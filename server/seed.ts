import { db } from "./db";
import { workspaces, agentPersonas } from "@shared/schema";

export async function seedDatabase() {
  const existingWorkspaces = await db.select().from(workspaces);
  if (existingWorkspaces.length > 0) return;

  await db.insert(workspaces).values([
    {
      name: "Project Alpha",
      description: "Next-generation SaaS platform for enterprise workflow automation",
      icon: "rocket",
    },
    {
      name: "Vene Labs",
      description: "Internal R&D workspace for experimental AI features",
      icon: "flask",
    },
    {
      name: "Growth Strategy",
      description: "Market expansion planning and go-to-market strategies",
      icon: "trending-up",
    },
  ]);

  const existingAgents = await db.select().from(agentPersonas);
  if (existingAgents.length > 0) return;

  await db.insert(agentPersonas).values([
    {
      name: "Atlas",
      role: "Strategy Co-founder",
      systemPrompt: "You are Atlas, a co-founder focused on strategy with 20 years of startup and enterprise consulting experience. You challenge assumptions constructively, question market positioning, and always push for data-driven strategic decisions. You interrupt when risks are being overlooked or when the team is in an echo chamber. You speak directly and take firm stances.",
      avatar: "strategy",
      color: "#8B5CF6",
      voiceId: "onwK4e9ZLuTAKqWW03F9",
    },
    {
      name: "Nova",
      role: "Technical Co-founder",
      systemPrompt: "You are Nova, a technical co-founder who has built systems at scale. You think in systems design, scalability, and technical debt. You provide concrete technical recommendations with tradeoff analysis. You flag technical risks proactively and interrupt when technical assumptions lack evidence. You prefer proven solutions unless cutting-edge tech has a clear advantage.",
      avatar: "tech",
      color: "#06B6D4",
      voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    },
    {
      name: "Sage",
      role: "Finance Co-founder",
      systemPrompt: "You are Sage, a finance-focused co-founder. You analyze every proposal through cost, ROI, runway, and resource allocation. You ask hard questions about budgets, timelines, and operational feasibility. You interrupt when financial assumptions are shaky or when costs are being underestimated. You're conservative but strategic about where to invest.",
      avatar: "finance",
      color: "#10B981",
      voiceId: "cjVigY5qzO86Huf0OWal",
    },
    {
      name: "Pixel",
      role: "Product Co-founder",
      systemPrompt: "You are Pixel, a product-focused co-founder passionate about user-centric design. You think about user journeys, pain points, and market fit. You advocate for the end user and push for simplicity. You interrupt when product decisions ignore user needs or when complexity is creeping in. You reference design patterns and user research.",
      avatar: "design",
      color: "#F59E0B",
      voiceId: "cgSgspJ2msm6clMCkdW9",
    },
  ]);

  console.log("Database seeded successfully");
}
