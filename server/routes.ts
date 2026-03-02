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
import { createSession, destroySession, navigateTo, performAction, getScreenshot, getCurrentUrl, hasSession, addScreenshotListener, type BrowserAction } from "./browser-manager";
import { analyzeScreenshot, describeScreen } from "./browser-vision";
import { WebSocketServer, WebSocket } from "ws";

const audioBodyParser = express.json({ limit: "50mb" });

const messageBodySchema = z.object({
  content: z.string().min(1),
  senderName: z.string().optional(),
  targetAgentIds: z.array(z.number()).optional(),
});

const statusSchema = z.object({
  status: z.string().min(1),
});

const quickChatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
  provider: z.enum(["openai", "gemini"]).optional(),
});

function getUserId(req: express.Request): string | undefined {
  return req.headers["x-user-id"] as string | undefined;
}

async function verifyWorkspaceAccess(workspaceId: number, userId: string | undefined, userEmail?: string): Promise<boolean> {
  const ws = await storage.getWorkspace(workspaceId);
  if (!ws) return false;
  if (!ws.userId) return true;
  if (userId && ws.userId === userId) return true;
  if (userEmail) {
    const member = await storage.getWorkspaceMemberByEmail(workspaceId, userEmail);
    if (member && member.status === "accepted") return true;
  }
  if (userId) {
    const members = await storage.getWorkspaceMembers(workspaceId);
    const memberMatch = members.find(m => m.userId === userId && m.status === "accepted");
    if (memberMatch) return true;
  }
  return false;
}

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

  app.get("/api/workspaces", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      const ownedWs = await storage.getWorkspaces(userId);
      if (userId) {
        const memberWs = await storage.getWorkspacesByMemberUserId(userId);
        const ownedIds = new Set(ownedWs.map(w => w.id));
        const combined = [...ownedWs, ...memberWs.filter(w => !ownedIds.has(w.id))];
        return res.json(combined);
      }
      res.json(ownedWs);
    } catch (e) {
      console.error("Error fetching workspaces:", e);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.get("/api/workspaces/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      const ws = await storage.getWorkspace(parseInt(req.params.id));
      if (!ws) return res.status(404).json({ error: "Not found" });
      if (ws.userId && userId && ws.userId !== userId) return res.status(404).json({ error: "Not found" });
      res.json(ws);
    } catch (e) {
      console.error("Error fetching workspace:", e);
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  app.post("/api/workspaces", async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertWorkspaceSchema.safeParse({ ...req.body, userId });
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
      const userId = getUserId(req);
      const wsId = parseInt(req.params.id);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      await storage.deleteWorkspace(wsId);
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting workspace:", e);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  app.get("/api/workspaces/:wsId/members", async (req, res) => {
    try {
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      const members = await storage.getWorkspaceMembers(wsId);
      res.json(members);
    } catch (e) {
      console.error("Error fetching members:", e);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.post("/api/workspaces/:wsId/members", async (req, res) => {
    try {
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });

      const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Valid email required" });

      const existing = await storage.getWorkspaceMemberByEmail(wsId, parsed.data.email);
      if (existing) return res.status(409).json({ error: "Already invited" });

      const member = await storage.addWorkspaceMember({
        workspaceId: wsId,
        email: parsed.data.email,
        role: "member",
        invitedBy: userId || null,
        status: "accepted",
        userId: null,
      });
      res.status(201).json(member);
    } catch (e) {
      console.error("Error inviting member:", e);
      res.status(500).json({ error: "Failed to invite member" });
    }
  });

  app.delete("/api/workspaces/:wsId/members/:memberId", async (req, res) => {
    try {
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      await storage.removeWorkspaceMember(parseInt(req.params.memberId));
      res.status(204).send();
    } catch (e) {
      console.error("Error removing member:", e);
      res.status(500).json({ error: "Failed to remove member" });
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
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      const meetings = await storage.getMeetings(wsId);
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
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });

      const sessionId = `session-${Date.now()}`;
      const meeting = await storage.createMeeting({
        ...parsed.data,
        workspaceId: wsId,
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

  app.get("/api/meetings/:id/decision-memory", async (req, res) => {
    try {
      const userId = getUserId(req);
      const meeting = await storage.getMeeting(parseInt(req.params.id));
      if (!meeting) return res.status(404).json({ error: "Not found" });
      if (meeting.workspaceId) {
        if (!(await verifyWorkspaceAccess(meeting.workspaceId, userId))) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      const ws = (meeting.worldState as WorldState) || createEmptyWorldState(`session-${meeting.id}`);
      const messages = await storage.getMeetingMessages(parseInt(req.params.id));
      res.json({
        meetingId: meeting.id,
        title: meeting.title,
        sessionId: ws.sessionId,
        version: ws.version,
        decisions: ws.decisions,
        assumptions: ws.assumptions,
        options: ws.options,
        scenarios: ws.scenarios,
        constraints: ws.constraints,
        transcript: messages.map(m => ({
          speaker: m.senderName,
          content: m.content,
          timestamp: m.createdAt,
        })),
        exportedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Error fetching decision memory:", e);
      res.status(500).json({ error: "Failed to fetch decision memory" });
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
      const userContent = parsed.data.content;

      const agentRoster = validAgents.map(a => `- ${a.name} (${a.role})`).join("\n");
      const recentContext = previousMessages.slice(-6).map(m => `[${m.senderName}]: ${m.content}`).join("\n");

      let selectedAgents = validAgents;
      let shouldReact = false;

      if (parsed.data.targetAgentIds && parsed.data.targetAgentIds.length > 0) {
        selectedAgents = validAgents.filter(a => parsed.data.targetAgentIds!.includes(a.id));
        if (selectedAgents.length === 0) selectedAgents = validAgents.slice(0, 1);
        shouldReact = false;
      } else {

      const nameAliases: Record<string, string[]> = {
        atlas: ["atlas", "아틀라스", "atlus"],
        nova: ["nova", "노바"],
        sage: ["sage", "세이지"],
        pixel: ["pixel", "픽셀"],
      };

      const lowerContent = userContent.toLowerCase();
      const directlyNamed = validAgents.filter(a => {
        const key = a.name.toLowerCase();
        const aliases = nameAliases[key] || [key];
        return aliases.some(alias => {
          const idx = lowerContent.indexOf(alias);
          if (idx === -1) return false;
          const before = idx > 0 ? lowerContent[idx - 1] : " ";
          const after = idx + alias.length < lowerContent.length ? lowerContent[idx + alias.length] : " ";
          const isBoundary = (ch: string) => /[\s,\.!?:;'"()~\-]/.test(ch) || ch === " ";
          return isBoundary(before) && isBoundary(after);
        });
      });

      if (directlyNamed.length > 0) {
        selectedAgents = directlyNamed;
        shouldReact = false;
        console.log(`[Router] Direct name match: ${directlyNamed.map(a => a.name).join(", ")}`);
      } else {
        const domainKeywords: Record<string, string[]> = {
          finance: ["예산", "매출", "비용", "현금", "수익", "투자", "runway", "burn rate", "budget", "revenue", "cost", "profit", "cash", "financial", "pricing", "roi", "capital", "funding", "valuation", "재무", "손익", "흐름", "할인", "가격"],
          tech: ["기술", "개발", "코드", "서버", "api", "배포", "아키텍처", "스택", "인프라", "데이터베이스", "tech", "code", "deploy", "architecture", "backend", "frontend", "scalab", "infra", "database", "engineering", "시스템", "플랫폼"],
          strategy: ["전략", "비전", "로드맵", "경쟁", "시장", "포지셔닝", "파트너", "strategy", "vision", "roadmap", "compet", "market", "positioning", "pivot", "mission", "growth", "방향", "목표"],
          marketing: ["마케팅", "브랜드", "디자인", "ux", "ui", "사용자", "고객", "캠페인", "광고", "콘텐츠", "marketing", "brand", "design", "user", "customer", "campaign", "advertis", "content", "creative", "sns", "인플루언서", "홍보"],
        };

        const agentDomainMap: Record<string, string> = {};
        for (const agent of validAgents) {
          const roleLower = agent.role.toLowerCase();
          if (roleLower.includes("finance") || roleLower.includes("재무")) agentDomainMap[agent.name] = "finance";
          else if (roleLower.includes("tech") || roleLower.includes("기술") || roleLower.includes("engineer")) agentDomainMap[agent.name] = "tech";
          else if (roleLower.includes("strateg") || roleLower.includes("전략")) agentDomainMap[agent.name] = "strategy";
          else if (roleLower.includes("market") || roleLower.includes("design") || roleLower.includes("마케팅") || roleLower.includes("디자인") || roleLower.includes("creative")) agentDomainMap[agent.name] = "marketing";
        }

        const domainScores: Record<string, number> = { finance: 0, tech: 0, strategy: 0, marketing: 0 };
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
          for (const kw of keywords) {
            if (lowerContent.includes(kw)) domainScores[domain]++;
          }
        }

        const maxScore = Math.max(...Object.values(domainScores));
        const matchedDomains = Object.entries(domainScores).filter(([, s]) => s > 0 && s >= maxScore - 1).map(([d]) => d);

        if (maxScore >= 2 && matchedDomains.length <= 2) {
          const domainAgents = validAgents.filter(a => {
            const domain = agentDomainMap[a.name];
            return domain && matchedDomains.includes(domain);
          });
          if (domainAgents.length > 0) {
            selectedAgents = domainAgents;
            shouldReact = domainAgents.length >= 2;
            console.log(`[Router] Keyword domain match (${matchedDomains.join(",")}): ${domainAgents.map(a => a.name).join(", ")}`);
          }
        }

        if (selectedAgents === validAgents) {
          try {
            const routerResponse = await aiClient.chatJSON([
              {
                role: "system",
                content: `You are a meeting conversation router. Pick which agents should respond.

Available agents (with their domains):
${validAgents.map(a => `- ${a.name} (${a.role})`).join("\n")}

Recent conversation:
${recentContext || "(meeting just started)"}

RULES:
1. For domain-specific questions, pick only the 1-2 most relevant agents based on their role.
2. For broad questions inviting discussion, pick 2-3 agents (never all ${validAgents.length}).
3. For the first message in a meeting, pick 2-3 agents.
4. Set react to true only if 2+ agents are selected.

Return JSON: {"agents": ["Name1", "Name2"], "react": true}`,
              },
              { role: "user", content: userContent },
            ]);

            try {
              const routing = JSON.parse(routerResponse);
              if (Array.isArray(routing.agents) && routing.agents.length > 0) {
                const namedAgents = routing.agents
                  .map((name: string) => validAgents.find(a => a.name.toLowerCase() === name.toLowerCase()))
                  .filter(Boolean) as typeof validAgents;
                if (namedAgents.length > 0) {
                  selectedAgents = namedAgents;
                  console.log(`[Router] AI selected: ${namedAgents.map(a => a.name).join(", ")}`);
                }
              }
              shouldReact = routing.react === true && selectedAgents.length >= 2;
            } catch {
              selectedAgents = validAgents.slice(0, 2);
              console.log(`[Router] JSON parse failed, fallback to first 2`);
            }
          } catch (routerErr) {
            selectedAgents = validAgents.slice(0, 2);
            console.log(`[Router] AI call failed, fallback to first 2`, routerErr);
          }
        }
      }
      }

      const respondedAgents: { agentId: number; agentName: string; content: string }[] = [];

      for (const agent of selectedAgents) {
        if (aborted) break;

        try {
          const chatHistory: ChatMessage[] = previousMessages.map(m => ({
            role: (m.senderType === "human" ? "user" : "assistant") as "user" | "assistant",
            content: m.senderType === "human" ? m.content : `[${m.senderName}]: ${m.content}`,
          }));

          if (respondedAgents.length > 0) {
            for (const prev of respondedAgents) {
              chatHistory.push({ role: "assistant", content: `[${prev.agentName}]: ${prev.content}` });
            }
          }

          const otherAgentNames = validAgents.filter(a => a.id !== agent.id).map(a => `${a.name} (${a.role})`).join(", ");
          const systemMsg: ChatMessage = {
            role: "system",
            content: `${agent.systemPrompt}

You are ${agent.name}, the ${agent.role}. You are in a LIVE voice meeting with the founder and colleagues: ${otherAgentNames || "none"}.

CRITICAL OUTPUT RULES:
- NEVER start with "[${agent.name}]:" or any name tag prefix. Just speak directly.
- NEVER include multiple agent responses. You are ONLY ${agent.name}. Output ONLY your own words.
- Keep it to 1-3 sentences (under 80 words). This is spoken conversation, not writing.
- No bullet points, no markdown, no headers. Pure speech only.

PERSONALITY:
- Talk like a real person in a meeting — interruptions, half-thoughts, emphasis are OK
- Use filler words sparingly but naturally: "honestly", "look", "so here's my take"
- Show genuine emotion: excitement ("oh that's actually brilliant"), doubt ("hmm, I'm not sure about that"), concern ("wait, that worries me")
- Have a point of view. Don't hedge everything. Take a stance.
- If you disagree, just say it: "I disagree" or "No, I think that's wrong because..."

CONVERSATION FLOW:
- Respond to what was JUST said. Don't summarize the whole meeting.
- If another agent just spoke, react to THEIR specific point — agree, push back, or build on it
- Ask the founder ONE specific question if you want more info, not a laundry list
- Never repeat what someone else already said. If you agree, say "I agree with [name]" and add something NEW
- Match the founder's language (Korean → Korean, English → English)`,
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

          let cleanedResponse = fullResponse
            .replace(/^\[?[\w\s-]+\]?:\s*/i, "")
            .replace(/\n\[[\w\s-]+\]:\s*/g, "\n")
            .trim();

          respondedAgents.push({ agentId: agent.id, agentName: agent.name, content: cleanedResponse });

          const savedMsg = await storage.createMeetingMessage({
            meetingId,
            senderType: "agent",
            senderName: agent.name,
            agentId: agent.id,
            content: cleanedResponse,
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

      if (!aborted && shouldReact && respondedAgents.length >= 2) {
        const nonRespondedAgents = validAgents.filter(a => !respondedAgents.find(r => r.agentId === a.id));
        const reactor = nonRespondedAgents.length > 0
          ? nonRespondedAgents[Math.floor(Math.random() * nonRespondedAgents.length)]
          : respondedAgents[Math.floor(Math.random() * respondedAgents.length)];
        const reactorAgent = validAgents.find(a => a.id === (reactor.id ?? (reactor as any).agentId));

        if (reactorAgent) {
          const othersContext = respondedAgents
            .filter(r => r.agentId !== reactorAgent.id)
            .map(r => `[${r.agentName}]: ${r.content}`)
            .join("\n\n");

          try {
            const reactionSystemMsg: ChatMessage = {
              role: "system",
              content: `${reactorAgent.systemPrompt}

You are ${reactorAgent.name}. You just heard your colleagues speak. Jump in with a quick reaction.

RULES:
- NEVER start with "[${reactorAgent.name}]:" or any name tag. Just speak.
- 1-2 sentences MAXIMUM. Like a quick interjection in a real meeting.
- React to ONE specific thing someone said — agree, push back, or add a twist
- Be natural: "Yeah but...", "That's fair, although...", "Wait, I actually think..."
- Use the founder's language (Korean/English)
- No markdown, no bullet points`,
            };

            const reactionHistory: ChatMessage[] = [
              ...previousMessages.slice(-4).map(m => ({
                role: (m.senderType === "human" ? "user" : "assistant") as "user" | "assistant",
                content: m.senderType === "human" ? m.content : `[${m.senderName}]: ${m.content}`,
              })),
              ...respondedAgents.map(r => ({
                role: "assistant" as const,
                content: `[${r.agentName}]: ${r.content}`,
              })),
              { role: "user" as const, content: `[System]: Now react briefly to what the others just said:\n\n${othersContext}` },
            ];

            let reactionContent = "";
            if (!aborted) {
              res.write(`data: ${JSON.stringify({ type: "agent_start", agentId: reactorAgent.id, agentName: reactorAgent.name })}\n\n`);
            }

            for await (const chunk of aiClient.chatStream([reactionSystemMsg, ...reactionHistory])) {
              if (aborted) break;
              if (chunk.content) {
                reactionContent += chunk.content;
                res.write(`data: ${JSON.stringify({ type: "agent_chunk", agentId: reactorAgent.id, content: chunk.content })}\n\n`);
              }
            }

            let cleanedReaction = reactionContent
              .replace(/^\[?[\w\s-]+\]?:\s*/i, "")
              .replace(/\n\[[\w\s-]+\]:\s*/g, "\n")
              .trim();

            if (cleanedReaction && !aborted) {
              const savedReaction = await storage.createMeetingMessage({
                meetingId,
                senderType: "agent",
                senderName: reactorAgent.name,
                agentId: reactorAgent.id,
                content: cleanedReaction,
              });
              res.write(`data: ${JSON.stringify({ type: "agent_done", agentId: reactorAgent.id, data: savedReaction })}\n\n`);
            }
          } catch (error) {
            console.error(`Reaction round error for ${reactorAgent.name}:`, error);
          }
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

  app.post("/api/meetings/:id/generate-code", async (req, res) => {
    const meetingId = parseInt(req.params.id);
    let aborted = false;
    res.on("close", () => { aborted = true; });

    try {
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ error: "Not found" });

      const messages = await storage.getMeetingMessages(meetingId);
      const worldState = meeting.worldState as WorldState | null;
      const provider = (meeting.aiProvider || "gemini") as AIProvider;
      const aiClient = getAIClient(provider);

      const transcript = messages.slice(-20).map(m => `[${m.senderName}]: ${m.content}`).join("\n\n");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullCode = "";

      for await (const chunk of aiClient.chatStream([
        {
          role: "system",
          content: `You are the Coding Agent for ArgusVene, an AI co-founder engine. Based on the meeting discussion and WorldState, generate implementation code.

Rules:
- Generate working, production-ready code based on the decisions and technical discussions
- Use appropriate language/framework based on context (default: TypeScript/React if not specified)
- Include file paths as comments at the top of each file section (e.g., // === FILE: src/components/Feature.tsx ===)
- Separate multiple files with clear markers
- Include brief inline comments explaining key logic
- Focus on the most recent decisions and action items
- If the discussion is non-technical, generate relevant configuration, data models, or scaffolding
- Output clean, well-structured code ready to use`
        },
        {
          role: "user",
          content: `Meeting: "${meeting.title}"\n\nWorldState:\n${worldState ? JSON.stringify(worldState, null, 2) : "None"}\n\nRecent Transcript:\n${transcript || "No messages yet"}\n\nGenerate implementation code based on these discussions and decisions.`
        }
      ])) {
        if (aborted) break;
        if (chunk.content) {
          fullCode += chunk.content;
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk.content })}\n\n`);
        }
      }

      if (!aborted) {
        const saved = await storage.createArtifact({
          meetingId,
          workspaceId: meeting.workspaceId,
          type: "code",
          title: `Code: ${meeting.title} (v${(worldState?.version || 0) + 1})`,
          content: fullCode,
        });

        res.write(`data: ${JSON.stringify({ type: "complete", artifact: saved })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Code generation error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate code" });
      } else if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Code generation failed" })}\n\n`);
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
      }

      if (!aborted) {
        try {
          res.write(`data: ${JSON.stringify({ type: "code_start" })}\n\n`);

          let fullCode = "";
          for await (const chunk of aiClient.chatStream([
            {
              role: "system",
              content: `You are the Coding Agent for ArgusVene. Based on the completed meeting's decisions and WorldState, generate complete implementation code.

Rules:
- Generate working, production-ready code implementing the decisions made
- Use appropriate language/framework based on context (default: TypeScript/React)
- Mark file paths clearly: // === FILE: path/to/file.ts ===
- Include all necessary imports, types, and logic
- Be comprehensive — this code should be ready to use
- If the meeting was non-technical, generate data models, configs, or API schemas instead
- Output clean, well-structured, immediately usable code`
            },
            {
              role: "user",
              content: `Meeting: "${meeting.title}"\n\nDecisions:\n${JSON.stringify(parsed.decisions || [], null, 2)}\n\nWorldState:\n${worldState ? JSON.stringify(worldState, null, 2) : "None"}\n\nTranscript:\n${transcript}\n\nGenerate complete implementation code.`
            }
          ])) {
            if (aborted) break;
            if (chunk.content) {
              fullCode += chunk.content;
              res.write(`data: ${JSON.stringify({ type: "code_chunk", content: chunk.content })}\n\n`);
            }
          }

          if (!aborted && fullCode.trim()) {
            const codeArtifact = await storage.createArtifact({
              meetingId,
              workspaceId: meeting.workspaceId,
              type: "code",
              title: `Implementation: ${meeting.title}`,
              content: fullCode,
            });
            res.write(`data: ${JSON.stringify({ type: "code_complete", artifact: codeArtifact })}\n\n`);
          }
        } catch (codeError) {
          console.error("Post-meeting code generation error:", codeError);
          if (!aborted) {
            res.write(`data: ${JSON.stringify({ type: "code_error", error: "Code generation skipped" })}\n\n`);
          }
        }
      }

      if (!aborted) {
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
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      const artifacts = await storage.getArtifacts(wsId);
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
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      const decisions = await storage.getDecisions(wsId);
      res.json(decisions);
    } catch (e) {
      console.error("Error fetching decisions:", e);
      res.status(500).json({ error: "Failed to fetch decisions" });
    }
  });

  app.get("/api/workspaces/:wsId/tasks", async (req, res) => {
    try {
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      const tasks = await storage.getTasks(wsId);
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
      const userId = getUserId(req);
      const wsId = parseInt(req.params.wsId);
      if (!(await verifyWorkspaceAccess(wsId, userId))) return res.status(404).json({ error: "Not found" });
      const meetings = await storage.getMeetings(wsId);
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
          const userId = req.headers["x-user-id"] as string | undefined;
          const result = await executeAction(actionData.action, actionData.params || {}, userId);
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

  // ─── Browser Navigator REST API ───

  function requireBrowserAuth(req: express.Request, res: express.Response): string | null {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required for browser sessions" });
      return null;
    }
    return userId;
  }

  const BLOCKED_URL_PATTERNS = [
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i,
    /^https?:\/\/metadata\.google\.internal/i,
    /^https?:\/\/169\.254\./i,
    /^file:/i,
  ];

  function isUrlAllowed(url: string): boolean {
    return !BLOCKED_URL_PATTERNS.some(pattern => pattern.test(url));
  }

  app.post("/api/browser/session", async (req, res) => {
    try {
      const userId = requireBrowserAuth(req, res);
      if (!userId) return;
      const result = await createSession(userId);
      res.json(result);
    } catch (e: any) {
      console.error("[browser] Session creation error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/browser/session", async (req, res) => {
    try {
      const userId = requireBrowserAuth(req, res);
      if (!userId) return;
      await destroySession(userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/browser/navigate", async (req, res) => {
    try {
      const userId = requireBrowserAuth(req, res);
      if (!userId) return;
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL required" });
      const fullUrl = url.startsWith("http") ? url : "https://" + url;
      if (!isUrlAllowed(fullUrl)) return res.status(403).json({ error: "URL not allowed" });
      const result = await navigateTo(userId, url);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/browser/action", async (req, res) => {
    try {
      const userId = requireBrowserAuth(req, res);
      if (!userId) return;
      const action: BrowserAction = req.body;
      const result = await performAction(userId, action);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/browser/screenshot", async (req, res) => {
    try {
      const userId = requireBrowserAuth(req, res);
      if (!userId) return;
      const screenshot = await getScreenshot(userId);
      if (!screenshot) return res.status(404).json({ error: "No session" });
      res.set("Content-Type", "image/jpeg");
      res.send(screenshot);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/browser/status", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.json({ active: false, url: null });
    res.json({
      active: hasSession(userId),
      url: hasSession(userId) ? await getCurrentUrl(userId) : null,
    });
  });

  app.post("/api/browser/ai-command", async (req, res) => {
    const userId = requireBrowserAuth(req, res);
    if (!userId) return;
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "Command required" });
    if (!hasSession(userId)) return res.status(400).json({ error: "No browser session" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const actionHistory: string[] = [];
    const MAX_STEPS = 15;
    let aborted = false;

    req.on("close", () => { aborted = true; });

    try {
      for (let step = 0; step < MAX_STEPS && !aborted; step++) {
        const screenshot = await getScreenshot(userId);
        if (!screenshot) {
          res.write(`data: ${JSON.stringify({ status: "error", summary: "Lost browser session" })}\n\n`);
          break;
        }

        const base64 = screenshot.toString("base64");
        const result = await analyzeScreenshot(base64, command, actionHistory);

        if (aborted) break;
        res.write(`data: ${JSON.stringify({
          step: step + 1,
          thinking: result.thinking,
          status: result.status,
          summary: result.summary,
          actionType: result.action.type,
        })}\n\n`);

        if (result.status === "done" || result.status === "error") break;

        if (result.action.type === "navigate" && result.action.url) {
          const aiNavUrl = result.action.url.startsWith("http") ? result.action.url : "https://" + result.action.url;
          if (!isUrlAllowed(aiNavUrl)) {
            actionHistory.push(`Blocked navigation to internal URL: ${result.action.url}`);
          } else {
            await navigateTo(userId, result.action.url);
            actionHistory.push(`Navigated to ${result.action.url}`);
          }
        } else {
          const actionResult = await performAction(userId, result.action as BrowserAction);
          actionHistory.push(`${result.action.type}: ${actionResult.message}`);
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (e: any) {
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ status: "error", summary: e.message })}\n\n`);
        res.end();
      }
    }
  });

  // ─── Browser Navigator WebSocket (screenshot streaming) ───
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/browser" });

  wss.on("connection", (ws, req) => {
    const wsUrl = new URL(req.url || "", `http://${req.headers.host}`);
    const userId = wsUrl.searchParams.get("userId");
    if (!userId) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close();
      return;
    }
    console.log(`[ws/browser] Connected: ${userId}`);

    let removeListener: (() => void) | null = null;

    const setupStreaming = () => {
      if (removeListener) removeListener();

      if (!hasSession(userId)) return;

      removeListener = addScreenshotListener(userId, (screenshot) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(screenshot);
        }
      });
    };

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "start") {
          await createSession(userId);
          setupStreaming();
          ws.send(JSON.stringify({ type: "session_started" }));
        } else if (msg.type === "navigate") {
          const navUrl = msg.url?.startsWith("http") ? msg.url : "https://" + msg.url;
          if (!isUrlAllowed(navUrl)) {
            ws.send(JSON.stringify({ type: "error", message: "URL not allowed" }));
            return;
          }
          const result = await navigateTo(userId, msg.url);
          setupStreaming();
          ws.send(JSON.stringify({ type: "navigated", ...result }));
        } else if (msg.type === "action") {
          const result = await performAction(userId, msg.action);
          ws.send(JSON.stringify({ type: "action_result", ...result }));
        } else if (msg.type === "stop") {
          if (removeListener) removeListener();
          await destroySession(userId);
          ws.send(JSON.stringify({ type: "session_stopped" }));
        }
      } catch (e: any) {
        ws.send(JSON.stringify({ type: "error", message: e.message }));
      }
    });

    ws.on("close", () => {
      console.log(`[ws/browser] Disconnected: ${userId}`);
      if (removeListener) removeListener();
    });
  });

  return httpServer;
}

