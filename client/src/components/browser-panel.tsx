import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Play, Square, ArrowLeft, ArrowRight,
  RotateCw, Loader2, Monitor, Bot, Send,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface BrowserPanelProps {
  userId: string | null;
}

interface AiStep {
  step: number;
  thinking: string;
  status: string;
  summary: string;
  actionType: string;
}

export default function BrowserPanel({ userId }: BrowserPanelProps) {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [isAiWorking, setIsAiWorking] = useState(false);
  const [aiSteps, setAiSteps] = useState<AiStep[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (userId) headers["x-user-id"] = userId;
    return headers;
  }, [userId]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) wsRef.current.close();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/browser?userId=${userId || "anonymous"}`);
    ws.binaryType = "blob";

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        const url = URL.createObjectURL(event.data);
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } else {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "session_started") {
            setIsActive(true);
            setIsLoading(false);
          } else if (data.type === "navigated") {
            setCurrentUrl(data.url || "");
          } else if (data.type === "session_stopped") {
            setIsActive(false);
          }
        } catch {}
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;
    return ws;
  }, [userId]);

  const startSession = async () => {
    setIsLoading(true);
    try {
      const ws = connectWebSocket();
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start" }));
      };
    } catch (e) {
      setIsLoading(false);
    }
  };

  const stopSession = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    setIsActive(false);
    setCurrentUrl("");
    setAiSteps([]);
    setAiSummary("");
  };

  const handleNavigate = () => {
    if (!urlInput.trim() || !wsRef.current) return;
    let url = urlInput.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    wsRef.current.send(JSON.stringify({ type: "navigate", url }));
    setCurrentUrl(url);
    setUrlInput("");
  };

  const handleAiCommand = async () => {
    if (!commandInput.trim()) return;
    setIsAiWorking(true);
    setAiSteps([]);
    setAiSummary("");

    try {
      const response = await fetch("/api/browser/ai-command", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ command: commandInput }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.done) {
              setIsAiWorking(false);
            } else if (parsed.status === "done" || parsed.status === "error") {
              setAiSummary(parsed.summary || "");
              setAiSteps((prev) => [...prev, parsed]);
            } else {
              setAiSteps((prev) => [...prev, parsed]);
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error("[browser-panel] AI command error:", e);
    }
    setIsAiWorking(false);
    setCommandInput("");
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !wsRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    wsRef.current.send(JSON.stringify({
      type: "action",
      action: { type: "click", x, y },
    }));
  };

  if (!isActive && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8" data-testid="browser-panel-inactive">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
          <Monitor className="w-8 h-8 text-blue-400" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-sm font-semibold text-foreground">UI Navigator</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Launch a browser that Gemini can see and control.
            Navigate websites, extract data, and perform tasks with AI vision.
          </p>
        </div>
        <Button
          onClick={startSession}
          size="sm"
          className="gap-2"
          data-testid="button-start-browser"
        >
          <Play className="w-3.5 h-3.5" />
          Launch Browser
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="browser-panel-active">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => wsRef.current?.send(JSON.stringify({ type: "action", action: { type: "back" } }))}
          data-testid="button-browser-back"
        >
          <ArrowLeft className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => wsRef.current?.send(JSON.stringify({ type: "action", action: { type: "forward" } }))}
          data-testid="button-browser-forward"
        >
          <ArrowRight className="w-3 h-3" />
        </Button>

        <form
          className="flex-1 flex gap-1"
          onSubmit={(e) => { e.preventDefault(); handleNavigate(); }}
        >
          <div className="relative flex-1">
            <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={currentUrl || "Enter URL..."}
              className="h-6 pl-7 text-xs"
              data-testid="input-browser-url"
            />
          </div>
          <Button type="submit" variant="ghost" size="icon" className="h-6 w-6" data-testid="button-browser-go">
            <RotateCw className="w-3 h-3" />
          </Button>
        </form>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={stopSession}
          data-testid="button-stop-browser"
        >
          <Square className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-black">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain cursor-pointer"
            onClick={handleCanvasClick}
            data-testid="canvas-browser-view"
          />
        )}

        {isAiWorking && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-background/90 backdrop-blur border border-border rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span className="text-xs font-medium text-blue-400">AI Working...</span>
              </div>
              {aiSteps.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Step {aiSteps[aiSteps.length - 1].step}: {aiSteps[aiSteps.length - 1].thinking}
                </p>
              )}
            </div>
          </div>
        )}

        {aiSummary && !isAiWorking && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-background/90 backdrop-blur border border-green-500/30 rounded-lg p-2">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-green-400">{aiSummary}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border">
        <form
          className="flex items-center gap-1.5 px-2 py-1.5"
          onSubmit={(e) => { e.preventDefault(); handleAiCommand(); }}
        >
          <Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Tell AI what to do on this page..."
            className="h-6 text-xs flex-1"
            disabled={isAiWorking}
            data-testid="input-ai-command"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={isAiWorking || !commandInput.trim()}
            data-testid="button-send-ai-command"
          >
            {isAiWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
