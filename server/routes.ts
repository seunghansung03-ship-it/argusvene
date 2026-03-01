import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkspaceSchema, insertMeetingSchema } from "@shared/schema";
import { z } from "zod";
import { getAIClient, getAvailableProviders, getDefaultProvider, setDefaultProvider, type AIProvider, type ChatMessage } from "./ai-provider";

const messageBodySchema = z.object({
  content: z.string().min(1),
  senderName: z.string().optional(),
});

const statusSchema = z.object({
  status: z.string().min(1),
});

const quickChatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
  provider: z.enum(["openai", "gemini"]).optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/providers", (_req, res) => {
    res.json({
      providers: getAvailableProviders(),
      default: getDefaultProvider(),
    });
  });

  app.post("/api/providers/default", (req, res) => {
    const parsed = z.object({ provider: z.enum(["openai", "gemini"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    setDefaultProvider(parsed.data.provider);
    res.json({ default: parsed.data.provider });
  });

  app.get("/api/workspaces", async (_req, res) => {
    try {
      const ws = await storage.getWorkspaces();
      res.json(ws);
    } catch (e) {
      console.error("Error fetching workspaces:", e);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.get("/api/workspaces/:id", async (req, res) => {
    try {
      const ws = await storage.getWorkspace(parseInt(req.params.id));
      if (!ws) return res.status(404).json({ error: "Not found" });
      res.json(ws);
    } catch (e) {
      console.error("Error fetching workspace:", e);
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  app.post("/api/workspaces", async (req, res) => {
    const parsed = insertWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    try {
      const ws = await storage.createWorkspace(parsed.data);
      res.status(201).json(ws);
    } catch (e) {
      console.error("Error creating workspace:", e);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  app.delete("/api/workspaces/:id", async (req, res) => {
    try {
      await storage.deleteWorkspace(parseInt(req.params.id));
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting workspace:", e);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  app.get("/api/agents", async (_req, res) => {
    try {
      const agents = await storage.getAgentPersonas();
      res.json(agents);
    } catch (e) {
      console.error("Error fetching agents:", e);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/workspaces/:wsId/meetings", async (req, res) => {
    try {
      const meetings = await storage.getMeetings(parseInt(req.params.wsId));
      res.json(meetings);
    } catch (e) {
      console.error("Error fetching meetings:", e);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/:id", async (req, res) => {
    try {
      const meeting = await storage.getMeeting(parseInt(req.params.id));
      if (!meeting) return res.status(404).json({ error: "Not found" });
      res.json(meeting);
    } catch (e) {
      console.error("Error fetching meeting:", e);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  app.post("/api/workspaces/:wsId/meetings", async (req, res) => {
    const bodySchema = z.object({
      title: z.string().min(1),
      agentIds: z.array(z.number()).default([]),
      aiProvider: z.enum(["openai", "gemini"]).default("openai"),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const meeting = await storage.createMeeting({
        ...parsed.data,
        workspaceId: parseInt(req.params.wsId),
        status: "active",
      });
      res.status(201).json(meeting);
    } catch (e) {
      console.error("Error creating meeting:", e);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id/status", async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    try {
      const updated = await storage.updateMeetingStatus(parseInt(req.params.id), parsed.data.status);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e) {
      console.error("Error updating meeting:", e);
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  app.get("/api/meetings/:id/messages", async (req, res) => {
    try {
      const msgs = await storage.getMeetingMessages(parseInt(req.params.id));
      res.json(msgs);
    } catch (e) {
      console.error("Error fetching messages:", e);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/meetings/:id/messages", async (req, res) => {
    const parsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const meetingId = parseInt(req.params.id);
    let aborted = false;

    res.on("close", () => { aborted = true; });

    try {
      const userMsg = await storage.createMeetingMessage({
        meetingId,
        senderType: "human",
        senderName: parsed.data.senderName || "You",
        content: parsed.data.content,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "user_message", data: userMsg })}\n\n`);

      if (aborted) return;

      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
        return;
      }

      const provider = (meeting.aiProvider || "openai") as AIProvider;
      const aiClient = getAIClient(provider);

      const agentIds = (meeting.agentIds as number[]) || [];
      const agents = await Promise.all(agentIds.map(id => storage.getAgentPersona(id)));
      const validAgents = agents.filter(Boolean) as NonNullable<typeof agents[0]>[];

      const previousMessages = await storage.getMeetingMessages(meetingId);

      for (const agent of validAgents) {
        if (aborted) break;

        try {
          const chatHistory: ChatMessage[] = previousMessages.map(m => ({
            role: (m.senderType === "human" ? "user" : "assistant") as "user" | "assistant",
            content: m.senderType === "human" ? m.content : `[${m.senderName}]: ${m.content}`,
          }));

          const systemMsg: ChatMessage = {
            role: "system",
            content: `${agent.systemPrompt}\n\nYou are ${agent.name}, the ${agent.role}. Respond concisely and in-character. Keep responses focused and under 300 words unless a detailed analysis is required.`,
          };

          let fullResponse = "";

          if (!aborted) {
            res.write(`data: ${JSON.stringify({ type: "agent_start", agentId: agent.id, agentName: agent.name })}\n\n`);
          }

          for await (const chunk of aiClient.chatStream([systemMsg, ...chatHistory])) {
            if (aborted) break;
            if (chunk.content) {
              fullResponse += chunk.content;
              res.write(`data: ${JSON.stringify({ type: "agent_chunk", agentId: agent.id, content: chunk.content })}\n\n`);
            }
          }

          const savedMsg = await storage.createMeetingMessage({
            meetingId,
            senderType: "agent",
            senderName: agent.name,
            agentId: agent.id,
            content: fullResponse,
          });

          if (!aborted) {
            res.write(`data: ${JSON.stringify({ type: "agent_done", agentId: agent.id, data: savedMsg })}\n\n`);
          }
        } catch (error) {
          console.error(`Error with agent ${agent.name}:`, error);
          if (!aborted) {
            res.write(`data: ${JSON.stringify({ type: "agent_error", agentId: agent.id, error: "Failed to get response" })}\n\n`);
          }
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Error in message handler:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      } else if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Internal error" })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/meetings/:id/summarize", async (req, res) => {
    const meetingId = parseInt(req.params.id);
    let aborted = false;
    res.on("close", () => { aborted = true; });

    try {
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const messages = await storage.getMeetingMessages(meetingId);
      if (messages.length === 0) return res.status(400).json({ error: "No messages to summarize" });

      const provider = (meeting.aiProvider || "openai") as AIProvider;
      const aiClient = getAIClient(provider);

      const transcript = messages.map(m => `[${m.senderName}]: ${m.content}`).join("\n\n");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const resultText = await aiClient.chatJSON([
        {
          role: "system",
          content: `You are the Consensus Engine for ArgusVene. Analyze the meeting transcript and produce a structured JSON output with:
1. "artifacts" - Array of generated documents. Each has: "type" (one of: "architecture_doc", "prd", "technical_spec", "meeting_notes"), "title", "content" (detailed markdown).
2. "decisions" - Array of decisions made. Each has: "title", "description".
3. "tasks" - Array of action items. Each has: "title", "description", "assignee" (agent name or "Unassigned"), "executionType" (one of: "manual", "ai_draft", "ai_research").

For executionType:
- "manual" = requires human action
- "ai_draft" = AI can generate a draft document/code/plan for this
- "ai_research" = AI can research and compile information for this

Be thorough and extract every actionable item. Output ONLY valid JSON.`
        },
        { role: "user", content: `Meeting: "${meeting.title}"\n\nTranscript:\n${transcript}` }
      ]);

      if (aborted) return;

      let parsed: any;
      try {
        parsed = JSON.parse(resultText);
      } catch {
        parsed = { artifacts: [], decisions: [], tasks: [] };
      }

      const savedArtifacts = [];
      for (const a of (parsed.artifacts || [])) {
        const saved = await storage.createArtifact({
          meetingId,
          workspaceId: meeting.workspaceId,
          type: a.type || "meeting_notes",
          title: a.title || "Untitled",
          content: a.content || "",
        });
        savedArtifacts.push(saved);
      }

      const savedDecisions = [];
      for (const d of (parsed.decisions || [])) {
        const saved = await storage.createDecision({
          meetingId,
          workspaceId: meeting.workspaceId,
          title: d.title || "Untitled",
          description: d.description || "",
        });
        savedDecisions.push(saved);
      }

      const savedTasks = [];
      for (const t of (parsed.tasks || [])) {
        const saved = await storage.createTask({
          meetingId,
          workspaceId: meeting.workspaceId,
          title: t.title || "Untitled",
          description: t.description || "",
          assignee: t.assignee || "Unassigned",
          status: "pending",
          executionType: t.executionType || "manual",
        });
        savedTasks.push(saved);
      }

      await storage.updateMeetingStatus(meetingId, "ended");

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "summary", artifacts: savedArtifacts, decisions: savedDecisions, tasks: savedTasks })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Summarize error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to summarize" });
      } else if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to summarize" })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/tasks/:id/execute", async (req, res) => {
    const taskId = parseInt(req.params.id);
    let aborted = false;
    res.on("close", () => { aborted = true; });

    try {
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      if (task.executionType === "manual") {
        return res.status(400).json({ error: "Manual tasks cannot be executed by AI" });
      }

      const providerParam = req.body?.provider as AIProvider | undefined;
      const aiClient = getAIClient(providerParam);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "start", taskId: task.id, executionType: task.executionType })}\n\n`);

      let systemPrompt = "";
      if (task.executionType === "ai_draft") {
        systemPrompt = `You are OpenClaw, the autonomous execution runtime for ArgusVene. Your job is to produce a complete, high-quality draft based on the task description. Output detailed, actionable content in markdown format. Include specifics like code snippets, architecture diagrams in mermaid, timelines, or whatever is appropriate for the task.`;
      } else if (task.executionType === "ai_research") {
        systemPrompt = `You are OpenClaw, the autonomous execution runtime for ArgusVene. Your job is to research and compile comprehensive information based on the task description. Provide structured research findings, comparisons, recommendations, and citations where relevant. Output in markdown format.`;
      }

      let fullResult = "";

      for await (const chunk of aiClient.chatStream([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Task: ${task.title}\n\nDescription: ${task.description || "No additional details provided."}\n\nAssigned to: ${task.assignee || "Unassigned"}\n\nPlease produce a comprehensive output for this task.` },
      ])) {
        if (aborted) break;
        if (chunk.content) {
          fullResult += chunk.content;
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk.content })}\n\n`);
        }
      }

      const updated = await storage.updateTaskExecution(taskId, fullResult, "completed");

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "complete", task: updated })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Task execution error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to execute task" });
      } else if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Execution failed" })}\n\n`);
        res.end();
      }
    }
  });

  app.get("/api/workspaces/:wsId/artifacts", async (req, res) => {
    try {
      const artifacts = await storage.getArtifacts(parseInt(req.params.wsId));
      res.json(artifacts);
    } catch (e) {
      console.error("Error fetching artifacts:", e);
      res.status(500).json({ error: "Failed to fetch artifacts" });
    }
  });

  app.get("/api/artifacts/:id", async (req, res) => {
    try {
      const artifact = await storage.getArtifact(parseInt(req.params.id));
      if (!artifact) return res.status(404).json({ error: "Not found" });
      res.json(artifact);
    } catch (e) {
      console.error("Error fetching artifact:", e);
      res.status(500).json({ error: "Failed to fetch artifact" });
    }
  });

  app.get("/api/workspaces/:wsId/decisions", async (req, res) => {
    try {
      const decisions = await storage.getDecisions(parseInt(req.params.wsId));
      res.json(decisions);
    } catch (e) {
      console.error("Error fetching decisions:", e);
      res.status(500).json({ error: "Failed to fetch decisions" });
    }
  });

  app.get("/api/workspaces/:wsId/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasks(parseInt(req.params.wsId));
      res.json(tasks);
    } catch (e) {
      console.error("Error fetching tasks:", e);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.patch("/api/tasks/:id/status", async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    try {
      const updated = await storage.updateTaskStatus(parseInt(req.params.id), parsed.data.status);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e) {
      console.error("Error updating task:", e);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.post("/api/quick-chat", async (req, res) => {
    const parsed = quickChatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    let aborted = false;
    res.on("close", () => { aborted = true; });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const provider = parsed.data.provider as AIProvider | undefined;
      const aiClient = getAIClient(provider);

      const chatMessages: ChatMessage[] = [
        { role: "system", content: "You are ArgusVene, an AI Co-founder assistant. You help founders and executives with strategic thinking, technical decisions, and business planning. Be concise, insightful, and actionable." },
        ...(parsed.data.history || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: parsed.data.message },
      ];

      for await (const chunk of aiClient.chatStream(chatMessages)) {
        if (aborted) break;
        if (chunk.content) {
          res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Quick chat error:", error);
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ error: "Failed" })}\n\n`);
        res.end();
      }
    }
  });

  return httpServer;
}
