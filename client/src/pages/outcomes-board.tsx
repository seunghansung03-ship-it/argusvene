import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowRight, CheckCircle2, FileStack, ListTodo } from "lucide-react";
import { ProductShell } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Artifact, Decision, Meeting, Task, Workspace } from "@shared/schema";

function snippet(value: string, max = 220) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

export default function OutcomesBoardPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const { toast } = useToast();

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", workspaceId],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}`),
  });
  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: ["/api/workspaces", workspaceId, "meetings"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/meetings`),
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

  const [meetingFilter, setMeetingFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const meetingId = meetingFilter === "all" ? null : Number(meetingFilter);
    return {
      decisions: decisions?.filter((decision) => !meetingId || decision.meetingId === meetingId) || [],
      tasks: tasks?.filter((task) => !meetingId || task.meetingId === meetingId) || [],
      artifacts: artifacts?.filter((artifact) => !meetingId || artifact.meetingId === meetingId) || [],
    };
  }, [artifacts, decisions, meetingFilter, tasks]);

  const updateTaskStatus = async (taskId: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/tasks/${taskId}/status`, { status });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "tasks"] });
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message || "Could not update task.", variant: "destructive" });
    }
  };

  const startFollowUpRoom = async () => {
    const title = meetingFilter === "all"
      ? `Follow-up for ${workspace?.name || "workspace"}`
      : `Follow-up: ${meetings?.find((meeting) => String(meeting.id) === meetingFilter)?.title || workspace?.name || "workspace"}`;

    try {
      const response = await apiRequest("POST", `/api/workspaces/${workspaceId}/meetings`, {
        title,
        agentIds: [],
        aiProvider: "gemini",
      });
      const meeting: Meeting = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "meetings"] });
      window.location.href = `/meeting/${meeting.id}`;
    } catch (error: any) {
      toast({ title: "Create room failed", description: error.message || "Could not create follow-up room.", variant: "destructive" });
    }
  };

  return (
    <ProductShell
      title={`${workspace?.name || "Workspace"} outcomes`}
      description="Review what the room decided, what must happen next, and which artifacts are ready to inspect."
      backHref={`/workspace/${workspaceId}`}
      backLabel="Workspace"
      actions={
        <Button className="rounded-full" onClick={startFollowUpRoom}>
          <ArrowRight className="h-4 w-4" />
          Start follow-up room
        </Button>
      }
    >
      <div className="mb-6 flex items-center gap-3">
        <Select value={meetingFilter} onValueChange={setMeetingFilter}>
          <SelectTrigger className="h-10 w-[280px] rounded-xl border-slate-200 bg-white">
            <SelectValue placeholder="Filter by meeting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All meetings</SelectItem>
            {meetings?.map((meeting) => (
              <SelectItem key={meeting.id} value={String(meeting.id)}>{meeting.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Decisions
          </div>
          <div className="mt-4 space-y-3">
            {filtered.decisions.map((decision) => (
              <div key={decision.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{decision.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{snippet(decision.description)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ListTodo className="h-4 w-4 text-orange-500" />
            Tasks
          </div>
          <div className="mt-4 space-y-3">
            {filtered.tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                  <Select value={task.status} onValueChange={(value) => updateTaskStatus(task.id, value)}>
                    <SelectTrigger className="h-8 w-[120px] rounded-lg border-slate-200 bg-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="in_progress">in_progress</SelectItem>
                      <SelectItem value="completed">completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {task.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{snippet(task.description)}</p> : null}
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileStack className="h-4 w-4 text-sky-600" />
            Artifacts
          </div>
          <div className="mt-4 space-y-3">
            {filtered.artifacts.map((artifact) => (
              <div key={artifact.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{artifact.title}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{artifact.type}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{snippet(artifact.content)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ProductShell>
  );
}
