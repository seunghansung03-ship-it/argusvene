import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  Radio,
  Send,
  Sparkles,
  StopCircle,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentPersona, MeetingMessage } from "@shared/schema";
import type { GeminiLiveStatus } from "@/hooks/use-gemini-live";
import type { RoomV2Mode, StreamingAgentTurn } from "./types";

type SpeechLocale = "auto" | "ko-KR" | "en-US";

interface TranscriptColumnProps {
  messages: MeetingMessage[];
  streamingTurns: StreamingAgentTurn[];
  activeAgents: AgentPersona[];
  currentMode: RoomV2Mode;
  targetAgentId: number | null;
  sending: boolean;
  liveStatus: GeminiLiveStatus;
  liveDraft: string;
  micLevel: number;
  microphoneEnabled: boolean;
  speechLocale: SpeechLocale;
  workOrder: string;
  onSend: (content: string) => void;
  onStop: () => void;
  onToggleLive: () => void;
  onToggleMicrophone: () => void;
  onSpeechLocaleChange: (value: SpeechLocale) => void;
}

function promptPresets(mode: RoomV2Mode, locale: SpeechLocale) {
  const korean = locale === "ko-KR" || (locale === "auto" && typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ko"));
  if (korean) {
    return {
      align: "지금 가장 중요한 쟁점을 정렬해줘. 누가 무엇을 결정해야 하는지 바로 보이게 해줘.",
      critique: "현재 안의 가장 치명적인 허점과 잘못된 가정을 정면으로 비판해줘.",
      research: "외부 검증이 필요한 항목을 조사 질문으로 바꿔줘.",
      decide: "지금 시점에서 하나를 고르고, 나머지를 왜 버려야 하는지 결정해줘.",
    }[mode];
  }
  return {
    align: "Align the room on the single most important question and who needs to answer it now.",
    critique: "Critique the current direction hard and surface the weakest assumptions first.",
    research: "Turn the unknowns into concrete external research questions.",
    decide: "Force a decision now. Pick one path and reject the weaker ones.",
  }[mode];
}

function modeLabel(mode: RoomV2Mode) {
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

function liveStatusCopy(status: GeminiLiveStatus) {
  switch (status) {
    case "connecting":
      return {
        label: "Connecting",
        description: "Opening the live audio session.",
        badgeClassName: "bg-amber-500/15 text-amber-200 border-amber-400/30",
      };
    case "connected":
      return {
        label: "Connected",
        description: "Audio is ready. The room is standing by.",
        badgeClassName: "bg-sky-500/15 text-sky-200 border-sky-400/30",
      };
    case "speaking":
      return {
        label: "Agent speaking",
        description: "Gemini Live is currently talking back.",
        badgeClassName: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
      };
    case "listening":
      return {
        label: "Listening",
        description: "The lane is actively listening for speech.",
        badgeClassName: "bg-violet-500/15 text-violet-200 border-violet-400/30",
      };
    case "disconnected":
    default:
      return {
        label: "Idle",
        description: "Use typed turns or start live voice.",
        badgeClassName: "bg-slate-500/15 text-slate-200 border-slate-400/30",
      };
  }
}

function messageTone(message: MeetingMessage) {
  if (message.senderType === "human") {
    return {
      wrapper: "border-[#eadbc8] bg-[#f8f0e4] text-[#1c1712]",
      meta: "text-[#7f6045]",
      role: "bg-[#ffffff] text-[#7f6045] border-[#e6d6c0]",
    };
  }

  return {
    wrapper: "border-white/10 bg-white/6 text-[#f7f1e9]",
    meta: "text-[#c8bbab]",
    role: "bg-[#f08b5b]/12 text-[#f4d6c6] border-[#f08b5b]/20",
  };
}

export function TranscriptColumn({
  messages,
  streamingTurns,
  activeAgents,
  currentMode,
  targetAgentId,
  sending,
  liveStatus,
  liveDraft,
  micLevel,
  microphoneEnabled,
  speechLocale,
  workOrder,
  onSend,
  onStop,
  onToggleLive,
  onToggleMicrophone,
  onSpeechLocaleChange,
}: TranscriptColumnProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingTurns, liveDraft]);

  const preset = useMemo(() => promptPresets(currentMode, speechLocale), [currentMode, speechLocale]);
  const targetAgent = activeAgents.find((agent) => agent.id === targetAgentId) || null;
  const liveMeta = liveStatusCopy(liveStatus);
  const meterWidth = Math.max(liveStatus === "disconnected" ? 0 : 4, Math.round(micLevel * 100));

  return (
    <div className="flex h-full flex-col bg-[#0e1418] text-[#f7f1e9]">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b9ab98]">Conversation Lane</span>
              <Badge className="rounded-full border border-white/10 bg-white/6 text-[#f7f1e9]">
                {messages.length} turns
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#cdbfaa]">
              Keep this lane conversational. Push decisions and instructions out of the room without turning it into a note dump.
            </p>
          </div>
          <Button
            variant={liveStatus === "disconnected" ? "secondary" : "outline"}
            size="sm"
            className="h-10 rounded-full border-white/10 bg-white/6 px-4 text-[#f7f1e9] hover:bg-white/10"
            onClick={onToggleLive}
          >
            <Radio className="mr-1.5 h-4 w-4" />
            {liveStatus === "disconnected" ? "Go live" : "End live"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          <Card className="rounded-[24px] border-white/10 bg-white/6 p-4 shadow-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b9ab98]">Voice control</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className={cn("rounded-full border px-3 py-1", liveMeta.badgeClassName)}>
                    {liveMeta.label}
                  </Badge>
                  <Badge className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-[#f7f1e9]">
                    {speechLocale === "ko-KR" ? "Korean priority" : speechLocale === "en-US" ? "English priority" : "Auto language"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#d8cbba]">{liveMeta.description}</p>
              </div>

              <div className="min-w-[9.5rem] rounded-[20px] border border-white/10 bg-black/15 px-3 py-3">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[#b9ab98]">
                  <span>Mic energy</span>
                  <span>{Math.round(micLevel * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#f08b5b] transition-all" style={{ width: `${meterWidth}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Select value={speechLocale} onValueChange={(value) => onSpeechLocaleChange(value as SpeechLocale)}>
                <SelectTrigger className="h-10 min-w-[11rem] rounded-full border-white/10 bg-[#151c21] text-[#f7f1e9]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="ko-KR">Korean</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full border-white/10 bg-[#151c21] px-4 text-[#f7f1e9] hover:bg-white/10"
                onClick={onToggleMicrophone}
              >
                {microphoneEnabled ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
                {microphoneEnabled ? "Mute mic" : "Unmute mic"}
              </Button>
            </div>

            {liveDraft ? (
              <div className="mt-3 rounded-[20px] border border-[#f08b5b]/20 bg-[#f08b5b]/10 px-3 py-3 text-sm leading-6 text-[#f7f1e9]">
                {liveDraft}
              </div>
            ) : null}
          </Card>

          <Card className="rounded-[24px] border-white/10 bg-[#131a1f] p-4 shadow-none">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[#f7f1e9]">
                Mode {modeLabel(currentMode)}
              </Badge>
              <Badge className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[#f7f1e9]">
                {targetAgent ? `Direct to ${targetAgent.name}` : "Room-wide routing"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#d8cbba]">{workOrder}</p>
          </Card>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        <div className="space-y-3 pr-1">
          {messages.map((message) => {
            const tone = messageTone(message);
            return (
              <div key={message.id} className={cn("rounded-[22px] border px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)]", tone.wrapper)}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge className={cn("rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em]", tone.role)}>
                    {message.senderType === "human" ? "Human" : "Agent"}
                  </Badge>
                  <span className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", tone.meta)}>
                    {message.senderName}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              </div>
            );
          })}

          {streamingTurns.map((turn) => (
            <div key={turn.agentId} className="rounded-[22px] border border-dashed border-[#f08b5b]/40 bg-[#171f24] px-4 py-3 text-[#f7f1e9]">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#f08b5b]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {turn.agentName}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{turn.content || "Thinking..."}</p>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-white/10 bg-black/10 px-4 py-4">
        <div className="rounded-[26px] border border-white/10 bg-[#11181d] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full border border-white/10 bg-white/6 px-3 text-[#f7f1e9] hover:bg-white/10"
              onClick={() => setDraft(preset)}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Load mode prompt
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#b9ab98]">
              <Waves className="h-3.5 w-3.5" />
              Speak naturally or type a precise move
            </div>
          </div>

          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            placeholder="Say what you would say in a real working session. The room should react, not summarize."
            className="resize-none rounded-[24px] border-white/10 bg-[#151c21] text-[#f7f1e9] placeholder:text-[#8d8376]"
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
                Send into room
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
