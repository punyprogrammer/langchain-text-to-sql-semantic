import type { HitlDecision, SseEvent } from "../types/chat";
import { readSseStream } from "./sse";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

interface StreamChatOptions {
  message?: string;
  threadId?: string;
  hitlDecision?: HitlDecision;
  onEvent: (event: SseEvent) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  message,
  threadId,
  hitlDecision,
  onEvent,
  signal,
}: StreamChatOptions): Promise<void> {
  const body: Record<string, string> = {};

  if (message) {
    body.message = message;
  }

  if (threadId) {
    body.thread_id = threadId;
  }

  if (hitlDecision) {
    body.hitl_decision = hitlDecision;
  }

  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(responseBody || `Request failed (${response.status})`);
  }

  await readSseStream(response, onEvent);
}
