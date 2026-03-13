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

interface TranscriptPanelProps {
  workOrder: string;
  messages: MeetingMessage[];
  activeAgents: AgentPersona[];
  streamingTurns: StreamingAgentTurn[];
  liveStatus: GeminiLiveStatus;
  liveDraft: string;
  microphoneEnabled: boolean;
  micLevel: number;
  mode: RoomCommandMode;
  targetAgentId: number | null;
  speechLocale: SpeechLocale;
  sending: boolean;
  onModeChange: (value: RoomCommandMode) => void;
  onTargetAgentChange: (value: number | null) => void;
  onSpeechLocaleChange: (value: SpeechLocale) => void;
  onToggleLive: () => void;
  onToggleMicrophone: () => void;
  onSend: (value: string) => void;
  onStop: () => void;
}

function formatTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function isKorean(locale: SpeechLocale) {
  return locale === "ko-KR" || (locale === "auto" && typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko"));
}

function presetPrompt(mode: RoomCommandMode, locale: SpeechLocale) {
  if (isKorean(locale)) {
    return {
      align: "지금 회의의 핵심 질문과 바로 다음 행동만 남겨줘.",
      critique: "현재 안의 가장 약한 가정과 먼저 깨질 부분을 말해줘.",
      research: "외부 검증이 필요한 포인트를 조사 행동으로 바꿔줘.",
      decide: "지금 어떤 결정을 내려야 하는지 하나로 좁혀줘.",
    }[mode];
  }

  return {
    align: "Compress the room around the key question and next action.",
    critique: "Name the weakest assumption and what breaks first.",
    research: "Turn the unknowns into concrete research moves.",
    decide: "Force the next decision now.",
  }[mode];
}

export function TranscriptPanel({
  workOrder,
  messages,
  activeAgents,
  streamingTurns,
  liveStatus,
  liveDraft,
  microphoneEnabled,
  micLevel,
  mode,
  targetAgentId,
  speechLocale,
  sending,
  onModeChange,
  onTargetAgentChange,
  onSpeechLocaleChange,
  onToggleLive,
  onToggleMicrophone,
  onSend,
  onStop,
}: TranscriptPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingTurns, liveDraft]);

  const targetAgent = useMemo(
    () => activeAgents.find((agent) => agent.id === targetAgentId) || null,
    [activeAgents, targetAgentId],
  );

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Transcript</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Talk to the room</h2>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            voice {liveStatus}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {workOrder}
        </div>

        <div className="mt-4 grid gap-2 xl:grid-cols-2">
          <Select value={mode} onValueChange={(value) => onModeChange(value as RoomCommandMode)}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="align">Align</SelectItem>
              <SelectItem value="critique">Critique</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="decide">Decide</SelectItem>
            </SelectContent>
          </Select>

          <Select value={targetAgentId ? String(targetAgentId) : "room"} onValueChange={(value) => onTargetAgentChange(value === "room" ? null : Number(value))}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Target" />
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
            <SelectTrigger className="h-10 w-[130px] rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Language" />
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
                message.senderType === "human" ? "border-slate-200 bg-slate-950 text-slate-50" : "border-slate-200 bg-slate-50 text-slate-900",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-500">{message.senderType}</span>
                  <span className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", message.senderType === "human" ? "text-slate-300" : "text-slate-500")}>
                    {message.senderName}
                  </span>
                </div>
                <span className={cn("text-[11px]", message.senderType === "human" ? "text-slate-400" : "text-slate-500")}>{formatTime(message.createdAt)}</span>
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
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">live transcript</div>
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
            onClick={() => setDraft(presetPrompt(mode, speechLocale))}
          >
            Use preset
          </button>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{messages.length} turns</span>
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
