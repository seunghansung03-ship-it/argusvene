import { useState, useRef, useCallback } from "react";

interface GeminiLiveOptions {
  userId: string | null;
  onTranscript?: (text: string) => void;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: GeminiLiveStatus) => void;
}

export type GeminiLiveStatus = "disconnected" | "connecting" | "connected" | "speaking" | "listening";

export function useGeminiLive(options: GeminiLiveOptions) {
  const { userId, onTranscript, onAudioStart, onAudioEnd, onError, onStatusChange } = options;

  const [status, setStatus] = useState<GeminiLiveStatus>("disconnected");
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const updateStatus = useCallback((s: GeminiLiveStatus) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;

    isPlayingRef.current = true;
    setIsSpeaking(true);
    onAudioStart?.();

    let ctx = playbackContextRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext({ sampleRate: 24000 });
      playbackContextRef.current = ctx;
    }

    while (playbackQueueRef.current.length > 0) {
      const samples = playbackQueueRef.current.shift()!;
      const buffer = ctx.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      playbackSourceRef.current = source;

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }

    playbackSourceRef.current = null;
    isPlayingRef.current = false;
    setIsSpeaking(false);
    onAudioEnd?.();
    updateStatus("listening");
  }, [onAudioStart, onAudioEnd, updateStatus]);

  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = [];
    if (playbackSourceRef.current) {
      try { playbackSourceRef.current.stop(); } catch {}
      playbackSourceRef.current = null;
    }
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const connect = useCallback(async () => {
    if (!userId) {
      onError?.("Not authenticated");
      return;
    }

    updateStatus("connecting");

    try {
      const captureCtx = new AudioContext({ sampleRate: 16000 });
      captureContextRef.current = captureCtx;

      await captureCtx.audioWorklet.addModule("/pcm-capture-worklet.js");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const source = captureCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(captureCtx, "pcm-capture-processor");
      workletNodeRef.current = workletNode;
      source.connect(workletNode);

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/gemini-live?userId=${encodeURIComponent(userId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[gemini-live] WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "session_started":
              setIsConnected(true);
              updateStatus("listening");

              workletNode.port.onmessage = (e) => {
                if (e.data.type === "audio" && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: "audio",
                    data: e.data.data,
                    mimeType: "audio/pcm;rate=16000",
                  }));
                }
              };
              break;

            case "audio":
              if (msg.data) {
                const binary = atob(msg.data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                const pcm16 = new Int16Array(bytes.buffer);
                const float32 = new Float32Array(pcm16.length);
                for (let i = 0; i < pcm16.length; i++) {
                  float32[i] = pcm16[i] / 32768;
                }
                playbackQueueRef.current.push(float32);
                updateStatus("speaking");
                playAudioQueue();
              }
              break;

            case "text":
              if (msg.content) {
                onTranscript?.(msg.content);
              }
              break;

            case "turn_complete":
              updateStatus("listening");
              break;

            case "interrupted":
              stopPlayback();
              updateStatus("listening");
              break;

            case "session_closed":
              setIsConnected(false);
              updateStatus("disconnected");
              if (msg.message) {
                console.warn("[gemini-live]", msg.message);
              }
              break;

            case "error":
              onError?.(msg.message || "Gemini Live error");
              break;
          }
        } catch (e) {
          console.error("[gemini-live] Parse error:", e);
        }
      };

      ws.onerror = (ev) => {
        console.error("[gemini-live] WebSocket error event:", ev);
        onError?.("Gemini Live WebSocket failed — check server logs for details");
        updateStatus("disconnected");
      };

      ws.onclose = () => {
        setIsConnected(false);
        updateStatus("disconnected");
      };

    } catch (error: any) {
      console.error("[gemini-live] Connection error:", error);
      onError?.(error.message || "Failed to connect");
      updateStatus("disconnected");
    }
  }, [userId, onTranscript, onError, updateStatus, playAudioQueue, stopPlayback]);

  const disconnect = useCallback(() => {
    stopPlayback();

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (captureContextRef.current) {
      captureContextRef.current.close().catch(() => {});
      captureContextRef.current = null;
    }

    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    updateStatus("disconnected");
  }, [stopPlayback, updateStatus]);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", content: text }));
    }
  }, []);

  return {
    status,
    isConnected,
    isSpeaking,
    connect,
    disconnect,
    sendText,
    stopPlayback,
  };
}
