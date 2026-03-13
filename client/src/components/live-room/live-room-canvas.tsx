import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Cpu,
  ExternalLink,
  FileCode2,
  Files,
  FlaskConical,
  GitBranch,
  Loader2,
  Milestone,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  Waypoints,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import BrowserPanel from "@/components/browser-panel";
import type { Artifact, Decision, Task } from "@shared/schema";
import type { CanvasSnapshot, PrototypeKind } from "./types";

function MermaidMap({ spec }: { spec: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!spec) {
      setSvg("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
        });
        const { svg: rendered } = await mermaid.render(`argusvene-${Date.now()}`, spec);
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) {
          setSvg(`<pre class="text-xs text-muted-foreground">${spec}</pre>`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spec]);

  if (!spec) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Decision structure will appear as the room sharpens.
      </div>
    );
  }

  return <div className="min-h-[280px] overflow-auto p-4" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function extractCodeBlock(source: string, language: string): string {
  if (!source) return "";
  const startToken = `\`\`\`${language}`;
  const startIndex = source.toLowerCase().indexOf(startToken.toLowerCase());
  if (startIndex === -1) return "";

  const contentStart = source.indexOf("\n", startIndex);
  if (contentStart === -1) return "";

  const endIndex = source.indexOf("```", contentStart + 1);
  if (endIndex === -1) return "";

  return source.slice(contentStart + 1, endIndex).trim();
}

function normalizeHtmlPreview(source: string): string {
  const htmlBlock = extractCodeBlock(source, "html");
  if (htmlBlock) return htmlBlock;

  const trimmed = source.trim();
  if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) {
    return trimmed;
  }

  return "";
}

const prototypeDefinitions: Record<
  PrototypeKind,
  {
    label: string;
    description: string;
    icon: typeof FileCode2;
    placeholder: string;
    artifactTypes: string[];
  }
> = {
  software: {
    label: "Software prototype",
    description: "Generate an implementation draft with file plan, product behavior, and code.",
    icon: FileCode2,
    placeholder: "Turn the room's current direction into a software implementation draft we can critique now.",
    artifactTypes: ["software_prototype", "code", "runtime_bundle"],
  },
  hardware: {
    label: "Hardware concept pack",
    description: "Generate subsystem structure, interfaces, BOM starter, and build/test loops.",
    icon: Cpu,
    placeholder: "Translate the room into a hardware system concept with interfaces, BOM starter, and build risks.",
    artifactTypes: ["hardware_concept"],
  },
  workflow: {
    label: "Workflow draft",
    description: "Generate an operating model, roles, decision gates, and version 1 SOP.",
    icon: Waypoints,
    placeholder: "Turn this meeting into a repeatable operating workflow with roles, steps, and failure points.",
    artifactTypes: ["workflow_draft"],
  },
  experiment: {
    label: "Experiment brief",
    description: "Generate a concrete prototype or validation experiment with success metrics.",
    icon: FlaskConical,
    placeholder: "Design the next experiment the team should run immediately, with metrics and failure modes.",
    artifactTypes: ["experiment_brief"],
  },
};

type CanvasTab = "build" | "flow" | "map" | "navigator" | "ship";

interface LiveRoomCanvasProps {
  canvas: CanvasSnapshot;
  liveWorkOrder: string;
  mermaid: string;
  comparison: { scenarios: any[]; metricKeys: string[] } | null;
  userId: string | null;
  meetingStatus: string;
  recentArtifacts: Artifact[];
  recentDecisions: Decision[];
  recentTasks: Task[];
  generatedCode: string;
  prototypeDraft: string;
  prototypeKind: PrototypeKind;
  prototypeObjective: string;
  runtimePreviewUrl: string | null;
  isFinalizing: boolean;
  isGeneratingCode: boolean;
  isGeneratingPrototype: boolean;
  isLaunchingRuntime: boolean;
  onFinalizeRoom: () => void;
  onGenerateCode: () => void;
  onPrototypeKindChange: (kind: PrototypeKind) => void;
  onPrototypeObjectiveChange: (objective: string) => void;
  onGeneratePrototype: (kind?: PrototypeKind, objective?: string) => void;
  onLaunchRuntime: () => void;
}

