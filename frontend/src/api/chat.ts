import type { SseEvent } from "../types/chat";
import { readSseStream } from "./sse";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export async function streamChat(
  message: string,
  threadId: string | undefined,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      ...(threadId ? { thread_id: threadId } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed (${response.status})`);
  }

  await readSseStream(response, onEvent);
}
