import { useMemo, useState } from "react";
import { Bot, MailPlus, UserRoundX, Wand2 } from "lucide-react";
import { AgentAvatar } from "@/components/agent-avatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentPersona } from "@shared/schema";
import type { RoomCommandMode, RoomV3Context } from "./types";

interface OperationsPaneProps {
  room: RoomV3Context;
  mode: RoomCommandMode;
  targetAgentId: number | null;
  onTargetAgent: (agentId: number | null) => void;
  onToggleAgent: (agent: AgentPersona) => Promise<void>;
  onCommand: (agent: AgentPersona, mode: RoomCommandMode | "build") => Promise<void>;
  onInviteHuman: (email: string) => Promise<void>;
  onRemoveHuman: (memberId: number) => Promise<void>;
}

export function OperationsPane({
  room,
  mode,
  targetAgentId,
  onTargetAgent,
  onToggleAgent,
  onCommand,
  onInviteHuman,
  onRemoveHuman,
}: OperationsPaneProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [busyAgentId, setBusyAgentId] = useState<number | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
  const [busyCommand, setBusyCommand] = useState<string | null>(null);
  const activeAgentIds = new Set(room.activeAgentIds);

  const leadAgent = useMemo(() => {
    const direct = room.agents.find((agent) => agent.id === targetAgentId && activeAgentIds.has(agent.id));
    if (direct) return direct;
    return room.agents.find((agent) => activeAgentIds.has(agent.id)) || null;
  }, [room.agents, room.activeAgentIds, targetAgentId]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-[#eef2f4] text-[#15222b] shadow-[0_18px_60px_rgba(18,24,34,0.08)]">
      <div className="border-b border-black/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#58707d]">Operations</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#15222b]">Control the room</h2>
        <p className="mt-2 text-sm leading-6 text-[#5a6c76]">
          Pick a lead agent, invite collaborators, and fire precise commands without clutter.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-5 py-4">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-[#15222b]/10 bg-[#15222b] p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ab8ca]">Command deck</p>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {leadAgent ? `${leadAgent.name} is on point` : "Select an active agent to lead"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#c8d7df]">
                  {leadAgent ? `${leadAgent.role}. Current room mode: ${mode}.` : "Activate at least one agent before commanding the room."}
                </p>
              </div>
              <Badge className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white">
                {leadAgent ? "lead set" : "no lead"}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["build", "critique", "research", "decide"] as const).map((commandMode) => {
                const key = `${leadAgent?.id || "none"}:${commandMode}`;
                return (
                  <Button
                    key={commandMode}
                    variant="ghost"
                    className={cn(
                      "justify-start rounded-full border px-4",
                      mode === commandMode
                        ? "border-[#f08b5b]/30 bg-[#f08b5b] text-[#171614] hover:bg-[#e97941]"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                    )}
                    disabled={!leadAgent || busyCommand === key}
                    onClick={async () => {
                      if (!leadAgent) return;
                      setBusyCommand(key);
                      try {
                        await onCommand(leadAgent, commandMode);
                      } finally {
                        setBusyCommand(null);
                      }
                    }}
                  >
                    <Wand2 className="mr-1.5 h-4 w-4" />
                    {commandMode}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[22px] border border-black/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#58707d]">People</p>
            <div className="mt-3 flex gap-2">
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@company.com"
                className="h-10 rounded-full border-black/10 bg-[#f7fafb]"
              />
              <Button
                className="rounded-full bg-[#15222b] text-white hover:bg-black"
                disabled={!inviteEmail.trim()}
                onClick={async () => {
                  await onInviteHuman(inviteEmail.trim());
                  setInviteEmail("");
                }}
              >
                <MailPlus className="mr-1.5 h-4 w-4" />
                Invite
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {room.members.length ? room.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-[18px] border border-black/10 bg-[#f7fafb] px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#15222b]">{member.email}</p>
                    <p className="mt-1 text-xs text-[#5a6c76]">{member.role} · {member.status}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    disabled={busyMemberId === member.id}
                    onClick={async () => {
                      setBusyMemberId(member.id);
                      try {
                        await onRemoveHuman(member.id);
                      } finally {
                        setBusyMemberId(null);
                      }
                    }}
                  >
                    <UserRoundX className="h-4 w-4" />
                  </Button>
                </div>
              )) : (
                <p className="text-sm text-[#5a6c76]">No invited collaborators yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-black/10 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#58707d]">Agents</p>
              <Badge className="rounded-full bg-[#d7e4ea] text-[#15222b]">{room.activeAgentIds.length} active</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {room.agents.map((agent) => {
                const active = activeAgentIds.has(agent.id);
                const targeted = targetAgentId === agent.id;

                return (
                  <article
                    key={agent.id}
                    className={cn(
                      "rounded-[18px] border border-black/10 bg-[#f7fafb] p-3 transition",
                      targeted ? "ring-1 ring-[#f08b5b]/50" : "",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <AgentAvatar avatar={agent.avatar} color={agent.color} size="md" name={agent.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#15222b]">{agent.name}</span>
                          <Badge className={cn("rounded-full", active ? "bg-[#15222b] text-white" : "bg-[#d7e4ea] text-[#15222b]")}>
                            {active ? "active" : "standby"}
                          </Badge>
                          {targeted ? <Badge className="rounded-full bg-[#f08b5b]/16 text-[#5c3419]">lead</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#5a6c76]">{agent.role}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant={active ? "outline" : "default"}
                            size="sm"
                            className={active ? "rounded-full border-black/10" : "rounded-full bg-[#15222b] text-white hover:bg-black"}
                            disabled={busyAgentId === agent.id}
                            onClick={async () => {
                              setBusyAgentId(agent.id);
                              try {
                                await onToggleAgent(agent);
                              } finally {
                                setBusyAgentId(null);
                              }
                            }}
                          >
                            <Bot className="mr-1.5 h-3.5 w-3.5" />
                            {active ? "Stand down" : "Activate"}
                          </Button>

                          {active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full"
                              onClick={() => onTargetAgent(targeted ? null : agent.id)}
                            >
                              {targeted ? "Clear lead" : "Set lead"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-[22px] border border-black/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#58707d]">Context files</p>
            <div className="mt-3 space-y-2">
              {room.files.length ? room.files.slice(0, 5).map((file) => (
                <div key={file.id} className="rounded-[16px] border border-black/10 bg-[#f7fafb] px-3 py-3">
                  <p className="truncate text-sm font-medium text-[#15222b]">{file.originalName}</p>
                  <p className="mt-1 text-xs text-[#5a6c76]">{file.mimeType}</p>
                </div>
              )) : (
                <p className="text-sm text-[#5a6c76]">No context files attached yet.</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}
