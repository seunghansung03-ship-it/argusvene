import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AgentAvatar } from "@/components/agent-avatar";
import {
  ArrowLeft, Send, FileText, CheckCircle2, ListTodo,
  Loader2, User, Sparkles, StopCircle, Brain,
  Activity, Clock, FileCode, Eye,
} from "lucide-react";
import type { Meeting, MeetingMessage, AgentPersona, Artifact, Decision, Task } from "@shared/schema";

interface StreamingMessage {
  agentId: number;
  agentName: string;
  content: string;
  isComplete: boolean;
}

function ChatPanel({
  messages,
  streamingMessages,
  agents,
  onSend,
  isSending,
  meetingStatus,
}: {
  messages: MeetingMessage[];
  streamingMessages: StreamingMessage[];
  agents: AgentPersona[];
  onSend: (msg: string) => void;
  isSending: boolean;
  meetingStatus: string;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessages]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    onSend(input.trim());
    setInput("");
  };

  const agentMap = new Map(agents.map(a => [a.id, a]));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="font-semibold text-sm text-foreground">Discussion</span>
        <Badge variant="secondary" className="text-xs">
          {messages.length} messages
        </Badge>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => {
          const agent = msg.agentId ? agentMap.get(msg.agentId) : null;
          const isHuman = msg.senderType === "human";

          return (
            <div key={msg.id} className="group" data-testid={`message-${msg.id}`}>
              <div className="flex items-start gap-2.5">
                {isHuman ? (
                  <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-secondary-foreground" />
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
                    <span className="text-sm font-semibold text-foreground">{msg.senderName}</span>
                    {agent && (
                      <span className="text-xs text-muted-foreground">{agent.role}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-sm text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
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

        {isSending && streamingMessages.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Agents are thinking...</span>
          </div>
        )}
      </div>

      {meetingStatus === "active" && (
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              data-testid="input-meeting-message"
              placeholder="Type your message..."
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
        </div>
      )}
    </div>
  );
}

function CenterStage({
  artifacts,
  decisions,
  tasks,
  isSummarizing,
  summaryArtifacts,
  summaryDecisions,
  summaryTasks,
}: {
  artifacts: Artifact[];
  decisions: Decision[];
  tasks: Task[];
  isSummarizing: boolean;
  summaryArtifacts: Artifact[];
  summaryDecisions: Decision[];
  summaryTasks: Task[];
}) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const allArtifacts = [...summaryArtifacts, ...artifacts];
  const allDecisions = [...summaryDecisions, ...decisions];
  const allTasks = [...summaryTasks, ...tasks];

  if (isSummarizing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Consensus Engine Active</p>
          <p className="text-sm text-muted-foreground mt-1">Analyzing transcript and generating artifacts...</p>
        </div>
      </div>
    );
  }

  if (selectedArtifact) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Button data-testid="button-back-stage" variant="ghost" size="sm" onClick={() => setSelectedArtifact(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Badge variant="secondary">{selectedArtifact.type.replace(/_/g, " ")}</Badge>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-bold text-foreground mb-4" data-testid="text-stage-artifact-title">
            {selectedArtifact.title}
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {selectedArtifact.content.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasContent = allArtifacts.length > 0 || allDecisions.length > 0 || allTasks.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Center Stage</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Generated documents, decisions, and structured content will appear here as the discussion progresses. End the meeting to activate the Consensus Engine.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm text-foreground">Generated Outputs</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {allArtifacts.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Documents
            </h4>
            <div className="space-y-2">
              {allArtifacts.map(a => (
                <Card
                  key={a.id}
                  className="p-3 cursor-pointer hover-elevate border-card-border"
                  onClick={() => setSelectedArtifact(a)}
                  data-testid={`stage-artifact-${a.id}`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.type.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {allDecisions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Decisions
            </h4>
            <div className="space-y-2">
              {allDecisions.map(d => (
                <Card key={d.id} className="p-3 border-card-border" data-testid={`stage-decision-${d.id}`}>
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {allTasks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5" />
              Action Items
            </h4>
            <div className="space-y-2">
              {allTasks.map(t => (
                <Card key={t.id} className="p-3 border-card-border" data-testid={`stage-task-${t.id}`}>
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  {t.assignee && (
                    <p className="text-xs text-muted-foreground mt-1">Assigned to: {t.assignee}</p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RightPanel({
  agents,
  agentIds,
  workflowStatus,
  streamingAgentId,
}: {
  agents: AgentPersona[];
  agentIds: number[];
  workflowStatus: string[];
  streamingAgentId: number | null;
}) {
  const activeAgents = agents.filter(a => agentIds.includes(a.id));

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm text-foreground">Agents & Workflow</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Active Agents
          </h4>
          <div className="space-y-2">
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
            {activeAgents.length === 0 && (
              <p className="text-sm text-muted-foreground">No agents in this meeting</p>
            )}
          </div>
        </div>

        <Separator />

        <div className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Workflow Status
          </h4>
          <div className="space-y-2">
            {workflowStatus.length > 0 ? (
              workflowStatus.map((status, i) => (
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
  const meetingId = parseInt(params.id || "0");

  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);
  const [streamingAgentId, setStreamingAgentId] = useState<number | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string[]>([]);
  const [summaryArtifacts, setSummaryArtifacts] = useState<Artifact[]>([]);
  const [summaryDecisions, setSummaryDecisions] = useState<Decision[]>([]);
  const [summaryTasks, setSummaryTasks] = useState<Task[]>([]);

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

  const { data: artifacts = [] } = useQuery<Artifact[]>({
    queryKey: ["/api/workspaces", meeting?.workspaceId, "artifacts"],
    queryFn: () => fetch(`/api/workspaces/${meeting?.workspaceId}/artifacts`).then(r => r.json()),
    enabled: !!meeting?.workspaceId,
  });

  const { data: decisions = [] } = useQuery<Decision[]>({
    queryKey: ["/api/workspaces", meeting?.workspaceId, "decisions"],
    queryFn: () => fetch(`/api/workspaces/${meeting?.workspaceId}/decisions`).then(r => r.json()),
    enabled: !!meeting?.workspaceId,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/workspaces", meeting?.workspaceId, "tasks"],
    queryFn: () => fetch(`/api/workspaces/${meeting?.workspaceId}/tasks`).then(r => r.json()),
    enabled: !!meeting?.workspaceId,
  });

  const handleSendMessage = useCallback(async (content: string) => {
    setIsSending(true);
    setStreamingMessages([]);
    setWorkflowStatus(prev => [...prev, `User message sent`]);

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
            setStreamingMessages(prev =>
              prev.map(sm =>
                sm.agentId === data.agentId
                  ? { ...sm, isComplete: true }
                  : sm
              )
            );
            setStreamingAgentId(null);
            setWorkflowStatus(prev => [...prev, `${data.data?.senderName} finished`]);
            break;
          case "done":
            setIsSending(false);
            setStreamingMessages([]);
            queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "messages"] });
            break;
        }
      },
      () => setIsSending(false)
    );
  }, [meetingId]);

  const handleEndMeeting = async () => {
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
      },
      () => {
        setIsSummarizing(false);
        queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId] });
        if (meeting?.workspaceId) {
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", meeting.workspaceId, "artifacts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", meeting.workspaceId, "decisions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", meeting.workspaceId, "tasks"] });
        }
        toast({ title: "Meeting ended", description: "Artifacts and decisions have been generated." });
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
            <p className="text-xs text-muted-foreground">
              {meeting.status === "active" ? "In Progress" : "Ended"} - {agentIds.length} agent{agentIds.length !== 1 ? "s" : ""}
            </p>
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
            onSend={handleSendMessage}
            isSending={isSending}
            meetingStatus={meeting.status}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <CenterStage
            artifacts={artifacts}
            decisions={decisions}
            tasks={tasks}
            isSummarizing={isSummarizing}
            summaryArtifacts={summaryArtifacts}
            summaryDecisions={summaryDecisions}
            summaryTasks={summaryTasks}
          />
        </div>

        <div className="w-[280px] border-l border-border flex-shrink-0 flex flex-col min-h-0">
          <RightPanel
            agents={agents}
            agentIds={agentIds}
            workflowStatus={workflowStatus}
            streamingAgentId={streamingAgentId}
          />
        </div>
      </div>
    </div>
  );
}
