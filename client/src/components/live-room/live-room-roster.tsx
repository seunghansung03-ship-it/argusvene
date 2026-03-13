import { useState } from "react";
import { MailPlus, Radio, Sparkles, Users, UserRoundX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AgentAvatar } from "@/components/agent-avatar";
import type { AgentPersona } from "@shared/schema";
import type { GeminiLiveStatus } from "@/hooks/use-gemini-live";
import type { AgentCommandMode, HumanRosterEntry, RoomMode } from "./types";

interface LiveRoomRosterProps {
  humans: HumanRosterEntry[];
  agents: AgentPersona[];
  activeAgentIds: number[];
  targetAgentId: number | null;
  roomMode: RoomMode;
  liveWorkOrder: string;
  geminiLiveStatus: GeminiLiveStatus;
  onInviteHuman: (email: string) => Promise<void>;
  onRemoveHuman: (memberId: number) => Promise<void>;
  onToggleAgent: (agent: AgentPersona) => Promise<void>;
  onAddressAgent: (agentId: number | null) => void;
  onRunAgentCommand: (agent: AgentPersona, command: AgentCommandMode) => Promise<void>;
}

export function LiveRoomRoster({
  humans,
  agents,
  activeAgentIds,
  targetAgentId,
  roomMode,
  liveWorkOrder,
  geminiLiveStatus,
  onInviteHuman,
  onRemoveHuman,
  onToggleAgent,
  onAddressAgent,
  onRunAgentCommand,
}: LiveRoomRosterProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [busyHumanId, setBusyHumanId] = useState<number | null>(null);
  const [busyAgentId, setBusyAgentId] = useState<number | null>(null);
  const [busyCommandKey, setBusyCommandKey] = useState<string | null>(null);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const submitInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setSubmittingInvite(true);
    try {
      await onInviteHuman(email);
      setInviteEmail("");
    } finally {
      setSubmittingInvite(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Participants</h2>
            <Badge variant="secondary" className="rounded-full">
              {humans.length + activeAgentIds.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Run the room by inviting people, activating specialists, and targeting specific agents.
          </p>
        </div>
      </div>

      <Tabs defaultValue="agents" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="room">Room</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agents" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-3">
              {agents.map((agent) => {
                const active = activeAgentIds.includes(agent.id);
                const targeted = targetAgentId === agent.id;
                return (
                  <Card key={agent.id} className={`border-card-border p-3 ${active ? "ring-1 ring-primary/30" : ""}`}>
                    <div className="flex items-start gap-3">
                      <AgentAvatar avatar={agent.avatar} color={agent.color} name={agent.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                          <Badge variant={active ? "default" : "outline"} className="rounded-full px-2">
                            {active ? "Active" : "Standby"}
                          </Badge>
                          {targeted ? (
                            <Badge className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              Next turn
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{agent.role}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant={active ? "outline" : "default"}
                            size="sm"
                            className="h-8"
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
                            {busyAgentId === agent.id ? "Updating..." : active ? "Remove from room" : "Bring into room"}
                          </Button>
                          {active ? (
                            <Button
                              variant={targeted ? "default" : "ghost"}
                              size="sm"
                              className="h-8"
                              onClick={() => onAddressAgent(targeted ? null : agent.id)}
                            >
                              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                              {targeted ? "Clear target" : "Address directly"}
                            </Button>
                          ) : null}
                        </div>
                        {active ? (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {([
                              { id: "build", label: "Build" },
                              { id: "critique", label: "Critique" },
                              { id: "research", label: "Research" },
                              { id: "decide", label: "Decide" },
                            ] as const).map((command) => {
                              const commandKey = `${agent.id}:${command.id}`;
                              return (
                                <Button
                                  key={command.id}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 justify-start"
                                  disabled={busyCommandKey === commandKey}
                                  onClick={async () => {
                                    setBusyCommandKey(commandKey);
                                    try {
                                      await onRunAgentCommand(agent, command.id);
                                    } finally {
                                      setBusyCommandKey(null);
                                    }
                                  }}
                                >
                                  {busyCommandKey === commandKey ? "Working..." : command.label}
                                </Button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="people" className="mt-0 min-h-0 flex-1">
          <div className="border-b border-border px-4 py-4">
            <div className="flex gap-2">
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Invite by email"
                className="h-9"
              />
              <Button onClick={submitInvite} disabled={submittingInvite || !inviteEmail.trim()} className="h-9">
                <MailPlus className="mr-1.5 h-4 w-4" />
                Invite
              </Button>
            </div>
          </div>
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-3">
              {humans.map((human) => (
                <Card key={human.id} className="border-card-border p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {human.label.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{human.label}</span>
                        <Badge variant="outline" className="rounded-full px-2">
                          {human.kind === "founder" ? "Founder" : "Member"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{human.detail}</p>
                    </div>
                    {human.memberId ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        disabled={busyHumanId === human.memberId}
                        onClick={async () => {
                          setBusyHumanId(human.memberId ?? null);
                          try {
                            await onRemoveHuman(human.memberId!);
                          } finally {
                            setBusyHumanId(null);
                          }
                        }}
                      >
                        <UserRoundX className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="room" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-4">
              <Card className="border-card-border p-4">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Current live layer</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Room mode is <span className="font-medium text-foreground">{roomMode}</span>. Gemini Live is{" "}
                  <span className="font-medium text-foreground">{geminiLiveStatus}</span>.
                </p>
              </Card>

              <Card className="border-card-border p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Current work order</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {liveWorkOrder || "No explicit work order yet. Use Build, Critique, Research, or Decide on an active agent."}
                </p>
              </Card>

              <Card className="border-card-border p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Operating rules</span>
                </div>
                <Separator className="my-3" />
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Keep at least one specialist active in the room.</li>
                  <li>Use direct targeting when you need a single accountable answer.</li>
                  <li>Use the canvas to pressure-test assumptions before shipping.</li>
                </ul>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