export function LiveRoomCanvas({
  canvas,
  liveWorkOrder,
  mermaid,
  comparison,
  userId,
  meetingStatus,
  recentArtifacts,
  recentDecisions,
  recentTasks,
  generatedCode,
  prototypeDraft,
  prototypeKind,
  prototypeObjective,
  runtimePreviewUrl,
  isFinalizing,
  isGeneratingCode,
  isGeneratingPrototype,
  isLaunchingRuntime,
  onFinalizeRoom,
  onGenerateCode,
  onPrototypeKindChange,
  onPrototypeObjectiveChange,
  onGeneratePrototype,
  onLaunchRuntime,
}: LiveRoomCanvasProps) {
  const [activeTab, setActiveTab] = useState<CanvasTab>("build");

  const activePrototype = prototypeDefinitions[prototypeKind];
  const buildArtifacts = useMemo(
    () =>
      recentArtifacts.filter((artifact) =>
        Object.values(prototypeDefinitions).some((definition) => definition.artifactTypes.includes(artifact.type)),
      ),
    [recentArtifacts],
  );
  const latestSoftwareArtifact = useMemo(
    () => recentArtifacts.find((artifact) => artifact.type === "software_prototype" || artifact.type === "code"),
    [recentArtifacts],
  );
  const livePreviewHtml = useMemo(
    () => normalizeHtmlPreview(prototypeDraft || latestSoftwareArtifact?.content || ""),
    [prototypeDraft, latestSoftwareArtifact],
  );

  const buildQuickstarts = useMemo(
    () => [
      {
        kind: "software" as const,
        title: "Build the software slice",
        prompt: `Turn "${canvas.objective}" into a software implementation draft the room can critique immediately.`,
      },
      {
        kind: "hardware" as const,
        title: "Sketch the hardware system",
        prompt: `Translate "${canvas.objective}" into a hardware concept pack with subsystem interfaces and a BOM starter.`,
      },
      {
        kind: "experiment" as const,
        title: "Design the next experiment",
        prompt: `Design the next validation experiment for "${canvas.objective}" with metrics, failure modes, and a 24-hour loop.`,
      },
      {
        kind: "workflow" as const,
        title: "Draft the operating flow",
        prompt: `Turn "${canvas.objective}" into a workflow with roles, decision gates, and a version 1 SOP.`,
      },
    ],
    [canvas.objective],
  );

  const reviewCues = useMemo(
    () =>
      [
        ...canvas.risks.map((risk) => ({
          id: risk.id,
          label: "Risk pressure",
          detail: risk.label,
          tone: risk.severity === "critical" ? "critical" : "watch",
        })),
        ...canvas.threads.map((thread) => ({
          id: thread.id,
          label: "Decision thread",
          detail: thread.detail,
          tone: "neutral" as const,
        })),
        ...canvas.decisions.map((decision) => ({
          id: decision.id,
          label: "Committed direction",
          detail: decision.note,
          tone: "positive" as const,
        })),
      ].slice(0, 6),
    [canvas.decisions, canvas.risks, canvas.threads],
  );

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent)]">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary/10 text-primary">{canvas.stage}</Badge>
              <Badge variant="outline" className="rounded-full">
                Agent-driven canvas
              </Badge>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{canvas.objective}</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{canvas.headline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onGenerateCode} disabled={isGeneratingCode} className="gap-2">
              {isGeneratingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
              Draft code
            </Button>
            <Button onClick={onFinalizeRoom} disabled={isFinalizing || meetingStatus !== "active"} className="gap-2">
              {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Milestone className="h-4 w-4" />}
              Finalize outputs
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CanvasTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-5 py-3">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="build">Build</TabsTrigger>
            <TabsTrigger value="flow">Flow</TabsTrigger>
            <TabsTrigger value="map">Decision Map</TabsTrigger>
            <TabsTrigger value="navigator">Navigator</TabsTrigger>
            <TabsTrigger value="ship">Ship</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="build" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-[0.78fr,1.22fr]">
              <div className="space-y-4">
                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Make / review / revise</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This is the room's build loop. Generate something concrete now, inspect it, argue with it, then regenerate.
                  </p>
                  <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current work order</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {liveWorkOrder || "No active work order yet. Use the roster on the right to tell a specialist to build, critique, research, or decide."}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {buildQuickstarts.map((quickstart) => {
                      const Icon = prototypeDefinitions[quickstart.kind].icon;
                      const selected = prototypeKind === quickstart.kind;
                      return (
                        <button
                          key={quickstart.kind}
                          type="button"
                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                            selected ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card/60 hover:border-primary/30"
                          }`}
                          onClick={() => {
                            onPrototypeKindChange(quickstart.kind);
                            onPrototypeObjectiveChange(quickstart.prompt);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">{quickstart.title}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{quickstart.prompt}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-3">
                    <Select value={prototypeKind} onValueChange={(value) => onPrototypeKindChange(value as PrototypeKind)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Build mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(prototypeDefinitions).map(([kind, definition]) => (
                          <SelectItem key={kind} value={kind}>
                            {definition.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Textarea
                      value={prototypeObjective}
                      onChange={(event) => onPrototypeObjectiveChange(event.target.value)}
                      rows={6}
                      placeholder={activePrototype.placeholder}
                      className="resize-none text-sm leading-6"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="gap-2"
                        disabled={!prototypeObjective.trim() || isGeneratingPrototype || meetingStatus !== "active"}
                        onClick={() => onGeneratePrototype()}
                      >
                        {isGeneratingPrototype ? <Loader2 className="h-4 w-4 animate-spin" /> : <activePrototype.icon className="h-4 w-4" />}
                        Generate draft
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={() => setActiveTab("navigator")}>
                        <Bot className="h-4 w-4" />
                        Open navigator
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Pressure the draft with this context</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {reviewCues.length > 0 ? (
                      reviewCues.map((cue) => (
                        <div key={cue.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`rounded-full ${
                                cue.tone === "critical"
                                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                  : cue.tone === "positive"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-primary/10 text-primary"
                              }`}
                            >
                              {cue.label}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-foreground">{cue.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">The room has not built enough pressure yet. Use the transcript or navigator to sharpen the draft.</p>
                    )}
                  </div>
                </Card>

                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <Files className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Recent build artifacts</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {buildArtifacts.length > 0 ? (
                      buildArtifacts.slice(0, 5).map((artifact) => (
                        <div key={artifact.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{artifact.title}</p>
                            <Badge variant="outline" className="rounded-full px-2">
                              {artifact.type}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{artifact.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nothing has been generated in this room yet. Use the build loop above to create the first artifact.</p>
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-card-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-full bg-primary/10 text-primary">{activePrototype.label}</Badge>
                        {isGeneratingPrototype ? (
                          <Badge variant="outline" className="rounded-full">
                            Streaming
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-foreground">Live draft</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{activePrototype.description}</p>
                    </div>
                    <Button variant="outline" className="gap-2" onClick={() => onGeneratePrototype()} disabled={!prototypeObjective.trim() || isGeneratingPrototype}>
                      {isGeneratingPrototype ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Regenerate
                    </Button>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-border/70 bg-slate-950 p-4 text-slate-100">
                    {prototypeDraft ? (
                      <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap text-[13px] leading-6">
                        {prototypeDraft}
                      </pre>
                    ) : (
                      <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-slate-300/75">
                        Generate a draft and the room will get something concrete to inspect here.
                      </div>
                    )}
                  </div>
                </Card>

                {prototypeKind === "software" ? (
                  <Card className="border-card-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Runnable product preview</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={onLaunchRuntime}
                          disabled={isLaunchingRuntime || !prototypeObjective.trim()}
                        >
                          {isLaunchingRuntime ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                          Launch runtime
                        </Button>
                        {runtimePreviewUrl ? (
                          <Button asChild variant="ghost" className="gap-2">
                            <a href={runtimePreviewUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                              Open preview
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Launch a hosted runtime when you want a real preview URL. If the room has only emitted an HTML fence so far, the fallback inline preview still renders below.
                    </p>
                    <div className="mt-4 overflow-hidden rounded-[24px] border border-border/70 bg-white">
                      {runtimePreviewUrl ? (
                        <iframe
                          title="Runtime preview"
                          src={runtimePreviewUrl}
                          sandbox="allow-scripts"
                          className="h-[420px] w-full bg-white"
                        />
                      ) : livePreviewHtml ? (
                        <iframe
                          title="Prototype preview"
                          srcDoc={livePreviewHtml}
                          sandbox="allow-scripts"
                          className="h-[420px] w-full bg-white"
                        />
                      ) : (
                        <div className="flex h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                          Generate a software draft with an HTML preview block and it will render here.
                        </div>
                      )}
                    </div>
                  </Card>
                ) : null}

                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Agent moves feeding the build loop</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {canvas.operations.length > 0 ? (
                      canvas.operations.map((operation) => (
                        <div key={operation.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-2">
                              {operation.actor}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">{operation.action}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{operation.summary}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Once agents start moving, their decisions and interventions will appear here as the draft context.</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="flow" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
              <div className="space-y-4">
                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Room agenda</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {canvas.agenda.map((item, index) => (
                      <div key={`${item}-${index}`} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3 text-sm text-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-card-border p-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Decision threads</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {canvas.threads.length > 0 ? (
                        canvas.threads.map((thread) => (
                          <div key={thread.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                            <p className="text-sm font-medium text-foreground">{thread.label}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{thread.detail}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">New threads appear when agents decompose the decision space.</p>
                      )}
                    </div>
                  </Card>

                  <Card className="border-card-border p-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Risk pressure</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {canvas.risks.length > 0 ? (
                        canvas.risks.map((risk) => (
                          <div key={risk.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`rounded-full ${
                                  risk.severity === "critical"
                                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {risk.severity}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-foreground">{risk.label}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No major blockers pinned yet.</p>
                      )}
                    </div>
                  </Card>
                </div>

                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Scenario spread</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {canvas.scenarios.length > 0 ? (
                      canvas.scenarios.map((scenario) => (
                        <div key={scenario.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                          <p className="text-sm font-medium text-foreground">{scenario.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{scenario.note}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Counter-scenarios appear when the room tests alternatives.</p>
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="min-h-[320px] overflow-hidden border-card-border">
                  <MermaidMap spec={mermaid} />
                </Card>

                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Decision rack</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {canvas.decisions.length > 0 ? (
                      canvas.decisions.map((decision) => (
                        <div key={decision.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                          <p className="text-sm font-medium text-foreground">{decision.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{decision.note}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Use the room until the recommendation hardens into a decision.</p>
                    )}
                  </div>
                </Card>

                <Card className="border-card-border p-4">
                  <div className="flex items-center gap-2">
                    <Files className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Attached references</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {canvas.references.length > 0 ? (
                      canvas.references.map((reference) => (
                        <div key={reference.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/60 px-3 py-2">
                          <span className="text-sm text-foreground">{reference.name}</span>
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{reference.kind}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Prep the workspace with files to make this room much stronger.</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="map" className="mt-0 min-h-0 flex-1">
          <div className="grid h-full gap-4 px-5 py-5 xl:grid-cols-[1.1fr,0.9fr]">
            <Card className="min-h-0 overflow-hidden border-card-border">
              <MermaidMap spec={mermaid} />
            </Card>
            <Card className="min-h-0 overflow-hidden border-card-border">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Scenario compare</h3>
                  {comparison?.scenarios?.length ? (
                    comparison.scenarios.map((scenario: any, index: number) => (
                      <div key={scenario.id || index} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-2">
                            {scenario.type || "scenario"}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">{scenario.label || `Scenario ${index + 1}`}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{scenario.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Structured comparisons will show up here once agents start modelling options.</p>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="navigator" className="mt-0 min-h-0 flex-1">
          <div className="h-full px-5 py-5">
            <Card className="h-full overflow-hidden border-card-border">
              <BrowserPanel userId={userId} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ship" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-[0.85fr,1.15fr]">
              <div className="space-y-4">
                <Card className="border-card-border p-4">
                  <h3 className="text-sm font-semibold text-foreground">Decisions</h3>
                  <div className="mt-3 space-y-3">
                    {recentDecisions.length > 0 ? (
                      recentDecisions.map((decision) => (
                        <div key={decision.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                          <p className="text-sm font-medium text-foreground">{decision.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{decision.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Finalize the room to turn discussion into explicit decisions.</p>
                    )}
                  </div>
                </Card>

                <Card className="border-card-border p-4">
                  <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
                  <div className="mt-3 space-y-3">
                    {recentTasks.length > 0 ? (
                      recentTasks.map((task) => (
                        <div key={task.id} className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <Badge variant="outline" className="rounded-full px-2">
                              {task.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.description || "No description"}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Tasks will appear here after consensus extraction.</p>
                    )}
                  </div>
                </Card>
              </div>

              <Card className="border-card-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Latest implementation draft</h3>
                <div className="mt-3 space-y-3">
                  {generatedCode ? (
                    <pre className="max-h-[540px] overflow-auto rounded-2xl border border-border/70 bg-black/90 p-4 text-[12px] leading-6 text-slate-100">
                      {generatedCode}
                    </pre>
                  ) : recentArtifacts.find((artifact) => artifact.type === "code") ? (
                    <pre className="max-h-[540px] overflow-auto rounded-2xl border border-border/70 bg-black/90 p-4 text-[12px] leading-6 text-slate-100">
                      {recentArtifacts.find((artifact) => artifact.type === "code")?.content || ""}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Draft code from the room will appear here. Use “Draft code” for a mid-meeting implementation pass or finalize the room to capture the full package.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
