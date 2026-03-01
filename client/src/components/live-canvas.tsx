import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch, BarChart3, Shield, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Target, Monitor,
} from "lucide-react";
import BrowserPanel from "./browser-panel";

interface WorldState {
  sessionId: string;
  version: number;
  entities: any[];
  assumptions: any[];
  constraints: any[];
  options: any[];
  scenarios: any[];
  metrics: any[];
  decisions: any[];
  lastUpdated: string;
}

interface Counterfactual {
  id: string;
  scenario: string;
  description: string;
  impact: string;
}

interface LiveCanvasProps {
  worldState: WorldState | null;
  mermaidSpec: string;
  comparison: { scenarios: any[]; metricKeys: string[] } | null;
  counterfactuals: Counterfactual[];
  isUpdating: boolean;
  userId?: string | null;
}

function MermaidRenderer({ spec }: { spec: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    if (!spec) return;
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          flowchart: { curve: "basis", padding: 15 },
        });
        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, spec);
        if (!cancelled) setSvgContent(svg);
      } catch (e) {
        console.error("Mermaid render error:", e);
        if (!cancelled) setSvgContent(`<pre style="color:#888;font-size:12px;">${spec}</pre>`);
      }
    })();

    return () => { cancelled = true; };
  }, [spec]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-auto flex items-center justify-center p-4 min-h-[200px]"
      dangerouslySetInnerHTML={{ __html: svgContent }}
      data-testid="mermaid-canvas"
    />
  );
}

function ScenarioCompare({ comparison }: { comparison: { scenarios: any[]; metricKeys: string[] } }) {
  if (!comparison.scenarios.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8">
        Scenarios will appear as the discussion progresses
      </div>
    );
  }

  const typeColor = (type: string) => {
    switch (type) {
      case "base": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "best": return "bg-green-500/10 text-green-400 border-green-500/30";
      case "worst": return "bg-red-500/10 text-red-400 border-red-500/30";
      default: return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    }
  };

  return (
    <div className="p-4 space-y-3 overflow-auto">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(comparison.scenarios.length, 3)}, 1fr)` }}>
        {comparison.scenarios.map((sc, i) => (
          <Card key={i} className={`p-3 border ${typeColor(sc.type)}`} data-testid={`scenario-card-${i}`}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px]">{sc.type}</Badge>
              <span className="text-sm font-semibold truncate">{sc.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{sc.description}</p>
            <div className="space-y-1.5">
              {comparison.metricKeys.map(key => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{key}</span>
                  <span className="font-mono font-medium">
                    {sc.metrics[key] !== undefined ? String(sc.metrics[key]) : "—"}
                    {key === "risk" && typeof sc.metrics[key] === "number" ? "%" : ""}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AssumptionPanel({ assumptions }: { assumptions: any[] }) {
  if (!assumptions.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        Assumptions will be extracted from the discussion
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "text-blue-400";
      case "challenged": return "text-yellow-400";
      case "invalidated": return "text-red-400";
      case "confirmed": return "text-green-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="p-3 space-y-2 overflow-auto">
      {assumptions.map((a, i) => (
        <div key={i} className="p-2 rounded border border-border" data-testid={`assumption-${i}`}>
          <div className="flex items-start gap-2">
            <Shield className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${statusColor(a.status)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{a.text}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      a.confidence > 70 ? "bg-green-500" : a.confidence > 40 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${a.confidence}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{a.confidence}%</span>
              </div>
              {a.challengedBy && (
                <p className="text-[10px] text-yellow-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {a.challengedBy}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CounterfactualPanel({ counterfactuals }: { counterfactuals: Counterfactual[] }) {
  if (!counterfactuals.length) return null;

  return (
    <div className="p-3 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5" />
        Counterfactuals
      </h4>
      {counterfactuals.map((cf) => (
        <Card key={cf.id} className="p-2.5 border-yellow-500/20 bg-yellow-500/5" data-testid={`counterfactual-${cf.id}`}>
          <p className="text-xs font-semibold text-foreground">{cf.scenario}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{cf.description}</p>
          <p className="text-[10px] text-yellow-400 mt-1">Impact: {cf.impact}</p>
        </Card>
      ))}
    </div>
  );
}

function MetricsPanel({ metrics }: { metrics: any[] }) {
  if (!metrics.length) return null;

  const trendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Metrics</h4>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="p-2 rounded border border-border text-center">
            <div className="flex items-center justify-center gap-1">
              {m.trend && trendIcon(m.trend)}
              <span className="text-sm font-bold text-foreground">{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{m.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LiveCanvas({
  worldState,
  mermaidSpec,
  comparison,
  counterfactuals,
  isUpdating,
  userId,
}: LiveCanvasProps) {
  const hasContent = worldState && (
    worldState.options.length > 0 ||
    worldState.assumptions.length > 0 ||
    worldState.scenarios.length > 0 ||
    worldState.metrics.length > 0
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">Live Canvas</span>
          {worldState && (
            <Badge variant="secondary" className="text-[10px]">
              v{worldState.version}
            </Badge>
          )}
        </div>
        {isUpdating && (
          <Badge variant="outline" className="text-[10px] animate-pulse text-primary">
            Compiling...
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue={hasContent || isUpdating ? "tree" : "browser"} className="h-full flex flex-col">
          <TabsList className="mx-3 mt-2 flex-shrink-0">
            <TabsTrigger value="tree" className="text-xs" data-testid="canvas-tab-tree">
              <GitBranch className="w-3 h-3 mr-1" />
              Decision Tree
            </TabsTrigger>
            <TabsTrigger value="compare" className="text-xs" data-testid="canvas-tab-compare">
              <BarChart3 className="w-3 h-3 mr-1" />
              Scenarios
            </TabsTrigger>
            <TabsTrigger value="assumptions" className="text-xs" data-testid="canvas-tab-assumptions">
              <Shield className="w-3 h-3 mr-1" />
              Assumptions
            </TabsTrigger>
            <TabsTrigger value="browser" className="text-xs" data-testid="canvas-tab-browser">
              <Monitor className="w-3 h-3 mr-1" />
              Browser
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="flex-1 overflow-auto m-0 mt-0">
            {!hasContent && !isUpdating ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <GitBranch className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground max-w-md">
                  Start discussing strategic options to visualize decision trees here.
                </p>
              </div>
            ) : (
              <>
                {mermaidSpec && <MermaidRenderer spec={mermaidSpec} />}
                {counterfactuals.length > 0 && <CounterfactualPanel counterfactuals={counterfactuals} />}
              </>
            )}
          </TabsContent>

          <TabsContent value="compare" className="flex-1 overflow-auto m-0 mt-0">
            {comparison && <ScenarioCompare comparison={comparison} />}
            {worldState && <MetricsPanel metrics={worldState.metrics} />}
          </TabsContent>

          <TabsContent value="assumptions" className="flex-1 overflow-auto m-0 mt-0">
            {worldState && <AssumptionPanel assumptions={worldState.assumptions} />}
          </TabsContent>

          <TabsContent value="browser" className="flex-1 overflow-hidden m-0 mt-0">
            <BrowserPanel userId={userId || null} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
