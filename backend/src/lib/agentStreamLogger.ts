import type { UsageMetadata } from "@langchain/core/messages";

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function serializePayload(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function logToolCallStart(
  tag: string,
  name: string,
  callId: string,
  input: unknown,
): void {
  const serialized = serializePayload(input);
  console.log(
    `[${tag}] tool_start name=${name} callId=${callId} inputTokens≈${estimateTokens(serialized)} inputChars=${serialized.length}`,
  );
}

export function logToolCallResult(
  tag: string,
  name: string,
  callId: string,
  output: unknown,
): void {
  const serialized = serializePayload(output);
  console.log(
    `[${tag}] tool_result name=${name} callId=${callId} outputTokens≈${estimateTokens(serialized)} outputChars=${serialized.length}`,
  );
}

export function logToolCallError(
  tag: string,
  name: string,
  callId: string,
  message: string,
): void {
  console.log(
    `[${tag}] tool_error name=${name} callId=${callId} outputTokens≈${estimateTokens(message)} message=${message}`,
  );
}

export function logLlmUsage(tag: string, usage: UsageMetadata): void {
  console.log(
    `[${tag}] llm_usage input_tokens=${usage.input_tokens ?? 0} output_tokens=${usage.output_tokens ?? 0} total_tokens=${usage.total_tokens ?? 0}`,
  );
}

export async function trackLlmMessageUsage(
  tag: string,
  messages: AsyncIterable<{ usage: PromiseLike<UsageMetadata | undefined> }>,
): Promise<void> {
  for await (const message of messages) {
    try {
      const usage = await message.usage;
      if (usage) {
        logLlmUsage(tag, usage);
      }
    } catch {
      // ignore per-message usage failures
    }
  }
}
