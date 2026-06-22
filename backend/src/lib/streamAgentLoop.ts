import type { UsageMetadata } from "@langchain/core/messages";
import type { Response } from "express";
import {
  estimateTokens,
  logLlmUsage,
  logToolCallError,
  logToolCallResult,
  logToolCallStart,
  serializePayload,
} from "./agentStreamLogger.js";
import { sendSseEvent } from "./sse.js";

export interface TokenCounts {
  input: number;
  output: number;
  total: number;
}

export interface LoopTokenUsage {
  tool: TokenCounts;
  llm: TokenCounts;
  combined: TokenCounts;
}

export function createEmptyLoopUsage(): LoopTokenUsage {
  const empty = { input: 0, output: 0, total: 0 };
  return { tool: { ...empty }, llm: { ...empty }, combined: { ...empty } };
}

export function getPayloadTokenCount(value: unknown): number {
  return estimateTokens(serializePayload(value));
}

function addCounts(a: TokenCounts, b: TokenCounts): TokenCounts {
  const input = a.input + b.input;
  const output = a.output + b.output;
  return { input, output, total: input + output };
}

export function buildLoopUsage(tracker: {
  toolInput: number;
  toolOutput: number;
  llmInput: number;
  llmOutput: number;
}): LoopTokenUsage {
  const tool = {
    input: tracker.toolInput,
    output: tracker.toolOutput,
    total: tracker.toolInput + tracker.toolOutput,
  };
  const llm = {
    input: tracker.llmInput,
    output: tracker.llmOutput,
    total: tracker.llmInput + tracker.llmOutput,
  };
  return {
    tool,
    llm,
    combined: addCounts(tool, llm),
  };
}

export async function trackLlmMessageUsageWithEvents(
  tag: string,
  messages: AsyncIterable<{ usage: PromiseLike<UsageMetadata | undefined> }>,
  res: Response,
  tracker: { llmInput: number; llmOutput: number },
): Promise<void> {
  for await (const message of messages) {
    try {
      const usage = await message.usage;
      if (!usage) continue;

      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

      tracker.llmInput += inputTokens;
      tracker.llmOutput += outputTokens;

      logLlmUsage(tag, usage);
      sendSseEvent(res, "llm_usage", {
        inputTokens,
        outputTokens,
        totalTokens,
      });
    } catch {
      // ignore per-message usage failures
    }
  }
}

interface StreamToolCallsOptions {
  tag: string;
  res: Response;
  signal: AbortSignal;
  toolCalls: AsyncIterable<{
    name: string;
    callId: string;
    input: unknown;
    output: Promise<unknown>;
  }>;
  tracker: { toolInput: number; toolOutput: number };
}

export async function streamToolCallsWithUsage({
  tag,
  res,
  signal,
  toolCalls,
  tracker,
}: StreamToolCallsOptions): Promise<void> {
  for await (const call of toolCalls) {
    if (signal.aborted) return;

    const inputTokens = getPayloadTokenCount(call.input);
    tracker.toolInput += inputTokens;

    logToolCallStart(tag, call.name, call.callId, call.input);
    sendSseEvent(res, "tool_start", {
      name: call.name,
      callId: call.callId,
      input: call.input,
      inputTokens,
    });

    try {
      const output = await call.output;
      const outputTokens = getPayloadTokenCount(output);
      tracker.toolOutput += outputTokens;

      logToolCallResult(tag, call.name, call.callId, output);
      sendSseEvent(res, "tool_result", {
        name: call.name,
        callId: call.callId,
        output,
        outputTokens,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool failed";
      const outputTokens = getPayloadTokenCount(message);
      tracker.toolOutput += outputTokens;

      logToolCallError(tag, call.name, call.callId, message);
      sendSseEvent(res, "tool_error", {
        name: call.name,
        callId: call.callId,
        message,
        outputTokens,
      });
    }
  }
}
