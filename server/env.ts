import "dotenv/config";

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = normalize(process.env[key]);
    if (value) return value;
  }
  return undefined;
}

export function requireEnv(primaryKey: string, ...aliases: string[]): string {
  const value = getEnv(primaryKey, ...aliases);
  if (value) return value;

  const checkedKeys = [primaryKey, ...aliases].join(", ");
  throw new Error(`Missing required environment variable. Checked: ${checkedKeys}`);
}

export const env = {
  get nodeEnv(): string {
    return getEnv("NODE_ENV") || "development";
  },
  get port(): number {
    return Number.parseInt(getEnv("PORT") || "5000", 10);
  },
  get databaseUrl(): string {
    return requireEnv("DATABASE_URL");
  },
  get geminiApiKey(): string | undefined {
    return getEnv("GOOGLE_API_KEY");
  },
  get geminiBaseUrl(): string | undefined {
    return getEnv("GEMINI_BASE_URL");
  },
  get useVertexAI(): boolean {
    return getEnv("GOOGLE_GENAI_USE_VERTEXAI") === "true";
  },
  get googleCloudProject(): string | undefined {
    return getEnv("GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT");
  },
  get googleCloudLocation(): string {
    return getEnv("GOOGLE_CLOUD_LOCATION") || "us-central1";
  },
  get openAIApiKey(): string | undefined {
    return getEnv("OPENAI_API_KEY");
  },
  get openAIBaseUrl(): string | undefined {
    return getEnv("OPENAI_BASE_URL");
  },
  get elevenLabsApiKey(): string | undefined {
    return getEnv("ELEVENLABS_API_KEY");
  },
  get chromiumExecutablePath(): string | undefined {
    return getEnv("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH");
  },
};
