import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { getAIClient, type AIProvider, type ChatMessage } from "./ai-provider";
import { executeMeetingAction, getMeetingActionDescriptions } from "./meeting-actions";
import type { AgentPersona, Meeting, WorkspaceFile } from "@shared/schema";

const roomV2TurnSchema = z.object({
  content: z.string().trim().min(1),
  senderName: z.string().trim().min(1).max(80).optional(),
  targetAgentId: z.number().optional(),
  mode: z.enum(["align", "critique", "research", "decide"]).default("align"),
});

type RoomV2Mode = z.infer<typeof roomV2TurnSchema>["mode"];

function getUserId(req: Request): string | undefined {
  return req.headers["x-user-id"] as string | undefined;
}

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

async function verifyWorkspaceAccess(workspaceId: number, userId: string | undefined): Promise<boolean> {
  const workspace = await storage.getWorkspace(workspaceId);
  if (!workspace) return false;
  if (!workspace.userId) return true;
  if (userId && workspace.userId === userId) return true;
  if (userId) {
    const members = await storage.getWorkspaceMembers(workspaceId);
    return members.some((member) => member.userId === userId && member.status === "accepted");
  }
  return false;
}

async function verifyMeetingAccess(meetingId: number, userId: string | undefined): Promise<Meeting | null> {
  const meeting = await storage.getMeeting(meetingId);
  if (!meeting) return null;
  return (await verifyWorkspaceAccess(meeting.workspaceId, userId)) ? meeting : null;
}

function firstSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/(.+?[.!?])(\s|$)/);
  return (match?.[1] || trimmed).trim();
}

function buildWorkOrder(params: {
  meeting: Meeting;
  decisions: Awaited<ReturnType<typeof storage.getDecisions>>;
  tasks: Awaited<ReturnType<typeof storage.getTasks>>;
  artifacts: Awaited<ReturnType<typeof storage.getArtifacts>>;
}) {
  const { meeting, decisions, tasks, artifacts } = params;
  const pendingTask = tasks.find((task) => task.status !== "completed");
  if (pendingTask) {
    return `Execute or pressure-test "${pendingTask.title}".`;
  }

  const latestRuntime = artifacts.find((artifact) => artifact.type === "runtime_bundle");
  if (latestRuntime) {
    return `Inspect the runnable preview "${latestRuntime.title}" and critique it directly.`;
  }

  const latestPrototype = artifacts.find((artifact) => artifact.type === "software_prototype" || artifact.type === "hardware_concept" || artifact.type === "workflow_draft" || artifact.type === "experiment_brief");
  if (latestPrototype) {
    return `Stress-test "${latestPrototype.title}" and decide what to revise next.`;
  }

  const latestDecision = decisions[0];
  if (latestDecision) {
    return `Decide whether "${latestDecision.title}" should hold or be revised.`;
  }

  return `Move "${meeting.title}" from discussion into a concrete artifact the room can inspect.`;
}

async function buildRoomV2Payload(meeting: Meeting) {
  const [workspace, members, files, agents, messages, artifacts, decisions, tasks] = await Promise.all([
    storage.getWorkspace(meeting.workspaceId),
    storage.getWorkspaceMembers(meeting.workspaceId),
    storage.getWorkspaceFiles(meeting.workspaceId),
    storage.getAgentPersonas(),
    storage.getMeetingMessages(meeting.id),
    storage.getArtifacts(meeting.workspaceId),
    storage.getDecisions(meeting.workspaceId),
    storage.getTasks(meeting.workspaceId),
  ]);

  const activeAgentIds = (meeting.agentIds as number[]) || [];
  const latestRuntime = artifacts.find((artifact) => artifact.type === "runtime_bundle");

  return {
    meeting,
    workspace: workspace ?? null,
    members,
    files,
    agents,
    activeAgentIds,
    messages,
    recentArtifacts: artifacts.slice(0, 8),
    recentDecisions: decisions.slice(0, 8),
    recentTasks: tasks.slice(0, 8),
    runtimePreviewUrl: latestRuntime ? `/preview/runtime/${latestRuntime.id}/` : null,
    workOrder: buildWorkOrder({ meeting, decisions, tasks, artifacts }),
  };
}

