import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

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
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
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
  const ai = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
  });

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
        model: "gemini-2.5-flash",
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
        model: "gemini-2.5-flash",
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
        model: "gemini-2.5-flash",
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

const clients: Record<AIProvider, AIClient> = {
  openai: createOpenAIClient(),
  gemini: createGeminiClient(),
};

let defaultProvider: AIProvider = "openai";

export function setDefaultProvider(provider: AIProvider) {
  defaultProvider = provider;
}

export function getDefaultProvider(): AIProvider {
  return defaultProvider;
}

export function getAIClient(provider?: AIProvider): AIClient {
  return clients[provider || defaultProvider];
}

export function getAvailableProviders(): { id: AIProvider; name: string; available: boolean }[] {
  return [
    {
      id: "openai",
      name: "OpenAI (GPT-5.2)",
      available: !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL),
    },
    {
      id: "gemini",
      name: "Google Gemini (2.5 Flash)",
      available: !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL),
    },
  ];
}
