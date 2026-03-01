import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AgentAvatar } from "@/components/agent-avatar";
import {
  ArrowLeft, Plus, MessageSquare, FileText, CheckCircle2, ListTodo,
  Clock, Circle, CheckCircle, AlertCircle, Users, Sparkles,
  Rocket, FlaskConical, TrendingUp, Briefcase, Play, Loader2,
  Bot, Zap, Eye, FileCode,
} from "lucide-react";
import type { Workspace, Meeting, AgentPersona, Artifact, Decision, Task } from "@shared/schema";

const iconMap: Record<string, typeof Rocket> = {
  rocket: Rocket,
  flask: FlaskConical,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
};

function MeetingsTab({ workspaceId }: { workspaceId: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [aiProvider, setAiProvider] = useState<string>("");

  const { data: meetings, isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/workspaces", workspaceId, "meetings"],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/meetings`).then(r => r.json()),
  });

  const { data: agents } = useQuery<AgentPersona[]>({
    queryKey: ["/api/agents"],
  });

  const { data: providerData } = useQuery<{ providers: { id: string; name: string; available: boolean }[]; default: string }>({
    queryKey: ["/api/providers"],
  });

  const availableProviders = providerData?.providers.filter(p => p.available) || [];
  const effectiveProvider = aiProvider || providerData?.default || "openai";

  const createMeeting = useMutation({
    mutationFn: (data: { title: string; agentIds: number[]; aiProvider: string }) =>
      apiRequest("POST", `/api/workspaces/${workspaceId}/meetings`, data),
    onSuccess: async (response) => {
      const meeting = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "meetings"] });
      setDialogOpen(false);
      setTitle("");
      setSelectedAgents([]);
      setLocation(`/meeting/${meeting.id}`);
    },
  });

  const toggleAgent = (id: number) => {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const providerLabel = (id: string) => {
    if (id === "openai") return "OpenAI GPT-5.2";
    if (id === "gemini") return "Google Gemini 2.5";
    return id;
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-medium text-foreground">Meetings</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-meeting" size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              New Meeting
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a Meeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Input
                data-testid="input-meeting-title"
                placeholder="Meeting topic"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div>
                <p className="text-sm font-medium mb-2 text-foreground">AI Provider</p>
                <Select value={effectiveProvider} onValueChange={setAiProvider}>
                  <SelectTrigger data-testid="select-ai-provider">
                    <SelectValue placeholder="Select AI provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.length > 0 ? (
                      availableProviders.map(p => (
                        <SelectItem key={p.id} value={p.id} data-testid={`option-provider-${p.id}`}>
                          {p.name}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="openai">OpenAI GPT-5.2</SelectItem>
                        <SelectItem value="gemini">Google Gemini 2.5</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm font-medium mb-3 text-foreground">Select AI Agents</p>
                <div className="space-y-2">
                  {agents?.map(agent => (
                    <div
                      key={agent.id}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedAgents.includes(agent.id) ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      onClick={() => toggleAgent(agent.id)}
                      data-testid={`toggle-agent-${agent.id}`}
                    >
                      <Checkbox checked={selectedAgents.includes(agent.id)} />
                      <AgentAvatar avatar={agent.avatar} color={agent.color} size="sm" name={agent.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                data-testid="button-start-meeting"
                className="w-full"
                onClick={() => createMeeting.mutate({ title, agentIds: selectedAgents, aiProvider: effectiveProvider })}
                disabled={!title.trim() || selectedAgents.length === 0 || createMeeting.isPending}
              >
                {createMeeting.isPending ? "Starting..." : "Start Meeting"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}
        </div>
      ) : meetings && meetings.length > 0 ? (
        <div className="space-y-3">
          {meetings.map(m => (
            <Card
              key={m.id}
              className="p-4 cursor-pointer hover-elevate border-card-border"
              onClick={() => setLocation(`/meeting/${m.id}`)}
              data-testid={`card-meeting-${m.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{m.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {providerLabel(m.aiProvider)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Badge variant={m.status === "active" ? "default" : "secondary"}>
                  {m.status === "active" ? "Active" : "Ended"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-card-border">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No meetings yet. Start one to collaborate with AI agents.</p>
        </Card>
      )}
    </div>
  );
}

function ArtifactsTab({ workspaceId }: { workspaceId: number }) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const { data: artifacts, isLoading } = useQuery<Artifact[]>({
    queryKey: ["/api/workspaces", workspaceId, "artifacts"],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/artifacts`).then(r => r.json()),
  });

  if (isLoading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}</div>;

  return (
    <div>
      {selectedArtifact ? (
        <div>
          <Button data-testid="button-back-artifacts" variant="ghost" size="sm" onClick={() => setSelectedArtifact(null)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <Card className="p-6 border-card-border">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Badge variant="secondary">{selectedArtifact.type.replace(/_/g, " ")}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(selectedArtifact.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-4" data-testid="text-artifact-title">
              {selectedArtifact.title}
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-artifact-content">
              {selectedArtifact.content.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </Card>
        </div>
      ) : artifacts && artifacts.length > 0 ? (
        <div className="space-y-3">
          {artifacts.map(a => (
            <Card
              key={a.id}
              className="p-4 cursor-pointer hover-elevate border-card-border"
              onClick={() => setSelectedArtifact(a)}
              data-testid={`card-artifact-${a.id}`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.type.replace(/_/g, " ")}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-card-border">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No artifacts yet. End a meeting to generate documents.</p>
        </Card>
      )}
    </div>
  );
}

function DecisionsTab({ workspaceId }: { workspaceId: number }) {
  const { data: decisions, isLoading } = useQuery<Decision[]>({
    queryKey: ["/api/workspaces", workspaceId, "decisions"],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/decisions`).then(r => r.json()),
  });

  if (isLoading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>;

  return decisions && decisions.length > 0 ? (
    <div className="space-y-3">
      {decisions.map(d => (
        <Card key={d.id} className="p-4 border-card-border" data-testid={`card-decision-${d.id}`}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{d.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  ) : (
    <Card className="p-8 text-center border-card-border">
      <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">No decisions recorded yet.</p>
    </Card>
  );
}

function TasksTab({ workspaceId }: { workspaceId: number }) {
  const { toast } = useToast();
  const [executingId, setExecutingId] = useState<number | null>(null);
  const [executionResult, setExecutionResult] = useState<{ taskId: number; result: string } | null>(null);

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/workspaces", workspaceId, "tasks"],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/tasks`).then(r => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/tasks/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "tasks"] }),
  });

  const handleExecuteTask = useCallback(async (taskId: number) => {
    setExecutingId(taskId);
    let result = "";

    await streamChat(
      `/api/tasks/${taskId}/execute`,
      {},
      (data) => {
        if (data.type === "chunk" && data.content) {
          result += data.content;
          setExecutionResult({ taskId, result });
        }
        if (data.type === "complete") {
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "tasks"] });
          toast({ title: "Task executed", description: "OpenClaw has completed the task." });
        }
      },
      () => {
        setExecutingId(null);
      }
    );
  }, [workspaceId, toast]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const executionTypeBadge = (type: string | null) => {
    if (!type || type === "manual") return null;
    if (type === "ai_draft") return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
        <FileCode className="w-2.5 h-2.5" />
        AI Draft
      </Badge>
    );
    if (type === "ai_research") return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
        <Bot className="w-2.5 h-2.5" />
        AI Research
      </Badge>
    );
    return null;
  };

  if (isLoading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>;

  return (
    <div>
      {executionResult && (
        <Card className="p-4 border-card-border mb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">OpenClaw Execution Result</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExecutionResult(null)}
              data-testid="button-close-execution"
            >
              Close
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none max-h-64 overflow-y-auto" data-testid="text-execution-result">
            {executionResult.result.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {executingId === executionResult.taskId && (
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse" />
            )}
          </div>
        </Card>
      )}

      {tasks && tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map(t => (
            <Card key={t.id} className="p-4 border-card-border" data-testid={`card-task-${t.id}`}>
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 flex-shrink-0"
                  onClick={() => updateStatus.mutate({
                    id: t.id,
                    status: t.status === "completed" ? "pending" : "completed"
                  })}
                  data-testid={`button-toggle-task-${t.id}`}
                >
                  {statusIcon(t.status)}
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {t.title}
                    </p>
                    {executionTypeBadge(t.executionType)}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {t.assignee && (
                      <span className="text-xs text-muted-foreground">
                        Assigned to: {t.assignee}
                      </span>
                    )}
                    {t.executionResult && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => setExecutionResult({ taskId: t.id, result: t.executionResult! })}
                        data-testid={`button-view-result-${t.id}`}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Result
                      </Button>
                    )}
                  </div>
                </div>
                {t.executionType && t.executionType !== "manual" && t.status !== "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => handleExecuteTask(t.id)}
                    disabled={executingId !== null}
                    data-testid={`button-execute-task-${t.id}`}
                  >
                    {executingId === t.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 mr-1.5" />
                        Execute
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-card-border">
          <ListTodo className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No tasks yet.</p>
        </Card>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const workspaceId = parseInt(params.id || "0");

  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Workspace not found</p>
      </div>
    );
  }

  const Icon = iconMap[workspace.icon || "briefcase"] || Briefcase;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Button
          data-testid="button-back-dashboard"
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          All Workspaces
        </Button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-workspace-title">
              {workspace.name}
            </h1>
            <p className="text-muted-foreground">{workspace.description}</p>
          </div>
        </div>

        <Tabs defaultValue="meetings">
          <TabsList className="mb-6">
            <TabsTrigger value="meetings" data-testid="tab-meetings">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Meetings
            </TabsTrigger>
            <TabsTrigger value="artifacts" data-testid="tab-artifacts">
              <FileText className="w-4 h-4 mr-1.5" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="decisions" data-testid="tab-decisions">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Decisions
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">
              <ListTodo className="w-4 h-4 mr-1.5" />
              Tasks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meetings">
            <MeetingsTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="artifacts">
            <ArtifactsTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="decisions">
            <DecisionsTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="tasks">
            <TasksTab workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
