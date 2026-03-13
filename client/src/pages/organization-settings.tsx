import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Save, Trash2 } from "lucide-react";
import { ProductShell } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetchJson, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentPersona } from "@shared/schema";

type ProvidersResponse = {
  providers: { id: string; name: string; available: boolean }[];
  default: string;
};

const emptyAgent = {
  name: "",
  role: "",
  systemPrompt: "",
  avatar: "",
  color: "#111827",
  voiceId: "",
};

export default function OrganizationSettingsPage() {
  const { toast } = useToast();
  const { data: agents } = useQuery<AgentPersona[]>({ queryKey: ["/api/agents"] });
  const { data: providers } = useQuery<ProvidersResponse>({
    queryKey: ["/api/providers"],
    queryFn: () => apiFetchJson("/api/providers"),
  });

  const [selectedAgentId, setSelectedAgentId] = useState<number | "new">("new");
  const [agentDraft, setAgentDraft] = useState(emptyAgent);
  const [saving, setSaving] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);

  useEffect(() => {
    if (selectedAgentId === "new") {
      setAgentDraft(emptyAgent);
      return;
    }
    const selected = agents?.find((agent) => agent.id === selectedAgentId);
    if (selected) {
      setAgentDraft({
        name: selected.name,
        role: selected.role,
        systemPrompt: selected.systemPrompt,
        avatar: selected.avatar || "",
        color: selected.color || "#111827",
        voiceId: selected.voiceId || "",
      });
    }
  }, [agents, selectedAgentId]);

  const saveAgent = async () => {
    setSaving(true);
    try {
      if (selectedAgentId === "new") {
        await apiRequest("POST", "/api/agents", agentDraft);
      } else {
        await apiRequest("PATCH", `/api/agents/${selectedAgentId}`, agentDraft);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Saved", description: "Agent library updated." });
      if (selectedAgentId === "new") {
        setSelectedAgentId("new");
        setAgentDraft(emptyAgent);
      }
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message || "Could not save agent.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAgent = async () => {
    if (selectedAgentId === "new") return;
    try {
      await apiRequest("DELETE", `/api/agents/${selectedAgentId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setSelectedAgentId("new");
      setAgentDraft(emptyAgent);
      toast({ title: "Deleted", description: "Agent removed from the library." });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message || "Could not delete agent.", variant: "destructive" });
    }
  };

  const updateDefaultProvider = async (provider: string) => {
    setSavingProvider(true);
    try {
      await apiRequest("POST", "/api/providers/default", { provider });
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({ title: "Saved", description: "Room defaults updated." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message || "Could not update provider.", variant: "destructive" });
    } finally {
      setSavingProvider(false);
    }
  };

  return (
    <ProductShell
      title="Organization settings"
      description="Manage the shared agent library and room defaults used across workspaces."
      backHref="/"
      backLabel="Home"
    >
      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <Card className="min-h-[70vh] rounded-2xl border-slate-200">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agent library</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Shared room specialists</h2>
          </div>
          <ScrollArea className="h-[calc(70vh-86px)]">
            <div className="space-y-2 px-4 py-4">
              <button
                type="button"
                onClick={() => setSelectedAgentId("new")}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedAgentId === "new" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"}`}
              >
                <div className="text-sm font-semibold">New agent</div>
                <div className={`mt-1 text-xs ${selectedAgentId === "new" ? "text-slate-300" : "text-slate-500"}`}>Create a new reusable specialist.</div>
              </button>
              {agents?.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedAgentId === agent.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <span className="text-sm font-semibold">{agent.name}</span>
                  </div>
                  <div className={`mt-1 text-xs ${selectedAgentId === agent.id ? "text-slate-300" : "text-slate-500"}`}>{agent.role}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Room defaults</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Base model and provider</h2>
            <div className="mt-4 max-w-sm">
              <Select value={providers?.default || "gemini"} onValueChange={updateDefaultProvider} disabled={savingProvider}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agent details</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedAgentId === "new" ? "Create agent" : "Edit agent"}</h2>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Input value={agentDraft.name} onChange={(event) => setAgentDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Agent name" />
              <Input value={agentDraft.role} onChange={(event) => setAgentDraft((current) => ({ ...current, role: event.target.value }))} placeholder="Role" />
              <Input value={agentDraft.color} onChange={(event) => setAgentDraft((current) => ({ ...current, color: event.target.value }))} placeholder="#111827" />
              <Input value={agentDraft.voiceId} onChange={(event) => setAgentDraft((current) => ({ ...current, voiceId: event.target.value }))} placeholder="Voice ID (optional)" />
              <Input value={agentDraft.avatar} onChange={(event) => setAgentDraft((current) => ({ ...current, avatar: event.target.value }))} placeholder="Avatar (optional)" className="lg:col-span-2" />
              <Textarea
                value={agentDraft.systemPrompt}
                onChange={(event) => setAgentDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
                rows={10}
                placeholder="Write the role, tone, authority boundary, and intervention triggers."
                className="lg:col-span-2"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="rounded-xl" disabled={!agentDraft.name.trim() || !agentDraft.role.trim() || !agentDraft.systemPrompt.trim() || saving} onClick={saveAgent}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save agent"}
              </Button>
              {selectedAgentId !== "new" ? (
                <Button variant="outline" className="rounded-xl" onClick={deleteAgent}>
                  <Trash2 className="h-4 w-4" />
                  Delete agent
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </ProductShell>
  );
}
