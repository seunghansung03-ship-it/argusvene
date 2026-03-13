import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Radio, Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type { GeminiLiveStatus } from "@/hooks/use-gemini-live";
import type { RoomCommandMode, SpeechLocale, StreamingAgentTurn } from "./types";

interface TranscriptLaneProps {
  workOrder: string;
  messages: MeetingMessage[];
  streamingTurns: StreamingAgentTurn[];
  activeAgents: AgentPersona[];
  mode: RoomCommandMode;
  targetAgentId: number | null;
  liveStatus: GeminiLiveStatus;
  liveDraft: string;
  micLevel: number;
  speechLocale: SpeechLocale;
  microphoneEnabled: boolean;
  sending: boolean;
  onModeChange: (value: RoomCommandMode) => void;
  onTargetAgentChange: (value: number | null) => void;
  onSend: (value: string) => void;
  onStop: () => void;
  onToggleLive: () => void;
  onToggleMicrophone: () => void;
  onSpeechLocaleChange: (value: SpeechLocale) => void;
}

function isKorean(locale: SpeechLocale) {
  return locale === "ko-KR" || (locale === "auto" && typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko"));
}

function promptPreset(mode: RoomCommandMode, locale: SpeechLocale) {
  const korean = isKorean(locale);
  if (korean) {
    return {
      align: "지금 회의의 핵심 쟁점과 바로 다음 행동만 정리해줘.",
      critique: "현재 방향의 가장 치명적인 문제를 하나만 정확히 말해줘.",
      research: "외부 확인이 필요한 포인트를 조사 행동으로 바꿔줘.",
      decide: "지금 당장 어떤 결정을 내려야 하는지 단호하게 말해줘.",
    }[mode];
  }

  return {
    align: "State the core question and the immediate next action.",
    critique: "Name the single biggest flaw in the current direction.",
    research: "Turn the unknowns into concrete research actions.",
    decide: "Force the next decision now.",
  }[mode];
}

function voiceState(status: GeminiLiveStatus) {
  switch (status) {
    case "connecting":
      return "connecting";
    case "connected":
      return "ready";
    case "speaking":
      return "speaking";
    case "listening":
      return "listening";
    case "disconnected":
    default:
      return "idle";
  }
}

function formatTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function TranscriptLane({
  workOrder,
  messages,
  streamingTurns,
  activeAgents,
  mode,
  targetAgentId,
  liveStatus,
  liveDraft,
  micLevel,
  speechLocale,
  microphoneEnabled,
  sending,
  onModeChange,
  onTargetAgentChange,
  onSend,
  onStop,
  onToggleLive,
  onToggleMicrophone,
  onSpeechLocaleChange,
}: TranscriptLaneProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingTurns, liveDraft]);

  const targetAgent = useMemo(
    () => activeAgents.find((agent) => agent.id === targetAgentId) || null,
    [activeAgents, targetAgentId],
  );
  const preset = useMemo(() => promptPreset(mode, speechLocale), [mode, speechLocale]);
  const localeLabel = isKorean(speechLocale) ? "ko" : speechLocale === "en-US" ? "en" : "auto";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Live feed</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Transcript lane</h2>
            <p className="mt-1 text-sm text-slate-600">Human turns, live voice, and agent responses in one stream.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              voice {voiceState(liveStatus)}
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {localeLabel}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current work order</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">{workOrder}</p>
        </div>

        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          <Select value={mode} onValueChange={(value) => onModeChange(value as RoomCommandMode)}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-slate-900">
              <SelectValue placeholder="mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="align">Align</SelectItem>
              <SelectItem value="critique">Critique</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="decide">Decide</SelectItem>
            </SelectContent>
          </Select>
          <Select value={targetAgentId ? String(targetAgentId) : "room"} onValueChange={(value) => onTargetAgentChange(value === "room" ? null : Number(value))}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-slate-900">
              <SelectValue placeholder="target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="room">Entire room</SelectItem>
              {activeAgents.map((agent) => (
                <SelectItem key={agent.id} value={String(agent.id)}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant={liveStatus === "disconnected" ? "default" : "outline"} className="rounded-xl" onClick={onToggleLive}>
            <Radio className="h-4 w-4" />
            {liveStatus === "disconnected" ? "Connect voice" : "Disconnect voice"}
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={onToggleMicrophone}>
            {microphoneEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {microphoneEnabled ? "Mute mic" : "Unmute mic"}
          </Button>
          <Select value={speechLocale} onValueChange={(value) => onSpeechLocaleChange(value as SpeechLocale)}>
            <SelectTrigger className="h-10 w-[130px] rounded-xl border-slate-200 bg-white text-slate-900">
              <SelectValue placeholder="language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="ko-KR">Korean</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto min-w-28">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <span>mic</span>
              <span>{Math.round(micLevel * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.max(liveStatus === "disconnected" ? 0 : 4, Math.round(micLevel * 100))}%` }} />
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-5 py-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "rounded-2xl border px-4 py-3",
                message.senderType === "human"
                  ? "border-slate-200 bg-slate-950 text-slate-50"
                  : "border-slate-200 bg-slate-50 text-slate-900",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                    {message.senderType}
                  </span>
                  <span className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.18em]",
                    message.senderType === "human" ? "text-slate-300" : "text-slate-500",
                  )}>
                    {message.senderName}
                  </span>
                </div>
                <span className={cn("text-[11px]", message.senderType === "human" ? "text-slate-400" : "text-slate-500")}>
                  {formatTime(message.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </article>
          ))}

          {streamingTurns.map((turn) => (
            <article key={turn.agentId} className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-slate-900">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {turn.agentName}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{turn.content || "Thinking..."}</p>
            </article>
          ))}

          {liveDraft ? (
            <article className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-slate-900">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                live transcript
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{liveDraft}</p>
            </article>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-slate-200 px-5 py-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={() => setDraft(preset)}
          >
            Load mode prompt
          </button>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{messages.length} turns logged</span>
        </div>

        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          placeholder={targetAgent ? `${targetAgent.name}에게 직접 지시하거나 룸 전체에 다음 행동을 던지세요.` : "Type the next direct instruction for the room."}
          className="resize-none rounded-2xl border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-400"
        />

        <div className="mt-3 flex gap-2">
          {sending ? (
            <Button className="flex-1 rounded-xl" variant="destructive" onClick={onStop}>
              <Square className="h-4 w-4" />
              Stop turn
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-xl"
              disabled={!draft.trim()}
              onClick={() => {
                onSend(draft.trim());
                setDraft("");
              }}
            >
              <Send className="h-4 w-4" />
              Send to {targetAgent ? targetAgent.name : "room"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
