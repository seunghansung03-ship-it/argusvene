import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AgentAvatar } from "@/components/agent-avatar";
import LiveCanvas from "@/components/live-canvas";
import {
  ArrowLeft, Send, FileText, CheckCircle2, ListTodo,
  Loader2, User, Sparkles, StopCircle, Brain,
  Activity, Clock, FileCode, Eye, Mic, MicOff,
  AlertTriangle, Zap, Volume2, VolumeX,
} from "lucide-react";
import { useTTS } from "@/hooks/use-tts";
import { useGeminiLive, type GeminiLiveStatus } from "@/hooks/use-gemini-live";
import { useAuth } from "@/hooks/use-auth";
import type { Meeting, MeetingMessage, AgentPersona, Artifact, Decision, Task } from "@shared/schema";

interface StreamingMessage {
  agentId: number;
  agentName: string;
  content: string;
  isComplete: boolean;
}

interface WorldStateData {
  sessionId: string;
  version: number;
  entities: any[];
  assumptions: any[];
  constraints: any[];
  options: any[];
  scenarios: any[];
  metrics: any[];
  decisions: any[];
  lastUpdated: string;
}

interface Counterfactual {
  id: string;
  scenario: string;
  description: string;
  impact: string;
}

function VoiceWaveform({ active, color = "bg-primary" }: { active: boolean; color?: string }) {
  return (
    <div className="flex items-center gap-[3px] h-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all ${color} ${active ? "animate-pulse" : "opacity-30"}`}
          style={{
            height: active ? `${8 + Math.random() * 10}px` : "4px",
            animationDelay: `${i * 0.1}s`,
            animationDuration: active ? `${0.4 + Math.random() * 0.3}s` : "0s",
          }}
        />
      ))}
    </div>
  );
}

function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30" data-testid="badge-live-mode">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-[11px] font-bold text-red-400 tracking-wider">LIVE</span>
    </div>
  );
}

