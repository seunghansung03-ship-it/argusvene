import { useMemo, useState } from "react";
import { Bot, MailPlus, UserRoundX, Wand2 } from "lucide-react";
import { AgentAvatar } from "@/components/agent-avatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentPersona } from "@shared/schema";
import type { RoomV2Context, RoomV2Mode } from "./types";

interface RosterColumnProps {
  room: RoomV2Context;
  targetAgentId: number | null;
  currentMode: RoomV2Mode;
  onToggleAgent: (agent: AgentPersona) => Promise<void>;
  onTargetAgent: (agentId: number | null) => void;
  onCommand: (agent: AgentPersona, mode: RoomV2Mode | "build") => Promise<void>;
  onInviteHuman: (email: string) => Promise<void>;
  onRemoveHuman: (memberId: number) => Promise<void>;
}

function modeButtonLabel(mode: RoomV2Mode | "build") {
  switch (mode) {
    case "build":
      return "Build";
    case "critique":
      return "Critique";
    case "research":
      return "Research";
    case "decide":
      return "Decide";
    case "align":
    default:
      return "Align";
  }
}

export function RosterColumn({
  room,
  targetAgentId,
  currentMode,
  onToggleAgent,
  onTargetAgent,
  onCommand,
  onInviteHuman,
  onRemoveHuman,
}: RosterColumnProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [busyAgentId, setBusyAgentId] = useState<number | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
  const [busyCommand, setBusyCommand] = useState<string | null>(null);
  const activeAgentIds = new Set(room.activeAgentIds);

  const selectedAgent = useMemo(() => {
    const direct = room.agents.find((agent) => agent.id === targetAgentId && activeAgentIds.has(agent.id));
    if (direct) return direct;
    return room.agents.find((agent) => activeAgentIds.has(agent.id)) || null;
  }, [room.agents, targetAgentId, room.activeAgentIds]);

  return (
    <div className="flex h-full flex-col bg-[#eef2f4] text-[#15222b]">
      <div className="border-b border-black/10 px-4 py-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#58707d]">Operators</span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Run the room, not just the chat</h2>
        <p className="mt-2 text-sm leading-6 text-[#5a6c76]">
          Select who is leading, bring people in or out, and tell one agent exactly how to move the room forward.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        <div className="space-y-4">
          <Card className="rounded-[26px] border-black/10 bg-[#15222b] p-4 text-white shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ab8ca]">Command deck</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">
                  {selectedAgent ? `${selectedAgent.name} is holding the lead` : "Pick an active agent to lead the next move"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#c6d8e3]">
                  {selectedAgent
                    ? `${selectedAgent.role}. Current room mode is ${modeButtonLabel(currentMode).toLowerCase()}.`
                    : "Activate an agent, target them, then fire a concrete instruction from here."}
                </p>
              </div>
              <Badge className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white">
                {selectedAgent ? "Direct operator" : "No target"}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["build", "critique", "research", "decide"] as const).map((mode) => {
                const key = `${selectedAgent?.id || "none"}:${mode}`;
                return (
                  <Button
                    key={mode}
                    variant="ghost"
                    className={cn(
                      "justify-start rounded-full border px-4 text-left",
                      mode === currentMode
                        ? "border-[#f08b5b]/30 bg-[#f08b5b] text-[#171614] hover:bg-[#e97941]"
                        : "border-white/10 bg-white/8 text-white hover:bg-white/14",
                    )}
                    disabled={!selectedAgent || busyCommand === key}
                    onClick={async () => {
                      if (!selectedAgent) return;
                      setBusyCommand(key);
                      try {
                        await onCommand(selectedAgent, mode);
                      } finally {
                        setBusyCommand(null);
                      }
                    }}
                  >
                    <Wand2 className="mr-1.5 h-4 w-4" />
                    {modeButtonLabel(mode)}
                  </Button>
                );
              })}
            </div>
          </Card>

          <Card className="rounded-[24px] border-black/10 bg-white p-4 shadow-none">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#58707d]">Invite people</p>
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
          </Card>

          <Card className="rounded-[24px] border-black/10 bg-white p-4 shadow-none">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-[#15222b] text-white">{room.members.length + 1} humans</Badge>
              <Badge className="rounded-full bg-[#d7e4ea] text-[#15222b]">{room.activeAgentIds.length} active agents</Badge>
              <Badge className="rounded-full bg-[#eef3d7] text-[#47512f]">{room.files.length} files loaded</Badge>
            </div>

            <div className="mt-3 space-y-3">
              {room.members.length ? room.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-[18px] border border-black/10 bg-[#f7fafb] px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.email}</p>
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
                <div className="rounded-[18px] border border-dashed border-black/10 bg-[#f7fafb] px-3 py-4 text-sm text-[#5a6c76]">
                  No invited collaborators yet. This room is currently solo.
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#58707d]">Agent roster</p>
              <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-[#15222b]">
                {room.agents.length} available
              </Badge>
            </div>

            {room.agents.map((agent) => {
              const active = activeAgentIds.has(agent.id);
              const targeted = targetAgentId === agent.id;
              return (
                <Card
                  key={agent.id}
                  className={cn(
                    "rounded-[24px] border-black/10 bg-white p-4 shadow-none transition",
                    active ? "ring-1 ring-[#f08b5b]/45" : "",
                    targeted ? "border-[#15222b]/20 shadow-[0_20px_60px_rgba(21,34,43,0.08)]" : "",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AgentAvatar avatar={agent.avatar} color={agent.color} size="lg" name={agent.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#15222b]">{agent.name}</span>
                        <Badge className={cn(
                          "rounded-full",
                          active ? "bg-[#15222b] text-white" : "bg-[#d7e4ea] text-[#15222b]",
                        )}>
                          {active ? "Active" : "Standby"}
                        </Badge>
                        {targeted ? (
                          <Badge className="rounded-full bg-[#f08b5b]/18 text-[#5c3419]">Direct lead</Badge>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-[#5a6c76]">{agent.role}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant={active ? "outline" : "default"}
                          className={active ? "rounded-full border-black/10" : "rounded-full bg-[#15222b] text-white hover:bg-black"}
                          size="sm"
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
                            className={cn(
                              "rounded-full",
                              targeted ? "bg-[#15222b]/8 text-[#15222b]" : "",
                            )}
                            onClick={() => onTargetAgent(targeted ? null : agent.id)}
                          >
                            {targeted ? "Clear lead" : "Set as lead"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
