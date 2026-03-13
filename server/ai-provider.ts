import OpenAI from "openai";
import { env } from "./env";
import { createGoogleGenAI, getGeminiTextModel, isVertexAIEnabled } from "./google-genai";

export type AIProvider = "openai" | "gemini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  content: string;
}

export interface AIClient {
  provider: AIProvider;
  chat(messages: ChatMessage[], maxTokens?: number): Promise<string>;
  chatStream(messages: ChatMessage[], maxTokens?: number): AsyncIterable<StreamChunk>;
  chatJSON(messages: ChatMessage[], maxTokens?: number): Promise<string>;
}

function createOpenAIClient(): AIClient {
  const openai = new OpenAI({
    apiKey: env.openAIApiKey,
    baseURL: env.openAIBaseUrl,
  });

  return {
    provider: "openai",

    async chat(messages, maxTokens = 8192) {
      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages,
        max_completion_tokens: maxTokens,
      });
      return response.choices[0]?.message?.content || "";
    },

    async *chatStream(messages, maxTokens = 8192) {
      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages,
        stream: true,
        max_completion_tokens: maxTokens,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          yield { content };
        }
      }
    },

    async chatJSON(messages, maxTokens = 8192) {
      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
      });
      return response.choices[0]?.message?.content || "{}";
    },
  };
}

function createGeminiClient(): AIClient {
  const ai = createGoogleGenAI();

  if (process.env.GOOGLE_API_KEY) {
    console.log("[AI] Using local GOOGLE_API_KEY for Gemini");
  } else if (isVertexAIEnabled()) {
    console.log(`[AI] Using Vertex AI for Gemini in ${env.googleCloudLocation}`);
  }

  function toGeminiMessages(messages: ChatMessage[]) {
    const systemInstruction = messages
      .filter(m => m.role === "system")
      .map(m => m.content)
      .join("\n\n");

    const contents = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: m.content }],
      }));

    return { systemInstruction, contents };
  }

  return {
    provider: "gemini",

    async chat(messages, maxTokens = 8192) {
      const { systemInstruction, contents } = toGeminiMessages(messages);
      const response = await ai.models.generateContent({
        model: getGeminiTextModel(),
        contents,
        config: {
          maxOutputTokens: maxTokens,
          systemInstruction: systemInstruction || undefined,
        },
      });
      return response.text || "";
    },

    async *chatStream(messages, maxTokens = 8192) {
      const { systemInstruction, contents } = toGeminiMessages(messages);
      const stream = await ai.models.generateContentStream({
        model: getGeminiTextModel(),
        contents,
        config: {
          maxOutputTokens: maxTokens,
          systemInstruction: systemInstruction || undefined,
        },
      });

      for await (const chunk of stream) {
        const content = chunk.text || "";
        if (content) {
          yield { content };
        }
      }
    },

    async chatJSON(messages, maxTokens = 8192) {
      const { systemInstruction, contents } = toGeminiMessages(messages);
      const response = await ai.models.generateContent({
        model: getGeminiTextModel(),
        contents,
        config: {
          maxOutputTokens: maxTokens,
          systemInstruction: systemInstruction || undefined,
          responseMimeType: "application/json",
        },
      });
      return response.text || "{}";
    },
  };
}

let defaultProvider: AIProvider = "gemini";

export function setDefaultProvider(provider: AIProvider) {
  defaultProvider = "gemini";
}

export function getDefaultProvider(): AIProvider {
  return "gemini";
}

export function getAIClient(provider?: AIProvider): AIClient {
  return createGeminiClient();
}

export function getAvailableProviders(): { id: AIProvider; name: string; available: boolean }[] {
  return [
    {
      id: "gemini",
      name: "Google Gemini 2.5 Flash",
      available: true,
    },
  ];
}