function parseActionPlan(raw: string): Array<{ action: string; params?: Record<string, any> }> {
  try {
    const parsed = JSON.parse(raw);
    const actions: unknown[] = Array.isArray(parsed?.actions) ? parsed.actions : [];
    return actions
      .filter((item): item is { action: string; params?: Record<string, any> } => {
        if (!item || typeof item !== "object") return false;
        return typeof (item as { action?: unknown }).action === "string";
      })
      .map((item) => ({
        action: item.action,
        params: item.params && typeof item.params === "object" ? item.params : {},
      }))
      .slice(0, 1);
  } catch {
    return [];
  }
}

function buildAgentSystemPrompt(agent: AgentPersona, mode: RoomV2Mode, roster: string) {
  const modeGuidance: Record<RoomV2Mode, string> = {
    align: "Clarify the sharpest next move and reduce ambiguity.",
    critique: "Push back hard. Surface flaws, risks, and weak assumptions first.",
    research: "Identify what must be verified externally and convert it into research moves.",
    decide: "Force a recommendation. Choose one path and reject weaker ones.",
  };

  return `${agent.systemPrompt}

You are ${agent.name}, the ${agent.role}, inside ArgusVene Room V2.
Other active specialists: ${roster || "none"}.

Room mode: ${mode}. ${modeGuidance[mode]}

Rules:
- Speak like a real person in a live meeting.
- 1-3 sentences maximum.
- No markdown, no bullets, no headers.
- Match the founder's language.
- Say something concrete enough that the room can act on it immediately.`;
}

async function planActionAfterReply(params: {
  aiClient: ReturnType<typeof getAIClient>;
  meeting: Meeting;
  agent: AgentPersona;
  mode: RoomV2Mode;
  spokenReply: string;
  transcript: string;
  files: WorkspaceFile[];
}) {
  const { aiClient, meeting, agent, mode, spokenReply, transcript, files } = params;
  const raw = await aiClient.chatJSON([
    {
      role: "system",
      content: `You are the hidden room operator for ${agent.name} inside ArgusVene Room V2.

Decide whether ${agent.name} should take one concrete room action after speaking.

Available actions:
${getMeetingActionDescriptions(files)}

Rules:
- Return zero or one action only.
- Only act if it materially improves the room state.
- Prefer set_work_order, create_task, record_decision, or read_workspace_file.
- Output valid JSON only.
- Shape: {"actions":[{"action":"set_work_order","params":{"workOrder":"..."}}]}`,
    },
    {
      role: "user",
      content: `Meeting: ${meeting.title}
Mode: ${mode}
Agent: ${agent.name} (${agent.role})

Recent transcript:
${transcript || "No transcript yet"}

What ${agent.name} just said:
${spokenReply}`,
    },
  ], 1000);

  return parseActionPlan(raw);
}

