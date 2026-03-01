import { apiRequest } from "./queryClient";

export async function streamChat(
  url: string,
  body: any,
  onChunk: (data: any) => void,
  onDone?: () => void
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error("Request failed");

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No body");

  const decoder = new TextDecoder();
  let buffer = "";

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

  onDone?.();
}
