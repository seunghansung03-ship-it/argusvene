export interface Entity {
  id: string;
  name: string;
  type: "person" | "project" | "market" | "resource" | "technology" | "organization";
  description?: string;
}

export interface Assumption {
  id: string;
  text: string;
  basis: string;
  confidence: number;
  challengedBy?: string;
  status: "active" | "challenged" | "invalidated" | "confirmed";
}

export interface Constraint {
  id: string;
  type: "budget" | "time" | "policy" | "technical" | "resource";
  description: string;
  severity: "hard" | "soft";
}

export interface StrategyOption {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  metrics: Record<string, number | string>;
}

export interface Scenario {
  id: string;
  label: string;
  type: "base" | "best" | "worst" | "alternative";
  optionId: string;
  metrics: {
    cost?: number;
    risk?: number;
    timeline?: string;
    impact?: number;
    runway?: number;
    [key: string]: number | string | undefined;
  };
  description: string;
}

export interface Metric {
  id: string;
  name: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "stable";
}

export interface DecisionRecord {
  id: string;
  title: string;
  chosenOptionId: string;
  reasoning: string;
  rejectedOptions: {
    optionId: string;
    reason: string;
  }[];
  premises: string[];
  timestamp: string;
}

export interface AgentAction {
  interrupt: boolean;
  interruptReason?: string;
  counterfactuals: {
    id: string;
    scenario: string;
    description: string;
    impact: string;
  }[];
  questions: {
    id: string;
    text: string;
    target?: string;
    priority: "critical" | "important" | "exploratory";
  }[];
}

export interface WorldState {
  sessionId: string;
  version: number;
  entities: Entity[];
  assumptions: Assumption[];
  constraints: Constraint[];
  options: StrategyOption[];
  scenarios: Scenario[];
  metrics: Metric[];
  decisions: DecisionRecord[];
  lastUpdated: string;
}

export function createEmptyWorldState(sessionId: string): WorldState {
  return {
    sessionId,
    version: 0,
    entities: [],
    assumptions: [],
    constraints: [],
    options: [],
    scenarios: [],
    metrics: [],
    decisions: [],
    lastUpdated: new Date().toISOString(),
  };
}
