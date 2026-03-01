import { storage } from "./storage";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = "https://api.elevenlabs.io/v1";

const DEFAULT_VOICE_MAP: Record<string, string> = {
  "Atlas": "CwhRBWXzGAHq8TQ4Fs17",
  "Nova": "EXAVITQu4vr4xnSDxMaL",
  "Sage": "cjVigY5qzO86Huf0OWal",
  "Pixel": "iP95p4xoKVk53GoZ742B",
  "co-founder": "JBFqnCBsd6RMkjVDRZzb",
};

const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

export async function getVoiceIdForAgent(agentName: string): Promise<string> {
  const agents = await storage.getAgentPersonas();
  const agent = agents.find(a => a.name === agentName);
  if (agent?.voiceId) return agent.voiceId;
  return DEFAULT_VOICE_MAP[agentName] || DEFAULT_VOICE;
}

export function isElevenLabsAvailable(): boolean {
  return !!ELEVENLABS_API_KEY;
}

export async function fetchElevenLabsVoices(): Promise<{ voice_id: string; name: string; labels: Record<string, string> }[]> {
  if (!ELEVENLABS_API_KEY) return [];

  try {
    const response = await fetch(`${BASE_URL}/voices`, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      labels: v.labels || {},
    }));
  } catch {
    return [];
  }
}

export async function synthesizeSpeech(
  text: string,
  agentName: string,
  overrideVoiceId?: string
): Promise<Buffer | null> {
  if (!ELEVENLABS_API_KEY) return null;

  const voiceId = overrideVoiceId || await getVoiceIdForAgent(agentName);

  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/[`~]/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();

  if (!cleaned) return null;

  const maxLen = 1000;
  const truncated = cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;

  try {
    const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: truncated,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.65,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      console.error("ElevenLabs API error:", response.status, await response.text());
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("ElevenLabs synthesis error:", error);
    return null;
  }
}

export async function getAvailableVoices(): Promise<{ agentName: string; voiceId: string }[]> {
  const agents = await storage.getAgentPersonas();
  return agents.map(a => ({
    agentName: a.name,
    voiceId: a.voiceId || DEFAULT_VOICE_MAP[a.name] || DEFAULT_VOICE,
  }));
}
