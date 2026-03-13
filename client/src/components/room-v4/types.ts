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

export interface RoomV4Context {
  meeting: Meeting;
  workspace: Workspace | null;
  members: WorkspaceMember[];
  files: WorkspaceFile[];
  agents: AgentPersona[];
  activeAgentIds: number[];
  messages: MeetingMessage[];
  recentArtifacts: Artifact[];
  recentDecisions: Decision[];
  recentTasks: Task[];
  runtimePreviewUrl: string | null;
  workOrder: string;
}

export type RoomCommandMode = "align" | "critique" | "research" | "decide";

export type PrototypeKind = "software" | "hardware" | "workflow" | "experiment";

export type WorkbenchView = "draft" | "preview";

export type SpeechLocale = "auto" | "ko-KR" | "en-US";

export interface StreamingAgentTurn {
  agentId: number;
  agentName: string;
  content: string;
}

export interface RoomNotice {
  tone: "neutral" | "success" | "error";
  message: string;
}
