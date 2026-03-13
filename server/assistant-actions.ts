import { storage } from "./storage";
import type { InsertWorkspace, InsertAgentPersona } from "@shared/schema";
import fs from "fs";
import path from "path";
import pdf from "pdf-parse";

export interface ActionResult {
  action: string;
  success: boolean;
  message: string;
  data?: any;
}

const AVAILABLE_ACTIONS = [
  {
    name: "create_workspace",
    description: "Create a new workspace/project",
    params: "name (required), description (required), icon (optional: rocket|flask|trending-up|briefcase)",
  },
  {
    name: "list_workspaces",
    description: "List all existing workspaces",
    params: "none",
  },
  {
    name: "create_agent",
    description: "Create a new AI agent persona",
    params: "name (required), role (required), systemPrompt (required), color (optional hex), voiceId (optional)",
  },
  {
    name: "list_agents",
    description: "List all available AI agents",
    params: "none",
  },
  {
    name: "create_meeting",
    description: "Create a new meeting in a workspace",
    params: "workspaceId (required number), title (required), agentIds (required number array)",
  },
  {
    name: "list_meetings",
    description: "List meetings in a workspace",
    params: "workspaceId (required number)",
  },
  {
    name: "delete_workspace",
    description: "Delete a workspace by ID",
    params: "id (required number)",
  },
  {
    name: "update_agent",
    description: "Update an existing agent's settings",
    params: "id (required number), plus any: name, role, systemPrompt, color, voiceId",
  },
  {
    name: "list_workspace_files",
    description: "List uploaded files in a workspace",
    params: "workspaceId (required number)",
  },
  {
    name: "read_workspace_file",
    description: "Read the contents of an uploaded file",
    params: "fileId (required number)",
  },
];

export function getActionDescriptions(): string {
  return AVAILABLE_ACTIONS.map(a => `- ${a.name}: ${a.description} (params: ${a.params})`).join("\n");
}

