import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Mic, MonitorPlay, Users } from "lucide-react";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useGeminiLive, type GeminiLiveStatus } from "@/hooks/use-gemini-live";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TranscriptPane } from "@/components/room-v3/transcript-pane";
import { CanvasPane } from "@/components/room-v3/canvas-pane";
import { OperationsPane } from "@/components/room-v3/operations-pane";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type {
  CanvasView,
  PrototypeKind,
  RoomCommandMode,
  RoomV3Context,
  SpeechLocale,
  StreamingAgentTurn,
} from "@/components/room-v3/types";

function commandPrompt(agent: AgentPersona, mode: RoomCommandMode) {
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

export default function MeetingRoomV3() {
  const params = useParams<{ id: string }>();
  const meetingId = Number(params.id);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<RoomV3Context>({
    queryKey: ["/api/v2/meetings", meetingId, "room"],
    queryFn: () => apiFetchJson(`/api/v2/meetings/${meetingId}/room`),
  });

  const [room, setRoom] = useState<RoomV3Context | null>(null);
  const [streamingTurns, setStreamingTurns] = useState<StreamingAgentTurn[]>([]);
  const [mode, setMode] = useState<RoomCommandMode>("align");
  const [targetAgentId, setTargetAgentId] = useState<number | null>(null);
  const [speechLocale, setSpeechLocale] = useState<SpeechLocale>("auto");
  const [prototypeKind, setPrototypeKind] = useState<PrototypeKind>("software");
  const [prototypeObjective, setPrototypeObjective] = useState("");
  const [prototypeDraft, setPrototypeDraft] = useState("");
  const [canvasView, setCanvasView] = useState<CanvasView>("preview");
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
    setCanvasView(data.runtimePreviewUrl ? "preview" : "draft");
    if (!prototypeObjective) {
      setPrototypeObjective(`Build the first concrete version of "${data.meeting.title}" so the room can inspect and revise it immediately.`);
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
              if (event.room?.runtimePreviewUrl) setCanvasView("preview");
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
    setCanvasView("draft");

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
      setCanvasView("preview");
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
    if (active.has(agent.id)) active.delete(agent.id);
    else active.add(agent.id);

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

  const runCommand = async (agent: AgentPersona, nextMode: RoomCommandMode | "build") => {
    setTargetAgentId(agent.id);
    if (nextMode === "build") {
      setPrototypeObjective(`${agent.name}, lead the next build pass as ${agent.role}. Make something concrete the room can critique immediately.`);
      await generatePrototype(agent);
      return;
    }
    setMode(nextMode);
    await sendTurn(commandPrompt(agent, nextMode));
  };

  if (isLoading || !room) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] px-4 py-4 text-[#171614] md:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-4 rounded-[26px] border border-black/10 bg-white/80 px-5 py-4">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="mt-3 h-10 w-80 rounded-2xl" />
            <Skeleton className="mt-3 h-5 w-[32rem] rounded-full" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[320px,minmax(0,1fr),360px]">
            <Skeleton className="h-[78vh] rounded-[28px]" />
            <Skeleton className="h-[78vh] rounded-[28px]" />
            <Skeleton className="h-[78vh] rounded-[28px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171614]">
      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 lg:px-8">
        <header className="mb-4 rounded-[26px] border border-black/10 bg-white/80 px-5 py-4 shadow-[0_16px_60px_rgba(18,24,34,0.06)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={room.workspace ? `/workspace/${room.workspace.id}` : "/"}>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-[#625748] hover:bg-black/5 hover:text-[#171614]">
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Workspace
                  </Button>
                </Link>
                <Badge className="rounded-full border border-black/10 bg-[#171614] px-3 py-1 text-white">
                  {room.workspace?.name || "Workspace"}
                </Badge>
                <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#171614]">
                  {liveStatusLabel(geminiLive.status)}
                </Badge>
                {runtimePreviewUrl ? (
                  <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-emerald-800">
                    runtime live
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-3 text-[2.25rem] font-semibold tracking-[-0.04em] text-[#171614]">{room.meeting.title}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-[#625748]">
                Shared room, active agents, direct build loop. No chat app chrome.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#171614]">
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {room.members.length + 1} humans
                </Badge>
                <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#171614]">
                  <Mic className="mr-1.5 h-3.5 w-3.5" />
                  {room.activeAgentIds.length} active agents
                </Badge>
                <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#171614]">
                  <MonitorPlay className="mr-1.5 h-3.5 w-3.5" />
                  {runtimePreviewUrl ? "preview ready" : "preview idle"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(["align", "critique", "research", "decide"] as RoomCommandMode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm font-medium transition",
                      mode === value
                        ? "border-[#171614] bg-[#171614] text-[#f4f1ea]"
                        : "border-black/10 bg-white text-[#171614]",
                    )}
                    onClick={() => setMode(value)}
                  >
                    {value}
                  </button>
                ))}
                {room.workspace ? (
                  <Link href={`/workspace/${room.workspace.id}/outcomes`}>
                    <Button variant="outline" className="h-10 rounded-full border-black/10 bg-white px-4">
                      Outcomes
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[320px,minmax(0,1fr),360px]">
          <div className="min-h-[78vh] xl:h-[calc(100vh-146px)]">
            <TranscriptPane
              messages={room.messages}
              streamingTurns={streamingTurns}
              activeAgents={activeAgents}
              mode={mode}
              targetAgentId={targetAgentId}
              workOrder={room.workOrder}
              liveStatus={geminiLive.status}
              liveDraft={liveDraft}
              micLevel={geminiLive.micLevel}
              speechLocale={speechLocale}
              microphoneEnabled={geminiLive.microphoneEnabled}
              sending={sending}
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

          <div className="min-h-[78vh] xl:h-[calc(100vh-146px)]">
            <CanvasPane
              room={room}
              prototypeKind={prototypeKind}
              canvasView={canvasView}
              prototypeObjective={prototypeObjective}
              prototypeDraft={prototypeDraft}
              runtimePreviewUrl={runtimePreviewUrl}
              isGeneratingPrototype={isGeneratingPrototype}
              isLaunchingRuntime={isLaunchingRuntime}
              onPrototypeKindChange={setPrototypeKind}
              onCanvasViewChange={setCanvasView}
              onPrototypeObjectiveChange={setPrototypeObjective}
              onGeneratePrototype={() => generatePrototype()}
              onLaunchRuntime={launchRuntime}
            />
          </div>

          <div className="min-h-[78vh] xl:h-[calc(100vh-146px)]">
            <OperationsPane
              room={room}
              mode={mode}
              targetAgentId={targetAgentId}
              onTargetAgent={setTargetAgentId}
              onToggleAgent={toggleAgent}
              onCommand={runCommand}
              onInviteHuman={inviteHuman}
              onRemoveHuman={removeHuman}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
