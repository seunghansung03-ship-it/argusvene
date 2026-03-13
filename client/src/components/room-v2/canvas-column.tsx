import { ExternalLink, Loader2, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { RoomV2Context } from "./types";

type PrototypeKind = "software" | "hardware" | "workflow" | "experiment";

interface CanvasColumnProps {
  room: RoomV2Context;
  prototypeKind: PrototypeKind;
  prototypeObjective: string;
  prototypeDraft: string;
  runtimePreviewUrl: string | null;
  isGeneratingPrototype: boolean;
  isLaunchingRuntime: boolean;
  activeAgentCount: number;
  onPrototypeKindChange: (value: PrototypeKind) => void;
  onPrototypeObjectiveChange: (value: string) => void;
  onGeneratePrototype: () => void;
  onLaunchRuntime: () => void;
}

const prototypeLabels: Record<PrototypeKind, { title: string; subtitle: string }> = {
  software: {
    title: "Software",
    subtitle: "Generate something the room can run in-browser.",
  },
  hardware: {
    title: "Hardware",
    subtitle: "Sketch components, interfaces, and physical constraints.",
  },
  workflow: {
    title: "Workflow",
    subtitle: "Map the operating process the team should follow.",
  },
  experiment: {
    title: "Experiment",
    subtitle: "Design a testable hypothesis and success conditions.",
  },
};

function latestRenderableDraft(room: RoomV2Context, draft: string) {
  if (draft.trim()) return draft;
  return room.recentArtifacts.find((artifact) => artifact.type === "software_prototype" || artifact.type === "code")?.content || "";
}

function signalListTitle(kind: "artifacts" | "decisions" | "tasks") {
  switch (kind) {
    case "decisions":
      return "Decision signal";
    case "tasks":
      return "Task follow-through";
    case "artifacts":
    default:
      return "Artifact stack";
  }
}

export function CanvasColumn({
  room,
  prototypeKind,
  prototypeObjective,
  prototypeDraft,
  runtimePreviewUrl,
  isGeneratingPrototype,
  isLaunchingRuntime,
  activeAgentCount,
  onPrototypeKindChange,
  onPrototypeObjectiveChange,
  onGeneratePrototype,
  onLaunchRuntime,
}: CanvasColumnProps) {
  const latestDraft = latestRenderableDraft(room, prototypeDraft);
  const kindMeta = prototypeLabels[prototypeKind];
  const canLaunchRuntime = prototypeKind === "software";

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#f5efe5_0%,#efe3d3_58%,#e7edf1_100%)] text-[#171614]">
      <div className="border-b border-black/10 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#725f48]">Live Canvas</span>
              <Badge className="rounded-full border border-black/10 bg-[#171614] px-3 py-1 text-[#f4ede1]">
                {kindMeta.title}
              </Badge>
            </div>
            <h2 className="mt-3 font-serif text-[2rem] leading-tight tracking-tight text-[#171614]">
              Build something the room can inspect immediately
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d5144]">
              The center surface is where agents turn talk into objects: prototypes, hardware outlines, workflows, experiments, and a runnable preview whenever the output is software.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="rounded-[24px] border-black/10 bg-white/75 p-4 shadow-none">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d755d]">Room instruction</p>
              <p className="mt-2 text-sm leading-6 text-[#171614]">{room.workOrder}</p>
            </Card>
            <Card className="rounded-[24px] border-black/10 bg-[#171614] p-4 text-[#f4ede1] shadow-none">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d3baa1]">Build posture</p>
              <p className="mt-2 text-sm leading-6">
                {activeAgentCount} active agents · {room.files.length} context files · {runtimePreviewUrl ? "preview live" : "preview pending"}
              </p>
            </Card>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-6 py-6">
        <div className="grid gap-5 xl:grid-cols-[0.92fr,1.08fr]">
          <div className="space-y-5">
            <Card className="rounded-[28px] border-black/10 bg-white/82 p-5 shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d755d]">Build loop</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#171614]">Choose the output, then force a draft</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5d5144]">{kindMeta.subtitle}</p>
                </div>
                <Badge className="rounded-full border border-[#f08b5b]/20 bg-[#f08b5b]/12 px-3 py-1 text-[#6e3f1d]">
                  Make - review - revise
                </Badge>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(Object.entries(prototypeLabels) as [PrototypeKind, { title: string; subtitle: string }][]).map(([kind, meta]) => (
                  <button
                    key={kind}
                    type="button"
                    className={cn(
                      "rounded-[22px] border px-4 py-4 text-left transition",
                      prototypeKind === kind
                        ? "border-[#171614] bg-[#171614] text-[#f4ede1] shadow-[0_18px_50px_rgba(23,22,20,0.18)]"
                        : "border-black/10 bg-[#f8f4ed] text-[#171614] hover:border-black/20 hover:bg-white",
                    )}
                    onClick={() => onPrototypeKindChange(kind)}
                  >
                    <p className="text-sm font-semibold tracking-tight">{meta.title}</p>
                    <p className={cn("mt-1 text-xs leading-5", prototypeKind === kind ? "text-[#d8c7b4]" : "text-[#6d6255]")}>
                      {meta.subtitle}
                    </p>
                  </button>
                ))}
              </div>

              <Textarea
                value={prototypeObjective}
                onChange={(event) => onPrototypeObjectiveChange(event.target.value)}
                rows={8}
                placeholder="Describe exactly what the room should generate next."
                className="mt-4 resize-none rounded-[24px] border-black/10 bg-[#f8f4ed] text-[#171614]"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  className="rounded-full bg-[#171614] px-4 text-[#f4ede1] hover:bg-black"
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
                      Open preview
                    </a>
                  </Button>
                ) : null}
              </div>

              {!canLaunchRuntime ? (
                <p className="mt-3 text-xs leading-5 text-[#6d6255]">
                  Runtime preview is reserved for software outputs. Hardware, workflow, and experiment modes stay in structured canvas form for now.
                </p>
              ) : null}
            </Card>

            <Card className="rounded-[28px] border-black/10 bg-[#171614] p-5 text-[#f4ede1] shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d3baa1]">Inspection copy</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">What the room will review next</h3>
                </div>
                <Badge className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[#f4ede1]">
                  {kindMeta.title}
                </Badge>
              </div>
              <div className="mt-4 max-h-[34rem] overflow-auto rounded-[24px] border border-white/10 bg-black/20 p-4">
                {latestDraft ? (
                  <pre className="whitespace-pre-wrap text-[13px] leading-6">{latestDraft}</pre>
                ) : (
                  <p className="text-sm leading-6 text-[#cbbba8]">
                    No artifact yet. Use the build loop above to force the first concrete object into the room.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="rounded-[28px] border-black/10 bg-white/82 p-5 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d755d]">Preview surface</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#171614]">See behavior, not only text</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5d5144]">
                    When the current artifact is software, the room can launch it directly and critique the behavior from here.
                  </p>
                </div>
                <Badge className={cn(
                  "rounded-full border px-3 py-1",
                  runtimePreviewUrl
                    ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-800"
                    : "border-black/10 bg-[#f4ede1] text-[#5d5144]",
                )}>
                  {runtimePreviewUrl ? "Preview live" : "Awaiting runtime"}
                </Badge>
              </div>

              <div className="mt-4 overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                {runtimePreviewUrl ? (
                  <iframe title="Runtime preview" src={runtimePreviewUrl} className="h-[430px] w-full bg-white" sandbox="allow-scripts" />
                ) : (
                  <div className="flex h-[430px] flex-col items-center justify-center px-10 text-center">
                    <p className="text-lg font-medium tracking-tight text-[#171614]">Nothing is running yet</p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#6d6255]">
                      Generate a software draft, then launch the runtime so the room can click through the result instead of arguing abstractly.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="rounded-[24px] border-black/10 bg-white/75 p-4 shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d755d]">{signalListTitle("artifacts")}</p>
                <div className="mt-3 space-y-3">
                  {room.recentArtifacts.length ? room.recentArtifacts.slice(0, 4).map((artifact) => (
                    <div key={artifact.id} className="rounded-[18px] border border-black/10 bg-[#f8f4ed] px-3 py-3">
                      <p className="text-sm font-medium">{artifact.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6d6255]">{artifact.type}</p>
                    </div>
                  )) : (
                    <div className="rounded-[18px] border border-dashed border-black/10 bg-[#f8f4ed] px-3 py-4 text-sm text-[#6d6255]">
                      The room has not pinned an artifact yet.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="rounded-[24px] border-black/10 bg-white/75 p-4 shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d755d]">{signalListTitle("decisions")}</p>
                <div className="mt-3 space-y-3">
                  {room.recentDecisions.length ? room.recentDecisions.slice(0, 4).map((decision) => (
                    <div key={decision.id} className="rounded-[18px] border border-black/10 bg-[#f8f4ed] px-3 py-3">
                      <p className="text-sm font-medium">{decision.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6d6255]">{decision.description}</p>
                    </div>
                  )) : (
                    <div className="rounded-[18px] border border-dashed border-black/10 bg-[#f8f4ed] px-3 py-4 text-sm text-[#6d6255]">
                      Decisions will appear here once the room locks a call.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="rounded-[24px] border-black/10 bg-white/75 p-4 shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d755d]">{signalListTitle("tasks")}</p>
                <div className="mt-3 space-y-3">
                  {room.recentTasks.length ? room.recentTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="rounded-[18px] border border-black/10 bg-[#f8f4ed] px-3 py-3">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6d6255]">{task.status}</p>
                    </div>
                  )) : (
                    <div className="rounded-[18px] border border-dashed border-black/10 bg-[#f8f4ed] px-3 py-4 text-sm text-[#6d6255]">
                      Follow-through tasks have not been created yet.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
