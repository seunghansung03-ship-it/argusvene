import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { streamChat } from "@/lib/api";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useGeminiLive } from "@/hooks/use-gemini-live";
import { PageChrome } from "@/components/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { LiveRoomCanvas } from "@/components/live-room/live-room-canvas";
import { LiveRoomRoster } from "@/components/live-room/live-room-roster";
import { LiveRoomTranscript } from "@/components/live-room/live-room-transcript";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type { AgentCommandMode, HumanRosterEntry, PrototypeKind, RoomContext, RoomMode, SpeechLocale, StreamingTurn } from "@/components/live-room/types";

const roomModeLabels: Record<RoomMode, string> = {
  align: "Alignment",
  debate: "Debate",
  research: "Research",
  ship: "Ship",
};

export default function MeetingRoom() {
  const params = useParams<{ id: string }>();
  const meetingId = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: roomContext, isLoading } = useQuery<RoomContext>({
    queryKey: ["/api/meetings", meetingId, "room-context"],
    queryFn: () => apiFetchJson(`/api/meetings/${meetingId}/room-context`),
  });

  const { data: serverMessages } = useQuery<MeetingMessage[]>({
    queryKey: ["/api/meetings", meetingId, "messages"],
    queryFn: () => apiFetchJson(`/api/meetings/${meetingId}/messages`),
  });

  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [streamingTurns, setStreamingTurns] = useState<StreamingTurn[]>([]);
  const [targetAgentId, setTargetAgentId] = useState<number | null>(null);
  const [roomMode, setRoomMode] = useState<RoomMode>("align");
  const [speechLocale, setSpeechLocale] = useState<SpeechLocale>("auto");
  const [activeAgentIds, setActiveAgentIds] = useState<number[]>([]);
  const [canvas, setCanvas] = useState<RoomContext["canvas"] | null>(null);
  const [mermaid, setMermaid] = useState("");
  const [comparison, setComparison] = useState<RoomContext["comparison"]>(null);
  const [meetingStatus, setMeetingStatus] = useState("active");
  const [isSending, setIsSending] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isGeneratingPrototype, setIsGeneratingPrototype] = useState(false);
  const [isLaunchingRuntime, setIsLaunchingRuntime] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [prototypeDraft, setPrototypeDraft] = useState("");
  const [prototypeKind, setPrototypeKind] = useState<PrototypeKind>("software");
  const [prototypeObjective, setPrototypeObjective] = useState("");
  const [liveWorkOrder, setLiveWorkOrder] = useState("");
  const [runtimePreviewUrl, setRuntimePreviewUrl] = useState<string | null>(null);
  const [geminiLiveDraft, setGeminiLiveDraft] = useState("");
  const [pendingLiveReconnect, setPendingLiveReconnect] = useState(false);
  const pendingVoiceTurnRef = useRef<string | null>(null);
  const activeStreamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (serverMessages) setMessages(serverMessages);
  }, [serverMessages]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko")) {
      setSpeechLocale("ko-KR");
    }
  }, []);

  useEffect(() => {
    if (!roomContext) return;
    setCanvas(roomContext.canvas);
    setMermaid(roomContext.mermaid);
    setComparison(roomContext.comparison);
    setMeetingStatus(roomContext.meeting.status);
    setActiveAgentIds(roomContext.activeAgentIds);
  }, [roomContext]);

  useEffect(() => {
    if (!roomContext || prototypeObjective) return;
    setPrototypeObjective(`Turn "${roomContext.meeting.title}" into a concrete draft the room can critique immediately.`);
  }, [roomContext, prototypeObjective]);

  useEffect(() => {
    const latestRuntime = roomContext?.recentArtifacts.find((artifact) => artifact.type === "runtime_bundle");
    setRuntimePreviewUrl(latestRuntime ? `/preview/runtime/${latestRuntime.id}` : null);
  }, [roomContext]);

  const humanRoster = useMemo<HumanRosterEntry[]>(() => {
    const roster: HumanRosterEntry[] = [];
    if (user) {
      roster.push({
        id: user.uid,
        label: user.displayName || user.email || "Founder",
        detail: user.email || "Current operator",
        kind: "founder",
      });
    }
    for (const member of roomContext?.members || []) {
      roster.push({
        id: `member-${member.id}`,
        label: member.email,
        detail: `${member.role} · ${member.status}`,
        kind: "member",
        memberId: member.id,
      });
    }
    return roster;
  }, [roomContext?.members, user]);

  const flushPendingVoiceTurn = async () => {
    const pending = pendingVoiceTurnRef.current;
    if (!pending || isSending) return;
    pendingVoiceTurnRef.current = null;
    await sendMessage(pending);
  };

  useEffect(() => {
    if (!isSending) {
      flushPendingVoiceTurn().catch(() => {});
    }
  }, [isSending]);

  const geminiLive = useGeminiLive({
    userId: user?.uid || null,
    languageHint: speechLocale,
    onTranscript: (text) => setGeminiLiveDraft(text),
    onTurnComplete: (text) => {
      setGeminiLiveDraft("");
      if (isSending) {
        pendingVoiceTurnRef.current = text;
        return;
      }
      sendMessage(text).catch((error) => {
        toast({
          title: "Live turn failed",
          description: error instanceof Error ? error.message : "Gemini Live turn could not be sent.",
          variant: "destructive",
        });
      });
    },
    onError: (message) => {
      toast({ title: "Gemini Live error", description: message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (pendingLiveReconnect && geminiLive.status === "disconnected") {
      geminiLive.connect();
      setPendingLiveReconnect(false);
    }
  }, [geminiLive.connect, geminiLive.status, pendingLiveReconnect]);

  const agents = roomContext?.agents || [];

  const handleSpeechLocaleChange = (nextLocale: SpeechLocale) => {
    if (nextLocale === speechLocale) return;
    const liveWasConnected = geminiLive.status !== "disconnected";
    setSpeechLocale(nextLocale);
    if (liveWasConnected) {
      setPendingLiveReconnect(true);
      geminiLive.disconnect();
      toast({
        title: "Live language updated",
        description: nextLocale === "ko-KR" ? "Gemini Live is reconnecting with Korean priority." : nextLocale === "en-US" ? "Gemini Live is reconnecting with English priority." : "Gemini Live is reconnecting in auto language mode.",
      });
    }
  };

  const sendMessage = async (content: string, explicitTarget?: number | null) => {
    if (!content.trim() || isSending) return;

    const senderName = user?.displayName || user?.email || "Founder";
    const targetIds = explicitTarget ? [explicitTarget] : targetAgentId ? [targetAgentId] : undefined;
    const controller = new AbortController();
    let completed = false;
    activeStreamRef.current = controller;
    setIsSending(true);
    setStreamingTurns([]);

    try {
      await streamChat(
        `/api/meetings/${meetingId}/messages`,
        {
          content,
          senderName,
          targetAgentIds: targetIds,
        },
        (event) => {
          switch (event.type) {
            case "user_message":
              if (event.data) {
                setMessages((current) => [...current, event.data]);
              }
              break;
            case "agent_start":
              setStreamingTurns((current) => {
                if (current.find((turn) => turn.agentId === event.agentId)) return current;
                return [...current, { agentId: event.agentId, agentName: event.agentName, content: "" }];
              });
              break;
            case "agent_chunk":
              setStreamingTurns((current) =>
                current.map((turn) =>
                  turn.agentId === event.agentId ? { ...turn, content: `${turn.content}${event.content || ""}` } : turn,
                ),
              );
              break;
            case "agent_done":
              setStreamingTurns((current) => current.filter((turn) => turn.agentId !== event.agentId));
              if (event.data) {
                setMessages((current) => [...current, event.data]);
              }
              break;
            case "action_result":
              if (event.message) {
                setMessages((current) => [...current, event.message]);
              }
              if (event.action?.workOrder) {
                setLiveWorkOrder(event.action.workOrder);
              }
              if (event.action && event.action.success === false) {
                toast({
                  title: "Agent action failed",
                  description: event.action.message || "A room action could not be completed.",
                  variant: "destructive",
                });
              }
              break;
            case "worldstate_updated":
              setCanvas(event.canvas || null);
              setMermaid(event.mermaid || "");
              setComparison(event.comparison || null);
              break;
            case "interrupt":
              if (event.message) {
                setMessages((current) => [...current, event.message]);
              }
              break;
            case "error":
              toast({
                title: "Room response failed",
                description: event.error || "A room response failed while streaming.",
                variant: "destructive",
              });
              break;
            default:
              break;
          }
        },
        () => {
          completed = true;
          setIsSending(false);
          activeStreamRef.current = null;
          queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
        },
        controller.signal,
      );
    } catch (error: any) {
      toast({
        title: "Message failed",
        description: error.message || "Could not send this turn to the room.",
        variant: "destructive",
      });
    } finally {
      if (!completed && activeStreamRef.current === controller) {
        activeStreamRef.current = null;
        setIsSending(false);
        setStreamingTurns([]);
      }
    }
  };

  const stopStreaming = () => {
    activeStreamRef.current?.abort();
    activeStreamRef.current = null;
    setIsSending(false);
    setStreamingTurns([]);
  };

  const toggleAgent = async (agent: AgentPersona) => {
    const currentlyActive = activeAgentIds.includes(agent.id);
    if (currentlyActive && activeAgentIds.length === 1) {
      toast({
        title: "Keep one specialist active",
        description: "The room needs at least one active agent to remain operational.",
        variant: "destructive",
      });
      return;
    }

    const nextAgentIds = currentlyActive
      ? activeAgentIds.filter((id) => id !== agent.id)
      : [...activeAgentIds, agent.id];

    await apiRequest("PATCH", `/api/meetings/${meetingId}/agents`, { agentIds: nextAgentIds });
    setActiveAgentIds(nextAgentIds);
    if (currentlyActive && targetAgentId === agent.id) {
      setTargetAgentId(null);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
  };

  const inviteHuman = async (email: string) => {
    if (!roomContext) return;
    await apiRequest("POST", `/api/workspaces/${roomContext.workspace.id}/members`, { email });
    queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
  };

  const removeHuman = async (memberId: number) => {
    if (!roomContext) return;
    await apiRequest("DELETE", `/api/workspaces/${roomContext.workspace.id}/members/${memberId}`);
    queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
  };

  const generateCode = async () => {
    if (isGeneratingCode) return;
    setIsGeneratingCode(true);
    setGeneratedCode("");

    try {
      await streamChat(
        `/api/meetings/${meetingId}/generate-code`,
        {},
        (event) => {
          if (event.type === "chunk" && event.content) {
            setGeneratedCode((current) => `${current}${event.content}`);
          }
        },
        () => {
          setIsGeneratingCode(false);
          queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
        },
      );
    } catch (error: any) {
      setIsGeneratingCode(false);
      toast({
        title: "Code draft failed",
        description: error.message || "Could not generate code from the room.",
        variant: "destructive",
      });
    }
  };

  const generatePrototype = async (
    kindOverride?: PrototypeKind,
    objectiveOverride?: string,
    agentOverride?: Pick<AgentPersona, "name" | "role"> | null,
  ) => {
    const nextKind = kindOverride || prototypeKind;
    const nextObjective = (objectiveOverride || prototypeObjective || roomContext?.meeting.title || "").trim();

    if (!roomContext || !nextObjective || isGeneratingPrototype) return;

    setPrototypeKind(nextKind);
    setPrototypeObjective(nextObjective);
    setLiveWorkOrder(nextObjective);
    setIsGeneratingPrototype(true);
    setPrototypeDraft("");

    try {
      await streamChat(
        `/api/meetings/${meetingId}/prototype-draft`,
        {
          kind: nextKind,
          objective: nextObjective,
          agentName: agentOverride?.name,
          agentRole: agentOverride?.role,
        },
        (event) => {
          if (event.type === "chunk" && event.content) {
            setPrototypeDraft((current) => `${current}${event.content}`);
          }
          if (event.type === "complete" && event.message) {
            setMessages((current) => [...current, event.message]);
          }
        },
        () => {
          setIsGeneratingPrototype(false);
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", roomContext.workspace.id, "artifacts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
        },
      );
    } catch (error: any) {
      setIsGeneratingPrototype(false);
      toast({
        title: "Build draft failed",
        description: error.message || "Could not generate a room prototype draft.",
        variant: "destructive",
      });
    }
  };

  const launchRuntimePreview = async () => {
    if (!roomContext || prototypeKind !== "software" || isLaunchingRuntime) return;

    setIsLaunchingRuntime(true);
    try {
      const response = await apiFetchJson<{ previewUrl: string; message?: MeetingMessage }>(`/api/meetings/${meetingId}/runtime-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: prototypeObjective || roomContext.meeting.title,
          sourceDraft: prototypeDraft || undefined,
        }),
      });

      setRuntimePreviewUrl(response.previewUrl);
      if (response.message) {
        setMessages((current) => [...current, response.message!]);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", roomContext.workspace.id, "artifacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
    } catch (error: any) {
      toast({
        title: "Runtime launch failed",
        description: error.message || "Could not build a runnable preview from the current draft.",
        variant: "destructive",
      });
    } finally {
      setIsLaunchingRuntime(false);
    }
  };

  const inferPrototypeKindFromAgent = (agent: AgentPersona): PrototypeKind => {
    const role = `${agent.name} ${agent.role}`.toLowerCase();
    if (/(hardware|firmware|embedded|mechanical|electrical|industrial)/.test(role)) return "hardware";
    if (/(ops|operation|process|workflow|strategy|pm|program|go-to-market|gtm)/.test(role)) return "workflow";
    if (/(research|science|experiment|data|analytics|finance)/.test(role)) return "experiment";
    return "software";
  };

  const buildAgentCommandPrompt = (agent: AgentPersona, command: AgentCommandMode) => {
    switch (command) {
      case "build":
        return `${agent.name}, take point as ${agent.role} and produce something concrete the room can inspect immediately for "${roomContext?.meeting.title}". Make assumptions explicit and optimize for critique, not polish.`;
      case "critique":
        return `${agent.name}, critique the current direction hard as ${agent.role}. Call out the biggest flaws, weak assumptions, and what would break first.`;
      case "research":
        return `${agent.name}, from your ${agent.role} perspective, identify what we still need to verify externally and turn it into the sharpest research path for this room.`;
      case "decide":
      default:
        return `${agent.name}, act as the accountable ${agent.role} and force a decision. Recommend one direction, reject the weaker paths, and explain why now.`;
    }
  };

  const runAgentCommand = async (agent: AgentPersona, command: AgentCommandMode) => {
    if (!roomContext) return;

    const prompt = buildAgentCommandPrompt(agent, command);
    setTargetAgentId(agent.id);
    setLiveWorkOrder(prompt);

    if (command === "build") {
      const nextKind = inferPrototypeKindFromAgent(agent);
      setPrototypeKind(nextKind);
      setPrototypeObjective(prompt);
      await generatePrototype(nextKind, prompt, agent);
      return;
    }

    if (command === "research") {
      setRoomMode("research");
    } else if (command === "decide") {
      setRoomMode("ship");
    } else if (command === "critique") {
      setRoomMode("debate");
    }

    await sendMessage(prompt, agent.id);
  };

  const finalizeRoom = async () => {
    if (!roomContext || isFinalizing) return;
    setIsFinalizing(true);
    setGeneratedCode("");

    try {
      await streamChat(
        `/api/meetings/${meetingId}/summarize`,
        {},
        (event) => {
          if (event.type === "summary") {
            setMeetingStatus("ended");
          }
          if (event.type === "code_chunk" && event.content) {
            setGeneratedCode((current) => `${current}${event.content}`);
          }
        },
        () => {
          setIsFinalizing(false);
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", roomContext.workspace.id, "artifacts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", roomContext.workspace.id, "decisions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", roomContext.workspace.id, "tasks"] });
          queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "room-context"] });
          setLocation(`/workspace/${roomContext.workspace.id}/outcomes`);
        },
      );
    } catch (error: any) {
      setIsFinalizing(false);
      toast({
        title: "Room finalization failed",
        description: error.message || "Could not finalize outputs from this room.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !roomContext || !canvas) {
    return (
      <PageChrome eyebrow="Live Room" title="Loading room" description="Restoring the shared context for this meeting." fluid>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[72vh] rounded-3xl" />
          <Skeleton className="h-[72vh] rounded-3xl lg:col-span-1" />
          <Skeleton className="h-[72vh] rounded-3xl" />
        </div>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      eyebrow="Live Room"
      title={roomContext.meeting.title}
      description="Three panes only: transcript control, agent-driven canvas, and participant operations."
      badge={meetingStatus === "active" ? "Room Active" : "Room Ended"}
      backHref={`/workspace/${roomContext.workspace.id}`}
      fluid
      actions={
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(roomModeLabels) as RoomMode[]).map((mode) => (
              <Button
                key={mode}
                variant={roomMode === mode ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setRoomMode(mode)}
              >
                {roomModeLabels[mode]}
              </Button>
            ))}
          </div>
          <Link href={`/workspace/${roomContext.workspace.id}/outcomes`}>
            <Button variant="outline" className="gap-2">
              Outcomes
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {roomContext.workspace.name}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {activeAgentIds.length} active agents
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {humanRoster.length} humans
        </Badge>
        {geminiLive.status !== "disconnected" ? (
          <Badge className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Gemini Live {geminiLive.status}
          </Badge>
        ) : null}
        <Badge variant="outline" className="rounded-full px-3 py-1">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Center canvas accepts agent operations directly
        </Badge>
      </div>

      <div className="h-[calc(100vh-255px)] min-h-[720px] overflow-hidden rounded-[24px] border border-card-border">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={24} minSize={18}>
            <LiveRoomTranscript
              meetingStatus={meetingStatus}
              messages={messages}
              streamingTurns={streamingTurns}
              agents={agents}
              activeAgentIds={activeAgentIds}
              targetAgentId={targetAgentId}
              geminiLiveStatus={geminiLive.status}
              geminiLiveDraft={geminiLiveDraft}
              speechLocale={speechLocale}
              micLevel={geminiLive.micLevel}
              microphoneEnabled={geminiLive.microphoneEnabled}
              isSending={isSending}
              onSend={(content, explicitTarget) => sendMessage(content, explicitTarget)}
              onAbort={stopStreaming}
              onToggleLive={() => {
                if (geminiLive.status === "disconnected") {
                  geminiLive.connect();
                } else {
                  geminiLive.disconnect();
                }
              }}
              onToggleMicrophone={geminiLive.toggleMicrophone}
              onSpeechLocaleChange={handleSpeechLocaleChange}
              onClearTarget={() => setTargetAgentId(null)}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={52} minSize={38}>
            <LiveRoomCanvas
              canvas={canvas}
              liveWorkOrder={liveWorkOrder}
              mermaid={mermaid}
              comparison={comparison}
              userId={user?.uid || null}
              meetingStatus={meetingStatus}
              recentArtifacts={roomContext.recentArtifacts}
              recentDecisions={roomContext.recentDecisions}
              recentTasks={roomContext.recentTasks}
              generatedCode={generatedCode}
              prototypeDraft={prototypeDraft}
              prototypeKind={prototypeKind}
              prototypeObjective={prototypeObjective}
              runtimePreviewUrl={runtimePreviewUrl}
              isFinalizing={isFinalizing}
              isGeneratingCode={isGeneratingCode}
              isGeneratingPrototype={isGeneratingPrototype}
              isLaunchingRuntime={isLaunchingRuntime}
              onFinalizeRoom={finalizeRoom}
              onGenerateCode={generateCode}
              onPrototypeKindChange={setPrototypeKind}
              onPrototypeObjectiveChange={setPrototypeObjective}
              onGeneratePrototype={generatePrototype}
              onLaunchRuntime={launchRuntimePreview}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={24} minSize={18}>
            <LiveRoomRoster
              humans={humanRoster}
              agents={agents}
              activeAgentIds={activeAgentIds}
              targetAgentId={targetAgentId}
              roomMode={roomMode}
              liveWorkOrder={liveWorkOrder}
              geminiLiveStatus={geminiLive.status}
              onInviteHuman={inviteHuman}
              onRemoveHuman={removeHuman}
              onToggleAgent={toggleAgent}
              onAddressAgent={setTargetAgentId}
              onRunAgentCommand={runAgentCommand}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </PageChrome>
  );
}
