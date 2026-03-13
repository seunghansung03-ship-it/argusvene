import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  FolderKanban,
  Layers3,
  LogOut,
  Mic,
  Plus,
  Sparkles,
} from "lucide-react";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { PageChrome } from "@/components/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { AgentPersona, Artifact, Meeting, Workspace, WorkspaceMember } from "@shared/schema";

type WorkspaceMeta = {
  members: WorkspaceMember[];
  meetings: Meeting[];
  artifacts: Artifact[];
};

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="border-card-border p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

function WorkspaceCreateDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createWorkspace = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      apiRequest("POST", "/api/workspaces", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setOpen(false);
      setName("");
      setDescription("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Workspace name" />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="What will this team use the room for?"
          />
          <Button
            className="w-full"
            onClick={() => createWorkspace.mutate({ name, description })}
            disabled={!name.trim() || createWorkspace.isPending}
          >
            {createWorkspace.isPending ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();

  const { data: workspaces, isLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: agents } = useQuery<AgentPersona[]>({
    queryKey: ["/api/agents"],
  });

  const workspaceMetaQueries = useQueries({
    queries: (workspaces || []).map((workspace) => ({
      queryKey: ["/api/workspaces", workspace.id, "dashboard-meta"],
      queryFn: async (): Promise<WorkspaceMeta> => {
        const [members, meetings, artifacts] = await Promise.all([
          apiFetchJson<WorkspaceMember[]>(`/api/workspaces/${workspace.id}/members`),
          apiFetchJson<Meeting[]>(`/api/workspaces/${workspace.id}/meetings`),
          apiFetchJson<Artifact[]>(`/api/workspaces/${workspace.id}/artifacts`),
        ]);
        return { members, meetings, artifacts };
      },
      enabled: Boolean(workspace.id),
    })),
  });

  const totals = useMemo(() => {
    const totalPeople = workspaceMetaQueries.reduce((count, query) => count + (query.data?.members.length || 0), 0) + (workspaces?.length ? 1 : 0);
    const liveRooms = workspaceMetaQueries.flatMap((query, index) =>
      (query.data?.meetings || [])
        .filter((meeting) => meeting.status === "active")
        .map((meeting) => ({ ...meeting, workspaceName: workspaces?.[index]?.name || "Workspace" })),
    );
    const outputCount = workspaceMetaQueries.reduce((count, query) => count + (query.data?.artifacts.length || 0), 0);

    return {
      totalPeople,
      liveRooms,
      outputCount,
    };
  }, [workspaceMetaQueries, workspaces]);

  return (
    <PageChrome
      eyebrow="Organization Home"
      title="ArgusVene"
      description="Run your company as a set of live operating rooms. Prepare the workspace, open a meeting room, then convert the conversation into decisions, tasks, and implementation output."
      badge="Gemini Live / Cloud Run"
      actions={
        <>
          <WorkspaceCreateDialog />
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryStat label="Workspaces" value={String(workspaces?.length || 0)} detail="Independent teams, products, or strategic tracks." />
          <SummaryStat label="Live Rooms" value={String(totals.liveRooms.length)} detail="Rooms currently running with people and agents together." />
          <SummaryStat label="People" value={String(totals.totalPeople)} detail="Founders and invited teammates inside the operating system." />
          <SummaryStat label="Outputs" value={String(totals.outputCount)} detail="Artifacts already captured from previous rooms." />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
          <Card className="border-card-border p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Workspace runway</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is the prep layer. Each workspace feeds a dedicated live room and a dedicated output stream.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {workspaces?.length || 0} active
              </Badge>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {isLoading
                ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-3xl" />)
                : workspaces?.map((workspace, index) => {
                    const meta = workspaceMetaQueries[index]?.data;
                    const latestActiveRoom = meta?.meetings.find((meeting) => meeting.status === "active");
                    return (
                      <Link key={workspace.id} href={`/workspace/${workspace.id}`}>
                        <Card className="h-full cursor-pointer border-card-border p-5 transition hover:border-primary/40 hover:shadow-lg">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <FolderKanban className="h-5 w-5" />
                              </div>
                              <div>
                                <h2 className="text-lg font-semibold text-foreground">{workspace.name}</h2>
                                <p className="text-xs text-muted-foreground">
                                  {(meta?.members.length || 0) + 1} people · {meta?.artifacts.length || 0} outputs
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            {workspace.description || "No description yet. Define the mission, people, and agents before opening a room."}
                          </p>

                          <div className="mt-5 space-y-3">
                            <div className="rounded-2xl border border-border/70 bg-card/70 px-3 py-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Mic className="h-4 w-4 text-primary" />
                                {latestActiveRoom ? latestActiveRoom.title : "No live room running"}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {latestActiveRoom ? "Re-enter the room and keep the conversation moving." : "Prepare files and participants, then open the first room."}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="rounded-full px-3 py-1">
                                {(meta?.meetings.length || 0)} rooms
                              </Badge>
                              <Badge variant="secondary" className="rounded-full px-3 py-1">
                                {(meta?.members.length || 0) + 1} humans
                              </Badge>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="border-card-border p-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Operating model</p>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "Organization Home: choose which workspace needs attention.",
                  "Workspace Prep: line up people, files, and default specialists.",
                  "Live Room: run the 3-pane room with Gemini Live and browser actions.",
                  "Outcome Stream: commit decisions, tasks, and code after the room.",
                ].map((line) => (
                  <div key={line} className="rounded-2xl border border-border/70 bg-card/70 px-3 py-3 text-sm leading-6 text-muted-foreground">
                    {line}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-card-border p-5">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Agent library</p>
              </div>
              <div className="mt-4 space-y-3">
                {(agents || []).slice(0, 5).map((agent) => (
                  <div key={agent.id} className="rounded-2xl border border-border/70 bg-card/70 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-2">
                        {agent.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{agent.role}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{agent.systemPrompt}</p>
                  </div>
                ))}
                {!agents?.length ? (
                  <p className="text-sm text-muted-foreground">No specialists yet. Seed agents before running a room.</p>
                ) : null}
              </div>
            </Card>

            <Card className="border-card-border p-5">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Active rooms</p>
              </div>
              <div className="mt-4 space-y-3">
                {totals.liveRooms.length > 0 ? (
                  totals.liveRooms.slice(0, 5).map((room) => (
                    <Link key={room.id} href={`/meeting/${room.id}`}>
                      <div className="cursor-pointer rounded-2xl border border-border/70 bg-card/70 px-3 py-3 transition hover:border-primary/40">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Activity className="h-4 w-4 text-primary" />
                          {room.title}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{room.workspaceName}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No live rooms are running right now.</p>
                )}
              </div>
            </Card>
          </div>
        </div>

        <Card className="border-card-border p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Signed in as</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {user?.displayName || user?.email || "Unknown user"} is operating the organization control center.
          </p>
        </Card>
      </div>
    </PageChrome>
  );
}
