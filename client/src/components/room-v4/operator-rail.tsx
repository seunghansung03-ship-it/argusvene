import { useState } from "react";
import { Bot, MailPlus, MinusCircle, PlusCircle, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AgentPersona } from "@shared/schema";
import type { RoomCommandMode, RoomV4Context } from "./types";

interface OperatorRailProps {
  room: RoomV4Context;
  targetAgentId: number | null;
  mode: RoomCommandMode;
  busy: boolean;
  onTargetAgent: (agentId: number | null) => void;
  onModeChange: (mode: RoomCommandMode) => void;
  onToggleAgent: (agent: AgentPersona) => void;
  onRunCommand: (agent: AgentPersona | null, mode: RoomCommandMode | "build") => void;
  onInviteHuman: (email: string) => Promise<void>;
  onRemoveHuman: (memberId: number) => Promise<void>;
}

const modeLabels: Record<RoomCommandMode, { title: string; body: string }> = {
  align: {
    title: "Align",
    body: "Compress the room around the single most important next move.",
  },
  critique: {
    title: "Critique",
    body: "Force pushback and expose the weakest assumption first.",
  },
  research: {
    title: "Research",
    body: "Turn unknowns into explicit research tasks or fact checks.",
  },
  decide: {
    title: "Decide",
    body: "Lock the next decision instead of keeping the room vague.",
  },
};

function initials(value: string) {
  return value
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function OperatorRail({
  room,
  targetAgentId,
  mode,
  busy,
  onTargetAgent,
  onModeChange,
  onToggleAgent,
  onRunCommand,
  onInviteHuman,
  onRemoveHuman,
}: OperatorRailProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const activeIds = new Set(room.activeAgentIds);
  const targetAgent = room.agents.find((agent) => agent.id === targetAgentId) || null;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Room operations</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Operator rail</h2>
        <p className="mt-1 text-sm text-slate-600">Invite people, arm agents, and fire the next room move without digging through settings.</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-5 py-5">
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Command deck</p>
                <p className="mt-1 text-xs text-slate-500">
                  {targetAgent ? `${targetAgent.name} is currently targeted.` : "Commands will address the whole room."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onTargetAgent(null)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
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
                  <p className={cn("mt-2 text-sm leading-6", mode === option ? "text-slate-300" : "text-slate-600")}>
                    {modeLabels[option].body}
                  </p>
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
              <Bot className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-slate-900">Agents</p>
            </div>
            <div className="mt-3 space-y-2">
              {room.agents.map((agent) => {
                const isActive = activeIds.has(agent.id);
                const isTarget = targetAgentId === agent.id;
                return (
                  <div key={agent.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: agent.color || "#111827" }}
                      >
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
                            className={cn(
                              "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                              isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600",
                            )}
                            onClick={() => onToggleAgent(agent)}
                          >
                            {isActive ? "active" : "offline"}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onTargetAgent(isTarget ? null : agent.id)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                              isTarget ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                            )}
                          >
                            {isTarget ? "Focused" : "Focus"}
                          </button>
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => onRunCommand(agent, "build")}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Build
                          </button>
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => {
                              onModeChange("critique");
                              onRunCommand(agent, "critique");
                            }}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Critique
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
              <Users className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-semibold text-slate-900">Humans</p>
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
                  <button
                    type="button"
                    onClick={() => onRemoveHuman(member.id)}
                    className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100"
                  >
                    <MinusCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-900">Attached context</p>
            </div>
            <div className="mt-3 space-y-2">
              {room.files.slice(0, 6).map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <PlusCircle className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{file.originalName}</p>
                    <p className="text-xs text-slate-500">{file.mimeType}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </section>
  );
}
