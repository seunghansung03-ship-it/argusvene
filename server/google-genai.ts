import { GoogleGenAI } from "@google/genai";
import { env, requireEnv } from "./env";

export function isVertexAIEnabled(): boolean {
  if (env.useVertexAI) return true;
  return !env.geminiApiKey && Boolean(env.googleCloudProject);
}

export function createGoogleGenAI(): GoogleGenAI {
  if (env.geminiApiKey) {
    return new GoogleGenAI({
      apiKey: env.geminiApiKey,
      ...(env.geminiBaseUrl
        ? {
            httpOptions: {
              apiVersion: "",
              baseUrl: env.geminiBaseUrl,
            },
          }
        : {}),
    });
  }

  if (isVertexAIEnabled()) {
    return new GoogleGenAI({
      vertexai: true,
      project: requireEnv("GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"),
      location: env.googleCloudLocation,
    });
  }

  throw new Error(
    "Missing Gemini credentials. Set GOOGLE_API_KEY or configure Vertex AI with GOOGLE_GENAI_USE_VERTEXAI=true and GOOGLE_CLOUD_PROJECT.",
  );
}

export function getGeminiTextModel(): string {
  return "gemini-2.5-flash";
}

export function getGeminiLiveModel(): string {
  return isVertexAIEnabled()
    ? "gemini-live-2.5-flash-preview-native-audio-09-2025"
    : "gemini-2.5-flash-native-audio-preview-12-2025";
}
