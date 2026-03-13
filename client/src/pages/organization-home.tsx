import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, FolderKanban, Layers3, LogOut, Mic, Plus, Users } from "lucide-react";
import { ProductShell } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Artifact, Meeting, Workspace, WorkspaceMember } from "@shared/schema";

type WorkspaceMeta = {
  members: WorkspaceMember[];
  meetings: Meeting[];
  artifacts: Artifact[];
};

function WorkspaceCreateDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createWorkspace = useMutation({
    mutationFn: () => apiRequest("POST", "/api/workspaces", { name, description }),
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
        <Button className="rounded-full">
          <Plus className="h-4 w-4" />
          New workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Workspace name" />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What should this team use the live room for?" />
          <Button className="w-full" disabled={!name.trim() || createWorkspace.isPending} onClick={() => createWorkspace.mutate()}>
            {createWorkspace.isPending ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganizationHomePage() {
  const { user, signOut } = useAuth();
  const { data: workspaces, isLoading } = useQuery<Workspace[]>({ queryKey: ["/api/workspaces"] });

  const workspaceMetaQueries = useQueries({
    queries: (workspaces || []).map((workspace) => ({
      queryKey: ["/api/workspaces", workspace.id, "home-meta"],
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

  const summary = useMemo(() => {
    const liveRooms = workspaceMetaQueries.reduce((count, query) => count + (query.data?.meetings.filter((meeting) => meeting.status === "active").length || 0), 0);
    const people = workspaceMetaQueries.reduce((count, query) => count + (query.data?.members.length || 0), 0) + (workspaces?.length ? 1 : 0);
    const outputs = workspaceMetaQueries.reduce((count, query) => count + (query.data?.artifacts.length || 0), 0);
    return { liveRooms, people, outputs };
  }, [workspaceMetaQueries, workspaces]);

  return (
    <ProductShell
      title="Organization home"
      description="Choose the workspace, see what is live now, and move into the next room without extra friction."
      actions={
        <>
          <WorkspaceCreateDialog />
          <Button variant="outline" className="rounded-full" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-2xl border-slate-200 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspaces</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{workspaces?.length || 0}</div>
              <p className="mt-2 text-sm text-slate-600">Independent product or strategy tracks.</p>
            </Card>
            <Card className="rounded-2xl border-slate-200 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Live rooms</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{summary.liveRooms}</div>
              <p className="mt-2 text-sm text-slate-600">Rooms currently in progress.</p>
            </Card>
            <Card className="rounded-2xl border-slate-200 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">People + outputs</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{summary.people} / {summary.outputs}</div>
              <p className="mt-2 text-sm text-slate-600">Shared users and stored outcomes.</p>
            </Card>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace runway</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Enter the right room</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {isLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="px-5 py-5">
                      <Skeleton className="h-24 rounded-2xl" />
                    </div>
                  ))
                : workspaces?.map((workspace, index) => {
                    const meta = workspaceMetaQueries[index]?.data;
                    const liveMeeting = meta?.meetings.find((meeting) => meeting.status === "active");
                    return (
                      <Link key={workspace.id} href={`/workspace/${workspace.id}`}>
                        <button type="button" className="w-full px-5 py-5 text-left transition hover:bg-slate-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                                  <FolderKanban className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-lg font-semibold text-slate-950">{workspace.name}</p>
                                  <p className="text-sm text-slate-600">{workspace.description || "No description yet."}</p>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{(meta?.members.length || 0) + 1} humans</span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{meta?.artifacts.length || 0} outputs</span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{meta?.meetings.length || 0} meetings</span>
                              </div>
                            </div>
                            <div className="text-right">
                              {liveMeeting ? (
                                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                  Live now
                                </div>
                              ) : null}
                              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                Open workspace
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </button>
                      </Link>
                    );
                  })}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Layers3 className="h-4 w-4 text-orange-500" />
              Next operating rule
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Pick a workspace, ensure the right humans and files are attached, then open the room only when the team can actually make a decision or artifact inside it.
            </p>
          </Card>

          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Mic className="h-4 w-4 text-sky-600" />
              Signed in as
            </div>
            <p className="mt-3 text-sm font-medium text-slate-900">{user?.displayName || user?.email || "Unknown user"}</p>
            <p className="mt-1 text-sm text-slate-600">{user?.email || "No email available"}</p>
          </Card>

          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-violet-600" />
              Organization settings
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Manage the shared agent library and room defaults before teams open new rooms.</p>
            <Link href="/org/settings">
              <Button variant="outline" className="mt-4 w-full rounded-xl">
                Open organization settings
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </ProductShell>
  );
}
