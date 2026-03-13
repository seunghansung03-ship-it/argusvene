import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  MonitorPlay,
  Radar,
  Users,
} from "lucide-react";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useGeminiLive, type GeminiLiveStatus } from "@/hooks/use-gemini-live";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TranscriptColumn } from "@/components/room-v2/transcript-column";
import { CanvasColumn } from "@/components/room-v2/canvas-column";
import { RosterColumn } from "@/components/room-v2/roster-column";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type { RoomV2Context, RoomV2Mode, StreamingAgentTurn } from "@/components/room-v2/types";

type SpeechLocale = "auto" | "ko-KR" | "en-US";
type PrototypeKind = "software" | "hardware" | "workflow" | "experiment";

function commandPrompt(agent: AgentPersona, mode: RoomV2Mode) {
  switch (mode) {
    case "critique":
      return `${agent.name}, critique the current direction hard as ${agent.role}. Be specific about what breaks first.`;
    case "research":
      return `${agent.name}, identify the external facts we still need and turn them into sharp research moves.`;
    case "decide":
      return `${agent.name}, make the decision call now. Choose one path, reject the weaker ones, and explain why.`;
    case "align":
    default:
      return `${agent.name}, align the room around the single most important question and what must happen next.`;
  }
}

function liveStatusMeta(status: GeminiLiveStatus) {
  switch (status) {
    case "connecting":
      return {
        label: "Connecting audio lane",
        detail: "Opening the Gemini Live session and priming the mic.",
        badgeClassName: "bg-amber-500/15 text-amber-800 border-amber-400/30",
      };
    case "connected":
      return {
        label: "Live session ready",
        detail: "The room is connected and waiting for the next turn.",
        badgeClassName: "bg-sky-500/15 text-sky-800 border-sky-400/30",
      };
    case "speaking":
      return {
        label: "Agent is speaking",
        detail: "Audio is actively coming back from Gemini Live.",
        badgeClassName: "bg-emerald-500/15 text-emerald-800 border-emerald-400/30",
      };
    case "listening":
      return {
        label: "Listening live",
        detail: "The room is listening for the next spoken turn.",
        badgeClassName: "bg-violet-500/15 text-violet-800 border-violet-400/30",
      };
    case "disconnected":
    default:
      return {
        label: "Voice lane idle",
        detail: "Transcript still works, but live audio is currently off.",
        badgeClassName: "bg-slate-500/15 text-slate-700 border-slate-400/30",
      };
  }
}

function modeCopy(mode: RoomV2Mode) {
  switch (mode) {
    case "critique":
      return "Pressure-test";
    case "research":
      return "Research";
    case "decide":
      return "Decide";
    case "align":
    default:
      return "Align";
  }
}

function roomMetricCard(
  icon: JSX.Element,
  label: string,
  title: string,
  description: string,
  toneClassName: string,
) {
  return (
    <div className="rounded-[26px] border border-black/10 bg-white/70 p-4 shadow-[0_24px_80px_rgba(18,24,34,0.08)] backdrop-blur">
      <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl", toneClassName)}>
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d6d5c]">{label}</p>
      <p className="mt-2 text-base font-semibold tracking-tight text-[#15212b]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#625748]">{description}</p>
    </div>
  );
}

