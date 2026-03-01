import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkspaceSchema } from "@shared/schema";
import { z } from "zod";
import { getAIClient, getAvailableProviders, getDefaultProvider, setDefaultProvider, type AIProvider, type ChatMessage } from "./ai-provider";
import { compileWorldState, generateMermaidDecisionTree, generateScenarioComparison } from "./world-compiler";
import { evaluateParticipation, formatInterruptMessage } from "./ai-participant";
import { createEmptyWorldState, type WorldState } from "../shared/types/worldstate";
import { synthesizeSpeech, isElevenLabsAvailable, getAvailableVoices, fetchElevenLabsVoices } from "./elevenlabs";
import { insertAgentPersonaSchema } from "@shared/schema";
import { executeAction, getActionDescriptions, type ActionResult } from "./assistant-actions";

const audioBodyParser = express.json({ limit: "50mb" });

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

  app.post("/api/agents", async (req, res) => {
    const parsed = insertAgentPersonaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const agent = await storage.createAgentPersona(parsed.data);
      res.json(agent);
    } catch (e) {
      console.error("Error creating agent:", e);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.patch("/api/agents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid agent ID" });

    const partial = insertAgentPersonaSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error.message });

    try {
      const updated = await storage.updateAgentPersona(id, partial.data);
      if (!updated) return res.status(404).json({ error: "Agent not found" });
      res.json(updated);
    } catch (e) {
      console.error("Error updating agent:", e);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid agent ID" });

    try {
      const allMeetings = await storage.getAllMeetings();
      const inUse = allMeetings.some(m => {
        const ids = m.agentIds as number[] | null;
        return ids && ids.includes(id);
      });

      if (inUse) {
        return res.status(409).json({ error: "This agent is currently assigned to one or more meetings and cannot be deleted." });
      }

      await storage.deleteAgentPersona(id);
      res.json({ success: true });
    } catch (e) {
      console.error("Error deleting agent:", e);
      res.status(500).json({ error: "Failed to delete agent" });
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
      aiProvider: z.enum(["openai", "gemini"]).default("gemini"),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const sessionId = `session-${Date.now()}`;
      const meeting = await storage.createMeeting({
        ...parsed.data,
        workspaceId: parseInt(req.params.wsId),
        status: "active",
        worldState: createEmptyWorldState(sessionId),
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

  app.get("/api/meetings/:id/worldstate", async (req, res) => {
    try {
      const meeting = await storage.getMeeting(parseInt(req.params.id));
      if (!meeting) return res.status(404).json({ error: "Not found" });
      const ws = (meeting.worldState as WorldState) || createEmptyWorldState(`session-${meeting.id}`);
      const mermaid = generateMermaidDecisionTree(ws);
      const comparison = generateScenarioComparison(ws);
      res.json({ worldState: ws, mermaid, comparison });
    } catch (e) {
      console.error("Error fetching worldstate:", e);
      res.status(500).json({ error: "Failed to fetch world state" });
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

      const provider = (meeting.aiProvider || "gemini") as AIProvider;
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

          const otherAgentNames = validAgents.filter(a => a.id !== agent.id).map(a => `${a.name} (${a.role})`).join(", ");
          const systemMsg: ChatMessage = {
            role: "system",
            content: `${agent.systemPrompt}

You are ${agent.name}, the ${agent.role}. You are participating in a LIVE voice meeting with a human founder and other AI co-founders: ${otherAgentNames || "none"}.

CONVERSATION RULES:
- Speak naturally as if in a real meeting — use conversational tone, not formal reports
- Address others by name: "I agree with Atlas on the timeline, but..." or "Nova, have you considered..."
- React to what was JUST said — don't repeat the full context, respond directly
- Express opinions with personality: show enthusiasm, skepticism, concern, excitement
- Use natural speech patterns: "Look, here's the thing...", "Actually, I'd push back on that...", "That's a solid point, and building on it..."
- Keep responses SHORT for voice (2-4 sentences typical, max 150 words) — this is a conversation, not a presentation
- If you disagree, say so directly but constructively
- Ask the human founder follow-up questions to keep the dialogue flowing
- Avoid bullet points, headers, or markdown formatting — speak in paragraphs as you would out loud
- Don't summarize the entire discussion — just add your perspective on the latest point
- Use the user's language (if they speak Korean, respond in Korean; if English, respond in English)`,
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

      const firstRoundResponses: { agentId: number; agentName: string; content: string }[] = [];
      const latestMessages = await storage.getMeetingMessages(meetingId);

      for (const agent of validAgents) {
        const lastMsg = latestMessages.find(m => m.agentId === agent.id && m.senderType === "agent");
        if (lastMsg) firstRoundResponses.push({ agentId: agent.id, agentName: agent.name, content: lastMsg.content });
      }

      if (!aborted && validAgents.length >= 2 && firstRoundResponses.length >= 2) {
        const reactor = validAgents[Math.floor(Math.random() * validAgents.length)];
        const othersContext = firstRoundResponses
          .filter(r => r.agentId !== reactor.id)
          .map(r => `[${r.agentName}]: ${r.content}`)
          .join("\n\n");

        try {
          const reactionSystemMsg: ChatMessage = {
            role: "system",
            content: `${reactor.systemPrompt}

You are ${reactor.name}, the ${reactor.role}. You just heard your colleagues respond in a live meeting. Now it's your turn to REACT to what they said — agree, disagree, build on their ideas, or challenge them.

RULES:
- Address the other agents BY NAME: "${firstRoundResponses.filter(r => r.agentId !== reactor.id).map(r => r.agentName).join(", ")}"
- React specifically to something they said — don't just repeat yourself
- Be direct and conversational, 1-3 sentences max
- Show your personality: "I actually disagree with Nova here because..." or "Great point from Atlas — and I'd add..."
- Use the user's language (Korean if they speak Korean, English if English)
- Do NOT use markdown formatting`,
          };

          const reactionHistory: ChatMessage[] = [
            ...latestMessages.slice(-8).map(m => ({
              role: (m.senderType === "human" ? "user" : "assistant") as "user" | "assistant",
              content: m.senderType === "human" ? m.content : `[${m.senderName}]: ${m.content}`,
            })),
            { role: "user", content: `[System]: Now react to what the other agents just said:\n\n${othersContext}` },
          ];

          let reactionContent = "";
          if (!aborted) {
            res.write(`data: ${JSON.stringify({ type: "agent_start", agentId: reactor.id, agentName: reactor.name })}\n\n`);
          }

          for await (const chunk of aiClient.chatStream([reactionSystemMsg, ...reactionHistory])) {
            if (aborted) break;
            if (chunk.content) {
              reactionContent += chunk.content;
              res.write(`data: ${JSON.stringify({ type: "agent_chunk", agentId: reactor.id, content: chunk.content })}\n\n`);
            }
          }

          if (reactionContent.trim() && !aborted) {
            const savedReaction = await storage.createMeetingMessage({
              meetingId,
              senderType: "agent",
              senderName: reactor.name,
              agentId: reactor.id,
              content: reactionContent,
            });
            res.write(`data: ${JSON.stringify({ type: "agent_done", agentId: reactor.id, data: savedReaction })}\n\n`);
          }
        } catch (error) {
          console.error(`Reaction round error for ${reactor.name}:`, error);
        }
      }

      if (!aborted) {
        try {
          const currentWorldState = (meeting.worldState as WorldState) || createEmptyWorldState(`session-${meetingId}`);
          const allMsgs = await storage.getMeetingMessages(meetingId);
          const transcript = allMsgs.slice(-8).map(m => `[${m.senderName}]: ${m.content}`).join("\n");

          res.write(`data: ${JSON.stringify({ type: "worldstate_updating" })}\n\n`);

          const [updatedWorldState, participantAction] = await Promise.all([
            compileWorldState(currentWorldState, transcript, currentWorldState.sessionId),
            evaluateParticipation(currentWorldState, transcript),
          ]);

          if (participantAction.counterfactuals && participantAction.counterfactuals.length > 0) {
            const cfScenarios = participantAction.counterfactuals.map((cf: any, i: number) => ({
              id: cf.id || `cf-${Date.now()}-${i}`,
              label: cf.scenario,
              type: "alternative" as const,
              optionId: "",
              metrics: { risk: 50 },
              description: `${cf.description} — Impact: ${cf.impact}`,
            }));
            updatedWorldState.scenarios = [
              ...updatedWorldState.scenarios.filter((s: any) => !s.id.startsWith("cf-")),
              ...cfScenarios,
            ];
          }

          await storage.updateMeetingWorldState(meetingId, updatedWorldState);

          const mermaid = generateMermaidDecisionTree(updatedWorldState);
          const comparison = generateScenarioComparison(updatedWorldState);

          res.write(`data: ${JSON.stringify({
            type: "worldstate_updated",
            worldState: updatedWorldState,
            mermaid,
            comparison,
          })}\n\n`);

          if (participantAction.interrupt) {
            const interruptMsg = formatInterruptMessage(participantAction);
            const savedInterrupt = await storage.createMeetingMessage({
              meetingId,
              senderType: "agent",
              senderName: "co-founder",
              content: interruptMsg,
            });

            res.write(`data: ${JSON.stringify({
              type: "interrupt",
              action: participantAction,
              message: savedInterrupt,
            })}\n\n`);
          }

          if (participantAction.counterfactuals.length > 0) {
            res.write(`data: ${JSON.stringify({
              type: "counterfactuals",
              counterfactuals: participantAction.counterfactuals,
            })}\n\n`);
          }
        } catch (wsError) {
          console.error("WorldState/Participant error:", wsError);
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

  app.post("/api/meetings/:id/voice", audioBodyParser, async (req, res) => {
    const meetingId = parseInt(req.params.id);
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Audio data required" });
    }

    let aborted = false;
    res.on("close", () => { aborted = true; });

    try {
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const aiClient = getAIClient("gemini");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const transcriptResult = await aiClient.chat([
        { role: "system", content: "You are a speech-to-text transcription assistant. The user will provide audio content description. Transcribe or summarize what was said. Output only the transcription text, nothing else." },
        { role: "user", content: "Audio content received. Please acknowledge and indicate the meeting participant spoke." },
      ], 200);

      res.write(`data: ${JSON.stringify({ type: "transcript", text: transcriptResult })}\n\n`);

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Voice processing error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process voice" });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Voice processing failed" })}\n\n`);
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

      const provider = (meeting.aiProvider || "gemini") as AIProvider;
      const aiClient = getAIClient(provider);

      const transcript = messages.map(m => `[${m.senderName}]: ${m.content}`).join("\n\n");
      const worldState = meeting.worldState as WorldState | null;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const resultText = await aiClient.chatJSON([
        {
          role: "system",
          content: `You are the Consensus Engine for co-founder. Analyze the meeting transcript and WorldState to produce a structured JSON output with:
1. "artifacts" - Array of generated documents. Each has: "type" (one of: "architecture_doc", "prd", "technical_spec", "meeting_notes", "decision_brief"), "title", "content" (detailed markdown).
2. "decisions" - Array of decisions made. Each has: "title", "description", "premises" (array of reasoning points), "rejectedAlternatives" (array of alternatives not chosen with reasons).
3. "tasks" - Array of action items. Each has: "title", "description", "assignee" (agent name or "Unassigned"), "executionType" (one of: "manual", "ai_draft", "ai_research").

Include WorldState context in your analysis. Be thorough and extract every actionable item. Output ONLY valid JSON.`
        },
        { role: "user", content: `Meeting: "${meeting.title}"\n\nWorldState:\n${worldState ? JSON.stringify(worldState, null, 2) : "No WorldState"}\n\nTranscript:\n${transcript}` }
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
      if (task.executionType === "manual") return res.status(400).json({ error: "Manual tasks cannot be executed by AI" });

      const aiClient = getAIClient("gemini");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "start", taskId: task.id, executionType: task.executionType })}\n\n`);

      let systemPrompt = task.executionType === "ai_draft"
        ? `You are OpenClaw, the autonomous execution runtime for co-founder. Produce a complete, high-quality draft based on the task description. Output detailed, actionable content in markdown format.`
        : `You are OpenClaw, the autonomous execution runtime for co-founder. Research and compile comprehensive information based on the task description. Provide structured findings and recommendations in markdown format.`;

      let fullResult = "";

      for await (const chunk of aiClient.chatStream([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Task: ${task.title}\n\nDescription: ${task.description || "No additional details."}\n\nAssigned to: ${task.assignee || "Unassigned"}` },
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

  app.get("/api/meetings/:id/decision-memory", async (req, res) => {
    try {
      const meeting = await storage.getMeeting(parseInt(req.params.id));
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const messages = await storage.getMeetingMessages(parseInt(req.params.id));
      const worldState = (meeting.worldState as WorldState) || createEmptyWorldState(`session-${meeting.id}`);

      const decisionMemory = {
        meetingId: meeting.id,
        title: meeting.title,
        status: meeting.status,
        aiProvider: meeting.aiProvider,
        createdAt: meeting.createdAt,
        endedAt: meeting.endedAt,
        worldState: {
          sessionId: worldState.sessionId,
          version: worldState.version,
          entities: worldState.entities,
          assumptions: worldState.assumptions,
          constraints: worldState.constraints,
          options: worldState.options,
          scenarios: worldState.scenarios,
          metrics: worldState.metrics,
          decisions: worldState.decisions,
          lastUpdated: worldState.lastUpdated,
        },
        transcript: messages.map(m => ({
          speaker: m.senderName,
          type: m.senderType,
          content: m.content,
          timestamp: m.createdAt,
        })),
        messageCount: messages.length,
      };

      res.json(decisionMemory);
    } catch (e) {
      console.error("Error fetching decision memory:", e);
      res.status(500).json({ error: "Failed to fetch decision memory" });
    }
  });

  app.get("/api/workspaces/:wsId/decision-memory", async (req, res) => {
    try {
      const meetings = await storage.getMeetings(parseInt(req.params.wsId));
      const memories = [];

      for (const meeting of meetings) {
        const worldState = (meeting.worldState as WorldState) || null;
        if (!worldState) continue;

        memories.push({
          meetingId: meeting.id,
          title: meeting.title,
          status: meeting.status,
          createdAt: meeting.createdAt,
          worldStateVersion: worldState.version,
          decisions: worldState.decisions || [],
          assumptions: worldState.assumptions || [],
          options: worldState.options || [],
          scenarios: worldState.scenarios || [],
        });
      }

      res.json(memories);
    } catch (e) {
      console.error("Error fetching workspace decision memory:", e);
      res.status(500).json({ error: "Failed to fetch decision memory" });
    }
  });

  app.get("/api/tts/status", async (_req, res) => {
    res.json({
      available: isElevenLabsAvailable(),
      voices: await getAvailableVoices(),
    });
  });

  app.get("/api/tts/voices", async (_req, res) => {
    try {
      const voices = await fetchElevenLabsVoices();
      res.json(voices);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  app.post("/api/tts/synthesize", async (req, res) => {
    const parsed = z.object({
      text: z.string().min(1),
      agentName: z.string().default("co-founder"),
      voiceId: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const audioBuffer = parsed.data.voiceId
        ? await synthesizeSpeech(parsed.data.text, parsed.data.agentName, parsed.data.voiceId)
        : await synthesizeSpeech(parsed.data.text, parsed.data.agentName);
      if (!audioBuffer) {
        return res.status(503).json({ error: "TTS unavailable" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "TTS synthesis failed" });
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
      const provider = (parsed.data.provider || "gemini") as AIProvider;
      const aiClient = getAIClient(provider);

      const actionDescriptions = getActionDescriptions();
      const systemPrompt = `You are ArgusVene Co-founder, an AI assistant that helps founders set up and manage their workspace. You can both advise AND take direct actions.

AVAILABLE ACTIONS:
${actionDescriptions}

WHEN USER ASKS YOU TO DO SOMETHING (create workspace, add agent, start meeting, etc.):
1. Output a JSON action block on its own line like this:
<<<ACTION:{"action":"action_name","params":{...}}>>>
2. Then continue your response naturally after the action.
3. You can execute MULTIPLE actions in one response — each on its own line.

RULES:
- When creating agents, write a detailed systemPrompt (2-3 sentences) that defines the agent's personality, expertise, and communication style.
- For agent colors, use hex codes like #8B5CF6, #06B6D4, #10B981, #F59E0B, #EF4444, #EC4899, #6366F1, #14B8A6, #F97316, #3B82F6
- When creating a meeting, first check existing agents (list_agents) to know their IDs, then use those IDs.
- If the user asks to set up a project, create the workspace AND suggest/create relevant agents AND create the first meeting.
- Always confirm what you did after executing actions.
- If the user's request is just a question or discussion (no action needed), just respond normally without any ACTION blocks.
- Respond in the same language the user speaks.`;

      const chatMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...(parsed.data.history || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: parsed.data.message },
      ];

      res.write(`data: ${JSON.stringify({ content: "" })}\n\n`);

      const fullResponse = await aiClient.chat(chatMessages);

      if (aborted) return;

      const actionPattern = /<<<ACTION:(.*?)>>>/g;
      let match;
      const actionResults: ActionResult[] = [];

      while ((match = actionPattern.exec(fullResponse)) !== null) {
        try {
          const actionData = JSON.parse(match[1]);
          const result = await executeAction(actionData.action, actionData.params || {});
          actionResults.push(result);
          if (!aborted) {
            res.write(`data: ${JSON.stringify({ action: result })}\n\n`);
          }
        } catch (e) {
          const failResult: ActionResult = { action: "unknown", success: false, message: "Failed to parse action" };
          actionResults.push(failResult);
          if (!aborted) res.write(`data: ${JSON.stringify({ action: failResult })}\n\n`);
        }
      }

      if (!aborted) {
        if (actionResults.length > 0) {
          const followUpMessages: ChatMessage[] = [
            ...chatMessages,
            { role: "assistant", content: fullResponse },
            { role: "user", content: `[SYSTEM] Actions executed. Results:\n${actionResults.map(r => `- ${r.action}: ${r.success ? "✅" : "❌"} ${r.message}`).join("\n")}\n\nNow provide a brief, friendly summary to the user about what was done. If actions created resources, mention the names. Respond in the same language the user used. Do NOT output any ACTION blocks.` },
          ];

          for await (const chunk of aiClient.chatStream(followUpMessages)) {
            if (aborted) break;
            if (chunk.content) {
              res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
            }
          }
        } else {
          const cleanedResponse = fullResponse.replace(/<<<ACTION:.*?>>>/g, "").trim();
          res.write(`data: ${JSON.stringify({ content: cleanedResponse })}\n\n`);
        }

        if (!aborted) {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        }
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
