import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { ArrowRight, FileUp, MailPlus, Mic, Trash2, Users } from "lucide-react";
import { ProductShell } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { apiFetchJson, apiRequest, getAuthHeaders, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentPersona, Artifact, Decision, Meeting, Task, Workspace, WorkspaceFile, WorkspaceMember } from "@shared/schema";

export default function WorkspacePrepPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", workspaceId],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}`),
  });
  const { data: members } = useQuery<WorkspaceMember[]>({
    queryKey: ["/api/workspaces", workspaceId, "members"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/members`),
  });
  const { data: files } = useQuery<WorkspaceFile[]>({
    queryKey: ["/api/workspaces", workspaceId, "files"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/files`),
  });
  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: ["/api/workspaces", workspaceId, "meetings"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/meetings`),
  });
  const { data: artifacts } = useQuery<Artifact[]>({
    queryKey: ["/api/workspaces", workspaceId, "artifacts"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/artifacts`),
  });
  const { data: decisions } = useQuery<Decision[]>({
    queryKey: ["/api/workspaces", workspaceId, "decisions"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/decisions`),
  });
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/workspaces", workspaceId, "tasks"],
    queryFn: () => apiFetchJson(`/api/workspaces/${workspaceId}/tasks`),
  });
  const { data: agents } = useQuery<AgentPersona[]>({
    queryKey: ["/api/agents"],
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [openingRoom, setOpeningRoom] = useState(false);
  const [uploading, setUploading] = useState(false);

  const activeMeeting = useMemo(() => meetings?.find((meeting) => meeting.status === "active"), [meetings]);

  const toggleAgent = (agentId: number) => {
    setSelectedAgentIds((current) => current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]);
  };

  const inviteMember = async () => {
    try {
      await apiRequest("POST", `/api/workspaces/${workspaceId}/members`, { email: inviteEmail });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
      setInviteEmail("");
    } catch (error: any) {
      toast({ title: "Invite failed", description: error.message || "Could not invite member.", variant: "destructive" });
    }
  };

  const removeMember = async (memberId: number) => {
    try {
      await apiRequest("DELETE", `/api/workspaces/${workspaceId}/members/${memberId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "members"] });
    } catch (error: any) {
      toast({ title: "Remove failed", description: error.message || "Could not remove member.", variant: "destructive" });
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/workspaces/${workspaceId}/files`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "files"] });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Could not upload file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: number) => {
    try {
      await apiRequest("DELETE", `/api/workspaces/${workspaceId}/files/${fileId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "files"] });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message || "Could not delete file.", variant: "destructive" });
    }
  };

  const openRoom = async () => {
    setOpeningRoom(true);
    try {
      const response = await apiRequest("POST", `/api/workspaces/${workspaceId}/meetings`, {
        title: roomTitle,
        agentIds: selectedAgentIds,
        aiProvider: "gemini",
      });
      const meeting: Meeting = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "meetings"] });
      setLocation(`/meeting/${meeting.id}`);
    } catch (error: any) {
      toast({ title: "Open room failed", description: error.message || "Could not open room.", variant: "destructive" });
    } finally {
      setOpeningRoom(false);
    }
  };

  return (
    <ProductShell
      title={workspace?.name || "Workspace prep"}
      description={workspace?.description || "Prepare the people, files, and default agents before the room goes live."}
      backHref="/"
      backLabel="Home"
      actions={
        activeMeeting ? (
          <Link href={`/meeting/${activeMeeting.id}`}>
            <Button className="rounded-full">
              <Mic className="h-4 w-4" />
              Re-enter live room
            </Button>
          </Link>
        ) : null
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Open room</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Prepare the next live session</h2>
            <div className="mt-4 space-y-4">
              <Input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} placeholder="Decision or meeting topic" />
              <ScrollArea className="h-56 rounded-2xl border border-slate-200">
                <div className="space-y-2 p-3">
                  {agents?.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${selectedAgentIds.includes(agent.id) ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"}`}
                    >
                      <Checkbox checked={selectedAgentIds.includes(agent.id)} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{agent.name}</p>
                        <p className={`text-xs ${selectedAgentIds.includes(agent.id) ? "text-slate-300" : "text-slate-500"}`}>{agent.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <Button className="w-full rounded-xl" disabled={!roomTitle.trim() || selectedAgentIds.length === 0 || openingRoom} onClick={openRoom}>
                {openingRoom ? "Opening..." : "Open live room"}
              </Button>
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-sky-600" />
              Humans
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Invite teammate by email" />
              <Button variant="outline" className="rounded-xl" disabled={!inviteEmail.trim()} onClick={inviteMember}>
                <MailPlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {members?.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{member.email}</p>
                    <p className="text-xs text-slate-500">{member.role} · {member.status}</p>
                  </div>
                  <button type="button" onClick={() => removeMember(member.id)} className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileUp className="h-4 w-4 text-orange-500" />
              Files
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <label className="block cursor-pointer text-sm text-slate-600">
                <span className="font-medium text-slate-900">{uploading ? "Uploading..." : "Upload file"}</span>
                <input type="file" className="mt-3 block w-full text-sm" disabled={uploading} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadFile(file);
                }} />
              </label>
            </div>
            <div className="mt-4 space-y-2">
              {files?.map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{file.originalName}</p>
                    <p className="text-xs text-slate-500">{file.mimeType}</p>
                  </div>
                  <button type="button" onClick={() => deleteFile(file.id)} className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current status</div>
            <div className="mt-3 text-lg font-semibold text-slate-950">{activeMeeting ? activeMeeting.title : "No live room active"}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {activeMeeting ? "The team can jump straight back into the room." : "Pick the specialists, attach the relevant files, then open the room when the team is ready."}
            </p>
          </Card>

          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent outputs</div>
            <div className="mt-4 space-y-3">
              {artifacts?.slice(0, 3).map((artifact) => (
                <div key={artifact.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{artifact.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{artifact.type}</p>
                </div>
              ))}
            </div>
            <Link href={`/workspace/${workspaceId}/outcomes`}>
              <Button variant="outline" className="mt-4 w-full rounded-xl">
                Review outcomes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>

          <Card className="rounded-2xl border-slate-200 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent decisions and tasks</div>
            <div className="mt-4 space-y-3">
              {decisions?.slice(0, 2).map((decision) => (
                <div key={decision.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{decision.title}</p>
                  <p className="mt-1 text-xs text-slate-500">decision</p>
                </div>
              ))}
              {tasks?.slice(0, 2).map((task) => (
                <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{task.status}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </ProductShell>
  );
}
