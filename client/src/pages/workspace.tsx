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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AgentAvatar } from "@/components/agent-avatar";
import {
  ArrowLeft, Plus, MessageSquare, FileText, CheckCircle2, ListTodo,
  Clock, Circle, CheckCircle, AlertCircle, Users, Sparkles,
  Rocket, FlaskConical, TrendingUp, Briefcase, Play, Loader2,
  Bot, Zap, Eye, FileCode, Brain, Download, Shield, GitBranch,
  ChevronDown, ChevronRight, Target, Pencil, Trash2, Volume2,
  Code2, Copy, Check,
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
  const effectiveProvider = "gemini";

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
    if (id === "gemini") return "Gemini 2.5 Flash";
    return "Gemini";
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

              <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/50">
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Google Gemini 2.5 Flash</p>
                  <p className="text-xs text-muted-foreground">Primary AI Engine</p>
                </div>
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

function CodeArtifactView({ artifact }: { artifact: Artifact }) {
  const [copied, setCopied] = useState(false);
  const content = artifact.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileBlocks = content.split(/\/\/ === FILE: /g).filter(Boolean);
  const hasMultipleFiles = fileBlocks.length > 1 || content.includes("// === FILE:");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">code</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(artifact.createdAt).toLocaleDateString()}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy} data-testid="button-copy-artifact-code">
          {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
          {copied ? "Copied" : "Copy All"}
        </Button>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-4" data-testid="text-artifact-title">
        {artifact.title}
      </h3>
      {hasMultipleFiles ? (
        <div className="space-y-3">
          {fileBlocks.map((block, i) => {
            const lines = block.split("\n");
            const fileName = i === 0 && !content.startsWith("// === FILE:") ? null : lines[0]?.replace(/\s*===\s*$/, "").trim();
            const fileContent = fileName ? lines.slice(1).join("\n").trim() : block.trim();
            return (
              <div key={i} className="rounded-md border border-border overflow-hidden">
                {fileName && (
                  <div className="px-3 py-1.5 bg-muted border-b border-border flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-mono text-foreground">{fileName}</span>
                  </div>
                )}
                <pre className="p-4 text-[12px] font-mono text-foreground bg-black/20 overflow-x-auto whitespace-pre-wrap leading-relaxed" data-testid={`code-file-${i}`}>
                  {fileContent}
                </pre>
              </div>
            );
          })}
        </div>
      ) : (
        <pre className="p-4 text-[12px] font-mono text-foreground bg-black/20 rounded-md border border-border overflow-x-auto whitespace-pre-wrap leading-relaxed" data-testid="code-artifact-content">
          {content}
        </pre>
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
            {selectedArtifact.type === "code" ? (
              <CodeArtifactView artifact={selectedArtifact} />
            ) : (
              <>
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
              </>
            )}
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
                {a.type === "code" ? (
                  <Code2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
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
  const [copied, setCopied] = useState(false);
  const { data: decisions, isLoading } = useQuery<Decision[]>({
    queryKey: ["/api/workspaces", workspaceId, "decisions"],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/decisions`).then(r => r.json()),
  });

  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: ["/api/workspaces", workspaceId, "meetings"],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/meetings`).then(r => r.json()),
  });

  const worldStateDecisions = (meetings || [])
    .filter(m => m.worldState && (m.worldState as any).decisions?.length > 0)
    .flatMap(m => ((m.worldState as any).decisions || []).map((d: any) => ({ ...d, meetingTitle: m.title })));

  const allDecisions = [
    ...(decisions || []).map(d => ({ type: "formal" as const, id: d.id, title: d.title, description: d.description, status: d.status })),
    ...worldStateDecisions.map((d: any) => ({ type: "worldstate" as const, id: d.id, title: d.title, reasoning: d.reasoning, rejectedOptions: d.rejectedOptions, premises: d.premises, meetingTitle: d.meetingTitle, timestamp: d.timestamp })),
  ];

  const handleExport = () => {
    const exportData = {
      workspace_id: workspaceId,
      exported_at: new Date().toISOString(),
      decisions: allDecisions,
      worldstate_decisions: worldStateDecisions,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decision-memory-${workspaceId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = () => {
    const text = allDecisions.map(d => {
      if (d.type === "worldstate") {
        const ws = d as any;
        let s = `## ${ws.title}\nReasoning: ${ws.reasoning || ""}`;
        if (ws.premises?.length) s += `\nPremises: ${ws.premises.join(", ")}`;
        if (ws.rejectedOptions?.length) s += `\nRejected: ${ws.rejectedOptions.map((r: any) => r.reason).join("; ")}`;
        return s;
      }
      return `## ${d.title}\n${d.description || ""}`;
    }).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>;

  return allDecisions.length > 0 ? (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopyAll} data-testid="button-copy-decisions">
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied" : "Copy All"}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExport} data-testid="button-export-decisions">
          <Download className="w-3 h-3 mr-1" />
          Export JSON
        </Button>
      </div>
      <div className="space-y-3">
        {allDecisions.map((d, i) => (
          <Card key={`${d.type}-${d.id}-${i}`} className="p-4 border-card-border" data-testid={`card-decision-${d.type}-${i}`}>
            <div className="flex items-start gap-3">
              {d.type === "worldstate" ? (
                <Brain className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground">{d.title}</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {d.type === "worldstate" ? "WorldState" : "Formal"}
                  </Badge>
                </div>
                {d.type === "formal" && d.description && (
                  <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                )}
                {d.type === "worldstate" && (
                  <>
                    {(d as any).reasoning && (
                      <p className="text-sm text-muted-foreground mt-1">{(d as any).reasoning}</p>
                    )}
                    {(d as any).premises?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Premises
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(d as any).premises.map((p: string, j: number) => (
                            <Badge key={j} variant="secondary" className="text-[10px]">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {(d as any).rejectedOptions?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Rejected Alternatives
                        </p>
                        {(d as any).rejectedOptions.map((r: any, j: number) => (
                          <p key={j} className="text-xs text-muted-foreground ml-4 mt-0.5">• {r.reason}</p>
                        ))}
                      </div>
                    )}
                    {(d as any).meetingTitle && (
                      <p className="text-[10px] text-muted-foreground mt-2">From: {(d as any).meetingTitle}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  ) : (
    <Card className="p-8 text-center border-card-border">
      <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">No decisions recorded yet.</p>
      <p className="text-xs text-muted-foreground mt-1">Start a meeting and end it to see decision memory here.</p>
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

interface DecisionMemoryEntry {
  meetingId: number;
  title: string;
  status: string;
  createdAt: string;
  worldStateVersion: number;
  decisions: { id: string; title: string; chosenOptionId: string; reasoning: string; rejectedOptions: { optionId: string; reason: string }[]; premises: string[]; timestamp: string }[];
  assumptions: { id: string; text: string; basis: string; confidence: number; challengedBy: string | null; status: string }[];
  options: { id: string; title: string; description: string; pros: string[]; cons: string[] }[];
  scenarios: { id: string; label: string; type: string; optionId: string; metrics: Record<string, any>; description: string }[];
}

function DecisionMemoryTab({ workspaceId }: { workspaceId: number }) {
  const { toast } = useToast();
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null);

  const { data: memories, isLoading } = useQuery<DecisionMemoryEntry[]>({
    queryKey: ["/api/workspaces", workspaceId, "decision-memory"],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/decision-memory`).then(r => r.json()),
  });

  const handleExport = async (meetingId: number) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/decision-memory`);
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `decision-memory-${meetingId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Decision memory downloaded as JSON." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}</div>;

  if (!memories || memories.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No decision memory recorded yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a meeting and discuss strategic options. The AI will track decisions, assumptions, and alternatives.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {memories.map(mem => {
        const isExpanded = expandedMeeting === mem.meetingId;
        const hasDecisions = mem.decisions.length > 0;
        const hasAssumptions = mem.assumptions.length > 0;

        return (
          <Card key={mem.meetingId} className="border-card-border overflow-hidden" data-testid={`memory-meeting-${mem.meetingId}`}>
            <div
              className="p-4 flex items-center gap-3 cursor-pointer"
              onClick={() => setExpandedMeeting(isExpanded ? null : mem.meetingId)}
              data-testid={`button-expand-memory-${mem.meetingId}`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <Brain className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{mem.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">
                    WorldState v{mem.worldStateVersion}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {mem.decisions.length} decisions - {mem.assumptions.length} assumptions - {mem.options.length} options
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleExport(mem.meetingId); }}
                data-testid={`button-export-memory-${mem.meetingId}`}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
            </div>

            {isExpanded && (
              <div className="border-t border-border">
                {hasDecisions && (
                  <div className="p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5" />
                      Decisions Made
                    </h4>
                    <div className="space-y-3">
                      {mem.decisions.map((d, i) => (
                        <Card key={i} className="p-3 bg-green-500/5 border-green-500/20" data-testid={`decision-detail-${i}`}>
                          <p className="text-sm font-semibold text-foreground">{d.title}</p>
                          {d.reasoning && (
                            <p className="text-xs text-muted-foreground mt-1">{d.reasoning}</p>
                          )}
                          {d.premises && d.premises.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Premises</p>
                              <ul className="space-y-0.5">
                                {d.premises.map((p, j) => (
                                  <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                    <span className="text-green-500 mt-0.5">-</span>
                                    {p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {d.rejectedOptions && d.rejectedOptions.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1">Rejected Alternatives</p>
                              {d.rejectedOptions.map((ro, j) => (
                                <div key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-red-400 mt-0.5">x</span>
                                  <span><span className="font-medium">{ro.optionId}</span>: {ro.reason}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {hasAssumptions && (
                  <div className="p-4 border-t border-border">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Assumption Log
                    </h4>
                    <div className="space-y-2">
                      {mem.assumptions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs" data-testid={`assumption-log-${i}`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            a.status === "confirmed" ? "bg-green-500" :
                            a.status === "challenged" ? "bg-yellow-500" :
                            a.status === "invalidated" ? "bg-red-500" : "bg-blue-500"
                          }`} />
                          <span className="text-foreground flex-1">{a.text}</span>
                          <span className="text-muted-foreground font-mono">{a.confidence}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mem.scenarios.length > 0 && (
                  <div className="p-4 border-t border-border">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" />
                      Scenario Analysis
                    </h4>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(mem.scenarios.length, 3)}, 1fr)` }}>
                      {mem.scenarios.map((s, i) => (
                        <Card key={i} className="p-2.5 text-xs" data-testid={`scenario-memory-${i}`}>
                          <Badge variant="outline" className="text-[10px] mb-1">{s.type}</Badge>
                          <p className="font-medium text-foreground">{s.label}</p>
                          <p className="text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

const AGENT_COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#06B6D4",
];

function AgentsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentPersona | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [color, setColor] = useState(AGENT_COLORS[0]);
  const [voiceId, setVoiceId] = useState("");
  const [previewVoiceLoading, setPreviewVoiceLoading] = useState(false);

  const { data: agents, isLoading } = useQuery<AgentPersona[]>({
    queryKey: ["/api/agents"],
  });

  const { data: elevenLabsVoices } = useQuery<{ voice_id: string; name: string; labels: Record<string, string> }[]>({
    queryKey: ["/api/tts/voices"],
    queryFn: () => fetch("/api/tts/voices").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/agents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      resetForm();
      toast({ title: "Agent created" });
    },
    onError: () => toast({ title: "Failed to create agent", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      resetForm();
      toast({ title: "Agent updated" });
    },
    onError: () => toast({ title: "Failed to update agent", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/agents/${id}`);
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent deleted" });
    },
    onError: (err: Error) => toast({ title: err.message || "Failed to delete agent", variant: "destructive" }),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditingAgent(null);
    setName("");
    setRole("");
    setSystemPrompt("");
    setColor(AGENT_COLORS[0]);
    setVoiceId("");
  };

  const openEdit = (agent: AgentPersona) => {
    setEditingAgent(agent);
    setName(agent.name);
    setRole(agent.role);
    setSystemPrompt(agent.systemPrompt);
    setColor(agent.color || AGENT_COLORS[0]);
    setVoiceId(agent.voiceId || "");
    setDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!name.trim() || !role.trim() || !systemPrompt.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const payload = {
      name: name.trim(),
      role: role.trim(),
      systemPrompt: systemPrompt.trim(),
      color,
      voiceId: voiceId && voiceId !== "none" ? voiceId : null,
    };

    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const previewVoice = async (vId: string) => {
    if (!vId || vId === "none") return;
    setPreviewVoiceLoading(true);
    try {
      const res = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `Hello, I'm ${name || "your AI agent"}. I'm ready to help with ${role || "your project"}.`, agentName: name || "preview", voiceId: vId }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
    } catch {
      toast({ title: "Voice preview failed", variant: "destructive" });
    } finally {
      setPreviewVoiceLoading(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-medium text-foreground">AI Agents</h3>
        <Button size="sm" onClick={openCreate} data-testid="button-add-agent">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Agent
        </Button>
      </div>

      <div className="grid gap-3">
        {agents?.map(agent => (
          <Card key={agent.id} className="p-4" data-testid={`card-agent-${agent.id}`}>
            <div className="flex items-start gap-3">
              <AgentAvatar avatar={agent.avatar} color={agent.color} size="md" name={agent.name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-foreground" data-testid={`text-agent-name-${agent.id}`}>{agent.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{agent.role}</Badge>
                  {agent.voiceId && (
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      <Volume2 className="w-2.5 h-2.5" />
                      Voice
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{agent.systemPrompt}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(agent)} data-testid={`button-edit-agent-${agent.id}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => {
                    if (confirm(`Delete agent "${agent.name}"?`)) {
                      deleteMutation.mutate(agent.id);
                    }
                  }}
                  data-testid={`button-delete-agent-${agent.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {(!agents || agents.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No agents yet. Create your first AI agent to get started.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "Edit Agent" : "Create Agent"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
              <Input
                data-testid="input-agent-name"
                placeholder="e.g. Atlas, Luna, Kai..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Role *</label>
              <Input
                data-testid="input-agent-role"
                placeholder="e.g. Strategy Advisor, Legal Expert, Marketing Lead..."
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">System Prompt *</label>
              <Textarea
                data-testid="input-agent-prompt"
                placeholder="Define this agent's personality, expertise, and behavior..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {AGENT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    data-testid={`button-color-${c.replace("#", "")}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Voice</label>
              <div className="flex gap-2">
                <Select value={voiceId} onValueChange={setVoiceId}>
                  <SelectTrigger data-testid="select-agent-voice" className="flex-1">
                    <SelectValue placeholder="Select a voice (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No voice</SelectItem>
                    {elevenLabsVoices?.map(v => (
                      <SelectItem key={v.voice_id} value={v.voice_id} data-testid={`option-voice-${v.voice_id}`}>
                        {v.name} — {v.labels?.gender || "?"}, {v.labels?.accent || "?"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {voiceId && voiceId !== "none" && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => previewVoice(voiceId)}
                    disabled={previewVoiceLoading}
                    data-testid="button-preview-voice"
                  >
                    <Volume2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-agent">Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-agent"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {editingAgent ? "Save Changes" : "Create Agent"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
            <TabsTrigger value="memory" data-testid="tab-memory">
              <Brain className="w-4 h-4 mr-1.5" />
              Decision Memory
            </TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-agents">
              <Bot className="w-4 h-4 mr-1.5" />
              Agents
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
          <TabsContent value="memory">
            <DecisionMemoryTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="agents">
            <AgentsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
