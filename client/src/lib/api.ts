import { apiRequest } from "./queryClient";

let getUserId: (() => string | null) | null = null;

export function setUserIdGetter(fn: () => string | null) {
  getUserId = fn;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const uid = getUserId?.();
  if (uid) {
    headers["x-user-id"] = uid;
  }
  return headers;
}

export async function streamChat(
  url: string,
  body: any,
  onChunk: (data: any) => void,
  onDone?: () => void,
  signal?: AbortSignal
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) throw new Error("Request failed");

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          onChunk(parsed);
        } catch {}
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      return;
    }
    throw err;
  }

  onDone?.();
}
