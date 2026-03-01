const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = "https://api.elevenlabs.io/v1";

const AGENT_VOICE_MAP: Record<string, string> = {
  "Atlas": "onwK4e9ZLuTAKqWW03F9",
  "Nova": "Xb7hH8MSUJpSbSDYk0k2",
  "Sage": "cjVigY5qzO86Huf0OWal",
  "Pixel": "cgSgspJ2msm6clMCkdW9",
  "co-founder": "JBFqnCBsd6RMkjVDRZzb",
};

const DEFAULT_VOICE = "nPczCjzI2devNBz1zQrb";

export function getVoiceIdForAgent(agentName: string): string {
  return AGENT_VOICE_MAP[agentName] || DEFAULT_VOICE;
}

export function isElevenLabsAvailable(): boolean {
  return !!ELEVENLABS_API_KEY;
}

export async function synthesizeSpeech(
  text: string,
  agentName: string
): Promise<Buffer | null> {
  if (!ELEVENLABS_API_KEY) return null;

  const voiceId = getVoiceIdForAgent(agentName);

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
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
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

export function getAvailableVoices(): { agentName: string; voiceId: string }[] {
  return Object.entries(AGENT_VOICE_MAP).map(([agentName, voiceId]) => ({
    agentName,
    voiceId,
  }));
}
