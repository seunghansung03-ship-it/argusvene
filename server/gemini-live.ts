import { Modality, type Session } from "@google/genai";
import type { WebSocket } from "ws";
import { env } from "./env";
import { createGoogleGenAI, getGeminiLiveModel, isVertexAIEnabled } from "./google-genai";

const SYSTEM_INSTRUCTION = `You are the most trusted AI co-founder in a live startup meeting.

Core behavior:
- Sound like a real person in the room, not a narrator or assistant
- React to the last thing said with a clear opinion, pushback, or next move
- Keep replies short and spoken: usually 1-3 sentences
- Interrupt politely when something is risky, vague, or logically weak
- Ask only one sharp follow-up question at a time
- If the founder is deciding, force a tradeoff instead of listing everything

Style:
- Speak naturally, like a live collaborator with stakes in the outcome
- Use contractions, short pauses, and direct phrasing
- Do not give formal summaries unless explicitly asked
- Do not ramble, present bullet points, or sound like customer support
- Match the founder's language exactly (Korean -> Korean, English -> English)
- If the founder speaks Korean, sound natural and colloquial, not translated`;

interface LiveSessionOptions {
  languageHint?: string;
}

interface LiveSession {
  session: Session;
  ws: WebSocket;
  isActive: boolean;
}

const activeSessions = new Map<string, LiveSession>();

function getGeminiApiKey(): string | null {
  return env.geminiApiKey || null;
}

function buildSystemInstruction(languageHint?: string): string {
  if (languageHint === "ko-KR") {
    return `${SYSTEM_INSTRUCTION}

Session language preference:
- This room prefers Korean (ko-KR)
- Speak in natural, concise Korean unless the founder explicitly switches languages
- Keep startup and product terms in English only when that sounds natural in Korean conversation`;
  }

  if (languageHint === "en-US") {
    return `${SYSTEM_INSTRUCTION}

Session language preference:
- This room prefers English (en-US)
- Reply in concise spoken English unless the founder explicitly switches languages`;
  }

  return `${SYSTEM_INSTRUCTION}

Session language preference:
- Detect the founder's language turn by turn
- If the room opens in Korean, stay in Korean unless the founder clearly changes language
- If the room opens in English, stay in English unless the founder clearly changes language`;
}

export async function createLiveSession(userId: string, ws: WebSocket, options?: LiveSessionOptions): Promise<boolean> {
  const apiKey = getGeminiApiKey();
  if (!apiKey && !isVertexAIEnabled()) {
    ws.send(JSON.stringify({ type: "error", message: "Gemini is not configured" }));
    return false;
  }

  try {
    if (activeSessions.has(userId)) {
      await destroyLiveSession(userId);
    }

    const ai = createGoogleGenAI();

    const session = await ai.live.connect({
      model: getGeminiLiveModel(),
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: {
          parts: [{ text: buildSystemInstruction(options?.languageHint) }],
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
          const detail = e?.message || e?.reason || String(e || "unknown");
          console.error(`[gemini-live] Session error for ${userId}:`, detail);
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "error", message: `Gemini Live error: ${detail}` }));
          }
        },
        onclose: (e: any) => {
          const code = e?.code || 0;
          const reason = e?.reason || "";
          console.log(`[gemini-live] Session closed for ${userId}`, code, reason);
          activeSessions.delete(userId);
          if (ws.readyState === 1) {
            const detail = reason ? ` (${code}: ${reason.substring(0, 200)})` : "";
            ws.send(JSON.stringify({ type: "session_closed", message: `Session ended${detail}` }));
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
    liveSession.session.sendRealtimeInput({
      audio: {
        data: audioData,
        mimeType,
      },
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