function ChatPanel({
  messages,
  streamingMessages,
  agents,
  agentIds,
  onSend,
  onSendToAgent,
  onStopResponse,
  isSending,
  meetingStatus,
  interruptMessage,
  voiceMode,
  onToggleVoiceMode,
  liveMode,
  onToggleLiveMode,
  liveSpeaker,
  interimTranscript,
  pendingAgentSelect,
  ttsPlaying,
  geminiLiveStatus,
  onToggleGeminiLive,
}: {
  messages: MeetingMessage[];
  streamingMessages: StreamingMessage[];
  agents: AgentPersona[];
  agentIds: number[];
  onSend: (msg: string) => void;
  onSendToAgent: (agentId: number) => void;
  onStopResponse: () => void;
  isSending: boolean;
  meetingStatus: string;
  interruptMessage: string | null;
  voiceMode: boolean;
  onToggleVoiceMode: () => void;
  liveMode: boolean;
  onToggleLiveMode: () => void;
  liveSpeaker: string | null;
  interimTranscript: string;
  pendingAgentSelect: boolean;
  ttsPlaying: boolean;
  geminiLiveStatus?: string;
  onToggleGeminiLive?: () => void;
}) {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const wasRecordingBeforeTTS = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { speak, stop, isSpeaking, elevenLabsAvailable } = useTTS();
  const activeAgents = agents.filter(a => agentIds.includes(a.id));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessages, interimTranscript]);

  useEffect(() => {
    if (liveMode) return;
    const anyTTSPlaying = ttsPlaying || isSpeaking;
    if (anyTTSPlaying && isRecording) {
      wasRecordingBeforeTTS.current = true;
      try { recognitionRef.current?.stop(); } catch {}
      setIsRecording(false);
    } else if (!anyTTSPlaying && wasRecordingBeforeTTS.current) {
      wasRecordingBeforeTTS.current = false;
      setTimeout(() => startRecording(), 300);
    }
  }, [ttsPlaying, isSpeaking, liveMode]);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setInput(prev => prev + " " + transcript.trim());
          transcript = "";
        }
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    onSend(input.trim());
    setInput("");
  };

  const toggleVoice = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      wasRecordingBeforeTTS.current = false;
      return;
    }
    startRecording();
  };

  const agentMap = new Map(agents.map(a => [a.id, a]));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="font-semibold text-sm text-foreground">Transcript</span>
        <Badge variant="secondary" className="text-xs">
          {messages.length} messages
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          {isSpeaking && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={stop} data-testid="button-stop-tts">
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            </Button>
          )}
          {!liveMode && (
            <Button
              variant={voiceMode ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={onToggleVoiceMode}
              data-testid="button-toggle-voice-mode"
            >
              <Volume2 className="w-3 h-3 mr-1" />
              {voiceMode ? "Voice On" : "Voice Off"}
            </Button>
          )}
          {(voiceMode || liveMode) && elevenLabsAvailable && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium" data-testid="badge-elevenlabs">
              ElevenLabs
            </span>
          )}
        </div>
      </div>

      {liveMode && (
        <div className="px-4 py-2.5 border-b border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LiveBadge />
              {liveSpeaker && (
                <div className="flex items-center gap-1.5">
                  <VoiceWaveform active={true} color={liveSpeaker === "You" ? "bg-blue-400" : "bg-emerald-400"} />
                  <span className="text-xs font-medium text-foreground">{liveSpeaker}</span>
                </div>
              )}
              {!liveSpeaker && !isSending && (
                <span className="text-xs text-muted-foreground">Listening...</span>
              )}
              {!liveSpeaker && isSending && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Agents thinking...</span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
              onClick={onToggleLiveMode}
              data-testid="button-stop-live"
            >
              <StopCircle className="w-3 h-3 mr-1" />
              End Live
            </Button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => {
          const agent = msg.agentId ? agentMap.get(msg.agentId) : null;
          const isHuman = msg.senderType === "human";
          const isCofounder = msg.senderName === "co-founder";

          return (
            <div key={msg.id} className="group" data-testid={`message-${msg.id}`}>
              <div className="flex items-start gap-2.5">
                {isHuman ? (
                  <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-secondary-foreground" />
                  </div>
                ) : isCofounder ? (
                  <div className="w-7 h-7 rounded-md bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-yellow-500" />
                  </div>
                ) : (
                  <AgentAvatar
                    avatar={agent?.avatar}
                    color={agent?.color}
                    size="sm"
                    name={agent?.name}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isCofounder ? "text-yellow-500" : "text-foreground"}`}>
                      {msg.senderName}
                    </span>
                    {agent && (
                      <span className="text-xs text-muted-foreground">{agent.role}</span>
                    )}
                    {isCofounder && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500/30 text-yellow-500">
                        INTERRUPT
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-sm text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                  {!isHuman && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 mt-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); speak(msg.content, msg.senderName); }}
                      data-testid={`button-speak-${msg.id}`}
                    >
                      <Volume2 className="w-2.5 h-2.5 mr-0.5" />
                      Speak
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {streamingMessages.map((sm) => {
          const agent = agentMap.get(sm.agentId);
          return (
            <div key={`streaming-${sm.agentId}`} className="group">
              <div className="flex items-start gap-2.5">
                <AgentAvatar
                  avatar={agent?.avatar}
                  color={agent?.color}
                  size="sm"
                  name={agent?.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{sm.agentName}</span>
                    {agent && <span className="text-xs text-muted-foreground">{agent.role}</span>}
                    {liveMode && !sm.isComplete && (
                      <VoiceWaveform active={true} color="bg-emerald-400" />
                    )}
                  </div>
                  <div className="text-sm text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                    {sm.content}
                    {!sm.isComplete && (
                      <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {interruptMessage && (
          <Card className="p-3 border-yellow-500/30 bg-yellow-500/5 animate-in slide-in-from-left">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-yellow-500">co-founder Interrupt</span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{interruptMessage}</p>
          </Card>
        )}

        {liveMode && interimTranscript && (
          <div className="flex items-start gap-2.5 opacity-60">
            <div className="w-7 h-7 rounded-md bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Mic className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-blue-400">You</span>
                <VoiceWaveform active={true} color="bg-blue-400" />
              </div>
              <div className="text-sm text-foreground mt-1 italic">
                {interimTranscript}
              </div>
            </div>
          </div>
        )}

        {isSending && streamingMessages.length === 0 && !pendingAgentSelect && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Agents are thinking...</span>
          </div>
        )}

        {pendingAgentSelect && !isSending && (
          <div className="px-2 py-3 bg-primary/5 border border-primary/20 rounded-md mx-1 mb-1" data-testid="agent-select-panel">
            <p className="text-[11px] font-medium text-primary mb-2">Select who should respond:</p>
            <div className="flex flex-wrap gap-1.5">
              {activeAgents.length > 0 ? (
                <>
                  {activeAgents.map(agent => (
                    <Button
                      key={agent.id}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1.5"
                      onClick={() => onSendToAgent(agent.id)}
                      disabled={isSending}
                      data-testid={`button-select-agent-${agent.id}`}
                    >
                      <AgentAvatar avatar={agent.avatar} color={agent.color} size="xs" name={agent.name} />
                      {agent.name}
                    </Button>
                  ))}
                </>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5 border-yellow-500/30 text-yellow-500"
                onClick={() => onSendToAgent(-1)}
                disabled={isSending}
                data-testid="button-select-cofounder"
              >
                <Zap className="w-3 h-3" />
                {activeAgents.length > 0 ? "Auto (AI picks)" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {meetingStatus === "active" && (
        <div className="p-3 border-t border-border">
          {isSending && (
            <div className="flex items-center justify-center mb-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={onStopResponse}
                data-testid="button-stop-response"
              >
                <StopCircle className="w-3 h-3 mr-1.5" />
                Stop Response
              </Button>
            </div>
          )}
          {!liveMode ? (
            <>
              <div className="flex gap-2">
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  onClick={toggleVoice}
                  data-testid="button-voice-toggle"
                  className="flex-shrink-0"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Textarea
                  data-testid="input-meeting-message"
                  placeholder={isRecording ? "Listening... speak now" : "Type your message..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="resize-none text-sm"
                  rows={2}
                  disabled={isSending}
                />
                <Button
                  data-testid="button-send-message"
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2">
                {isRecording ? (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Recording... click mic to stop</span>
                  </div>
                ) : <div />}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={onToggleLiveMode}
                  data-testid="button-go-live"
                >
                  <Mic className="w-3 h-3 mr-1.5" />
                  Go Live
                </Button>
                {onToggleGeminiLive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 px-3 text-xs ${
                      geminiLiveStatus === "connected" || geminiLiveStatus === "listening" || geminiLiveStatus === "speaking"
                        ? "border-green-500/30 text-green-400"
                        : geminiLiveStatus === "connecting"
                          ? "border-yellow-500/30 text-yellow-400"
                          : "border-purple-500/30 text-purple-400"
                    }`}
                    onClick={onToggleGeminiLive}
                    disabled={geminiLiveStatus === "connecting"}
                    data-testid="button-gemini-live"
                  >
                    <Sparkles className="w-3 h-3 mr-1.5" />
                    {geminiLiveStatus === "connecting" ? "Connecting..." :
                     geminiLiveStatus === "disconnected" || !geminiLiveStatus ? "Gemini Live" :
                     "End Gemini Live"}
                  </Button>
                )}
              </div>
            </>
          ) : geminiLiveStatus && geminiLiveStatus !== "disconnected" ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className={`w-4 h-4 ${geminiLiveStatus === "speaking" ? "text-purple-400" : "text-green-400"}`} />
                <span className="text-muted-foreground">
                  {geminiLiveStatus === "listening" ? "Gemini is listening..." :
                   geminiLiveStatus === "speaking" ? "Gemini is speaking..." :
                   geminiLiveStatus === "connecting" ? "Connecting to Gemini Live..." :
                   "Gemini Live active"}
                </span>
                {(geminiLiveStatus === "listening" || geminiLiveStatus === "speaking") && (
                  <VoiceWaveform active={true} color={geminiLiveStatus === "speaking" ? "bg-purple-500" : "bg-green-500"} />
                )}
              </div>
              {onToggleGeminiLive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs border-red-500/30 text-red-400"
                  onClick={onToggleGeminiLive}
                  data-testid="button-end-gemini-live"
                >
                  <StopCircle className="w-3 h-3 mr-1.5" />
                  End Gemini Live
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mic className="w-4 h-4 text-red-400" />
                <span>Speak naturally — AI responds automatically</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RightPanel({
  agents,
  agentIds,
  workflowStatus,
  streamingAgentId,
  worldState,
}: {
  agents: AgentPersona[];
  agentIds: number[];
  workflowStatus: string[];
  streamingAgentId: number | null;
  worldState: WorldStateData | null;
}) {
  const activeAgents = agents.filter(a => agentIds.includes(a.id));

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm text-foreground">Agents & Status</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Active Participants
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-2 rounded-md bg-yellow-500/5 border border-yellow-500/20" data-testid="panel-cofounder">
              <div className="w-7 h-7 rounded-md bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">co-founder</p>
                <p className="text-xs text-muted-foreground">AI Decision Participant</p>
              </div>
            </div>

            {activeAgents.map(agent => (
              <div key={agent.id} className="flex items-center gap-2.5 p-2 rounded-md" data-testid={`panel-agent-${agent.id}`}>
                <AgentAvatar avatar={agent.avatar} color={agent.color} size="sm" name={agent.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.role}</p>
                </div>
                {streamingAgentId === agent.id && (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-500">Active</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {worldState && worldState.entities.length > 0 && (
          <>
            <div className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Entities Detected
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {worldState.entities.map((e, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]" data-testid={`entity-${i}`}>
                    {e.name}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {worldState && worldState.decisions && worldState.decisions.length > 0 && (
          <>
            <div className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Decision Memory
              </h4>
              <div className="space-y-2">
                {worldState.decisions.map((d: any, i: number) => (
                  <div key={i} className="p-2 rounded border border-border" data-testid={`decision-memory-${i}`}>
                    <p className="text-xs font-medium text-foreground">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{d.reasoning}</p>
                    {d.rejectedOptions && d.rejectedOptions.length > 0 && (
                      <div className="mt-1.5">
                        <p className="text-[10px] text-red-400 font-medium">Rejected:</p>
                        {d.rejectedOptions.map((r: any, j: number) => (
                          <p key={j} className="text-[10px] text-muted-foreground ml-2">- {r.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        <div className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Workflow
          </h4>
          <div className="space-y-2">
            {workflowStatus.length > 0 ? (
              workflowStatus.slice(-8).map((status, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{status}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Waiting for activity...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeetingRoom() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const meetingId = parseInt(params.id || "0");

  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);
  const [streamingAgentId, setStreamingAgentId] = useState<number | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string[]>([]);
  const [summaryArtifacts, setSummaryArtifacts] = useState<Artifact[]>([]);
  const [summaryDecisions, setSummaryDecisions] = useState<Decision[]>([]);
  const [summaryTasks, setSummaryTasks] = useState<Task[]>([]);
  const [worldState, setWorldState] = useState<WorldStateData | null>(null);
  const [mermaidSpec, setMermaidSpec] = useState<string>("");
  const [comparison, setComparison] = useState<{ scenarios: any[]; metricKeys: string[] } | null>(null);
  const [counterfactuals, setCounterfactuals] = useState<Counterfactual[]>([]);
  const [isWorldStateUpdating, setIsWorldStateUpdating] = useState(false);
  const [interruptMessage, setInterruptMessage] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const [liveMode, setLiveMode] = useState(false);
  const [liveSpeaker, setLiveSpeaker] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [pendingAgentSelect, setPendingAgentSelect] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const ttsQueueRef = useRef<{ text: string; agentName: string }[]>([]);
  const mainTTS = useTTS();
  const [geminiLiveTranscript, setGeminiLiveTranscript] = useState<string[]>([]);
  const geminiLive = useGeminiLive({
    userId: user?.uid || null,
    onTranscript: (text) => {
      setGeminiLiveTranscript(prev => [...prev, text]);
    },
    onAudioStart: () => {
      setLiveSpeaker("Gemini");
    },
    onAudioEnd: () => {
      setLiveSpeaker(null);
    },
    onError: (msg) => {
      toast({ title: "Gemini Live Error", description: msg, variant: "destructive" });
    },
  });
  const liveRecognitionRef = useRef<any>(null);
  const liveModeRef = useRef(false);
  const isSendingRef = useRef(false);
  const ttsDoneCallbackRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const handleSendMessageRef = useRef<(content: string, skipAgentSelect?: boolean) => void>(() => {});

  const startLiveSTT = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !liveModeRef.current) return;

    if (liveRecognitionRef.current) {
      try { liveRecognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingFinal = "";

    const SILENCE_TIMEOUT = 1000;

    const flushAndSend = () => {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
      if (!pendingFinal.trim() || !liveModeRef.current) return;

      const text = pendingFinal.trim();
      pendingFinal = "";
      setLiveSpeaker(null);
      setInterimTranscript("");
      try { recognition.stop(); } catch {}
      handleSendMessageRef.current(text, true);
    };

    const scheduleFlush = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (!isSendingRef.current) {
          flushAndSend();
        }
      }, SILENCE_TIMEOUT);
    };

    recognition.onresult = (event: any) => {
      if (!liveModeRef.current) return;

      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interim += t;
        }
      }

      if (mainTTS.isSpeaking || isSendingRef.current) {
        if (finalText || (interim && interim.split(" ").length >= 2)) {
          mainTTS.stop();
          mainTTS.setOnQueueDone(null);
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          setIsSending(false);
          isSendingRef.current = false;
          setStreamingMessages([]);
          setStreamingAgentId(null);
          setInterruptMessage(null);
          setLiveSpeaker("You");
          queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "messages"] });
        }
      }

      if (finalText) {
        pendingFinal += " " + finalText.trim();
        setInterimTranscript("");
        setLiveSpeaker("You");
        scheduleFlush();
      } else if (interim) {
        setInterimTranscript(pendingFinal ? pendingFinal.trim() + " " + interim : interim);
        setLiveSpeaker("You");
        scheduleFlush();
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      if (liveModeRef.current) {
        setTimeout(() => startLiveSTT(), 300);
      }
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (pendingFinal.trim() && liveModeRef.current && !isSendingRef.current) {
        const text = pendingFinal.trim();
        pendingFinal = "";
        setLiveSpeaker(null);
        setInterimTranscript("");
        handleSendMessageRef.current(text, true);
      }
    };

    liveRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {}
  }, [meetingId, mainTTS]);

  const toggleGeminiLive = useCallback(() => {
    if (geminiLive.isConnected) {
      geminiLive.disconnect();
      setLiveSpeaker(null);
      if (liveMode) {
        liveModeRef.current = false;
        setLiveMode(false);
      }
    } else {
      if (liveMode) {
        liveModeRef.current = false;
        setLiveMode(false);
        setInterimTranscript("");
        if (liveRecognitionRef.current) {
          try { liveRecognitionRef.current.abort(); } catch {}
          liveRecognitionRef.current = null;
        }
        mainTTS.stop();
      }
      liveModeRef.current = true;
      setLiveMode(true);
      geminiLive.connect();
    }
  }, [geminiLive, liveMode, mainTTS]);

  const toggleLiveMode = useCallback(() => {
    if (geminiLive.isConnected) {
      geminiLive.disconnect();
    }
    if (liveMode) {
      liveModeRef.current = false;
      setLiveMode(false);
      setLiveSpeaker(null);
      setInterimTranscript("");
      if (liveRecognitionRef.current) {
        try { liveRecognitionRef.current.abort(); } catch {}
        liveRecognitionRef.current = null;
      }
      mainTTS.stop();
    } else {
      liveModeRef.current = true;
      voiceModeRef.current = true;
      setLiveMode(true);
      setVoiceMode(true);
      startLiveSTT();
    }
  }, [liveMode, startLiveSTT, mainTTS, geminiLive]);

  const { data: meeting, isLoading: meetingLoading } = useQuery<Meeting>({
    queryKey: ["/api/meetings", meetingId],
    queryFn: () => fetch(`/api/meetings/${meetingId}`).then(r => r.json()),
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<MeetingMessage[]>({
    queryKey: ["/api/meetings", meetingId, "messages"],
    queryFn: () => fetch(`/api/meetings/${meetingId}/messages`).then(r => r.json()),
  });

  const { data: agents = [] } = useQuery<AgentPersona[]>({
    queryKey: ["/api/agents"],
  });

  useEffect(() => {
    if (meeting?.worldState) {
      const ws = meeting.worldState as WorldStateData;
      setWorldState(ws);
    }
  }, [meeting]);

  useEffect(() => {
    return () => {
      if (liveRecognitionRef.current) {
        try { liveRecognitionRef.current.abort(); } catch {}
        liveRecognitionRef.current = null;
      }
      liveModeRef.current = false;
      geminiLive.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!meetingId) return;
    fetch(`/api/meetings/${meetingId}/worldstate`)
      .then(r => r.json())
      .then(data => {
        if (data.worldState) setWorldState(data.worldState);
        if (data.mermaid) setMermaidSpec(data.mermaid);
        if (data.comparison) setComparison(data.comparison);
      })
      .catch(() => {});
  }, [meetingId]);

  const handleStopResponse = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSending(false);
    isSendingRef.current = false;
    setStreamingMessages([]);
    setPendingAgentSelect(false);
    setPendingUserMessage(null);
    mainTTS.stop();
    queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "messages"] });
  }, [meetingId, mainTTS]);

  const handleSendToAgent = useCallback(async (agentId: number) => {
    if (isSendingRef.current) return;
    const content = pendingUserMessage;
    setPendingAgentSelect(false);
    setPendingUserMessage(null);
    if (!content) return;

    if (agentId === -1) {
      handleSendMessageRef.current(content, true);
      return;
    }

    setIsSending(true);
    isSendingRef.current = true;
    setStreamingMessages([]);
    setInterruptMessage(null);
    setWorkflowStatus(prev => [...prev, `User message sent`]);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    await streamChat(
      `/api/meetings/${meetingId}/messages`,
      { content, senderName: "You", targetAgentIds: [agentId] },
      (data) => {
        switch (data.type) {
          case "agent_start":
            setStreamingAgentId(data.agentId);
            setStreamingMessages(prev => [
              ...prev,
              { agentId: data.agentId, agentName: data.agentName, content: "", isComplete: false }
            ]);
            break;
          case "agent_chunk":
            setStreamingMessages(prev =>
              prev.map(sm =>
                sm.agentId === data.agentId
                  ? { ...sm, content: sm.content + data.content }
                  : sm
              )
            );
            break;
          case "agent_done":
            setStreamingMessages(prev => {
              const msg = prev.find(sm => sm.agentId === data.agentId);
              if (msg && (voiceModeRef.current || liveModeRef.current)) {
                mainTTS.speak(msg.content, msg.agentName);
              }
              return prev.map(sm =>
                sm.agentId === data.agentId ? { ...sm, isComplete: true } : sm
              );
            });
            setStreamingAgentId(null);
            break;
          case "worldstate_updated":
            setIsWorldStateUpdating(false);
            if (data.worldState) setWorldState(data.worldState);
            if (data.mermaid) setMermaidSpec(data.mermaid);
            if (data.comparison) setComparison(data.comparison);
            break;
          case "interrupt":
            if (data.action?.interruptReason) setInterruptMessage(data.action.interruptReason);
            break;
          case "counterfactuals":
            if (data.counterfactuals) setCounterfactuals(data.counterfactuals);
            break;
          case "done":
            setIsSending(false);
            isSendingRef.current = false;
            setStreamingMessages([]);
            abortControllerRef.current = null;
            queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "messages"] });
            if (liveModeRef.current) {
              setTimeout(() => { if (liveModeRef.current) startLiveSTT(); }, 200);
            }
            break;
        }
      },
      () => { setIsSending(false); isSendingRef.current = false; abortControllerRef.current = null; },
      ac.signal
    );
  }, [meetingId, pendingUserMessage]);

  const handleSendMessage = useCallback(async (content: string, skipAgentSelect?: boolean) => {
    if (!skipAgentSelect && !liveModeRef.current) {
      setPendingUserMessage(content);
      setPendingAgentSelect(true);
      return;
    }

    setIsSending(true);
    isSendingRef.current = true;
    setStreamingMessages([]);
    setInterruptMessage(null);
    setWorkflowStatus(prev => [...prev, `User message sent`]);

    const ac = new AbortController();
    abortControllerRef.current = ac;

    await streamChat(
      `/api/meetings/${meetingId}/messages`,
      { content, senderName: "You" },
      (data) => {
        switch (data.type) {
          case "agent_start":
            setStreamingAgentId(data.agentId);
            setStreamingMessages(prev => [
              ...prev,
              { agentId: data.agentId, agentName: data.agentName, content: "", isComplete: false }
            ]);
            setWorkflowStatus(prev => [...prev, `${data.agentName} is responding...`]);
            break;
          case "agent_chunk":
            setStreamingMessages(prev =>
              prev.map(sm =>
                sm.agentId === data.agentId
                  ? { ...sm, content: sm.content + data.content }
                  : sm
              )
            );
            break;
          case "agent_done":
            setStreamingMessages(prev => {
              const msg = prev.find(sm => sm.agentId === data.agentId);
              if (msg && (voiceModeRef.current || liveModeRef.current)) {
                mainTTS.speak(msg.content, msg.agentName);
              }
              if (msg && liveModeRef.current) {
                setLiveSpeaker(msg.agentName);
              }
              return prev.map(sm =>
                sm.agentId === data.agentId
                  ? { ...sm, isComplete: true }
                  : sm
              );
            });
            setStreamingAgentId(null);
            setWorkflowStatus(prev => [...prev, `${data.data?.senderName} finished`]);
            break;
          case "worldstate_updating":
            setIsWorldStateUpdating(true);
            setWorkflowStatus(prev => [...prev, "World Compiler processing..."]);
            break;
          case "worldstate_updated":
            setIsWorldStateUpdating(false);
            if (data.worldState) setWorldState(data.worldState);
            if (data.mermaid) setMermaidSpec(data.mermaid);
            if (data.comparison) setComparison(data.comparison);
            setWorkflowStatus(prev => [...prev, `WorldState v${data.worldState?.version || "?"} compiled`]);
            break;
          case "interrupt":
            if (data.action?.interruptReason) {
              setInterruptMessage(data.action.interruptReason);
              if (voiceModeRef.current || liveModeRef.current) {
                ttsQueueRef.current.push({ text: data.action.interruptReason, agentName: "co-founder" });
              }
            }
            setWorkflowStatus(prev => [...prev, "co-founder INTERRUPTED"]);
            break;
          case "counterfactuals":
            if (data.counterfactuals) {
              setCounterfactuals(data.counterfactuals);
            }
            setWorkflowStatus(prev => [...prev, `${data.counterfactuals?.length || 0} counterfactuals generated`]);
            break;
          case "done":
            setIsSending(false);
            isSendingRef.current = false;
            setStreamingMessages([]);
            abortControllerRef.current = null;
            queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "messages"] });

            if (liveModeRef.current) {
              setTimeout(() => {
                if (liveModeRef.current) startLiveSTT();
              }, 200);
            }
            break;
        }
      },
      () => {
        setIsSending(false);
        isSendingRef.current = false;
        abortControllerRef.current = null;
      },
      ac.signal
    );
  }, [meetingId, startLiveSTT]);

  handleSendMessageRef.current = handleSendMessage;

  const handleEndMeeting = async () => {
    if (geminiLive.isConnected) {
      geminiLive.disconnect();
    }
    if (liveMode) {
      liveModeRef.current = false;
      setLiveMode(false);
      setLiveSpeaker(null);
      setInterimTranscript("");
      if (liveRecognitionRef.current) {
        try { liveRecognitionRef.current.abort(); } catch {}
        liveRecognitionRef.current = null;
      }
      mainTTS.stop();
    }
    setIsSummarizing(true);
    setWorkflowStatus(prev => [...prev, "Consensus Engine activated..."]);

    await streamChat(
      `/api/meetings/${meetingId}/summarize`,
      {},
      (data) => {
        if (data.type === "summary") {
          setSummaryArtifacts(data.artifacts || []);
          setSummaryDecisions(data.decisions || []);
          setSummaryTasks(data.tasks || []);
          setWorkflowStatus(prev => [
            ...prev,
            `Generated ${data.artifacts?.length || 0} documents`,
            `Recorded ${data.decisions?.length || 0} decisions`,
            `Created ${data.tasks?.length || 0} tasks`,
          ]);
        }
        if (data.type === "code_start") {
          setWorkflowStatus(prev => [...prev, "Coding Agent generating implementation..."]);
        }
        if (data.type === "code_complete") {
          setWorkflowStatus(prev => [...prev, "Code implementation generated and saved"]);
        }
        if (data.type === "code_error") {
          setWorkflowStatus(prev => [...prev, "Code generation skipped"]);
        }
      },
      () => {
        setIsSummarizing(false);
        queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId] });
        if (meeting?.workspaceId) {
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", meeting.workspaceId, "artifacts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", meeting.workspaceId, "decisions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", meeting.workspaceId, "tasks"] });
        }
        toast({ title: "Meeting ended", description: "Decision memory saved. Code & artifacts generated." });
      }
    );
  };

  if (meetingLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Meeting not found</p>
      </div>
    );
  }

  const agentIds = (meeting.agentIds as number[]) || [];

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            data-testid="button-back-workspace"
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/workspace/${meeting.workspaceId}`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate" data-testid="text-meeting-title">
              {meeting.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {meeting.status === "active" ? "In Progress" : "Ended"} - {agentIds.length + 1} participants
              </p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid="badge-ai-provider">
                Gemini 2.5
              </Badge>
              {worldState && worldState.version > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  WorldState v{worldState.version}
                </Badge>
              )}
              {liveMode && !geminiLive.isConnected && <LiveBadge />}
              {geminiLive.isConnected && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/15 border border-purple-500/30" data-testid="badge-gemini-live">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-purple-400 tracking-wider">GEMINI LIVE</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {meeting.status === "active" && (
            <Button
              data-testid="button-end-meeting"
              variant="destructive"
              size="sm"
              onClick={handleEndMeeting}
              disabled={isSummarizing || isSending}
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Summarizing...
                </>
              ) : (
                <>
                  <StopCircle className="w-3.5 h-3.5 mr-1.5" />
                  End Meeting
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-[340px] border-r border-border flex-shrink-0 flex flex-col min-h-0">
          <ChatPanel
            messages={messages}
            streamingMessages={streamingMessages}
            agents={agents}
            agentIds={(meeting.agentIds as number[]) || []}
            onSend={handleSendMessage}
            onSendToAgent={handleSendToAgent}
            onStopResponse={handleStopResponse}
            isSending={isSending}
            meetingStatus={meeting.status}
            interruptMessage={interruptMessage}
            voiceMode={voiceMode}
            onToggleVoiceMode={() => {
              const next = !voiceMode;
              setVoiceMode(next);
              voiceModeRef.current = next;
              if (!next) mainTTS.stop();
            }}
            liveMode={liveMode}
            onToggleLiveMode={toggleLiveMode}
            liveSpeaker={liveSpeaker}
            interimTranscript={interimTranscript}
            pendingAgentSelect={pendingAgentSelect}
            ttsPlaying={mainTTS.isSpeaking}
            geminiLiveStatus={geminiLive.status}
            onToggleGeminiLive={toggleGeminiLive}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {isSummarizing ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Consensus Engine Active</p>
                <p className="text-sm text-muted-foreground mt-1">Analyzing transcript & generating code...</p>
              </div>
              {workflowStatus.length > 0 && (
                <div className="mt-2 space-y-1 text-center">
                  {workflowStatus.slice(-4).map((s, i) => (
                    <p key={i} className="text-xs text-muted-foreground animate-in fade-in">{s}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <LiveCanvas
              worldState={worldState}
              mermaidSpec={mermaidSpec}
              comparison={comparison}
              counterfactuals={counterfactuals}
              isUpdating={isWorldStateUpdating}
              userId={user?.uid || null}
              meetingId={meetingId}
              meetingStatus={meeting.status}
            />
          )}
        </div>

        <div className="w-[260px] border-l border-border flex-shrink-0 flex flex-col min-h-0">
          <RightPanel
            agents={agents}
            agentIds={agentIds}
            workflowStatus={workflowStatus}
            streamingAgentId={streamingAgentId}
            worldState={worldState}
          />
        </div>
      </div>
    </div>
  );
}
