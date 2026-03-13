import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Mic, MonitorPlay, Users } from "lucide-react";
import { Link, useParams } from "wouter";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useGeminiLive, type GeminiLiveStatus } from "@/hooks/use-gemini-live";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TranscriptLane } from "@/components/room-v4/transcript-lane";
import { WorkbenchPane } from "@/components/room-v4/workbench-pane";
import { OperatorRail } from "@/components/room-v4/operator-rail";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type {
  PrototypeKind,
  RoomCommandMode,
  RoomNotice,
  RoomV4Context,
  SpeechLocale,
  StreamingAgentTurn,
  WorkbenchView,
} from "@/components/room-v4/types";

function isKorean(locale: SpeechLocale) {
  return locale === "ko-KR" || (locale === "auto" && typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko"));
}

function commandPrompt(agent: AgentPersona | null, mode: RoomCommandMode, locale: SpeechLocale) {
  const target = agent ? `${agent.name}(${agent.role})` : "the room";
  if (isKorean(locale)) {
    switch (mode) {
      case "critique":
        return `${target} 기준으로 지금 방향의 가장 약한 가정과 바로 깨질 지점을 짚어줘.`;
      case "research":
        return `${target} 기준으로 외부 검증이 필요한 포인트를 연구 행동으로 바꿔줘.`;
      case "decide":
        return `${target} 기준으로 지금 당장 내려야 하는 결정을 하나로 좁혀줘.`;
      case "align":
      default:
        return `${target} 기준으로 지금 회의의 핵심 질문과 바로 다음 행동을 압축해줘.`;
    }
  }

  switch (mode) {
    case "critique":
      return `From ${target}, name the weakest assumption and what breaks first.`;
    case "research":
      return `From ${target}, turn the open unknowns into concrete research moves.`;
    case "decide":
      return `From ${target}, force the next decision now and reject the weaker path.`;
    case "align":
    default:
      return `From ${target}, compress the room around the core question and immediate next action.`;
  }
}

function liveStatusLabel(status: GeminiLiveStatus) {
  switch (status) {
    case "connecting":
      return "voice connecting";
    case "connected":
      return "voice ready";
    case "listening":
      return "voice listening";
    case "speaking":
      return "voice speaking";
    case "disconnected":
    default:
      return "voice idle";
  }
}

export default function MeetingRoomV4() {
  const params = useParams<{ id: string }>();
  const meetingId = Number(params.id);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<RoomV4Context>({
    queryKey: ["/api/v2/meetings", meetingId, "room"],
    queryFn: () => apiFetchJson(`/api/v2/meetings/${meetingId}/room`),
    enabled: Number.isFinite(meetingId),
    refetchInterval: 4000,
  });

  const [room, setRoom] = useState<RoomV4Context | null>(null);
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
  const [isGeneratingPrototype, setIsGeneratingPrototype] = useState(false);
  const [isLaunchingRuntime, setIsLaunchingRuntime] = useState(false);
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
    if (!targetAgentId) return;
    if (!room) return;
    const stillActive = room.activeAgentIds.includes(targetAgentId);
    if (!stillActive) {
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
      sendTurn(text).catch((error) => {
        const message = error instanceof Error ? error.message : "Could not send the live turn.";
        setNotice({ tone: "error", message });
        toast({ title: "Live turn failed", description: message, variant: "destructive" });
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
    setNotice({ tone: "neutral", message: "Room is processing the next turn." });

    try {
      await streamChat(
        `/api/v2/meetings/${meetingId}/turn`,
        {
          content,
          senderName: user?.displayName || user?.email || "Founder",
          targetAgentId: targetAgentId || undefined,
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
              setStreamingTurns((current) =>
                current.map((turn) => turn.agentId === event.agentId ? { ...turn, content: `${turn.content}${event.content || ""}` } : turn),
              );
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
              if (Array.isArray(event.operations) && event.operations.length > 0) {
                const lead = event.operations[0];
                setNotice({ tone: "success", message: `${lead.actor} moved the room: ${lead.summary}` });
              } else {
                setNotice({ tone: "success", message: "Turn processed successfully." });
              }
              break;
            case "error":
              setNotice({ tone: "error", message: event.error || "The room failed to process that turn." });
              toast({
                title: "Turn failed",
                description: event.error || "The room failed to process that turn.",
                variant: "destructive",
              });
              break;
            default:
              break;
          }
        },
        () => {
          setSending(false);
          setStreamingTurns([]);
          activeTurnRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
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
    if (!room || isGeneratingPrototype || !prototypeObjective.trim()) return;
    setIsGeneratingPrototype(true);
    setPrototypeDraft("");
    setView("draft");
    setNotice({ tone: "neutral", message: "Generating the next concrete draft for the room." });

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
            setNotice({ tone: "success", message: "Draft generated. The room can now inspect and challenge it." });
          }
          if (event.type === "error") {
            setNotice({ tone: "error", message: event.error || "Prototype draft failed." });
          }
        },
        () => {
          setIsGeneratingPrototype(false);
          queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
        },
      );
    } catch (error: any) {
      setIsGeneratingPrototype(false);
      const message = error.message || "Could not generate a prototype draft.";
      setNotice({ tone: "error", message });
      toast({ title: "Draft failed", description: message, variant: "destructive" });
    }
  };

  const launchRuntime = async () => {
    if (!room || isLaunchingRuntime || !prototypeObjective.trim() || prototypeKind !== "software") return;
    setIsLaunchingRuntime(true);
    setNotice({ tone: "neutral", message: "Launching a live browser runtime for the current draft." });

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
      setNotice({ tone: "success", message: "Runtime launched. Inspect the live preview in the workbench." });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
    } catch (error: any) {
      const message = error.message || "Could not launch a runnable preview.";
      setNotice({ tone: "error", message });
      toast({ title: "Runtime launch failed", description: message, variant: "destructive" });
    } finally {
      setIsLaunchingRuntime(false);
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
      if (!active.has(targetAgentId || -1) && targetAgentId === agent.id) {
        setTargetAgentId(null);
      }
      setNotice({ tone: "success", message: `${agent.name} is now ${active.has(agent.id) ? "active" : "offline"} in the room.` });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
    } catch (error: any) {
      const message = error.message || "Could not update room agents.";
      setNotice({ tone: "error", message });
      toast({ title: "Agent update failed", description: message, variant: "destructive" });
    }
  };

  const inviteHuman = async (email: string) => {
    if (!room?.workspace) return;
    try {
      await apiRequest("POST", `/api/workspaces/${room.workspace.id}/members`, { email });
      setNotice({ tone: "success", message: `${email} has been invited to the workspace.` });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
    } catch (error: any) {
      const message = error.message || "Could not invite workspace member.";
      setNotice({ tone: "error", message });
      toast({ title: "Invite failed", description: message, variant: "destructive" });
    }
  };

  const removeHuman = async (memberId: number) => {
    if (!room?.workspace) return;
    try {
      await apiRequest("DELETE", `/api/workspaces/${room.workspace.id}/members/${memberId}`);
      setNotice({ tone: "success", message: "Member removed from workspace access." });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
    } catch (error: any) {
      const message = error.message || "Could not remove workspace member.";
      setNotice({ tone: "error", message });
      toast({ title: "Remove failed", description: message, variant: "destructive" });
    }
  };

  const runCommand = async (agent: AgentPersona | null, nextMode: RoomCommandMode | "build") => {
    if (agent) {
      setTargetAgentId(agent.id);
    }
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

  if (isLoading || !room) {
    if (error) {
      const message = error instanceof Error ? error.message : "Could not load this meeting room.";
      return (
        <div className="min-h-screen bg-[#f3f4f6] px-4 py-4 text-slate-950 md:px-6 lg:px-8">
          <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
            <div className="w-full rounded-2xl border border-rose-200 bg-white px-6 py-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">Room unavailable</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">The meeting room could not be loaded.</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
              <div className="mt-5">
                <Link href="/">
                  <Button>Back to organization home</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f3f4f6] px-4 py-4 text-slate-950 md:px-6 lg:px-8">
        <div className="mx-auto max-w-[1680px] space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <div className="grid gap-4 xl:grid-cols-[360px,minmax(0,1fr),340px]">
            <Skeleton className="h-[80vh] rounded-2xl" />
            <Skeleton className="h-[80vh] rounded-2xl" />
            <Skeleton className="h-[80vh] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-950">
      <div className="mx-auto max-w-[1680px] px-4 py-4 md:px-6 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={room.workspace ? `/workspace/${room.workspace.id}` : "/"}>
                  <Button variant="ghost" size="sm" className="rounded-full px-3">
                    <ArrowLeft className="h-4 w-4" />
                    Workspace
                  </Button>
                </Link>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {room.workspace?.name || "Workspace"}
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {liveStatusLabel(geminiLive.status)}
                </div>
                {runtimePreviewUrl ? (
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    runtime live
                  </div>
                ) : null}
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{room.meeting.title}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                A shared operating room for live conversation, active agents, and direct build-review-revise loops.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                <Users className="h-4 w-4" />
                {room.members.length + 1} humans
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                <Mic className="h-4 w-4" />
                {room.activeAgentIds.length} active agents
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                <MonitorPlay className="h-4 w-4" />
                {runtimePreviewUrl ? "preview ready" : "preview idle"}
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
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[360px,minmax(0,1fr),340px]">
          <div className="min-h-[80vh] xl:h-[calc(100vh-160px)]">
            <TranscriptLane
              workOrder={room.workOrder}
              messages={room.messages}
              streamingTurns={streamingTurns}
              activeAgents={activeAgents}
              mode={mode}
              targetAgentId={targetAgentId}
              liveStatus={geminiLive.status}
              liveDraft={liveDraft}
              micLevel={geminiLive.micLevel}
              speechLocale={speechLocale}
              microphoneEnabled={geminiLive.microphoneEnabled}
              sending={sending}
              onModeChange={setMode}
              onTargetAgentChange={setTargetAgentId}
              onSend={sendTurn}
              onStop={stopTurn}
              onToggleLive={() => {
                if (geminiLive.status === "disconnected") geminiLive.connect();
                else geminiLive.disconnect();
              }}
              onToggleMicrophone={geminiLive.toggleMicrophone}
              onSpeechLocaleChange={setSpeechLocale}
            />
          </div>

          <div className="min-h-[80vh] xl:h-[calc(100vh-160px)]">
            <WorkbenchPane
              room={room}
              prototypeKind={prototypeKind}
              prototypeObjective={prototypeObjective}
              prototypeDraft={prototypeDraft}
              runtimePreviewUrl={runtimePreviewUrl}
              view={view}
              isGeneratingPrototype={isGeneratingPrototype}
              isLaunchingRuntime={isLaunchingRuntime}
              notice={notice}
              onPrototypeKindChange={setPrototypeKind}
              onPrototypeObjectiveChange={setPrototypeObjective}
              onGeneratePrototype={() => generatePrototype()}
              onLaunchRuntime={launchRuntime}
              onViewChange={setView}
            />
          </div>

          <div className="min-h-[80vh] xl:h-[calc(100vh-160px)]">
            <OperatorRail
              room={room}
              targetAgentId={targetAgentId}
              mode={mode}
              busy={sending || isGeneratingPrototype || isLaunchingRuntime}
              onTargetAgent={setTargetAgentId}
              onModeChange={setMode}
              onToggleAgent={toggleAgent}
              onRunCommand={runCommand}
              onInviteHuman={inviteHuman}
              onRemoveHuman={removeHuman}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
