import { useEffect, useState } from "react";
import { Bot, MailPlus, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentPersona } from "@shared/schema";
import type { RoomCommandMode, RoomCoreState } from "./types";

interface OpsPanelProps {
  room: RoomCoreState;
  mode: RoomCommandMode;
  targetAgentId: number | null;
  busy: boolean;
  savingWorkOrder: boolean;
  endingRoom: boolean;
  onTargetAgent: (agentId: number | null) => void;
  onModeChange: (mode: RoomCommandMode) => void;
  onToggleAgent: (agent: AgentPersona) => void;
  onSetLeadAgent: (agentId: number | null) => void;
  onRunCommand: (agent: AgentPersona | null, mode: RoomCommandMode | "build") => void;
  onSaveWorkOrder: (workOrder: string) => Promise<void>;
  onEndRoom: () => Promise<void>;
  onInviteHuman: (email: string) => Promise<void>;
  onRemoveHuman: (memberId: number) => Promise<void>;
}

const modeLabels: Record<RoomCommandMode, { title: string; body: string }> = {
  align: { title: "Align", body: "Compress the room around the single next move." },
  critique: { title: "Critique", body: "Surface the weakest assumption or risk first." },
  research: { title: "Research", body: "Turn missing information into real research work." },
  decide: { title: "Decide", body: "Force a decision instead of leaving options vague." },
};

function initials(value: string) {
  return value
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativePresence(lastSeenAt: number) {
  const delta = Math.max(0, Date.now() - lastSeenAt);
  const seconds = Math.round(delta / 1000);
  if (seconds < 5) return "just now";
  return `${seconds}s ago`;
}

export function OpsPanel({
  room,
  mode,
  targetAgentId,
  busy,
  savingWorkOrder,
  endingRoom,
  onTargetAgent,
  onModeChange,
  onToggleAgent,
  onSetLeadAgent,
  onRunCommand,
  onSaveWorkOrder,
  onEndRoom,
  onInviteHuman,
  onRemoveHuman,
}: OpsPanelProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [workOrderDraft, setWorkOrderDraft] = useState(room.workOrder);
  const activeIds = new Set(room.activeAgentIds);
  const targetAgent = room.agents.find((agent) => agent.id === targetAgentId) || null;

  useEffect(() => {
    setWorkOrderDraft(room.workOrder);
  }, [room.workOrder]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Operator rail</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Run the room</h2>
        <p className="mt-1 text-sm text-slate-600">Choose the lead, activate agents, invite people, and trigger the next move.</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-5 py-5">
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Active work order</p>
                <p className="mt-1 text-xs text-slate-500">Keep the room pointed at one inspectable next move.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {room.meeting.status}
              </span>
            </div>
            <Textarea
              value={workOrderDraft}
              onChange={(event) => setWorkOrderDraft(event.target.value)}
              rows={4}
              className="mt-3 resize-none rounded-2xl border-slate-200 bg-slate-50"
              placeholder="Define the concrete object, decision, or revision the room should focus on."
            />
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1 rounded-xl"
                variant="outline"
                disabled={busy || savingWorkOrder || !workOrderDraft.trim() || workOrderDraft.trim() === room.workOrder.trim()}
                onClick={() => onSaveWorkOrder(workOrderDraft.trim())}
              >
                {savingWorkOrder ? "Saving..." : "Save work order"}
              </Button>
              <Button
                className="rounded-xl"
                variant="destructive"
                disabled={endingRoom || room.meeting.status === "ended"}
                onClick={() => onEndRoom()}
              >
                {endingRoom ? "Ending..." : "End room"}
              </Button>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Command deck</p>
                <p className="mt-1 text-xs text-slate-500">{targetAgent ? `${targetAgent.name} is targeted.` : "Commands address the lead or whole room."}</p>
              </div>
              <button type="button" onClick={() => onTargetAgent(null)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100">
                Clear focus
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              {(Object.keys(modeLabels) as RoomCommandMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onModeChange(option);
                    onRunCommand(targetAgent, option);
                  }}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                    mode === option ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{modeLabels[option].title}</span>
                    <Search className="h-4 w-4" />
                  </div>
                  <p className={cn("mt-2 text-sm leading-6", mode === option ? "text-slate-300" : "text-slate-600")}>{modeLabels[option].body}</p>
                </button>
              ))}
            </div>

            <Button className="mt-3 w-full rounded-xl" disabled={busy} onClick={() => onRunCommand(targetAgent, "build")}>
              <Sparkles className="h-4 w-4" />
              Build concrete output now
            </Button>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-semibold text-slate-900">Present now</p>
            </div>
            <div className="mt-3 space-y-2">
              {room.presence.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No live presence heartbeat received yet.
                </div>
              ) : (
                room.presence.map((person) => (
                  <div key={person.userId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        {initials(person.displayName || person.email || "U")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{person.displayName}</p>
                        <p className="truncate text-xs text-slate-500">{person.email || person.userId}</p>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{relativePresence(person.lastSeenAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-slate-900">Agents</p>
            </div>
            <div className="mt-3 space-y-2">
              {room.agents.map((agent) => {
                const isActive = activeIds.has(agent.id);
                const isTarget = targetAgentId === agent.id;
                const isLead = room.leadAgentId === agent.id;

                return (
                  <div key={agent.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: agent.color || "#111827" }}>
                        {initials(agent.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                            <p className="text-xs text-slate-500">{agent.role}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleAgent(agent)}
                            className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition", isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}
                          >
                            {isActive ? "active" : "offline"}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!isActive}
                            onClick={() => onSetLeadAgent(isLead ? null : agent.id)}
                            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50", isLead ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100")}
                          >
                            {isLead ? "Lead" : "Set lead"}
                          </button>
                          <button
                            type="button"
                            disabled={!isActive}
                            onClick={() => onTargetAgent(isTarget ? null : agent.id)}
                            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50", isTarget ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100")}
                          >
                            {isTarget ? "Focused" : "Focus"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <MailPlus className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-semibold text-slate-900">Workspace access</p>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
                <Button
                  variant="outline"
                  className="h-10 rounded-xl"
                  disabled={!inviteEmail.trim()}
                  onClick={async () => {
                    await onInviteHuman(inviteEmail.trim());
                    setInviteEmail("");
                  }}
                >
                  <MailPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {room.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                    {initials(member.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{member.email}</p>
                    <p className="text-xs text-slate-500">{member.role} · {member.status}</p>
                  </div>
                  <button type="button" onClick={() => onRemoveHuman(member.id)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-900">Attached files</p>
            </div>
            <div className="mt-3 space-y-2">
              {room.files.slice(0, 6).map((file) => (
                <div key={file.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-900">{file.originalName}</p>
                  <p className="text-xs text-slate-500">{file.mimeType}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </section>
  );
}
