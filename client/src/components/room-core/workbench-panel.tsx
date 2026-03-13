import { ArrowUpRight, FileCode2, Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PrototypeKind, RoomCoreState, RoomNotice, WorkbenchView } from "./types";

interface WorkbenchPanelProps {
  room: RoomCoreState;
  view: WorkbenchView;
  prototypeKind: PrototypeKind;
  prototypeObjective: string;
  prototypeDraft: string;
  runtimePreviewUrl: string | null;
  notice: RoomNotice | null;
  isGenerating: boolean;
  isLaunching: boolean;
  onViewChange: (value: WorkbenchView) => void;
  onPrototypeKindChange: (value: PrototypeKind) => void;
  onPrototypeObjectiveChange: (value: string) => void;
  onGenerate: () => void;
  onLaunch: () => void;
}

function currentDraft(room: RoomCoreState, prototypeDraft: string) {
  if (prototypeDraft.trim()) return prototypeDraft;
  const latest = room.recentArtifacts.find((artifact) =>
    ["software_prototype", "hardware_concept", "workflow_draft", "experiment_brief", "code"].includes(artifact.type),
  );
  return latest?.content || "";
}

export function WorkbenchPanel({
  room,
  view,
  prototypeKind,
  prototypeObjective,
  prototypeDraft,
  runtimePreviewUrl,
  notice,
  isGenerating,
  isLaunching,
  onViewChange,
  onPrototypeKindChange,
  onPrototypeObjectiveChange,
  onGenerate,
  onLaunch,
}: WorkbenchPanelProps) {
  const draft = currentDraft(room, prototypeDraft);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Live canvas</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Build and inspect</h2>
          </div>
          <div className="flex items-center gap-2">
            {(["draft", "preview"] as WorkbenchView[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onViewChange(option)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition",
                  view === option ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-4 rounded-2xl border px-4 py-3 text-sm",
              notice.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : notice.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            {notice.message}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 xl:grid-cols-[160px,minmax(0,1fr),auto,auto]">
          <Select value={prototypeKind} onValueChange={(value) => onPrototypeKindChange(value as PrototypeKind)}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="software">Software</SelectItem>
              <SelectItem value="hardware">Hardware</SelectItem>
              <SelectItem value="workflow">Workflow</SelectItem>
              <SelectItem value="experiment">Experiment</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={prototypeObjective}
            onChange={(event) => onPrototypeObjectiveChange(event.target.value)}
            className="h-11 rounded-xl border-slate-200 bg-white"
            placeholder="What should the room build right now?"
          />
          <Button className="h-11 rounded-xl" disabled={!prototypeObjective.trim() || isGenerating} onClick={onGenerate}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate draft
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" disabled={!prototypeObjective.trim() || isLaunching || prototypeKind !== "software"} onClick={onLaunch}>
            {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Launch preview
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col">
          {view === "preview" && runtimePreviewUrl ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Runnable preview</p>
                </div>
                <a href={runtimePreviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
              <iframe title="Runtime preview" src={runtimePreviewUrl} className="min-h-0 flex-1 bg-white" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Current work object</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <FileCode2 className="h-3.5 w-3.5" />
                  {prototypeKind}
                </div>
              </div>
              {draft ? (
                <ScrollArea className="min-h-0 flex-1 px-5 py-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-800">{draft}</pre>
                </ScrollArea>
              ) : (
                <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-slate-500">
                  Generate a concrete draft so the room has something real to inspect.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
