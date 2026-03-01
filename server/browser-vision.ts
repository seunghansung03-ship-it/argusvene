import { GoogleGenAI } from "@google/genai";
import type { BrowserAction } from "./browser-manager";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: { baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

const VISION_SYSTEM = `You are a browser automation agent. You see a screenshot of a web browser (1280x720 viewport).
The user wants you to accomplish a task on this webpage.

Analyze the screenshot and decide the NEXT SINGLE action to perform.

Respond ONLY with valid JSON in this exact format:
{
  "thinking": "Brief analysis of what you see and what to do next",
  "action": {
    "type": "click|type|scroll|press|back|forward|wait|done|navigate",
    "x": 640,
    "y": 360,
    "text": "text to type if type action",
    "key": "Enter",
    "deltaY": 300,
    "url": "https://example.com"
  },
  "status": "working|done|error",
  "summary": "Brief description of what was done or found"
}

Action types:
- click: Click at (x, y) coordinates on the page
- type: Click at (x, y) then type text. Always click the input field first
- scroll: Scroll the page. Positive deltaY = scroll down, negative = scroll up
- press: Press a keyboard key (Enter, Tab, Escape, etc.)
- back: Go back in browser history
- forward: Go forward in browser history
- wait: Wait for page to load
- done: Task is complete, provide summary of findings
- navigate: Go to a new URL

Important rules:
- Coordinates must be within 1280x720
- For clicking buttons/links, aim for the CENTER of the element
- If you see a login page and need credentials, set status to "error" with summary explaining what's needed
- When the task is complete, use action type "done" and provide findings in summary
- Be precise with click coordinates
- If a page is loading, use "wait" action
- Keep "thinking" brief (1-2 sentences max)`;

export interface VisionResult {
  thinking: string;
  action: BrowserAction & { type: string; url?: string };
  status: "working" | "done" | "error";
  summary: string;
}

export async function analyzeScreenshot(
  screenshotBase64: string,
  userCommand: string,
  history: string[] = []
): Promise<VisionResult> {
  const historyContext = history.length > 0
    ? `\n\nPrevious actions taken:\n${history.slice(-5).map((h, i) => `${i + 1}. ${h}`).join("\n")}`
    : "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: screenshotBase64,
              },
            },
            {
              text: `${VISION_SYSTEM}\n\nUser's task: ${userCommand}${historyContext}\n\nAnalyze this screenshot and provide the next action as JSON.`,
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    return {
      thinking: parsed.thinking || "",
      action: parsed.action || { type: "done" },
      status: parsed.status || "done",
      summary: parsed.summary || "",
    };
  } catch (e: any) {
    console.error("[browser-vision] Analysis error:", e.message);
    return {
      thinking: "Failed to analyze screenshot",
      action: { type: "done" },
      status: "error",
      summary: "Vision analysis failed: " + e.message,
    };
  }
}

export async function describeScreen(screenshotBase64: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: screenshotBase64,
              },
            },
            {
              text: "Briefly describe what you see on this web page in 2-3 sentences. Focus on the main content and any important data visible.",
            },
          ],
        },
      ],
      config: { maxOutputTokens: 256 },
    });
    return response.text || "Unable to describe the screen.";
  } catch (e: any) {
    return "Screen description unavailable.";
  }
}