export async function executeAction(actionName: string, params: Record<string, any>, userId?: string): Promise<ActionResult> {
  try {
    switch (actionName) {
      case "create_workspace": {
        if (!params.name || !params.description) {
          return { action: actionName, success: false, message: "name and description are required" };
        }
        const ws = await storage.createWorkspace({
          name: params.name,
          description: params.description,
          icon: params.icon || "briefcase",
          userId: userId || null,
        } as InsertWorkspace);
        return { action: actionName, success: true, message: `Workspace "${ws.name}" created (ID: ${ws.id})`, data: ws };
      }

      case "list_workspaces": {
        const workspaces = await storage.getWorkspaces(userId);
        return {
          action: actionName,
          success: true,
          message: workspaces.length === 0
            ? "No workspaces found."
            : `Found ${workspaces.length} workspace(s):\n${workspaces.map(w => `  - [ID:${w.id}] ${w.name}: ${w.description}`).join("\n")}`,
          data: workspaces,
        };
      }

      case "create_agent": {
        if (!params.name || !params.role || !params.systemPrompt) {
          return { action: actionName, success: false, message: "name, role, and systemPrompt are required" };
        }
        const agent = await storage.createAgentPersona({
          name: params.name,
          role: params.role,
          systemPrompt: params.systemPrompt,
          color: params.color || "#3B82F6",
          voiceId: params.voiceId || null,
        } as InsertAgentPersona);
        return { action: actionName, success: true, message: `Agent "${agent.name}" (${agent.role}) created (ID: ${agent.id})`, data: agent };
      }

      case "list_agents": {
        const agents = await storage.getAgentPersonas();
        return {
          action: actionName,
          success: true,
          message: agents.length === 0
            ? "No agents found."
            : `Found ${agents.length} agent(s):\n${agents.map(a => `  - [ID:${a.id}] ${a.name} (${a.role})`).join("\n")}`,
          data: agents,
        };
      }

      case "create_meeting": {
        if (!params.workspaceId || !params.title || !params.agentIds) {
          return { action: actionName, success: false, message: "workspaceId, title, and agentIds are required" };
        }
        const workspace = await storage.getWorkspace(params.workspaceId);
        if (!workspace) {
          return { action: actionName, success: false, message: `Workspace ID ${params.workspaceId} not found` };
        }
        const meeting = await storage.createMeeting({
          workspaceId: params.workspaceId,
          title: params.title,
          agentIds: params.agentIds,
          status: "active",
          aiProvider: "gemini",
        });
        return { action: actionName, success: true, message: `Meeting "${meeting.title}" created (ID: ${meeting.id}) in workspace "${workspace.name}"`, data: meeting };
      }

      case "list_meetings": {
        if (!params.workspaceId) {
          return { action: actionName, success: false, message: "workspaceId is required" };
        }
        const meetings = await storage.getMeetings(params.workspaceId);
        return {
          action: actionName,
          success: true,
          message: meetings.length === 0
            ? "No meetings found in this workspace."
            : `Found ${meetings.length} meeting(s):\n${meetings.map(m => `  - [ID:${m.id}] ${m.title} (${m.status})`).join("\n")}`,
          data: meetings,
        };
      }

      case "delete_workspace": {
        if (!params.id) {
          return { action: actionName, success: false, message: "id is required" };
        }
        const ws = await storage.getWorkspace(params.id);
        if (!ws) return { action: actionName, success: false, message: `Workspace ID ${params.id} not found` };
        await storage.deleteWorkspace(params.id);
        return { action: actionName, success: true, message: `Workspace "${ws.name}" deleted` };
      }

      case "update_agent": {
        if (!params.id) {
          return { action: actionName, success: false, message: "id is required" };
        }
        const { id, ...updates } = params;
        const updated = await storage.updateAgentPersona(id, updates);
        if (!updated) return { action: actionName, success: false, message: `Agent ID ${id} not found` };
        return { action: actionName, success: true, message: `Agent "${updated.name}" updated`, data: updated };
      }

      case "list_workspace_files": {
        if (!params.workspaceId) {
          return { action: actionName, success: false, message: "workspaceId is required" };
        }
        const files = await storage.getWorkspaceFiles(params.workspaceId);
        return {
          action: actionName,
          success: true,
          message: files.length === 0
            ? "No files found in this workspace."
            : `Found ${files.length} file(s):\n${files.map(f => `  - [ID:${f.id}] ${f.originalName} (${f.mimeType}, ${Math.round(f.size / 1024)}KB)`).join("\n")}`,
          data: files,
        };
      }

      case "read_workspace_file": {
        if (!params.fileId) {
          return { action: actionName, success: false, message: "fileId is required" };
        }
        const file = await storage.getWorkspaceFile(params.fileId);
        if (!file) return { action: actionName, success: false, message: `File ID ${params.fileId} not found` };

        const fullPath = path.join(process.cwd(), "uploads", file.path);
        if (!fs.existsSync(fullPath)) {
          return { action: actionName, success: false, message: "File data not found on disk" };
        }

        let content = "";
        try {
          if (file.mimeType === "application/pdf") {
            const dataBuffer = fs.readFileSync(fullPath);
            const pdfData = await pdf(dataBuffer);
            content = pdfData.text;
          } else if (file.mimeType.startsWith("text/") || file.mimeType === "application/json") {
            content = fs.readFileSync(fullPath, "utf-8");
          } else {
            return { action: actionName, success: false, message: `Unsupported file type for reading: ${file.mimeType}` };
          }
        } catch (error: any) {
          return { action: actionName, success: false, message: `Failed to read file: ${error.message}` };
        }

        return {
          action: actionName,
          success: true,
          message: `Successfully read file ${file.originalName}`,
          data: { content },
        };
      }

      default:
        return { action: actionName, success: false, message: `Unknown action: ${actionName}` };
    }
  } catch (error: any) {
    return { action: actionName, success: false, message: `Error: ${error.message || "Unknown error"}` };
  }
}