export default function MeetingRoomV2() {
  const params = useParams<{ id: string }>();
  const meetingId = Number(params.id);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<RoomV2Context>({
    queryKey: ["/api/v2/meetings", meetingId, "room"],
    queryFn: () => apiFetchJson(`/api/v2/meetings/${meetingId}/room`),
  });

  const [room, setRoom] = useState<RoomV2Context | null>(null);
  const [streamingTurns, setStreamingTurns] = useState<StreamingAgentTurn[]>([]);
  const [currentMode, setCurrentMode] = useState<RoomV2Mode>("align");
  const [targetAgentId, setTargetAgentId] = useState<number | null>(null);
  const [speechLocale, setSpeechLocale] = useState<SpeechLocale>("auto");
  const [prototypeKind, setPrototypeKind] = useState<PrototypeKind>("software");
  const [prototypeObjective, setPrototypeObjective] = useState("");
  const [prototypeDraft, setPrototypeDraft] = useState("");
  const [runtimePreviewUrl, setRuntimePreviewUrl] = useState<string | null>(null);
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
    if (!prototypeObjective) {
      setPrototypeObjective(`Build the first concrete version of "${data.meeting.title}" so the room can critique it immediately.`);
    }
  }, [data, prototypeObjective]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko")) {
      setSpeechLocale("ko-KR");
    }
  }, []);

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
        toast({
          title: "Live turn failed",
          description: error instanceof Error ? error.message : "Could not send the live turn.",
          variant: "destructive",
        });
      });
    },
    onError: (message) => toast({ title: "Gemini Live error", description: message, variant: "destructive" }),
  });

  const activeAgents = useMemo(() => {
    if (!room) return [];
    const activeIds = new Set(room.activeAgentIds);
    return room.agents.filter((agent) => activeIds.has(agent.id));
  }, [room]);

  const selectedAgent = useMemo(() => {
    if (!room || !targetAgentId) return null;
    return room.agents.find((agent) => agent.id === targetAgentId) || null;
  }, [room, targetAgentId]);

  const sendTurn = async (content: string) => {
    if (!room || !content.trim() || sending) return;

    const controller = new AbortController();
    activeTurnRef.current = controller;
    setSending(true);
    setStreamingTurns([]);

    try {
      await streamChat(
        `/api/v2/meetings/${meetingId}/turn`,
        {
          content,
          senderName: user?.displayName || user?.email || "Founder",
          targetAgentId: targetAgentId || undefined,
          mode: currentMode,
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
              break;
            case "error":
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
      toast({
        title: "Turn failed",
        description: error.message || "Could not send the turn.",
        variant: "destructive",
      });
    }
  };

  const stopTurn = () => {
    activeTurnRef.current?.abort();
    activeTurnRef.current = null;
    setSending(false);
    setStreamingTurns([]);
  };

  const generatePrototype = async (agentOverride?: Pick<AgentPersona, "name" | "role"> | null) => {
    if (!room || isGeneratingPrototype || !prototypeObjective.trim()) return;

    setIsGeneratingPrototype(true);
    setPrototypeDraft("");

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
        },
        () => {
          setIsGeneratingPrototype(false);
          queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
        },
      );
    } catch (error: any) {
      setIsGeneratingPrototype(false);
      toast({
        title: "Draft failed",
        description: error.message || "Could not generate a prototype draft.",
        variant: "destructive",
      });
    }
  };

  const launchRuntime = async () => {
    if (!room || isLaunchingRuntime || !prototypeObjective.trim() || prototypeKind !== "software") return;
    setIsLaunchingRuntime(true);

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
      const runtimeMessage = response.message;
      if (runtimeMessage) {
        setRoom((current) => current ? { ...current, messages: [...current.messages, runtimeMessage] } : current);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
    } catch (error: any) {
      toast({
        title: "Runtime launch failed",
        description: error.message || "Could not launch a runnable preview.",
        variant: "destructive",
      });
    } finally {
      setIsLaunchingRuntime(false);
    }
  };

  const toggleAgent = async (agent: AgentPersona) => {
    if (!room) return;
    const active = new Set(room.activeAgentIds);
    if (active.has(agent.id)) {
      active.delete(agent.id);
    } else {
      active.add(agent.id);
    }
    await apiRequest("PATCH", `/api/meetings/${meetingId}/agents`, { agentIds: [...active] });
    queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
    setRoom((current) => current ? { ...current, activeAgentIds: [...active] } : current);
  };

  const inviteHuman = async (email: string) => {
    if (!room?.workspace) return;
    await apiRequest("POST", `/api/workspaces/${room.workspace.id}/members`, { email });
    queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
  };

  const removeHuman = async (memberId: number) => {
    if (!room?.workspace) return;
    await apiRequest("DELETE", `/api/workspaces/${room.workspace.id}/members/${memberId}`);
    queryClient.invalidateQueries({ queryKey: ["/api/v2/meetings", meetingId, "room"] });
  };

  const runCommand = async (agent: AgentPersona, mode: RoomV2Mode | "build") => {
    setTargetAgentId(agent.id);
    if (mode === "build") {
      setPrototypeObjective(`${agent.name}, lead the build pass as ${agent.role}. Create something concrete the room can inspect and revise immediately.`);
      await generatePrototype(agent);
      return;
    }
    setCurrentMode(mode);
    await sendTurn(commandPrompt(agent, mode));
  };

  if (isLoading || !room) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#efe8dc_0%,#f8f4ed_42%,#eef3f6_100%)] px-4 py-4 text-[#15212b] md:px-6 lg:px-8">
        <div className="mb-4 rounded-[30px] border border-black/10 bg-white/70 p-5 shadow-[0_32px_120px_rgba(18,24,34,0.08)]">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="mt-4 h-12 w-[28rem] rounded-2xl" />
          <Skeleton className="mt-3 h-5 w-[38rem] rounded-full" />
        </div>
        <div className="mb-4 grid gap-3 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-[28px]" />
          <Skeleton className="h-32 rounded-[28px]" />
          <Skeleton className="h-32 rounded-[28px]" />
          <Skeleton className="h-32 rounded-[28px]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr,1fr]">
          <Skeleton className="h-[72vh] rounded-[32px]" />
          <Skeleton className="h-[72vh] rounded-[32px]" />
          <Skeleton className="h-[72vh] rounded-[32px]" />
        </div>
      </div>
    );
  }

  const liveMeta = liveStatusMeta(geminiLive.status);
  const humanCount = room.members.length + 1;
  const runtimeReady = Boolean(runtimePreviewUrl);

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#efe8dc_0%,#f8f4ed_40%,#edf2f6_100%)] text-[#15212b]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-14rem] h-[28rem] w-[28rem] rounded-full bg-[#f08b5b]/14 blur-3xl" />
        <div className="absolute right-[-10rem] top-[5rem] h-[24rem] w-[24rem] rounded-full bg-[#84a8c2]/18 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[28%] h-[22rem] w-[22rem] rounded-full bg-[#d8c7a8]/20 blur-3xl" />
      </div>

      <div className="relative px-4 py-4 md:px-6 lg:px-8">
        <div className="mb-4 rounded-[32px] border border-black/10 bg-white/72 p-4 shadow-[0_32px_120px_rgba(18,24,34,0.10)] backdrop-blur xl:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <Link href={room.workspace ? `/workspace/${room.workspace.id}` : "/"}>
                <Button variant="ghost" size="sm" className="mt-1 h-9 rounded-full px-3 text-[#55626d] hover:bg-black/5 hover:text-[#15212b]">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Workspace
                </Button>
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-black/10 bg-[#15212b] px-3 py-1 text-white">
                    {room.workspace?.name || "Workspace"}
                  </Badge>
                  <Badge className="rounded-full border border-black/10 bg-[#f4ede1] px-3 py-1 text-[#15212b]">
                    Live meeting room
                  </Badge>
                  {runtimeReady ? (
                    <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-emerald-800">
                      Runtime online
                    </Badge>
                  ) : null}
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#15212b] md:text-[2.6rem]">
                  {room.meeting.title}
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[#625748] md:text-[15px]">
                  This room is for one thing: talk naturally, build in the middle, and let people plus agents push the work forward without losing the thread.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:min-w-[22rem] xl:items-end">
              <div className="inline-flex flex-wrap rounded-full border border-black/10 bg-[#15212b]/5 p-1">
                {(["align", "critique", "research", "decide"] as RoomV2Mode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant="ghost"
                    className={cn(
                      "h-9 rounded-full px-4 text-sm font-medium",
                      currentMode === mode
                        ? "bg-[#15212b] text-white hover:bg-[#0d141b] hover:text-white"
                        : "text-[#4f5c66] hover:bg-white/80 hover:text-[#15212b]",
                    )}
                    onClick={() => setCurrentMode(mode)}
                  >
                    {modeCopy(mode)}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("rounded-full border px-3 py-1 text-[12px]", liveMeta.badgeClassName)}>
                  {liveMeta.label}
                </Badge>
                <Badge className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[#15212b]">
                  {selectedAgent ? `Directing ${selectedAgent.name}` : "Room-wide turn routing"}
                </Badge>
                {room.workspace ? (
                  <Link href={`/workspace/${room.workspace.id}/outcomes`}>
                    <Button variant="outline" className="h-10 rounded-full border-black/10 bg-white/80 px-4 text-[#15212b] hover:bg-white">
                      Outcomes
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {roomMetricCard(
            <Mic className="h-5 w-5 text-[#8b451f]" />,
            "Voice lane",
            liveMeta.label,
            liveMeta.detail,
            "bg-[#f08b5b]/16 text-[#8b451f]",
          )}
          {roomMetricCard(
            <Radar className="h-5 w-5 text-[#7e5518]" />,
            "Work order",
            room.workOrder,
            "This is the active question the room should be moving toward right now.",
            "bg-[#d8c7a8]/22 text-[#7e5518]",
          )}
          {roomMetricCard(
            <Users className="h-5 w-5 text-[#1f4f71]" />,
            "Roster",
            `${humanCount} humans · ${activeAgents.length} active agents`,
            selectedAgent ? `${selectedAgent.name} is the current direct operator.` : "No direct operator is pinned right now.",
            "bg-[#84a8c2]/18 text-[#1f4f71]",
          )}
          {roomMetricCard(
            <MonitorPlay className="h-5 w-5 text-[#0f6a56]" />,
            "Canvas output",
            runtimeReady ? "Interactive preview is live" : "No live preview yet",
            runtimeReady
              ? "The center canvas already has something concrete the room can click through."
              : "Generate and launch a software draft to get a clickable preview here.",
            runtimeReady ? "bg-emerald-500/16 text-[#0f6a56]" : "bg-slate-200 text-[#475569]",
          )}
        </div>

        <div className="h-[calc(100vh-318px)] min-h-[780px] overflow-hidden rounded-[34px] border border-black/10 bg-white/55 shadow-[0_40px_140px_rgba(18,24,34,0.12)] backdrop-blur">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={24} minSize={19}>
              <TranscriptColumn
                messages={room.messages}
                streamingTurns={streamingTurns}
                activeAgents={activeAgents}
                currentMode={currentMode}
                targetAgentId={targetAgentId}
                sending={sending}
                liveStatus={geminiLive.status}
                liveDraft={liveDraft}
                micLevel={geminiLive.micLevel}
                microphoneEnabled={geminiLive.microphoneEnabled}
                speechLocale={speechLocale}
                workOrder={room.workOrder}
                onSend={sendTurn}
                onStop={stopTurn}
                onToggleLive={() => {
                  if (geminiLive.status === "disconnected") geminiLive.connect();
                  else geminiLive.disconnect();
                }}
                onToggleMicrophone={geminiLive.toggleMicrophone}
                onSpeechLocaleChange={setSpeechLocale}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={52} minSize={40}>
              <CanvasColumn
                room={room}
                prototypeKind={prototypeKind}
                prototypeObjective={prototypeObjective}
                prototypeDraft={prototypeDraft}
                runtimePreviewUrl={runtimePreviewUrl}
                isGeneratingPrototype={isGeneratingPrototype}
                isLaunchingRuntime={isLaunchingRuntime}
                activeAgentCount={activeAgents.length}
                onPrototypeKindChange={setPrototypeKind}
                onPrototypeObjectiveChange={setPrototypeObjective}
                onGeneratePrototype={() => generatePrototype()}
                onLaunchRuntime={launchRuntime}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={24} minSize={19}>
              <RosterColumn
                room={room}
                targetAgentId={targetAgentId}
                currentMode={currentMode}
                onToggleAgent={toggleAgent}
                onTargetAgent={setTargetAgentId}
                onCommand={runCommand}
                onInviteHuman={inviteHuman}
                onRemoveHuman={removeHuman}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
