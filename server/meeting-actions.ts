import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import type { AgentPersona, Meeting, WorkspaceFile } from "@shared/schema";
import { storage } from "./storage";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const FILE_EXCERPT_LIMIT = 900;

export type MeetingActionName =
  | "set_work_order"
  | "create_task"
  | "record_decision"
  | "store_artifact"
  | "list_workspace_files"
  | "read_workspace_file";

export interface MeetingActionResult {
  action: string;
  success: boolean;
  message: string;
  data?: unknown;
  workOrder?: string;
}

export interface MeetingActionContext {
  meeting: Meeting;
  agent: Pick<AgentPersona, "id" | "name" | "role">;
  files: WorkspaceFile[];
}

function trimText(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next ? next : fallback;
}

function clipText(value: string, limit = FILE_EXCERPT_LIMIT): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit).trimEnd()}...`;
}

function buildFileCatalog(files: WorkspaceFile[]): string {
  if (files.length === 0) {
    return "No uploaded files are attached to this workspace.";
  }

  return files
    .slice(0, 12)
    .map((file) => `- fileId ${file.id}: ${file.originalName} (${file.mimeType}, ${Math.round(file.size / 1024)} KB)`)
    .join("\n");
}

export function getMeetingActionDescriptions(files: WorkspaceFile[]): string {
  return [
    "- set_work_order: Update the room's active work order so the canvas and roster show a sharper next move. Params: workOrder (required string).",
    "- create_task: Open a follow-up task in the workspace. Params: title (required), description (optional), assignee (optional), executionType (optional: manual|ai_draft|ai_research).",
    "- record_decision: Lock a decision into the room's outputs. Params: title (required), description (required).",
    "- store_artifact: Save a room artifact or brief for others to inspect. Params: type (required short slug), title (required), content (required).",
    "- list_workspace_files: Review which uploaded files are available. Params: none.",
    "- read_workspace_file: Pull a specific uploaded file into the room context. Params: fileId (preferred number) or fileName (string).",
    "",
    "Available workspace files:",
    buildFileCatalog(files),
  ].join("\n");
}

async function readWorkspaceFileContent(file: WorkspaceFile): Promise<string> {
  const fullPath = path.join(UPLOADS_DIR, file.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error("File data not found on disk");
  }

  if (file.mimeType === "application/pdf") {
    const dataBuffer = fs.readFileSync(fullPath);
    const pdfData = await pdf(dataBuffer);
    return pdfData.text || "";
  }

  if (file.mimeType.startsWith("text/") || file.mimeType === "application/json") {
    return fs.readFileSync(fullPath, "utf-8");
  }

  throw new Error(`Unsupported file type for reading: ${file.mimeType}`);
}

export async function executeMeetingAction(
  actionName: string,
  params: Record<string, any>,
  context: MeetingActionContext,
): Promise<MeetingActionResult> {
  try {
    switch (actionName as MeetingActionName) {
      case "set_work_order": {
        const workOrder = trimText(params.workOrder, "");
        if (!workOrder) {
          return { action: actionName, success: false, message: "workOrder is required" };
        }

        return {
          action: actionName,
          success: true,
          workOrder,
          message: `I'm resetting the room's work order to "${workOrder}".`,
          data: { workOrder },
        };
      }

      case "create_task": {
        const title = trimText(params.title, "");
        if (!title) {
          return { action: actionName, success: false, message: "title is required" };
        }

        const task = await storage.createTask({
          meetingId: context.meeting.id,
          workspaceId: context.meeting.workspaceId,
          title,
          description: trimText(params.description, ""),
          assignee: trimText(params.assignee, context.agent.name),
          executionType: trimText(params.executionType, "manual"),
          status: "pending",
        });

        return {
          action: actionName,
          success: true,
          message: `I opened a follow-up task: "${task.title}".`,
          data: task,
        };
      }

      case "record_decision": {
        const title = trimText(params.title, "");
        const description = trimText(params.description, "");
        if (!title || !description) {
          return { action: actionName, success: false, message: "title and description are required" };
        }

        const decision = await storage.createDecision({
          meetingId: context.meeting.id,
          workspaceId: context.meeting.workspaceId,
          title,
          description,
          status: "confirmed",
        });

        return {
          action: actionName,
          success: true,
          message: `I locked a decision for the room: "${decision.title}".`,
          data: decision,
        };
      }

      case "store_artifact": {
        const type = trimText(params.type, "working_note");
        const title = trimText(params.title, "");
        const content = trimText(params.content, "");
        if (!title || !content) {
          return { action: actionName, success: false, message: "title and content are required" };
        }

        const artifact = await storage.createArtifact({
          meetingId: context.meeting.id,
          workspaceId: context.meeting.workspaceId,
          type,
          title,
          content,
        });

        return {
          action: actionName,
          success: true,
          message: `I pinned a new artifact: "${artifact.title}".`,
          data: artifact,
        };
      }

      case "list_workspace_files": {
        return {
          action: actionName,
          success: true,
          message:
            context.files.length === 0
              ? "I checked the workspace and there are no uploaded files yet."
              : `I checked the workspace files: ${context.files
                  .slice(0, 6)
                  .map((file) => file.originalName)
                  .join(", ")}.`,
          data: context.files,
        };
      }

      case "read_workspace_file": {
        const requestedId = Number(params.fileId);
        const requestedName = trimText(params.fileName, "").toLowerCase();
        const file =
          context.files.find((entry) => Number.isFinite(requestedId) && entry.id === requestedId) ||
          context.files.find((entry) => requestedName && entry.originalName.toLowerCase() === requestedName) ||
          context.files.find((entry) => requestedName && entry.originalName.toLowerCase().includes(requestedName));

        if (!file) {
          return { action: actionName, success: false, message: "Requested file was not found in this workspace" };
        }

        const content = await readWorkspaceFileContent(file);
        const excerpt = clipText(content);

        return {
          action: actionName,
          success: true,
          message: `I pulled "${file.originalName}" into the room. Key excerpt: ${excerpt}`,
          data: {
            fileId: file.id,
            fileName: file.originalName,
            content,
            excerpt,
          },
        };
      }

      default:
        return { action: actionName, success: false, message: `Unknown meeting action: ${actionName}` };
    }
  } catch (error: any) {
    return {
      action: actionName,
      success: false,
      message: `Error: ${error?.message || "Unknown error"}`,
    };
  }
}
