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
  Sparkles, X,
} from "lucide-react";
import type { Workspace, Artifact, Decision, Task } from "@shared/schema";

const iconMap: Record<string, typeof Rocket> = {
  rocket: Rocket,
  flask: FlaskConical,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
};

function QuickIdeationBar() {
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || streaming) return;
    const userMsg = message.trim();
    setMessage("");
    setIsOpen(true);

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setStreaming(true);

    let assistantContent = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    await streamChat(
      "/api/quick-chat",
      { message: userMsg, history: newMessages.slice(0, -1) },
      (data) => {
        if (data.content) {
          assistantContent += data.content;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: assistantContent };
            return updated;
          });
        }
      },
      () => setStreaming(false)
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
        <Card className="mt-3 border-card-border max-h-80 flex flex-col">
          <div className="flex items-center justify-between gap-1 px-4 py-2 border-b border-card-border">
            <span className="text-sm font-medium text-muted-foreground">Quick Chat</span>
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
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
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
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function WorkspaceCard({ workspace, onClick }: { workspace: Workspace; onClick: () => void }) {
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
      className="p-5 cursor-pointer hover-elevate border-card-border group transition-all duration-200"
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
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
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
