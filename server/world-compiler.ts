import { getAIClient } from "./ai-provider";
import type { WorldState } from "../shared/types/worldstate";
import { createEmptyWorldState } from "../shared/types/worldstate";

const COMPILE_PROMPT = `You are the World Compiler for co-founder, an AI decision participant system.
Your job is to analyze meeting transcript and extract/update a structured WorldState.

Given the current WorldState and new transcript content, produce an UPDATED WorldState JSON.

Rules:
- Incrementally update: add new entities, assumptions, options discovered in transcript
- Update confidence levels on assumptions if new evidence appears
- Track all strategic options discussed
- Generate at least 2 scenarios (base + alternative) when options are discussed
- Extract metrics mentioned (cost, timeline, risk, etc.)
- Mark assumptions as "challenged" if contradicting evidence appears
- Each entity, assumption, option, scenario, metric, decision needs a unique id (use short descriptive slugs)

Output ONLY valid JSON matching this exact schema:
{
  "sessionId": "string",
  "version": number,
  "entities": [{ "id": "string", "name": "string", "type": "person|project|market|resource|technology|organization", "description": "string" }],
  "assumptions": [{ "id": "string", "text": "string", "basis": "string", "confidence": 0-100, "challengedBy": "string|null", "status": "active|challenged|invalidated|confirmed" }],
  "constraints": [{ "id": "string", "type": "budget|time|policy|technical|resource", "description": "string", "severity": "hard|soft" }],
  "options": [{ "id": "string", "title": "string", "description": "string", "pros": ["string"], "cons": ["string"], "metrics": {} }],
  "scenarios": [{ "id": "string", "label": "string", "type": "base|best|worst|alternative", "optionId": "string", "metrics": { "cost": number, "risk": 0-100, "timeline": "string", "impact": 0-100 }, "description": "string" }],
  "metrics": [{ "id": "string", "name": "string", "value": "number|string", "unit": "string", "trend": "up|down|stable" }],
  "decisions": [{ "id": "string", "title": "string", "chosenOptionId": "string", "reasoning": "string", "rejectedOptions": [{ "optionId": "string", "reason": "string" }], "premises": ["string"], "timestamp": "string" }],
  "lastUpdated": "ISO timestamp"
}`;

export async function compileWorldState(
  currentState: WorldState | null,
  newTranscript: string,
  sessionId: string
): Promise<WorldState> {
  const aiClient = getAIClient("gemini");
  const state = currentState || createEmptyWorldState(sessionId);

  const prompt = `Current WorldState (version ${state.version}):
${JSON.stringify(state, null, 2)}

New transcript content to process:
${newTranscript}

Produce the updated WorldState. Increment version by 1. Keep all existing data and add/modify based on new transcript.`;

  try {
    const result = await aiClient.chatJSON([
      { role: "system", content: COMPILE_PROMPT },
      { role: "user", content: prompt },
    ]);

    const parsed = JSON.parse(result);
    const validated: WorldState = {
      sessionId,
      version: (state.version || 0) + 1,
      entities: Array.isArray(parsed.entities) ? parsed.entities : state.entities,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : state.assumptions,
      constraints: Array.isArray(parsed.constraints) ? parsed.constraints : state.constraints,
      options: Array.isArray(parsed.options) ? parsed.options : state.options,
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : state.scenarios,
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : state.metrics,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : state.decisions,
      lastUpdated: new Date().toISOString(),
    };
    return validated;
  } catch (error) {
    console.error("World Compiler error:", error);
    return { ...state, version: state.version + 1, lastUpdated: new Date().toISOString() };
  }
}

export function generateMermaidDecisionTree(state: WorldState): string {
  if (!state.options.length && !state.decisions.length) {
    return "graph TD\n  A[No decisions yet] --> B[Start discussing options]";
  }

  let mermaid = "graph TD\n";
  const root = `  ROOT[\"${state.sessionId || 'Meeting'}\"]`;
  mermaid += root + "\n";

  state.options.forEach((opt, i) => {
    const nodeId = `OPT_${i}`;
    const isChosen = state.decisions.some(d => d.chosenOptionId === opt.id);
    const style = isChosen ? `:::chosen` : "";
    mermaid += `  ROOT --> ${nodeId}[\"${opt.title}\"]${style}\n`;

    const relatedScenarios = state.scenarios.filter(s => s.optionId === opt.id);
    relatedScenarios.forEach((sc, j) => {
      const scId = `SC_${i}_${j}`;
      mermaid += `  ${nodeId} --> ${scId}[\"${sc.label}<br/>Risk: ${sc.metrics.risk || '?'}%<br/>Cost: ${sc.metrics.cost || '?'}\"]`;
      if (sc.type === "best") mermaid += ":::best";
      else if (sc.type === "worst") mermaid += ":::worst";
      mermaid += "\n";
    });
  });

  mermaid += "\n  classDef chosen fill:#22c55e,color:#fff,stroke:#16a34a\n";
  mermaid += "  classDef best fill:#3b82f6,color:#fff,stroke:#2563eb\n";
  mermaid += "  classDef worst fill:#ef4444,color:#fff,stroke:#dc2626\n";

  return mermaid;
}

export function generateScenarioComparison(state: WorldState): {
  scenarios: { label: string; type: string; metrics: Record<string, any>; description: string }[];
  metricKeys: string[];
} {
  const scenarios = state.scenarios.map(s => ({
    label: s.label,
    type: s.type,
    metrics: s.metrics,
    description: s.description,
  }));

  const metricKeys = new Set<string>();
  state.scenarios.forEach(s => {
    Object.keys(s.metrics).forEach(k => {
      if (s.metrics[k] !== undefined) metricKeys.add(k);
    });
  });

  return { scenarios, metricKeys: Array.from(metricKeys) };
}
