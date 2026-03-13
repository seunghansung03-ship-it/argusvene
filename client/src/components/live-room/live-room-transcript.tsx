import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  Send,
  Sparkles,
  StopCircle,
  Volume2,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AgentAvatar } from "@/components/agent-avatar";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type { GeminiLiveStatus } from "@/hooks/use-gemini-live";
import type { SpeechLocale, StreamingTurn } from "./types";

interface LiveRoomTranscriptProps {
  meetingStatus: string;
  messages: MeetingMessage[];
  streamingTurns: StreamingTurn[];
  agents: AgentPersona[];
  activeAgentIds: number[];
  targetAgentId: number | null;
  geminiLiveStatus: GeminiLiveStatus;
  geminiLiveDraft: string;
  speechLocale: SpeechLocale;
  micLevel: number;
  microphoneEnabled: boolean;
  isSending: boolean;
  onSend: (content: string, targetAgentId?: number | null) => void;
  onAbort: () => void;
  onToggleLive: () => void;
  onToggleMicrophone: () => void;
  onSpeechLocaleChange: (locale: SpeechLocale) => void;
  onClearTarget: () => void;
}

function getPromptPresets(locale: SpeechLocale) {
  const prefersKorean =
    locale === "ko-KR" || (locale === "auto" && typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko"));

  if (prefersKorean) {
    return [
      {
        id: "pushback",
        label: "반론",
        prompt: "현재 안에 숨어있는 가장 큰 리스크와 허점을 바로 짚어줘. 서로 반박도 해줘.",
        icon: Zap,
      },
      {
        id: "decision",
        label: "결정안",
        prompt: "지금까지를 바탕으로 선택지와 권고안을 명확하게 정리해줘.",
        icon: WandSparkles,
      },
      {
        id: "research",
        label: "조사",
        prompt: "필요한 외부 검증 포인트를 정리하고, 브라우저에서 바로 확인할 조사 항목으로 바꿔줘.",
        icon: Sparkles,
      },
    ];
  }

  return [
    {
      id: "pushback",
      label: "Push Back",
      prompt: "Pressure-test the current direction. Call out the biggest risks and disagree where needed.",
      icon: Zap,
    },
    {
      id: "decision",
      label: "Decision",
      prompt: "Turn the discussion into a clear recommendation with tradeoffs and a proposed decision.",
      icon: WandSparkles,
    },
    {
      id: "research",
      label: "Research",
      prompt: "List the external facts we still need and convert them into browser-ready research tasks.",
      icon: Sparkles,
    },
  ];
}

export function LiveRoomTranscript({
  meetingStatus,
  messages,
  streamingTurns,
  agents,
  activeAgentIds,
  targetAgentId,
  geminiLiveStatus,
  geminiLiveDraft,
  speechLocale,
  micLevel,
  microphoneEnabled,
  isSending,
  onSend,
  onAbort,
  onToggleLive,
  onToggleMicrophone,
  onSpeechLocaleChange,
  onClearTarget,
}: LiveRoomTranscriptProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingTurns, geminiLiveDraft]);

  const activeAgents = useMemo(
    () => agents.filter((agent) => activeAgentIds.includes(agent.id)),
    [agents, activeAgentIds],
  );
  const promptPresets = useMemo(() => getPromptPresets(speechLocale), [speechLocale]);
  const targetAgent = activeAgents.find((agent) => agent.id === targetAgentId) || null;
  const localeLabel =
    speechLocale === "ko-KR" ? "Korean priority" : speechLocale === "en-US" ? "English priority" : "Auto language";

  const sendDraft = () => {
    const content = draft.trim();
    if (!content || isSending) return;
    onSend(content, targetAgentId);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Live Transcript</h2>
              <Badge variant="secondary" className="rounded-full">
                {messages.length + streamingTurns.length}
              </Badge>
              {geminiLiveStatus !== "disconnected" ? (
                <Badge className="rounded-full bg-emerald-500/15 text-emerald-500">
                  Gemini Live {geminiLiveStatus}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Founder, teammates, and agents speak into the same shared room.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSending ? (
              <Button variant="outline" size="sm" onClick={onAbort} className="h-8 gap-1.5">
                <StopCircle className="h-3.5 w-3.5" />
                Stop
              </Button>
            ) : null}
            <Button
              variant={geminiLiveStatus === "disconnected" ? "default" : "outline"}
              size="sm"
              onClick={onToggleLive}
              className="h-8 gap-1.5"
            >
              <Mic className="h-3.5 w-3.5" />
              {geminiLiveStatus === "disconnected" ? "Start Live" : "End Live"}
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="grid gap-3">
          <div className="grid gap-3 xl:grid-cols-[1fr,auto]">
            <Card className="border-card-border bg-card/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Voice lane</p>
                  <p className="mt-1 text-sm text-foreground">
                    {geminiLiveStatus === "disconnected"
                      ? "Start a live session to talk naturally with Gemini and the room."
                      : microphoneEnabled
                        ? "Hot mic is live. Gemini follows the room in real time."
                        : "Mic is muted. Gemini can still speak, but it will not hear you until you unmute."}
                  </p>
                </div>
                <div className="w-full max-w-[170px]">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{localeLabel}</span>
                    <span>{Math.round(micLevel * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        microphoneEnabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                      }`}
                      style={{ width: `${Math.max(4, Math.round(micLevel * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-2 sm:grid-cols-2 xl:w-[280px]">
              <Select value={speechLocale} onValueChange={(value) => onSpeechLocaleChange(value as SpeechLocale)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto detect</SelectItem>
                  <SelectItem value="ko-KR">Korean priority</SelectItem>
                  <SelectItem value="en-US">English priority</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={microphoneEnabled ? "outline" : "secondary"}
                className="h-10"
                onClick={onToggleMicrophone}
                disabled={geminiLiveStatus === "disconnected"}
              >
                <Mic className="mr-2 h-4 w-4" />
                {microphoneEnabled ? "Mute mic" : "Unmute mic"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          {promptPresets.map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => onSend(preset.prompt, targetAgentId)}
              disabled={isSending || meetingStatus !== "active"}
            >
              <preset.icon className="mr-1.5 h-3 w-3" />
              {preset.label}
            </Button>
          ))}
          {targetAgent ? (
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              Directing next turn to {targetAgent.name}
              <button className="ml-2 text-muted-foreground" onClick={onClearTarget} type="button">
                ×
              </button>
            </Badge>
          ) : null}
      </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const agent = agents.find((item) => item.id === message.agentId);
            const isAgent = message.senderType === "agent";
            return (
              <div key={message.id} className="flex gap-3">
                {isAgent ? (
                  <AgentAvatar avatar={agent?.avatar} color={agent?.color} name={agent?.name} size="sm" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {(message.senderName || "U").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{message.senderName}</span>
                    {agent?.role ? <span className="text-xs text-muted-foreground">{agent.role}</span> : null}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
                </div>
              </div>
            );
          })}

          {streamingTurns.map((turn) => {
            const agent = agents.find((item) => item.id === turn.agentId);
            return (
              <div key={`streaming-${turn.agentId}`} className="flex gap-3">
                <AgentAvatar avatar={agent?.avatar} color={agent?.color} name={turn.agentName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{turn.agentName}</span>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {turn.content}
                    <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
                  </p>
                </div>
              </div>
            );
          })}

          {geminiLiveDraft ? (
            <Card className="border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15">
                  <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Gemini Live</span>
                    <span className="text-[11px] text-muted-foreground">{geminiLiveStatus}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {geminiLiveDraft}
                    <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-emerald-500 align-middle" />
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border px-4 py-4">
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendDraft();
              }
            }}
            rows={4}
            placeholder="Drive the room. Ask for pushback, research, execution plans, or a direct answer from a specific agent."
            disabled={meetingStatus !== "active"}
            className="resize-none text-sm leading-6"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {activeAgents.length} active specialists are listening to this room.
            </p>
            <Button onClick={sendDraft} disabled={!draft.trim() || isSending || meetingStatus !== "active"} className="gap-2">
              <Send className="h-4 w-4" />
              Send to room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
