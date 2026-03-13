import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getAIClient, type AIProvider, type ChatMessage } from "./ai-provider";
import { executeMeetingAction, getMeetingActionDescriptions } from "./meeting-actions";
import { storage } from "./storage";
import type { AgentPersona, Meeting, WorkspaceFile } from "@shared/schema";

const roomCoreTurnSchema = z.object({
  content: z.string().trim().min(1),
  senderName: z.string().trim().min(1).max(80).optional(),
  targetAgentId: z.number().nullable().optional(),
  mode: z.enum(["align", "critique", "research", "decide"]).default("align"),
});

const roomPresenceSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().optional().nullable(),
});

const roomLeadAgentSchema = z.object({
  agentId: z.number().nullable(),
});

const roomWorkOrderSchema = z.object({
  workOrder: z.string().trim().min(1).max(2000),
});

type RoomCoreMode = z.infer<typeof roomCoreTurnSchema>["mode"];

interface PresenceEntry {
  userId: string;
  displayName: string;
  email: string | null;
  lastSeenAt: number;
}

interface RoomCoreMeta {
  leadAgentId: number | null;
  workOrder: string | null;
}

const PRESENCE_STALE_MS = 30_000;
const roomPresence = new Map<number, Map<string, PresenceEntry>>();

function getUserId(req: Request): string | undefined {
  return req.headers["x-user-id"] as string | undefined;
}

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function cleanPresence(meetingId: number) {
  const meetingPresence = roomPresence.get(meetingId);
  if (!meetingPresence) return;

  const now = Date.now();
  for (const [userId, entry] of meetingPresence.entries()) {
    if (now - entry.lastSeenAt > PRESENCE_STALE_MS) {
      meetingPresence.delete(userId);
    }
  }

  if (meetingPresence.size === 0) {
    roomPresence.delete(meetingId);
  }
}

