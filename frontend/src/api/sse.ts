import type { SseEvent, SseEventType } from "../types/chat";

export function parseSseChunk(buffer: string): {
  events: SseEvent[];
  remainder: string;
} {
  const events: SseEvent[] = [];
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    if (!part.trim()) continue;

    const eventLine = part.match(/^event: (.+)$/m)?.[1] as
      | SseEventType
      | undefined;
    const dataLine = part.match(/^data: (.+)$/m)?.[1];

    if (!eventLine || !dataLine) continue;

    try {
      events.push({
        type: eventLine,
        data: JSON.parse(dataLine) as Record<string, unknown>,
      });
    } catch {
      // skip malformed chunks
    }
  }

  return { events, remainder };
}

export async function readSseStream(
  response: Response,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.remainder;

    for (const event of parsed.events) {
      onEvent(event);
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseChunk(`${buffer}\n\n`);
    for (const event of parsed.events) {
      onEvent(event);
    }
  }
}
