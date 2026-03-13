import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Radio, Send, Sparkles, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type { GeminiLiveStatus } from "@/hooks/use-gemini-live";
import type { RoomCommandMode, SpeechLocale, StreamingAgentTurn } from "./types";

interface TranscriptPaneProps {
  messages: MeetingMessage[];
  streamingTurns: StreamingAgentTurn[];
  activeAgents: AgentPersona[];
  mode: RoomCommandMode;
  targetAgentId: number | null;
  workOrder: string;
  liveStatus: GeminiLiveStatus;
  liveDraft: string;
  micLevel: number;
  speechLocale: SpeechLocale;
  microphoneEnabled: boolean;
  sending: boolean;
  onSend: (value: string) => void;
  onStop: () => void;
  onToggleLive: () => void;
  onToggleMicrophone: () => void;
  onSpeechLocaleChange: (value: SpeechLocale) => void;
}

function presetForMode(mode: RoomCommandMode, locale: SpeechLocale) {
  const korean = locale === "ko-KR" || (locale === "auto" && typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko"));
  if (korean) {
    return {
      align: "지금 회의에서 가장 중요한 쟁점과 바로 다음 행동을 한 문장으로 정리해줘.",
      critique: "현재 방향의 가장 큰 허점 하나만 정확히 짚어줘.",
      research: "외부 검증이 필요한 질문을 바로 실행 가능한 조사 항목으로 바꿔줘.",
      decide: "지금 결정을 내려야 한다면 무엇을 선택해야 하는지 단호하게 말해줘.",
    }[mode];
  }

  return {
    align: "State the single most important question in this room and the next action.",
    critique: "Name the biggest flaw in the current direction with no softening.",
    research: "Turn the unknowns into concrete external research moves.",
    decide: "Force a decision now and explain what should happen next.",
  }[mode];
}

function liveLabel(status: GeminiLiveStatus) {
  switch (status) {
    case "connecting":
      return "connecting";
    case "connected":
      return "ready";
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    case "disconnected":
    default:
      return "idle";
  }
}

function modeTone(mode: RoomCommandMode) {
  switch (mode) {
    case "critique":
      return "bg-rose-500/14 text-rose-100 border-rose-400/20";
    case "research":
      return "bg-sky-500/14 text-sky-100 border-sky-400/20";
    case "decide":
      return "bg-emerald-500/14 text-emerald-100 border-emerald-400/20";
    case "align":
    default:
      return "bg-amber-500/14 text-amber-100 border-amber-400/20";
  }
}

function messageTone(message: MeetingMessage) {
  if (message.senderType === "human") {
    return "border-white/8 bg-white text-[#121417]";
  }
  return "border-white/10 bg-[#10171d] text-[#f3efe6]";
}

export function TranscriptPane({
  messages,
  streamingTurns,
  activeAgents,
  mode,
  targetAgentId,
  workOrder,
  liveStatus,
  liveDraft,
  micLevel,
  speechLocale,
  microphoneEnabled,
  sending,
  onSend,
  onStop,
  onToggleLive,
  onToggleMicrophone,
  onSpeechLocaleChange,
}: TranscriptPaneProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingTurns, liveDraft]);

  const targetAgent = useMemo(
    () => activeAgents.find((agent) => agent.id === targetAgentId) || null,
    [activeAgents, targetAgentId],
  );
  const preset = useMemo(() => presetForMode(mode, speechLocale), [mode, speechLocale]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-[#151c22] text-[#f3efe6] shadow-[0_18px_60px_rgba(18,24,34,0.10)]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b7ac9b]">Transcript</p>
            <p className="mt-1 text-sm text-[#ddd2c2]">Real conversation, live voice, direct prompts.</p>
          </div>
          <Button
            variant="outline"
            className="h-10 rounded-full border-white/10 bg-white/5 px-4 text-[#f3efe6] hover:bg-white/10"
            onClick={onToggleLive}
          >
            <Radio className="mr-1.5 h-4 w-4" />
            {liveStatus === "disconnected" ? "Start live" : "Stop live"}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge className={cn("rounded-full border px-3 py-1", modeTone(mode))}>{mode}</Badge>
          <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[#f3efe6]">
            voice {liveLabel(liveStatus)}
          </Badge>
          <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[#f3efe6]">
            {targetAgent ? `direct to ${targetAgent.name}` : "room routing"}
          </Badge>
        </div>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9f9788]">Work order</p>
              <p className="mt-1 text-sm leading-6 text-[#f3efe6]">{workOrder}</p>
            </div>
            <div className="w-24 shrink-0">
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#9f9788]">
                <span>mic</span>
                <span>{Math.round(micLevel * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#f08b5b] transition-all"
                  style={{ width: `${Math.max(liveStatus === "disconnected" ? 0 : 4, Math.round(micLevel * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Select value={speechLocale} onValueChange={(value) => onSpeechLocaleChange(value as SpeechLocale)}>
              <SelectTrigger className="h-9 w-[140px] rounded-full border-white/10 bg-[#10171d] text-[#f3efe6]">
                <SelectValue placeholder="language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="ko-KR">Korean</SelectItem>
                <SelectItem value="en-US">English</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="h-9 rounded-full border-white/10 bg-[#10171d] px-4 text-[#f3efe6] hover:bg-white/10"
              onClick={onToggleMicrophone}
            >
              {microphoneEnabled ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
              {microphoneEnabled ? "Mute" : "Unmute"}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-5 py-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <article key={message.id} className={cn("rounded-[20px] border px-4 py-3", messageTone(message))}>
              <div className="mb-2 flex items-center gap-2">
                <Badge
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em]",
                    message.senderType === "human"
                      ? "border-[#d3c7b5] bg-[#f5ede1] text-[#7a6046]"
                      : "border-white/10 bg-white/5 text-[#d8cdbf]",
                  )}
                >
                  {message.senderType === "human" ? "Human" : "Agent"}
                </Badge>
                <span className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.18em]",
                  message.senderType === "human" ? "text-[#7a6046]" : "text-[#b7ac9b]",
                )}>
                  {message.senderName}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </article>
          ))}

          {streamingTurns.map((turn) => (
            <article
              key={turn.agentId}
              className="rounded-[20px] border border-dashed border-[#f08b5b]/30 bg-[#10171d] px-4 py-3 text-[#f3efe6]"
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f08b5b]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {turn.agentName}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{turn.content || "Thinking..."}</p>
            </article>
          ))}

          {liveDraft ? (
            <article className="rounded-[20px] border border-[#f08b5b]/30 bg-[#f08b5b]/10 px-4 py-3 text-[#f3efe6]">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0bf9f]">
                live transcript
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{liveDraft}</p>
            </article>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-white/10 bg-[#10171d] px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-[#f3efe6] hover:bg-white/10"
            onClick={() => setDraft(preset)}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Use mode prompt
          </Button>
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#9f9788]">
            {messages.length} total turns
          </span>
        </div>

        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          placeholder="Speak to the room naturally, or type a sharp instruction."
          className="resize-none rounded-[22px] border-white/10 bg-[#151c22] text-[#f3efe6] placeholder:text-[#8b8479]"
        />

        <div className="mt-3 flex gap-2">
          {sending ? (
            <Button className="flex-1 rounded-full bg-[#f08b5b] text-[#171614] hover:bg-[#e97941]" onClick={onStop}>
              <StopCircle className="mr-1.5 h-4 w-4" />
              Stop turn
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-full bg-[#f08b5b] text-[#171614] hover:bg-[#e97941]"
              disabled={!draft.trim()}
              onClick={() => {
                onSend(draft.trim());
                setDraft("");
              }}
            >
              <Send className="mr-1.5 h-4 w-4" />
              Send
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