export function registerRoomV2Routes(app: Express) {
  app.get("/api/v2/meetings/:id/room", async (req: Request, res: Response) => {
    try {
      const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const payload = await buildRoomV2Payload(meeting);
      res.json(payload);
    } catch (error) {
      console.error("Room V2 room fetch error:", error);
      res.status(500).json({ error: "Failed to fetch room" });
    }
  });

  app.get("/api/v2/meetings/:id/messages", async (req: Request, res: Response) => {
    try {
      const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const messages = await storage.getMeetingMessages(meeting.id);
      res.json(messages);
    } catch (error) {
      console.error("Room V2 message fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/v2/meetings/:id/turn", async (req: Request, res: Response) => {
    const parsed = roomV2TurnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
    if (!meeting) return res.status(404).json({ error: "Not found" });

    let aborted = false;
    res.on("close", () => {
      aborted = true;
    });

    try {
      const [allAgents, files] = await Promise.all([
        storage.getAgentPersonas(),
        storage.getWorkspaceFiles(meeting.workspaceId),
      ]);
      const activeAgentIds = new Set<number>((meeting.agentIds as number[]) || []);
      const activeAgents = allAgents.filter((agent) => activeAgentIds.has(agent.id));
      const targetedAgent = activeAgents.find((agent) => agent.id === parsed.data.targetAgentId);
      const selectedAgents = targetedAgent ? [targetedAgent] : activeAgents.slice(0, 2);

      const userMessage = await storage.createMeetingMessage({
        meetingId: meeting.id,
        senderType: "human",
        senderName: parsed.data.senderName || "Founder",
        content: parsed.data.content,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(`data: ${JSON.stringify({ type: "user_message", data: userMessage })}\n\n`);

      const aiClient = getAIClient((meeting.aiProvider || "gemini") as AIProvider);
      const priorMessages = await storage.getMeetingMessages(meeting.id);
      const transcript = priorMessages.slice(-10).map((message) => `[${message.senderName}]: ${message.content}`).join("\n");
      const roster = activeAgents.map((agent) => `${agent.name} (${agent.role})`).join(", ");
      const responded: Array<{ agentId: number; agentName: string; content: string }> = [];

      for (const agent of selectedAgents) {
        if (aborted) break;

        const history: ChatMessage[] = priorMessages.slice(-10).map((message) => ({
          role: (message.senderType === "human" ? "user" : "assistant") as "user" | "assistant",
          content: message.senderType === "human" ? message.content : `[${message.senderName}]: ${message.content}`,
        }));

        const system: ChatMessage = {
          role: "system",
          content: buildAgentSystemPrompt(agent, parsed.data.mode, roster.replace(`${agent.name} (${agent.role})`, "").trim()),
        };

        let fullResponse = "";
        res.write(`data: ${JSON.stringify({ type: "agent_start", agentId: agent.id, agentName: agent.name })}\n\n`);

        for await (const chunk of aiClient.chatStream([system, ...history])) {
          if (aborted) break;
          if (!chunk.content) continue;
          fullResponse += chunk.content;
          res.write(`data: ${JSON.stringify({ type: "agent_chunk", agentId: agent.id, content: chunk.content })}\n\n`);
        }

        const cleaned = fullResponse.replace(/^\[?[\w\s-]+\]?:\s*/i, "").replace(/\n\[[\w\s-]+\]:\s*/g, "\n").trim();
        if (!cleaned) continue;

        responded.push({ agentId: agent.id, agentName: agent.name, content: cleaned });

        const saved = await storage.createMeetingMessage({
          meetingId: meeting.id,
          senderType: "agent",
          senderName: agent.name,
          agentId: agent.id,
          content: cleaned,
        });

        res.write(`data: ${JSON.stringify({ type: "agent_done", agentId: agent.id, data: saved })}\n\n`);

        const actionPlans = await planActionAfterReply({
          aiClient,
          meeting,
          agent,
          mode: parsed.data.mode,
          spokenReply: cleaned,
          transcript,
          files,
        });

        for (const actionPlan of actionPlans) {
          const result = await executeMeetingAction(actionPlan.action, actionPlan.params || {}, {
            meeting,
            agent,
            files,
          });

          let resultMessage = null;
          if (result.success && result.message) {
            resultMessage = await storage.createMeetingMessage({
              meetingId: meeting.id,
              senderType: "agent",
              senderName: agent.name,
              agentId: agent.id,
              content: result.message,
            });
          }

          res.write(`data: ${JSON.stringify({
            type: "action_result",
            agentId: agent.id,
            action: result,
            message: resultMessage,
          })}\n\n`);
        }
      }

      if (!aborted) {
        const payload = await buildRoomV2Payload(meeting);
        res.write(`data: ${JSON.stringify({
          type: "room_state",
          room: payload,
          operations: responded.map((item) => ({
            actor: item.agentName,
            summary: firstSentence(item.content),
          })),
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Room V2 turn error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process turn" });
      } else if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Internal error" })}\n\n`);
        res.end();
      }
    }
  });
}
