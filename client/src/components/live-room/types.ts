import type {
  AgentPersona,
  Artifact,
  Decision,
  Meeting,
  MeetingMessage,
  Task,
  Workspace,
  WorkspaceFile,
  WorkspaceMember,
} from "@shared/schema";

export interface CanvasReference {
  id: number;
  name: string;
  kind: string;
}

export interface CanvasOperation {
  id: string;
  actor: string;
  action: string;
  summary: string;
  status: "done" | "watch";
}

export interface CanvasItem {
  id: string;
  title: string;
  note: string;
}

export interface CanvasThread {
  id: string;
  label: string;
  detail: string;
}

export interface CanvasRisk {
  id: string;
  label: string;
  severity: string;
}

export interface CanvasSnapshot {
  headline: string;
  objective: string;
  stage: string;
  agenda: string[];
  references: CanvasReference[];
  operations: CanvasOperation[];
  threads: CanvasThread[];
  risks: CanvasRisk[];
  decisions: CanvasItem[];
  scenarios: CanvasItem[];
}

export interface RoomContext {
  meeting: Meeting;
  workspace: Workspace;
  members: WorkspaceMember[];
  files: WorkspaceFile[];
  agents: AgentPersona[];
  activeAgentIds: number[];
  recentArtifacts: Artifact[];
  recentDecisions: Decision[];
  recentTasks: Task[];
  worldState: any;
  mermaid: string;
  comparison: {
    scenarios: any[];
    metricKeys: string[];
  } | null;
  canvas: CanvasSnapshot;
}

export interface StreamingTurn {
  agentId: number;
  agentName: string;
  content: string;
}

export type RoomMode = "align" | "debate" | "research" | "ship";
export type SpeechLocale = "auto" | "ko-KR" | "en-US";
export type PrototypeKind = "software" | "hardware" | "workflow" | "experiment";
export type AgentCommandMode = "build" | "critique" | "research" | "decide";

export interface HumanRosterEntry {
  id: string;
  label: string;
  detail: string;
  kind: "founder" | "member";
  memberId?: number;
}

export type MeetingTranscript = MeetingMessage[];
