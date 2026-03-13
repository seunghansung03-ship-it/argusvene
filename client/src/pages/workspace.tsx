import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { ArrowRight, Bot, FileUp, FolderOpen, Layers3, MailPlus, Mic, ShieldCheck, Trash2, Users } from "lucide-react";
import { PageChrome } from "@/components/page-chrome";
import { AgentAvatar } from "@/components/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetchJson, apiRequest, getAuthHeaders, queryClient } from "@/lib/queryClient";
import type {
  AgentPersona,
  Artifact,
  Decision,
  Meeting,
  Task,
  Workspace,
  WorkspaceFile,
  WorkspaceMember,
} from "@shared/schema";

function StartRoomDialog({
  workspaceId,
  agents,
}: {
  workspaceId: number;
  agents: AgentPersona[];
}) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [agentIds, setAgentIds] = useState<number[]>(agents.slice(0, 3).map((agent) => agent.id));

  useEffect(() => {
    if (agentIds.length === 0 && agents.length > 0) {
      setAgentIds(agents.slice(0, 3).map((agent) => agent.id));
    }
  }, [agentIds.length, agents]);

  const createRoom = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/workspaces/${workspaceId}/meetings`, {
        title,
        agentIds,
        aiProvider: "gemini",
      });
      return response.json();
    },
    onSuccess: (meeting: Meeting) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "meetings"] });
      setOpen(false);
      setTitle("");
      setLocation(`/meeting/${meeting.id}`);
    },
  });

  const toggleAgent = (agentId: number) => {
    setAgentIds((current) =>
      current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId],
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Mic className="h-4 w-4" />
          Open Room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a live room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Decision or meeting topic" />
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Bring specialists into the room</p>
            <div className="grid gap-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    agentIds.includes(agent.id) ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <Checkbox checked={agentIds.includes(agent.id)} />
                  <AgentAvatar avatar={agent.avatar} color={agent.color} name={agent.name} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" disabled={!title.trim() || agentIds.length === 0 || createRoom.isPending} onClick={() => createRoom.mutate()}>
            {createRoom.isPending ? "Opening..." : "Open live room"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const { toast } = useToast();

  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", workspaceId],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}`),
  });
  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: ["/api/workspaces", workspaceId, "meetings"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/meetings`),
  });
  const { data: members } = useQuery<WorkspaceMember[]>({
    queryKey: ["/api/workspaces", workspaceId, "members"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/members`),
  });
  const { data: files } = useQuery<WorkspaceFile[]>({
    queryKey: ["/api/workspaces", workspaceId, "files"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/files`),
  });
  const { data: agents } = useQuery<AgentPersona[]>({
    queryKey: ["/api/agents"],
  });
  const { data: decisions } = useQuery<Decision[]>({
    queryKey: ["/api/workspaces", workspaceId, "decisions"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/decisions`),
  });
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/workspaces", workspaceId, "tasks"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/tasks`),
  });
  const { data: artifacts } = useQuery<Artifact[]>({
    queryKey: ["/api/workspaces", workspaceId, "artifacts"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/artifacts`),
  });

  const [inviteEmail, setInviteEmail] = useState("");

  const inviteMember = useMutation({
    mutationFn: (email: string) => apiRequest("POST", `/api/workspaces/${workspaceId}/members`, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
      setInviteEmail("");
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) => apiRequest("DELETE", `/api/workspaces/${workspaceId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
    },
  });

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/workspaces/${workspaceId}/files`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  };

  const deleteFile = useMutation({
    mutationFn: (fileId: number) => apiRequest("DELETE", `/api/workspaces/${workspaceId}/files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "files"] });
    },
  });

  const latestActiveRoom = useMemo(
    () => meetings?.find((meeting) => meeting.status === "active"),
    [meetings],
  );

  if (isLoading || !workspace) {
    return (
      <PageChrome eyebrow="Workspace Prep" title="Loading workspace" description="Collecting the prep context for this room.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-60 rounded-3xl" />
          <Skeleton className="h-60 rounded-3xl" />
        </div>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      eyebrow="Workspace Prep"
      title={workspace.name}
      description={workspace.description || "Define the mission, the people, the reference files, and the specialists before the room goes live."}
      badge="Preparation Layer"
      backHref="/"
      actions={
        <>
          <Link href={`/workspace/${workspaceId}/outcomes`}>
            <Button variant="outline" className="gap-2">
              <ArrowRight className="h-4 w-4" />
              Outcomes
            </Button>
          </Link>
          <StartRoomDialog workspaceId={workspaceId} agents={agents || []} />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <Card className="border-card-border p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Mission and live handoff</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current live room</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{latestActiveRoom?.title || "No room is active"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {latestActiveRoom ? "The team can re-enter immediately and continue the shared conversation." : "Open a live room once people, files, and specialists are lined up."}
                </p>
                {latestActiveRoom ? (
                  <Link href={`/meeting/${latestActiveRoom.id}`}>
                    <Button className="mt-4 gap-2">
                      Re-enter live room
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
              </div>
              <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Prep checklist</p>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <div>1. Invite the humans who should speak in the room.</div>
                  <div>2. Upload files that agents can read and quote.</div>
                  <div>3. Select specialists who will be allowed to act live.</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-card-border p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">People and access</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Invite teammate by email" />
              <Button
                onClick={() => inviteMember.mutate(inviteEmail)}
                disabled={!inviteEmail.trim() || inviteMember.isPending}
                className="gap-2"
              >
                <MailPlus className="h-4 w-4" />
                Invite
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {(members || []).length > 0 ? (
                members?.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.email}</p>
                      <p className="text-xs text-muted-foreground">{member.role} · {member.status}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(member.id)} disabled={removeMember.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No teammates invited yet.</p>
              )}
            </div>
          </Card>

          <Card className="border-card-border p-5">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Reference files</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40">
                <FileUp className="h-4 w-4" />
                Upload file
                <input
                  type="file"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      await uploadFile(file);
                      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "files"] });
                    } catch (error: any) {
                      toast({
                        title: "Upload failed",
                        description: error.message || "Could not upload the selected file.",
                        variant: "destructive",
                      });
                    } finally {
                      event.target.value = "";
                    }
                  }}
                />
              </label>
              <p className="text-xs text-muted-foreground">Agents can list and read uploaded files during the room.</p>
            </div>
            <div className="mt-4 grid gap-3">
              {(files || []).length > 0 ? (
                files?.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB · {file.mimeType}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteFile.mutate(file.id)} disabled={deleteFile.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-card-border p-5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Specialists available for the room</p>
            </div>
            <div className="mt-4 grid gap-3">
              {(agents || []).map((agent) => (
                <div key={agent.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                  <AgentAvatar avatar={agent.avatar} color={agent.color} name={agent.name} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{agent.name}</p>
                      <Badge variant="outline" className="rounded-full px-2">
                        {agent.role}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{agent.systemPrompt}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-card-border p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Recent outputs already captured</p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Decisions</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{decisions?.length || 0}</p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tasks</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{tasks?.length || 0}</p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-card/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Artifacts</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{artifacts?.length || 0}</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href={`/workspace/${workspaceId}/outcomes`}>
                <Button variant="outline" className="gap-2">
                  Review output stream
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="border-card-border p-5">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Room history</p>
            </div>
            <ScrollArea className="mt-4 h-[320px]">
              <div className="space-y-3">
                {(meetings || []).length > 0 ? (
                  meetings?.map((meeting) => (
                    <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                      <div className="cursor-pointer rounded-2xl border border-border/70 bg-card/70 px-4 py-3 transition hover:border-primary/40">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                          <Badge variant={meeting.status === "active" ? "default" : "outline"} className="rounded-full px-2">
                            {meeting.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(meeting.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No rooms have been opened for this workspace yet.</p>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </PageChrome>
  );
}
