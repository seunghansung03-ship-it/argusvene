import { ExternalLink, Loader2, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { CanvasView, PrototypeKind, RoomV3Context } from "./types";

interface CanvasPaneProps {
  room: RoomV3Context;
  prototypeKind: PrototypeKind;
  canvasView: CanvasView;
  prototypeObjective: string;
  prototypeDraft: string;
  runtimePreviewUrl: string | null;
  isGeneratingPrototype: boolean;
  isLaunchingRuntime: boolean;
  onPrototypeKindChange: (value: PrototypeKind) => void;
  onCanvasViewChange: (value: CanvasView) => void;
  onPrototypeObjectiveChange: (value: string) => void;
  onGeneratePrototype: () => void;
  onLaunchRuntime: () => void;
}

const kindLabels: Record<PrototypeKind, { title: string; hint: string }> = {
  software: { title: "Software", hint: "Generate code and launch a live preview." },
  hardware: { title: "Hardware", hint: "Create component logic and physical structure." },
  workflow: { title: "Workflow", hint: "Design the process the team should operate." },
  experiment: { title: "Experiment", hint: "Define a concrete test with success criteria." },
};

function currentDraft(room: RoomV3Context, draft: string) {
  if (draft.trim()) return draft;
  return room.recentArtifacts.find((artifact) => artifact.type === "software_prototype" || artifact.type === "code")?.content || "";
}

export function CanvasPane({
  room,
  prototypeKind,
  canvasView,
  prototypeObjective,
  prototypeDraft,
  runtimePreviewUrl,
  isGeneratingPrototype,
  isLaunchingRuntime,
  onPrototypeKindChange,
  onCanvasViewChange,
  onPrototypeObjectiveChange,
  onGeneratePrototype,
  onLaunchRuntime,
}: CanvasPaneProps) {
  const draft = currentDraft(room, prototypeDraft);
  const canLaunchRuntime = prototypeKind === "software";
  const kindMeta = kindLabels[prototypeKind];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-[#f7f3ed] text-[#171614] shadow-[0_18px_60px_rgba(18,24,34,0.08)]">
      <div className="border-b border-black/10 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d6d5c]">Live Canvas</p>
            <h2 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[#171614]">
              Make something the room can inspect right now
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#625748]">{kindMeta.hint}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#171614]">
              {room.recentArtifacts.length} artifacts
            </Badge>
            <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#171614]">
              {room.recentDecisions.length} decisions
            </Badge>
            <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#171614]">
              {room.recentTasks.length} tasks
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr),320px]">
          <div className="rounded-[22px] border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(kindLabels) as PrototypeKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-medium transition",
                    prototypeKind === kind
                      ? "border-[#171614] bg-[#171614] text-[#f7f3ed]"
                      : "border-black/10 bg-[#f7f3ed] text-[#171614] hover:bg-white",
                  )}
                  onClick={() => onPrototypeKindChange(kind)}
                >
                  {kindLabels[kind].title}
                </button>
              ))}
            </div>

            <Textarea
              value={prototypeObjective}
              onChange={(event) => onPrototypeObjectiveChange(event.target.value)}
              rows={5}
              placeholder="Describe exactly what this room should build next."
              className="mt-4 resize-none rounded-[20px] border-black/10 bg-[#fbf8f3] text-[#171614]"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="rounded-full bg-[#171614] px-4 text-[#f7f3ed] hover:bg-black"
                disabled={!prototypeObjective.trim() || isGeneratingPrototype}
                onClick={onGeneratePrototype}
              >
                {isGeneratingPrototype ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Generate draft
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-black/10 bg-white px-4"
                disabled={!prototypeObjective.trim() || isLaunchingRuntime || !canLaunchRuntime}
                onClick={onLaunchRuntime}
              >
                {isLaunchingRuntime ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
                Launch runtime
              </Button>
              {runtimePreviewUrl ? (
                <Button asChild variant="ghost" className="rounded-full px-4">
                  <a href={runtimePreviewUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Open in new tab
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-[22px] border border-black/10 bg-[#171614] p-4 text-[#f3efe6]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b7ac9b]">Work order</p>
            <p className="mt-2 text-sm leading-6">{room.workOrder}</p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b7ac9b]">Runtime</p>
            <p className="mt-2 text-sm leading-6">
              {runtimePreviewUrl ? "A clickable preview is live in this room." : "No preview yet. Generate and launch when the output is software."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition",
              canvasView === "preview"
                ? "border-[#171614] bg-[#171614] text-[#f7f3ed]"
                : "border-black/10 bg-white text-[#171614]",
            )}
            onClick={() => onCanvasViewChange("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition",
              canvasView === "draft"
                ? "border-[#171614] bg-[#171614] text-[#f7f3ed]"
                : "border-black/10 bg-white text-[#171614]",
            )}
            onClick={() => onCanvasViewChange("draft")}
          >
            Draft
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-[24px] border border-black/10 bg-white">
          {canvasView === "preview" ? (
            runtimePreviewUrl ? (
              <iframe title="Runtime preview" src={runtimePreviewUrl} className="h-full min-h-[420px] w-full bg-white" sandbox="allow-scripts" />
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-10 text-center">
                <p className="text-lg font-semibold tracking-tight text-[#171614]">Nothing is running yet</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#625748]">
                  The preview surface stays empty until the room turns a software draft into a runnable build.
                </p>
              </div>
            )
          ) : (
            <ScrollArea className="h-full min-h-[420px]">
              <div className="p-5">
                {draft ? (
                  <pre className="whitespace-pre-wrap text-[13px] leading-6 text-[#171614]">{draft}</pre>
                ) : (
                  <div className="flex min-h-[360px] items-center justify-center px-8 text-center text-sm leading-6 text-[#625748]">
                    No draft yet. Use the build controls above to generate the first object for this room.
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <div className="rounded-[20px] border border-black/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7d6d5c]">Artifacts</p>
            <div className="mt-3 space-y-2">
              {room.recentArtifacts.length ? room.recentArtifacts.slice(0, 3).map((artifact) => (
                <div key={artifact.id} className="rounded-[16px] border border-black/10 bg-[#fbf8f3] px-3 py-3">
                  <p className="text-sm font-medium text-[#171614]">{artifact.title}</p>
                  <p className="mt-1 text-xs text-[#625748]">{artifact.type}</p>
                </div>
              )) : (
                <p className="text-sm text-[#625748]">No artifacts pinned yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[20px] border border-black/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7d6d5c]">Decisions</p>
            <div className="mt-3 space-y-2">
              {room.recentDecisions.length ? room.recentDecisions.slice(0, 3).map((decision) => (
                <div key={decision.id} className="rounded-[16px] border border-black/10 bg-[#fbf8f3] px-3 py-3">
                  <p className="text-sm font-medium text-[#171614]">{decision.title}</p>
                  <p className="mt-1 text-xs text-[#625748]">{decision.description}</p>
                </div>
              )) : (
                <p className="text-sm text-[#625748]">No decisions locked yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[20px] border border-black/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7d6d5c]">Tasks</p>
            <div className="mt-3 space-y-2">
              {room.recentTasks.length ? room.recentTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="rounded-[16px] border border-black/10 bg-[#fbf8f3] px-3 py-3">
                  <p className="text-sm font-medium text-[#171614]">{task.title}</p>
                  <p className="mt-1 text-xs text-[#625748]">{task.status}</p>
                </div>
              )) : (
                <p className="text-sm text-[#625748]">No follow-up tasks yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
