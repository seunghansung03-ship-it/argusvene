import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Mic, MonitorPlay, Users } from "lucide-react";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useGeminiLive } from "@/hooks/use-gemini-live";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TranscriptPanel } from "@/components/room-core/transcript-panel";
import { WorkbenchPanel } from "@/components/room-core/workbench-panel";
import { OpsPanel } from "@/components/room-core/ops-panel";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type {
  PrototypeKind,
  RoomCommandMode,
  RoomCoreState,
  RoomNotice,
  SpeechLocale,
  StreamingAgentTurn,
  WorkbenchView,
} from "@/components/room-core/types";

function isKorean(locale: SpeechLocale) {
  return locale === "ko-KR" || (locale === "auto" && typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko"));
}

function commandPrompt(agent: AgentPersona | null, mode: RoomCommandMode, locale: SpeechLocale) {
  const target = agent ? `${agent.name}(${agent.role})` : "the room";
  if (isKorean(locale)) {
    return {
      align: `${target} 기준으로 지금 회의의 핵심 질문과 바로 다음 행동을 압축해줘.`,
      critique: `${target} 기준으로 가장 약한 가정과 먼저 깨질 지점을 짚어줘.`,
      research: `${target} 기준으로 외부 검증이 필요한 포인트를 조사 행동으로 바꿔줘.`,
      decide: `${target} 기준으로 지금 내려야 하는 결정을 하나로 좁혀줘.`,
    }[mode];
  }

  return {
    align: `From ${target}, compress the room around the core question and next move.`,
    critique: `From ${target}, name the weakest assumption and what breaks first.`,
    research: `From ${target}, turn the unknowns into concrete research actions.`,
    decide: `From ${target}, force the next decision now.`,
  }[mode];
}

export default function MeetingRoomCorePage() {
  const params = useParams<{ id: string }>();
  const meetingId = Number(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<RoomCoreState>({
    queryKey: ["/api/core/meetings", meetingId, "state"],
    queryFn: () => apiFetchJson(`/api/core/meetings/${meetingId}/state`),
    enabled: Number.isFinite(meetingId),
    refetchInterval: 5000,
  });

  const [room, setRoom] = useState<RoomCoreState | null>(null);
  const [streamingTurns, setStreamingTurns] = useState<StreamingAgentTurn[]>([]);
  const [mode, setMode] = useState<RoomCommandMode>("align");
  const [targetAgentId, setTargetAgentId] = useState<number | null>(null);
  const [speechLocale, setSpeechLocale] = useState<SpeechLocale>("auto");
  const [prototypeKind, setPrototypeKind] = useState<PrototypeKind>("software");
  const [prototypeObjective, setPrototypeObjective] = useState("");
  const [prototypeDraft, setPrototypeDraft] = useState("");
  const [runtimePreviewUrl, setRuntimePreviewUrl] = useState<string | null>(null);
  const [view, setView] = useState<WorkbenchView>("draft");
  const [notice, setNotice] = useState<RoomNotice | null>(null);
  const [sending, setSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingWorkOrder, setIsSavingWorkOrder] = useState(false);
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [liveDraft, setLiveDraft] = useState("");
  const activeTurnRef = useRef<AbortController | null>(null);
  const pendingVoiceTurnRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setRoom(data);
    setRuntimePreviewUrl(data.runtimePreviewUrl);
    if (data.runtimePreviewUrl && !runtimePreviewUrl) {
      setView("preview");
    }
    if (!prototypeObjective) {
      setPrototypeObjective(`Create the next concrete version of "${data.meeting.title}" so the room can inspect it now.`);
    }
    if (!prototypeDraft) {
      const latestDraft = data.recentArtifacts.find((artifact) =>
        ["software_prototype", "hardware_concept", "workflow_draft", "experiment_brief", "code"].includes(artifact.type),
      );
      if (latestDraft) {
        setPrototypeDraft(latestDraft.content);
      }
    }
  }, [data, prototypeDraft, prototypeObjective, runtimePreviewUrl]);

  useEffect(() => {
    if (!user?.uid || !meetingId) return;

    const heartbeat = () => {
      apiRequest("POST", `/api/core/meetings/${meetingId}/presence`, {
        displayName: user.displayName || user.email || "Participant",
        email: user.email,
      }).catch(() => {});
    };

    heartbeat();
    const id = window.setInterval(heartbeat, 10_000);
    return () => window.clearInterval(id);
  }, [meetingId, user?.displayName, user?.email, user?.uid]);

  useEffect(() => {
    if (!targetAgentId || !room) return;
    if (!room.activeAgentIds.includes(targetAgentId)) {
      setTargetAgentId(null);
    }
  }, [room, targetAgentId]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko")) {
      setSpeechLocale("ko-KR");
    }
  }, []);

  const activeAgents = useMemo(() => {
    if (!room) return [];
    const activeIds = new Set(room.activeAgentIds);
    return room.agents.filter((agent) => activeIds.has(agent.id));
  }, [room]);

  const flushPendingVoiceTurn = async () => {
    const pending = pendingVoiceTurnRef.current;
    if (!pending || sending) return;
    pendingVoiceTurnRef.current = null;
    await sendTurn(pending);
  };

  useEffect(() => {
    if (!sending) {
      flushPendingVoiceTurn().catch(() => {});
    }
  }, [sending]);

  const geminiLive = useGeminiLive({
    userId: user?.uid || null,
    languageHint: speechLocale,
    onTranscript: (text) => setLiveDraft(text),
    onTurnComplete: (text) => {
      setLiveDraft("");
      if (sending) {
        pendingVoiceTurnRef.current = text;
        return;
      }
      sendTurn(text).catch((err) => {
        const message = err instanceof Error ? err.message : "Could not send live turn.";
        setNotice({ tone: "error", message });
      });
    },
    onError: (message) => {
      setNotice({ tone: "error", message });
      toast({ title: "Gemini Live error", description: message, variant: "destructive" });
    },
  });

  const sendTurn = async (content: string) => {
    if (!room || !content.trim() || sending) return;

    const controller = new AbortController();
    activeTurnRef.current = controller;
    setSending(true);
    setStreamingTurns([]);
    setNotice({ tone: "neutral", message: "The room is processing the next turn." });

    try {
      await streamChat(
        `/api/core/meetings/${meetingId}/turn`,
        {
          content,
          senderName: user?.displayName || user?.email || "Founder",
          targetAgentId,
          mode,
        },
        (event) => {
          switch (event.type) {
            case "user_message":
              setRoom((current) => current ? { ...current, messages: [...current.messages, event.data] } : current);
              break;
            case "agent_start":
              setStreamingTurns((current) => [...current, { agentId: event.agentId, agentName: event.agentName, content: "" }]);
              break;
            case "agent_chunk":
              setStreamingTurns((current) => current.map((turn) => turn.agentId === event.agentId ? { ...turn, content: `${turn.content}${event.content || ""}` } : turn));
              break;
            case "agent_done":
              setStreamingTurns((current) => current.filter((turn) => turn.agentId !== event.agentId));
              setRoom((current) => current ? { ...current, messages: [...current.messages, event.data] } : current);
              break;
            case "action_result":
              if (event.message) {
                setRoom((current) => current ? { ...current, messages: [...current.messages, event.message] } : current);
              }
              if (event.action?.workOrder) {
                setRoom((current) => current ? { ...current, workOrder: event.action.workOrder } : current);
              }
              break;
            case "room_state":
              setRoom(event.room);
              setRuntimePreviewUrl(event.room?.runtimePreviewUrl || null);
              if (event.room?.runtimePreviewUrl) setView("preview");
              setNotice({ tone: "success", message: "Room state updated." });
              break;
            case "error":
              setNotice({ tone: "error", message: event.error || "Turn failed." });
              break;
            default:
              break;
          }
        },
        () => {
          setSending(false);
          setStreamingTurns([]);
          activeTurnRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
        },
        controller.signal,
      );
    } catch (error: any) {
      setSending(false);
      setStreamingTurns([]);
      activeTurnRef.current = null;
      const message = error.message || "Could not send the turn.";
      setNotice({ tone: "error", message });
      toast({ title: "Turn failed", description: message, variant: "destructive" });
    }
  };

  const stopTurn = () => {
    activeTurnRef.current?.abort();
    activeTurnRef.current = null;
    setSending(false);
    setStreamingTurns([]);
    setNotice({ tone: "neutral", message: "Turn interrupted." });
  };

  const generatePrototype = async (agentOverride?: Pick<AgentPersona, "name" | "role"> | null) => {
    if (!room || !prototypeObjective.trim() || isGenerating) return;
    setIsGenerating(true);
    setPrototypeDraft("");
    setView("draft");
    setNotice({ tone: "neutral", message: "Generating the next concrete draft." });

    try {
      await streamChat(
        `/api/meetings/${meetingId}/prototype-draft`,
        {
          kind: prototypeKind,
          objective: prototypeObjective,
          agentName: agentOverride?.name,
          agentRole: agentOverride?.role,
        },
        (event) => {
          if (event.type === "chunk" && event.content) {
            setPrototypeDraft((current) => `${current}${event.content}`);
          }
          if (event.type === "complete" && event.message) {
            setRoom((current) => current ? { ...current, messages: [...current.messages, event.message] } : current);
          }
          if (event.type === "error") {
            setNotice({ tone: "error", message: event.error || "Draft generation failed." });
          }
        },
        () => {
          setIsGenerating(false);
          setNotice({ tone: "success", message: "Draft generated. The room can inspect it now." });
          queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
        },
      );
    } catch (error: any) {
      setIsGenerating(false);
      const message = error.message || "Could not generate draft.";
      setNotice({ tone: "error", message });
      toast({ title: "Draft failed", description: message, variant: "destructive" });
    }
  };

  const launchRuntime = async () => {
    if (!room || !prototypeObjective.trim() || prototypeKind !== "software" || isLaunching) return;
    setIsLaunching(true);
    setNotice({ tone: "neutral", message: "Launching browser runtime for the current draft." });

    try {
      const response = await apiFetchJson<{ previewUrl: string; message?: MeetingMessage }>(`/api/meetings/${meetingId}/runtime-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: prototypeObjective,
          sourceDraft: prototypeDraft || undefined,
        }),
      });
      setRuntimePreviewUrl(response.previewUrl);
      setView("preview");
      const runtimeMessage = response.message;
      if (runtimeMessage) {
        setRoom((current) => current ? { ...current, messages: [...current.messages, runtimeMessage] } : current);
      }
      setNotice({ tone: "success", message: "Runtime preview launched." });
      queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
    } catch (error: any) {
      const message = error.message || "Could not launch preview.";
      setNotice({ tone: "error", message });
      toast({ title: "Preview failed", description: message, variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  };

  const toggleAgent = async (agent: AgentPersona) => {
    if (!room) return;
    const active = new Set(room.activeAgentIds);
    if (active.has(agent.id)) active.delete(agent.id);
    else active.add(agent.id);
    try {
      await apiRequest("PATCH", `/api/meetings/${meetingId}/agents`, { agentIds: [...active] });
      setRoom((current) => current ? { ...current, activeAgentIds: [...active] } : current);
      if (room.leadAgentId === agent.id && !active.has(agent.id)) {
        await setLeadAgent(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
    } catch (error: any) {
      toast({ title: "Agent update failed", description: error.message || "Could not update agent.", variant: "destructive" });
    }
  };

  const setLeadAgent = async (agentId: number | null) => {
    try {
      const nextState = await apiFetchJson<RoomCoreState>(`/api/core/meetings/${meetingId}/lead-agent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      setRoom(nextState);
      setNotice({ tone: "success", message: agentId ? "Lead agent updated." : "Lead agent cleared." });
    } catch (error: any) {
      toast({ title: "Lead update failed", description: error.message || "Could not update lead agent.", variant: "destructive" });
    }
  };

  const inviteHuman = async (email: string) => {
    try {
      await apiRequest("POST", `/api/workspaces/${room?.workspace?.id}/members`, { email });
      queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", room?.workspace?.id, "members"] });
      setNotice({ tone: "success", message: `Invited ${email} to the workspace.` });
    } catch (error: any) {
      const message = error.message || "Could not invite teammate.";
      setNotice({ tone: "error", message });
      toast({ title: "Invite failed", description: message, variant: "destructive" });
    }
  };

  const removeHuman = async (memberId: number) => {
    try {
      await apiRequest("DELETE", `/api/workspaces/${room?.workspace?.id}/members/${memberId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", room?.workspace?.id, "members"] });
      setNotice({ tone: "success", message: "Removed workspace member from room access." });
    } catch (error: any) {
      const message = error.message || "Could not remove teammate.";
      setNotice({ tone: "error", message });
      toast({ title: "Remove failed", description: message, variant: "destructive" });
    }
  };

  const saveWorkOrder = async (workOrder: string) => {
    setIsSavingWorkOrder(true);
    try {
      const nextState = await apiFetchJson<RoomCoreState>(`/api/core/meetings/${meetingId}/work-order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrder }),
      });
      setRoom(nextState);
      setNotice({ tone: "success", message: "Work order updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
    } catch (error: any) {
      const message = error.message || "Could not update work order.";
      setNotice({ tone: "error", message });
      toast({ title: "Work order failed", description: message, variant: "destructive" });
    } finally {
      setIsSavingWorkOrder(false);
    }
  };

  const endRoom = async () => {
    setIsEndingRoom(true);
    try {
      await apiRequest("PATCH", `/api/meetings/${meetingId}/status`, { status: "ended" });
      queryClient.invalidateQueries({ queryKey: ["/api/core/meetings", meetingId, "state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", room?.workspace?.id, "meetings"] });
      setLocation(room?.workspace ? `/workspace/${room.workspace.id}/outcomes` : "/");
    } catch (error: any) {
      const message = error.message || "Could not end room.";
      setNotice({ tone: "error", message });
      toast({ title: "End room failed", description: message, variant: "destructive" });
    } finally {
      setIsEndingRoom(false);
    }
  };

  const runCommand = async (agent: AgentPersona | null, nextMode: RoomCommandMode | "build") => {
    if (agent) setTargetAgentId(agent.id);
    if (nextMode === "build") {
      if (agent) {
        setPrototypeObjective(`${agent.name} should lead the next build pass as ${agent.role}. Produce something concrete enough to critique immediately.`);
      }
      await generatePrototype(agent ? { name: agent.name, role: agent.role } : null);
      return;
    }
    setMode(nextMode);
    await sendTurn(commandPrompt(agent, nextMode, speechLocale));
  };

  if (error) {
    const message = error instanceof Error ? error.message : "Could not load this meeting room.";
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">Room unavailable</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">The meeting room could not be loaded.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          <Link href="/">
            <Button className="mt-5">Back to organization home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !room) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <div className="grid gap-4 xl:grid-cols-[360px,minmax(0,1fr),360px]">
            <Skeleton className="h-[80vh] rounded-2xl" />
            <Skeleton className="h-[80vh] rounded-2xl" />
            <Skeleton className="h-[80vh] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-5 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={room.workspace ? `/workspace/${room.workspace.id}` : "/"}>
                <Button variant="ghost" size="sm" className="rounded-full px-3">
                  <ArrowLeft className="h-4 w-4" />
                  Workspace
                </Button>
              </Link>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">{room.workspace?.name || "Workspace"}</div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">voice {geminiLive.status}</div>
              {runtimePreviewUrl ? <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">preview ready</div> : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{room.meeting.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              <Users className="h-4 w-4" />
              {room.presence.length} present now
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              <Mic className="h-4 w-4" />
              {room.activeAgentIds.length} active agents
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              <MonitorPlay className="h-4 w-4" />
              {runtimePreviewUrl ? "preview live" : "preview idle"}
            </div>
            {room.workspace ? (
              <Link href={`/workspace/${room.workspace.id}/outcomes`}>
                <Button variant="outline" className="rounded-full">
                  Outcomes
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-6 py-4 xl:grid-cols-[340px,minmax(0,1fr),340px]">
        <div className="min-h-[80vh] xl:h-[calc(100vh-160px)]">
          <TranscriptPanel
            workOrder={room.workOrder}
            messages={room.messages}
            activeAgents={activeAgents}
            streamingTurns={streamingTurns}
            liveStatus={geminiLive.status}
            liveDraft={liveDraft}
            microphoneEnabled={geminiLive.microphoneEnabled}
            micLevel={geminiLive.micLevel}
            mode={mode}
            targetAgentId={targetAgentId}
            speechLocale={speechLocale}
            sending={sending}
            onModeChange={setMode}
            onTargetAgentChange={setTargetAgentId}
            onSpeechLocaleChange={setSpeechLocale}
            onToggleLive={() => {
              if (geminiLive.status === "disconnected") geminiLive.connect();
              else geminiLive.disconnect();
            }}
            onToggleMicrophone={geminiLive.toggleMicrophone}
            onSend={sendTurn}
            onStop={stopTurn}
          />
        </div>
        <div className="min-h-[80vh] xl:h-[calc(100vh-160px)]">
          <WorkbenchPanel
            room={room}
            view={view}
            prototypeKind={prototypeKind}
            prototypeObjective={prototypeObjective}
            prototypeDraft={prototypeDraft}
            runtimePreviewUrl={runtimePreviewUrl}
            notice={notice}
            isGenerating={isGenerating}
            isLaunching={isLaunching}
            onViewChange={setView}
            onPrototypeKindChange={setPrototypeKind}
            onPrototypeObjectiveChange={setPrototypeObjective}
            onGenerate={() => generatePrototype()}
            onLaunch={launchRuntime}
          />
        </div>
        <div className="min-h-[80vh] xl:h-[calc(100vh-160px)]">
          <OpsPanel
            room={room}
            mode={mode}
            targetAgentId={targetAgentId}
            busy={sending || isGenerating || isLaunching}
            savingWorkOrder={isSavingWorkOrder}
            endingRoom={isEndingRoom}
            onTargetAgent={setTargetAgentId}
            onModeChange={setMode}
            onToggleAgent={toggleAgent}
            onSetLeadAgent={setLeadAgent}
            onRunCommand={runCommand}
            onSaveWorkOrder={saveWorkOrder}
            onEndRoom={endRoom}
            onInviteHuman={inviteHuman}
            onRemoveHuman={removeHuman}
          />
        </div>
      </div>
    </div>
  );
}