function getPresence(meetingId: number) {
  cleanPresence(meetingId);
  return Array.from(roomPresence.get(meetingId)?.values() || []).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

function upsertPresence(meetingId: number, entry: PresenceEntry) {
  const meetingPresence = roomPresence.get(meetingId) || new Map<string, PresenceEntry>();
  meetingPresence.set(entry.userId, entry);
  roomPresence.set(meetingId, meetingPresence);
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

function readRoomCoreMeta(meeting: Meeting): RoomCoreMeta {
  const base = meeting.worldState && typeof meeting.worldState === "object" ? meeting.worldState as Record<string, any> : {};
  const meta = base.roomCoreMeta && typeof base.roomCoreMeta === "object" ? base.roomCoreMeta as Record<string, any> : {};

  return {
    leadAgentId: typeof meta.leadAgentId === "number" ? meta.leadAgentId : null,
    workOrder: typeof meta.workOrder === "string" && meta.workOrder.trim() ? meta.workOrder.trim() : null,
  };
}

async function writeRoomCoreMeta(meeting: Meeting, patch: Partial<RoomCoreMeta>) {
  const currentState = meeting.worldState && typeof meeting.worldState === "object" ? meeting.worldState as Record<string, any> : {};
  const currentMeta = readRoomCoreMeta(meeting);
  const nextMeta: RoomCoreMeta = {
    leadAgentId: patch.leadAgentId === undefined ? currentMeta.leadAgentId : patch.leadAgentId,
    workOrder: patch.workOrder === undefined ? currentMeta.workOrder : patch.workOrder,
  };

  await storage.updateMeetingWorldState(meeting.id, {
    ...currentState,
    roomCoreMeta: nextMeta,
  });
}

function inferWorkOrder(params: {
  meeting: Meeting;
  decisions: Awaited<ReturnType<typeof storage.getDecisions>>;
  tasks: Awaited<ReturnType<typeof storage.getTasks>>;
  artifacts: Awaited<ReturnType<typeof storage.getArtifacts>>;
  explicitWorkOrder: string | null;
}) {
  const { meeting, decisions, tasks, artifacts, explicitWorkOrder } = params;
  if (explicitWorkOrder) return explicitWorkOrder;

  const pendingTask = tasks.find((task) => task.status !== "completed");
  if (pendingTask) {
    return `Resolve "${pendingTask.title}" and decide whether the current work object should change.`;
  }

  const latestRuntime = artifacts.find((artifact) => artifact.type === "runtime_bundle");
  if (latestRuntime) {
    return `Inspect "${latestRuntime.title}" directly and decide what needs revision.`;
  }

  const latestArtifact = artifacts.find((artifact) =>
    ["software_prototype", "hardware_concept", "workflow_draft", "experiment_brief", "code"].includes(artifact.type),
  );
  if (latestArtifact) {
    return `Pressure-test "${latestArtifact.title}" and choose the next revision move.`;
  }

  const latestDecision = decisions[0];
  if (latestDecision) {
    return `Re-check the decision "${latestDecision.title}" against the latest discussion.`;
  }

  return `Move "${meeting.title}" from discussion into a concrete object the room can inspect right now.`;
}

async function buildRoomCorePayload(meeting: Meeting) {
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

  const activeAgentIds = Array.isArray(meeting.agentIds) ? meeting.agentIds as number[] : [];
  const latestRuntime = artifacts.find((artifact) => artifact.type === "runtime_bundle");
  const roomMeta = readRoomCoreMeta(meeting);

  return {
    meeting,
    workspace: workspace ?? null,
    members,
    presence: getPresence(meeting.id),
    files,
    agents,
    activeAgentIds,
    leadAgentId: activeAgentIds.includes(roomMeta.leadAgentId || -1) ? roomMeta.leadAgentId : null,
    messages,
    recentArtifacts: artifacts.slice(0, 8),
    recentDecisions: decisions.slice(0, 8),
    recentTasks: tasks.slice(0, 8),
    runtimePreviewUrl: latestRuntime ? `/preview/runtime/${latestRuntime.id}/` : null,
    workOrder: inferWorkOrder({
      meeting,
      decisions,
      tasks,
      artifacts,
      explicitWorkOrder: roomMeta.workOrder,
    }),
  };
}

function parsePlannedActions(raw: string): Array<{ action: string; params?: Record<string, any> }> {
  try {
    const parsed: unknown = JSON.parse(raw);
    const actions: unknown[] =
      parsed && typeof parsed === "object" && Array.isArray((parsed as { actions?: unknown[] }).actions)
        ? (parsed as { actions: unknown[] }).actions
        : [];

    const isPlannedAction = (item: unknown): item is { action: string; params?: Record<string, any> } => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { action?: unknown; params?: unknown };
      return typeof candidate.action === "string";
    };

    return actions
      .filter(isPlannedAction)
      .map((item) => ({
        action: item.action,
        params: item.params && typeof item.params === "object" ? item.params : {},
      }))
      .slice(0, 2);
  } catch {
    return [];
  }
}

function buildAgentSystemPrompt(params: {
  agent: AgentPersona;
  mode: RoomCoreMode;
  activeRoster: AgentPersona[];
  workOrder: string;
  files: WorkspaceFile[];
}) {
  const { agent, mode, activeRoster, workOrder, files } = params;
  const roster = activeRoster.filter((entry) => entry.id !== agent.id).map((entry) => `${entry.name} (${entry.role})`).join(", ");
  const fileSummary = files.length
    ? files.slice(0, 6).map((file) => `${file.originalName} (${file.mimeType})`).join(", ")
    : "No uploaded files";

  const modeGuidance: Record<RoomCoreMode, string> = {
    align: "Reduce ambiguity and make the next move obvious.",
    critique: "Surface the sharpest flaw or risky assumption first.",
    research: "Turn missing information into concrete fact-finding moves.",
    decide: "Force a clear decision and reject weaker paths.",
  };

  return `${agent.systemPrompt}

You are ${agent.name}, the ${agent.role}, inside the live ArgusVene meeting room.

Current work order: ${workOrder}
Other active specialists: ${roster || "none"}
Uploaded context: ${fileSummary}
Room mode: ${mode}. ${modeGuidance[mode]}

Rules:
- Speak like a real person in a live meeting.
- 1-3 short spoken sentences.
- Match the user's language.
- No markdown, no bullets, no headers.
- Say something specific enough that the room can act on it now.
- If you see a concrete next action, push for it.`;
}

async function planActions(params: {
  aiClient: ReturnType<typeof getAIClient>;
  meeting: Meeting;
  agent: AgentPersona;
  mode: RoomCoreMode;
  spokenReply: string;
  transcript: string;
  files: WorkspaceFile[];
  workOrder: string;
}) {
  const { aiClient, meeting, agent, mode, spokenReply, transcript, files, workOrder } = params;
  const raw = await aiClient.chatJSON([
    {
      role: "system",
      content: `You are the hidden execution planner for ${agent.name} in ArgusVene.

Decide whether ${agent.name} should take up to two concrete room actions after speaking.

Available actions:
${getMeetingActionDescriptions(files)}

Rules:
- Return zero, one, or two actions only.
- Only act if it materially improves the room.
- Prefer changing the work order, creating a task, recording a decision, storing an artifact, or reading a file.
- Output valid JSON only.
- Shape: {"actions":[{"action":"set_work_order","params":{"workOrder":"..."}}]}`,
    },
    {
      role: "user",
      content: `Meeting: ${meeting.title}
Mode: ${mode}
Current work order: ${workOrder}
Agent: ${agent.name} (${agent.role})

Recent transcript:
${transcript || "No transcript yet"}

What ${agent.name} just said:
${spokenReply}`,
    },
  ], 1400);

  return parsePlannedActions(raw);
}

function pickSupportAgent(activeAgents: AgentPersona[], primaryAgent: AgentPersona, mode: RoomCoreMode) {
  const others = activeAgents.filter((agent) => agent.id !== primaryAgent.id);
  if (others.length === 0) return null;

  const scored = others.map((agent) => {
    const role = `${agent.role} ${agent.name}`.toLowerCase();
    let score = 0;
    if (mode === "critique" && (role.includes("critic") || role.includes("risk") || role.includes("strategy"))) score += 3;
    if (mode === "research" && (role.includes("research") || role.includes("analyst") || role.includes("market"))) score += 3;
    if (mode === "decide" && (role.includes("lead") || role.includes("strategy") || role.includes("product"))) score += 3;
    if (mode === "align" && (role.includes("product") || role.includes("strategy") || role.includes("ops"))) score += 2;
    return { agent, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.agent || others[0];
}

export function registerRoomCoreRoutes(app: Express) {
  app.get("/api/core/meetings/:id/state", async (req: Request, res: Response) => {
    try {
      const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const payload = await buildRoomCorePayload(meeting);
      res.json(payload);
    } catch (error) {
      console.error("Room core state error:", error);
      res.status(500).json({ error: "Failed to fetch room state" });
    }
  });

  app.post("/api/core/meetings/:id/presence", async (req: Request, res: Response) => {
    const parsed = roomPresenceSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      upsertPresence(meeting.id, {
        userId,
        displayName: parsed.data.displayName || "Participant",
        email: parsed.data.email || null,
        lastSeenAt: Date.now(),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Room core presence error:", error);
      res.status(500).json({ error: "Failed to update presence" });
    }
  });

  app.patch("/api/core/meetings/:id/lead-agent", async (req: Request, res: Response) => {
    const parsed = roomLeadAgentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const activeAgentIds = Array.isArray(meeting.agentIds) ? meeting.agentIds as number[] : [];
      if (parsed.data.agentId !== null && !activeAgentIds.includes(parsed.data.agentId)) {
        return res.status(400).json({ error: "Lead agent must be active in the room" });
      }

      await writeRoomCoreMeta(meeting, { leadAgentId: parsed.data.agentId });
      const updatedMeeting = await storage.getMeeting(meeting.id);
      if (!updatedMeeting) return res.status(404).json({ error: "Not found" });

      const payload = await buildRoomCorePayload(updatedMeeting);
      res.json(payload);
    } catch (error) {
      console.error("Room core lead agent error:", error);
      res.status(500).json({ error: "Failed to update lead agent" });
    }
  });

  app.patch("/api/core/meetings/:id/work-order", async (req: Request, res: Response) => {
    const parsed = roomWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
      if (!meeting) return res.status(404).json({ error: "Not found" });

      await writeRoomCoreMeta(meeting, { workOrder: parsed.data.workOrder.trim() });
      const updatedMeeting = await storage.getMeeting(meeting.id);
      if (!updatedMeeting) return res.status(404).json({ error: "Not found" });

      const payload = await buildRoomCorePayload(updatedMeeting);
      res.json(payload);
    } catch (error) {
      console.error("Room core work order error:", error);
      res.status(500).json({ error: "Failed to update work order" });
    }
  });

  app.post("/api/core/meetings/:id/turn", async (req: Request, res: Response) => {
    const parsed = roomCoreTurnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const meeting = await verifyMeetingAccess(Number.parseInt(getRouteParam(req.params.id), 10), getUserId(req));
    if (!meeting) return res.status(404).json({ error: "Not found" });

    let aborted = false;
    res.on("close", () => {
      aborted = true;
    });

    try {
      const [allAgents, files, priorMessages, decisions, tasks, artifacts] = await Promise.all([
        storage.getAgentPersonas(),
        storage.getWorkspaceFiles(meeting.workspaceId),
        storage.getMeetingMessages(meeting.id),
        storage.getDecisions(meeting.workspaceId),
        storage.getTasks(meeting.workspaceId),
        storage.getArtifacts(meeting.workspaceId),
      ]);

      const activeAgentIds = new Set<number>(Array.isArray(meeting.agentIds) ? meeting.agentIds as number[] : []);
      const activeAgents = allAgents.filter((agent) => activeAgentIds.has(agent.id));
      if (activeAgents.length === 0) {
        return res.status(400).json({ error: "No active agents in this room" });
      }

      const roomMeta = readRoomCoreMeta(meeting);
      const workOrder = inferWorkOrder({
        meeting,
        decisions,
        tasks,
        artifacts,
        explicitWorkOrder: roomMeta.workOrder,
      });

      const targetedAgent = activeAgents.find((agent) => agent.id === parsed.data.targetAgentId);
      const leadAgent = activeAgents.find((agent) => agent.id === roomMeta.leadAgentId);
      const primaryAgent = targetedAgent || leadAgent || activeAgents[0];
      const supportAgent = targetedAgent ? null : pickSupportAgent(activeAgents, primaryAgent, parsed.data.mode);
      const selectedAgents = [primaryAgent, supportAgent].filter(Boolean) as AgentPersona[];

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
      const transcript = priorMessages.slice(-12).map((message) => `[${message.senderName}]: ${message.content}`).join("\n");
      let latestMeeting = meeting;

      for (const agent of selectedAgents) {
        if (aborted) break;

        const history: ChatMessage[] = [
          {
            role: "system",
            content: buildAgentSystemPrompt({
              agent,
              mode: parsed.data.mode,
              activeRoster: activeAgents,
              workOrder,
              files,
            }),
          },
          ...priorMessages.slice(-12).map((message) => ({
            role: (message.senderType === "human" ? "user" : "assistant") as "user" | "assistant",
            content: message.senderType === "human" ? message.content : `[${message.senderName}]: ${message.content}`,
          })),
          {
            role: "user",
            content: parsed.data.content,
          },
        ];

        let fullResponse = "";
        res.write(`data: ${JSON.stringify({ type: "agent_start", agentId: agent.id, agentName: agent.name })}\n\n`);

        for await (const chunk of aiClient.chatStream(history, 1200)) {
          if (aborted) break;
          if (!chunk.content) continue;
          fullResponse += chunk.content;
          res.write(`data: ${JSON.stringify({ type: "agent_chunk", agentId: agent.id, content: chunk.content })}\n\n`);
        }

        const cleaned = fullResponse.replace(/^\[?[\w\s-]+\]?:\s*/i, "").replace(/\n\[[\w\s-]+\]:\s*/g, "\n").trim();
        if (!cleaned) continue;

        const saved = await storage.createMeetingMessage({
          meetingId: latestMeeting.id,
          senderType: "agent",
          senderName: agent.name,
          agentId: agent.id,
          content: cleaned,
        });

        res.write(`data: ${JSON.stringify({ type: "agent_done", agentId: agent.id, data: saved })}\n\n`);

        const plannedActions = await planActions({
          aiClient,
          meeting: latestMeeting,
          agent,
          mode: parsed.data.mode,
          spokenReply: cleaned,
          transcript,
          files,
          workOrder,
        });

        for (const plannedAction of plannedActions) {
          if (aborted) break;

          const actionResult = await executeMeetingAction(plannedAction.action, plannedAction.params || {}, {
            meeting: latestMeeting,
            agent,
            files,
          });

          if (actionResult.success && actionResult.workOrder) {
            await writeRoomCoreMeta(latestMeeting, { workOrder: actionResult.workOrder });
            const updatedMeeting = await storage.getMeeting(latestMeeting.id);
            if (updatedMeeting) {
              latestMeeting = updatedMeeting;
            }
          }

          let actionMessage = null;
          if (actionResult.success && actionResult.message) {
            actionMessage = await storage.createMeetingMessage({
              meetingId: latestMeeting.id,
              senderType: "agent",
              senderName: agent.name,
              agentId: agent.id,
              content: actionResult.message,
            });
          }

          res.write(`data: ${JSON.stringify({
            type: "action_result",
            agentId: agent.id,
            action: actionResult,
            message: actionMessage,
          })}\n\n`);
        }
      }

      if (!aborted) {
        const updatedMeeting = await storage.getMeeting(meeting.id);
        if (!updatedMeeting) {
          res.write(`data: ${JSON.stringify({ type: "error", error: "Meeting disappeared during turn processing" })}\n\n`);
          res.end();
          return;
        }

        const payload = await buildRoomCorePayload(updatedMeeting);
        res.write(`data: ${JSON.stringify({ type: "room_state", room: payload })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Room core turn error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process turn" });
      } else if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Internal error" })}\n\n`);
        res.end();
      }
    }
  });
}
