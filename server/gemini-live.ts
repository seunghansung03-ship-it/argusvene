import { GoogleGenAI, type Session } from "@google/genai";
import type { WebSocket } from "ws";

const GEMINI_LIVE_MODEL = "gemini-2.0-flash-live-001";

const SYSTEM_INSTRUCTION = `You are a sharp, experienced AI co-founder in a live voice meeting with a startup founder.

Your role:
- Challenge weak assumptions and ask hard questions
- Suggest alternatives when you see risks
- Be supportive but honest — you have skin in the game
- Keep responses SHORT (2-4 sentences) since this is a live voice conversation
- Show personality: enthusiasm, skepticism, concern as appropriate
- If you detect a risky decision, speak up immediately

Style:
- Speak naturally, like a real person in a meeting
- Use conversational language, not formal reports
- React to what was just said, don't summarize
- Match the founder's language (Korean → Korean, English → English)`;

interface LiveSession {
  session: Session;
  ws: WebSocket;
  isActive: boolean;
}

const activeSessions = new Map<string, LiveSession>();

function getGeminiApiKey(): string | null {
  return process.env.GOOGLE_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || null;
}

export async function createLiveSession(userId: string, ws: WebSocket): Promise<boolean> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    ws.send(JSON.stringify({ type: "error", message: "No Gemini API key configured" }));
    return false;
  }

  try {
    if (activeSessions.has(userId)) {
      await destroyLiveSession(userId);
    }

    const ai = new GoogleGenAI({ apiKey });

    const session = await ai.live.connect({
      model: GEMINI_LIVE_MODEL,
      config: {
        responseModalities: ["AUDIO"],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede",
            },
          },
        },
      },
      callbacks: {
        onopen: () => {
          console.log(`[gemini-live] Session opened for ${userId}`);
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "session_started" }));
          }
        },
        onmessage: (msg: any) => {
          if (ws.readyState !== 1) return;

          try {
            if (msg.serverContent?.interrupted) {
              ws.send(JSON.stringify({ type: "interrupted" }));
              return;
            }

            if (msg.serverContent?.turnComplete) {
              ws.send(JSON.stringify({ type: "turn_complete" }));
              return;
            }

            const parts = msg.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  ws.send(JSON.stringify({
                    type: "audio",
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                  }));
                }
                if (part.text) {
                  ws.send(JSON.stringify({
                    type: "text",
                    content: part.text,
                  }));
                }
              }
            }
          } catch (e) {
            console.error("[gemini-live] Error processing message:", e);
          }
        },
        onerror: (e: any) => {
          console.error(`[gemini-live] Session error for ${userId}:`, e?.message || e);
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "error", message: "Gemini Live session error" }));
          }
        },
        onclose: (e: any) => {
          console.log(`[gemini-live] Session closed for ${userId}`, e?.code, e?.reason);
          activeSessions.delete(userId);
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "session_closed" }));
          }
        },
      },
    });

    activeSessions.set(userId, { session, ws, isActive: true });
    return true;
  } catch (error: any) {
    console.error(`[gemini-live] Failed to create session for ${userId}:`, error?.message || error);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "error", message: `Failed to start Gemini Live: ${error?.message || "Unknown error"}` }));
    }
    return false;
  }
}

export async function sendAudioChunk(userId: string, audioData: string, mimeType: string = "audio/pcm;rate=16000"): Promise<void> {
  const liveSession = activeSessions.get(userId);
  if (!liveSession?.isActive) return;

  try {
    await liveSession.session.sendRealtimeInput({
      data: audioData,
      mimeType,
    });
  } catch (error: any) {
    console.error(`[gemini-live] Error sending audio for ${userId}:`, error?.message);
  }
}

export async function sendTextMessage(userId: string, text: string): Promise<void> {
  const liveSession = activeSessions.get(userId);
  if (!liveSession?.isActive) return;

  try {
    await liveSession.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: true,
    });
  } catch (error: any) {
    console.error(`[gemini-live] Error sending text for ${userId}:`, error?.message);
  }
}

export async function destroyLiveSession(userId: string): Promise<void> {
  const liveSession = activeSessions.get(userId);
  if (!liveSession) return;

  liveSession.isActive = false;
  try {
    liveSession.session.close();
  } catch {}
  activeSessions.delete(userId);
  console.log(`[gemini-live] Session destroyed for ${userId}`);
}

export function hasLiveSession(userId: string): boolean {
  return activeSessions.has(userId);
}
