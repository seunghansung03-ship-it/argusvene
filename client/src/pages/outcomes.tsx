import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowRight, CheckCircle2, FileText, ListTodo } from "lucide-react";
import { PageChrome } from "@/components/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetchJson } from "@/lib/queryClient";
import type { Artifact, Decision, Task, Workspace } from "@shared/schema";

export default function OutcomesPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);

  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", workspaceId],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}`),
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

  if (isLoading || !workspace) {
    return (
      <PageChrome eyebrow="Outcome Stream" title="Loading outputs" description="Collecting the decisions, tasks, and artifacts for this workspace.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      eyebrow="Outcome Stream"
      title={`${workspace.name} outputs`}
      description="This page is the post-room ledger. Every confirmed decision, task, and artifact should be understandable without replaying the whole meeting."
      badge="Post-Room"
      backHref={`/workspace/${workspaceId}`}
      actions={
        <Link href={`/workspace/${workspaceId}`}>
          <Button variant="outline" className="gap-2">
            Return to prep
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-card-border p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Decisions</p>
          </div>
          <ScrollArea className="mt-4 h-[520px]">
            <div className="space-y-3">
              {(decisions || []).length > 0 ? (
                decisions?.map((decision) => (
                  <div key={decision.id} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-2">
                        {decision.status}
                      </Badge>
                      <p className="text-sm font-medium text-foreground">{decision.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No decisions captured yet.</p>
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="border-card-border p-5">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Tasks</p>
          </div>
          <ScrollArea className="mt-4 h-[520px]">
            <div className="space-y-3">
              {(tasks || []).length > 0 ? (
                tasks?.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <Badge variant="outline" className="rounded-full px-2">
                        {task.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.description || "No description"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Assignee: {task.assignee || "Unassigned"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No tasks captured yet.</p>
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="border-card-border p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Artifacts</p>
          </div>
          <ScrollArea className="mt-4 h-[520px]">
            <div className="space-y-3">
              {(artifacts || []).length > 0 ? (
                artifacts?.map((artifact) => (
                  <div key={artifact.id} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-2">
                        {artifact.type}
                      </Badge>
                      <p className="text-sm font-medium text-foreground">{artifact.title}</p>
                    </div>
                    <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{artifact.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No artifacts captured yet.</p>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </PageChrome>
  );
}
