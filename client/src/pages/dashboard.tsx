import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { streamChat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Send, Rocket, FlaskConical, TrendingUp, Briefcase,
  MessageSquare, FileText, CheckCircle2, ListTodo, ArrowRight,
  Sparkles, X, CheckCircle, XCircle, Zap, Loader2, LogOut, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { Workspace, Artifact, Decision, Task } from "@shared/schema";

const iconMap: Record<string, typeof Rocket> = {
  rocket: Rocket,
  flask: FlaskConical,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
};

type ChatMsg = { role: string; content: string; actions?: { action: string; success: boolean; message: string; data?: any }[] };

function ActionBadge({ result }: { result: { action: string; success: boolean; message: string } }) {
  const actionLabels: Record<string, string> = {
    create_workspace: "Workspace Created",
    list_workspaces: "Workspaces Listed",
    create_agent: "Agent Created",
    list_agents: "Agents Listed",
    create_meeting: "Meeting Created",
    list_meetings: "Meetings Listed",
    delete_workspace: "Workspace Deleted",
    update_agent: "Agent Updated",
  };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs ${result.success ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`} data-testid={`badge-action-${result.action}`}>
      {result.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      <span className="font-medium">{actionLabels[result.action] || result.action}</span>
    </div>
  );
}

function QuickIdeationBar() {
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [executingActions, setExecutingActions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || streaming) return;
    const userMsg = message.trim();
    setMessage("");
    setIsOpen(true);

    const newMessages: ChatMsg[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setStreaming(true);

    let assistantContent = "";
    const pendingActions: any[] = [];
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    await streamChat(
      "/api/quick-chat",
      { message: userMsg, history: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })) },
      (data) => {
        if (data.content !== undefined) {
          assistantContent += data.content;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: assistantContent, actions: [...pendingActions] };
            return updated;
          });
        }
        if (data.action) {
          pendingActions.push(data.action);
          setExecutingActions(true);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: assistantContent, actions: [...pendingActions] };
            return updated;
          });
          queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
          queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        }
      },
      () => {
        setStreaming(false);
        setExecutingActions(false);
        queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      }
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Sparkles className="w-5 h-5" />
        </div>
        <Input
          data-testid="input-quick-ideation"
          placeholder="Ask your AI Co-founder anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="pl-12 pr-12 bg-card border-card-border"
        />
        <Button
          data-testid="button-quick-send"
          size="icon"
          variant="ghost"
          className="absolute right-2 top-1/2 -translate-y-1/2"
          onClick={handleSend}
          disabled={!message.trim() || streaming}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {isOpen && messages.length > 0 && (
        <Card className="mt-3 border-card-border max-h-[400px] flex flex-col">
          <div className="flex items-center justify-between gap-1 px-4 py-2 border-b border-card-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Co-founder Assistant</span>
              {executingActions && (
                <Badge variant="outline" className="text-[10px] gap-1 text-amber-400 border-amber-400/30">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Executing...
                </Badge>
              )}
            </div>
            <Button
              data-testid="button-close-quickchat"
              size="icon"
              variant="ghost"
              onClick={() => { setIsOpen(false); setMessages([]); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                  data-testid={`text-quickchat-message-${i}`}
                >
                  {m.content || (streaming && i === messages.length - 1 ? (
                    <span className="inline-block w-1.5 h-4 bg-current animate-pulse" />
                  ) : "")}
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[85%]">
                    {m.actions.map((a, j) => (
                      <ActionBadge key={j} result={a} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function WorkspaceCard({ workspace, onClick, onDelete }: { workspace: Workspace; onClick: () => void; onDelete: () => void }) {
  const Icon = iconMap[workspace.icon || "briefcase"] || Briefcase;

  const { data: artifacts } = useQuery<Artifact[]>({
    queryKey: ["/api/workspaces", workspace.id, "artifacts"],
    queryFn: () => fetch(`/api/workspaces/${workspace.id}/artifacts`).then(r => r.json()),
  });
  const { data: decisions } = useQuery<Decision[]>({
    queryKey: ["/api/workspaces", workspace.id, "decisions"],
    queryFn: () => fetch(`/api/workspaces/${workspace.id}/decisions`).then(r => r.json()),
  });
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/workspaces", workspace.id, "tasks"],
    queryFn: () => fetch(`/api/workspaces/${workspace.id}/tasks`).then(r => r.json()),
  });

  return (
    <Card
      className="p-5 cursor-pointer border-card-border group transition-all duration-200"
      onClick={onClick}
      data-testid={`card-workspace-${workspace.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate" data-testid={`text-workspace-name-${workspace.id}`}>
            {workspace.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {workspace.description || "No description"}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-delete-workspace-${workspace.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete workspace "{workspace.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this workspace and all its meetings, decisions, tasks, and documents. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                data-testid={`button-confirm-delete-workspace-${workspace.id}`}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />
          <span>{artifacts?.length || 0} docs</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{decisions?.length || 0} decisions</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListTodo className="w-3.5 h-3.5" />
          <span>{tasks?.length || 0} tasks</span>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: workspaces, isLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const createWorkspace = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      apiRequest("POST", "/api/workspaces", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setDialogOpen(false);
      setNewWsName("");
      setNewWsDesc("");
      toast({ title: "Workspace created" });
    },
  });

  const deleteWorkspace = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/workspaces/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      toast({ title: "Workspace deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete workspace", variant: "destructive" });
    },
  });

  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-3">
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                className="w-8 h-8 rounded-full"
                data-testid="img-user-avatar"
              />
            )}
            <span className="text-sm text-muted-foreground" data-testid="text-user-name">
              {user?.displayName || user?.email}
            </span>
            <Button
              data-testid="button-sign-out"
              size="sm"
              variant="ghost"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-app-title">
              ArgusVene
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Your AI Co-founder Engine. Transform meetings into decisions, documents, and action.
          </p>
        </div>

        <div className="mb-12">
          <QuickIdeationBar />
        </div>

        <div className="flex items-center justify-between gap-2 mb-6">
          <h2 className="text-lg font-semibold text-foreground">Workspaces</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-workspace" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Input
                  data-testid="input-workspace-name"
                  placeholder="Workspace name"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                />
                <Input
                  data-testid="input-workspace-description"
                  placeholder="Description (optional)"
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                />
                <Button
                  data-testid="button-submit-workspace"
                  className="w-full"
                  onClick={() => createWorkspace.mutate({ name: newWsName, description: newWsDesc })}
                  disabled={!newWsName.trim() || createWorkspace.isPending}
                >
                  {createWorkspace.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-5 border-card-border">
                <div className="flex items-start gap-4">
                  <Skeleton className="w-11 h-11 rounded-md" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : workspaces && workspaces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map(ws => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onClick={() => setLocation(`/workspace/${ws.id}`)}
                onDelete={() => deleteWorkspace.mutate(ws.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-card-border">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No workspaces yet</h3>
            <p className="text-muted-foreground mb-6">Create your first workspace to start collaborating with AI agents.</p>
            <Button data-testid="button-create-first-workspace" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Workspace
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
