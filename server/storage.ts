import { eq, desc, and, or } from "drizzle-orm";
import { db } from "./db";
import {
  users, type User, type InsertUser,
  workspaces, type Workspace, type InsertWorkspace,
  agentPersonas, type AgentPersona, type InsertAgentPersona,
  meetings, type Meeting, type InsertMeeting,
  meetingMessages, type MeetingMessage, type InsertMeetingMessage,
  artifacts, type Artifact, type InsertArtifact,
  decisions, type Decision, type InsertDecision,
  tasks, type Task, type InsertTask,
  workspaceMembers, type WorkspaceMember, type InsertWorkspaceMember,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getWorkspaces(userId?: string): Promise<Workspace[]>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  createWorkspace(ws: InsertWorkspace): Promise<Workspace>;
  deleteWorkspace(id: number): Promise<void>;

  getAgentPersonas(): Promise<AgentPersona[]>;
  getAgentPersona(id: number): Promise<AgentPersona | undefined>;
  createAgentPersona(agent: InsertAgentPersona): Promise<AgentPersona>;
  updateAgentPersona(id: number, agent: Partial<InsertAgentPersona>): Promise<AgentPersona | undefined>;
  deleteAgentPersona(id: number): Promise<void>;

  getMeetings(workspaceId: number): Promise<Meeting[]>;
  getAllMeetings(): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeetingStatus(id: number, status: string): Promise<Meeting | undefined>;
  updateMeetingWorldState(id: number, worldState: any): Promise<Meeting | undefined>;

  getMeetingMessages(meetingId: number): Promise<MeetingMessage[]>;
  createMeetingMessage(msg: InsertMeetingMessage): Promise<MeetingMessage>;

  getArtifacts(workspaceId: number): Promise<Artifact[]>;
  getArtifact(id: number): Promise<Artifact | undefined>;
  createArtifact(artifact: InsertArtifact): Promise<Artifact>;

  getDecisions(workspaceId: number): Promise<Decision[]>;
  createDecision(decision: InsertDecision): Promise<Decision>;

  getTasks(workspaceId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTaskStatus(id: number, status: string): Promise<Task | undefined>;
  updateTaskExecution(id: number, result: string, status: string): Promise<Task | undefined>;

  getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]>;
  getWorkspaceMemberByEmail(workspaceId: number, email: string): Promise<WorkspaceMember | undefined>;
  addWorkspaceMember(member: InsertWorkspaceMember): Promise<WorkspaceMember>;
  updateWorkspaceMemberStatus(id: number, status: string, userId?: string): Promise<WorkspaceMember | undefined>;
  removeWorkspaceMember(id: number): Promise<void>;
  getWorkspacesByMemberEmail(email: string): Promise<Workspace[]>;
  getWorkspacesByMemberUserId(userId: string): Promise<Workspace[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser: InsertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getWorkspaces(userId?: string) {
    if (userId) {
      return db.select().from(workspaces).where(eq(workspaces.userId, userId)).orderBy(desc(workspaces.createdAt));
    }
    return db.select().from(workspaces).orderBy(desc(workspaces.createdAt));
  }
  async getWorkspace(id: number) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return ws;
  }
  async createWorkspace(ws: InsertWorkspace) {
    const [created] = await db.insert(workspaces).values(ws).returning();
    return created;
  }
  async deleteWorkspace(id: number) {
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async getAgentPersonas() {
    return db.select().from(agentPersonas);
  }
  async getAgentPersona(id: number) {
    const [agent] = await db.select().from(agentPersonas).where(eq(agentPersonas.id, id));
    return agent;
  }
  async createAgentPersona(agent: InsertAgentPersona) {
    const [created] = await db.insert(agentPersonas).values(agent).returning();
    return created;
  }
  async updateAgentPersona(id: number, agent: Partial<InsertAgentPersona>) {
    const [updated] = await db.update(agentPersonas).set(agent).where(eq(agentPersonas.id, id)).returning();
    return updated;
  }
  async deleteAgentPersona(id: number) {
    await db.delete(agentPersonas).where(eq(agentPersonas.id, id));
  }

  async getMeetings(workspaceId: number) {
    return db.select().from(meetings).where(eq(meetings.workspaceId, workspaceId)).orderBy(desc(meetings.createdAt));
  }
  async getAllMeetings() {
    return db.select().from(meetings);
  }
  async getMeeting(id: number) {
    const [m] = await db.select().from(meetings).where(eq(meetings.id, id));
    return m;
  }
  async createMeeting(meeting: InsertMeeting) {
    const [created] = await db.insert(meetings).values(meeting).returning();
    return created;
  }
  async updateMeetingStatus(id: number, status: string) {
    const [updated] = await db.update(meetings).set({ status, endedAt: status === "ended" ? new Date() : undefined }).where(eq(meetings.id, id)).returning();
    return updated;
  }
  async updateMeetingWorldState(id: number, worldState: any) {
    const [updated] = await db.update(meetings).set({ worldState }).where(eq(meetings.id, id)).returning();
    return updated;
  }

  async getMeetingMessages(meetingId: number) {
    return db.select().from(meetingMessages).where(eq(meetingMessages.meetingId, meetingId)).orderBy(meetingMessages.createdAt);
  }
  async createMeetingMessage(msg: InsertMeetingMessage) {
    const [created] = await db.insert(meetingMessages).values(msg).returning();
    return created;
  }

  async getArtifacts(workspaceId: number) {
    return db.select().from(artifacts).where(eq(artifacts.workspaceId, workspaceId)).orderBy(desc(artifacts.createdAt));
  }
  async getArtifact(id: number) {
    const [a] = await db.select().from(artifacts).where(eq(artifacts.id, id));
    return a;
  }
  async createArtifact(artifact: InsertArtifact) {
    const [created] = await db.insert(artifacts).values(artifact).returning();
    return created;
  }

  async getDecisions(workspaceId: number) {
    return db.select().from(decisions).where(eq(decisions.workspaceId, workspaceId)).orderBy(desc(decisions.createdAt));
  }
  async createDecision(decision: InsertDecision) {
    const [created] = await db.insert(decisions).values(decision).returning();
    return created;
  }

  async getTasks(workspaceId: number) {
    return db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId)).orderBy(desc(tasks.createdAt));
  }
  async getTask(id: number) {
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
    return t;
  }
  async createTask(task: InsertTask) {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }
  async updateTaskStatus(id: number, status: string) {
    const [updated] = await db.update(tasks).set({ status, completedAt: status === "completed" ? new Date() : undefined }).where(eq(tasks.id, id)).returning();
    return updated;
  }
  async updateTaskExecution(id: number, result: string, status: string) {
    const [updated] = await db.update(tasks).set({ executionResult: result, status, completedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async getWorkspaceMembers(workspaceId: number) {
    return db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)).orderBy(desc(workspaceMembers.createdAt));
  }
  async getWorkspaceMemberByEmail(workspaceId: number, email: string) {
    const [member] = await db.select().from(workspaceMembers).where(
      and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.email, email.toLowerCase()))
    );
    return member;
  }
  async addWorkspaceMember(member: InsertWorkspaceMember) {
    const [created] = await db.insert(workspaceMembers).values({ ...member, email: member.email.toLowerCase() }).returning();
    return created;
  }
  async updateWorkspaceMemberStatus(id: number, status: string, userId?: string) {
    const updates: any = { status };
    if (userId) updates.userId = userId;
    const [updated] = await db.update(workspaceMembers).set(updates).where(eq(workspaceMembers.id, id)).returning();
    return updated;
  }
  async removeWorkspaceMember(id: number) {
    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));
  }
  async getWorkspacesByMemberEmail(email: string) {
    const members = await db.select().from(workspaceMembers).where(
      and(eq(workspaceMembers.email, email.toLowerCase()), eq(workspaceMembers.status, "accepted"))
    );
    if (members.length === 0) return [];
    const wsIds = members.map(m => m.workspaceId);
    const result = await db.select().from(workspaces).where(
      or(...wsIds.map(id => eq(workspaces.id, id)))
    );
    return result;
  }
  async getWorkspacesByMemberUserId(userId: string) {
    const members = await db.select().from(workspaceMembers).where(
      and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "accepted"))
    );
    if (members.length === 0) return [];
    const wsIds = members.map(m => m.workspaceId);
    const result = await db.select().from(workspaces).where(
      or(...wsIds.map(id => eq(workspaces.id, id)))
    );
    return result;
  }
}

export const storage = new DatabaseStorage();
