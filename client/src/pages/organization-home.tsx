import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, FolderKanban, LogOut, Plus } from "lucide-react";
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
    const outputs = workspaceMetaQueries.reduce((count, query) => count + (query.data?.artifacts.length || 0), 0);
    return { liveRooms, outputs };
  }, [workspaceMetaQueries]);

  return (
    <ProductShell
      title="Organization home"
      description="Choose a workspace and move straight into preparation or the active room."
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
      <div className="space-y-4">
        <Card className="rounded-2xl border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>{workspaces?.length || 0} workspaces</span>
            <span className="text-slate-300">/</span>
            <span>{summary.liveRooms} live rooms</span>
            <span className="text-slate-300">/</span>
            <span>{summary.outputs} outputs</span>
            <span className="ml-auto truncate font-medium text-slate-900">{user?.displayName || user?.email || "Unknown user"}</span>
          </div>
        </Card>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspaces</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Open the right track</h2>
            </div>
            <Link href="/org/settings">
              <Button variant="outline" className="rounded-full">
                Organization
              </Button>
            </Link>
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
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                                <FolderKanban className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-base font-semibold text-slate-950">{workspace.name}</p>
                                <p className="text-sm text-slate-600">{workspace.description || "No description yet."}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{(meta?.members.length || 0) + 1} people</span>
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{meta?.meetings.length || 0} meetings</span>
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{meta?.artifacts.length || 0} outputs</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            {liveMeeting ? (
                              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                Live
                              </div>
                            ) : null}
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                              Open
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
    </ProductShell>
  );
}
