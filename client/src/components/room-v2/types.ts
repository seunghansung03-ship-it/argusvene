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

export interface RoomV2Context {
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

export type RoomV2Mode = "align" | "critique" | "research" | "decide";

export interface StreamingAgentTurn {
  agentId: number;
  agentName: string;
  content: string;
}
