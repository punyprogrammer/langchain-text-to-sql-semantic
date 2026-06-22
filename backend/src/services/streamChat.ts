import type { Response } from "express";
import { Command } from "@langchain/langgraph";
import type { HITLRequest } from "langchain";
import textToSqlAgent from "../agents/textToSqlAgent.js";
import { getDb } from "../db/db.js";
import {
  buildLoopUsage,
  streamToolCallsWithUsage,
  trackLlmMessageUsageWithEvents,
} from "../lib/streamAgentLoop.js";
import { initSse, sendSseEvent } from "../lib/sse.js";

const SUMMARY_TOKEN_CHUNK_SIZE = 4;
const LOG_TAG = "chat";
const REJECT_MESSAGE = "SQL execution was rejected by the user.";

type HitlDecision = "approve" | "reject";

type AgentStreamInput =
  | { messages: Array<{ role: "user"; content: string }> }
  | Command;

async function streamSummaryTokens(
  summary: string,
  res: Response,
  signal: AbortSignal,
): Promise<void> {
  for (let i = 0; i < summary.length; i += SUMMARY_TOKEN_CHUNK_SIZE) {
    if (signal.aborted) return;

    sendSseEvent(res, "token", {
      summary: summary.slice(i, i + SUMMARY_TOKEN_CHUNK_SIZE),
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function extractSummary(finalState: Record<string, unknown>): string {
  const structuredResponse = finalState.structuredResponse as
    | { summary?: string }
    | undefined;

  return typeof structuredResponse?.summary === "string"
    ? structuredResponse.summary
    : "";
}

async function runAgentStream(
  input: AgentStreamInput,
  threadId: string,
  res: Response,
  signal: AbortSignal,
  usageTracker: {
    toolInput: number;
    toolOutput: number;
    llmInput: number;
    llmOutput: number;
  },
  options?: { abortAfterResume?: boolean },
): Promise<{ interrupted: boolean; summary: string }> {
  const db = await getDb();

  const run = await textToSqlAgent.streamEvents(input, {
    version: "v3",
    context: { db },
    signal,
    configurable: { thread_id: threadId },
  });

  if (options?.abortAfterResume) {
    run.abort(REJECT_MESSAGE);
  }

  await Promise.all([
    streamToolCallsWithUsage({
      tag: LOG_TAG,
      res,
      signal,
      toolCalls: run.toolCalls,
      tracker: usageTracker,
    }),
    trackLlmMessageUsageWithEvents(LOG_TAG, run.messages, res, usageTracker),
  ]);

  if (signal.aborted) {
    return { interrupted: false, summary: "" };
  }

  if (run.interrupted) {
    const interrupt = run.interrupts[0];
    const hitlRequest = interrupt.payload as HITLRequest;

    sendSseEvent(res, "approval_required", {
      interruptId: interrupt.interruptId,
      actionRequests: hitlRequest.actionRequests,
      reviewConfigs: hitlRequest.reviewConfigs,
    });

    return { interrupted: true, summary: "" };
  }

  const finalState = (await run.output) as Record<string, unknown>;
  return { interrupted: false, summary: extractSummary(finalState) };
}

function buildHitlResume(decision: HitlDecision) {
  if (decision === "approve") {
    return { decisions: [{ type: "approve" as const }] };
  }

  return {
    decisions: [{ type: "reject" as const, message: REJECT_MESSAGE }],
  };
}

export async function streamChatResponse(
  options: {
    message?: string;
    threadId: string;
    hitlDecision?: HitlDecision;
  },
  res: Response,
  signal: AbortSignal,
): Promise<void> {
  initSse(res);
  sendSseEvent(res, "started", { thread_id: options.threadId });

  const usageTracker = {
    toolInput: 0,
    toolOutput: 0,
    llmInput: 0,
    llmOutput: 0,
  };

  try {
    let input: AgentStreamInput;

    if (options.hitlDecision) {
      input = new Command({ resume: buildHitlResume(options.hitlDecision) });
    } else if (options.message) {
      input = { messages: [{ role: "user", content: options.message }] };
    } else {
      sendSseEvent(res, "error", { message: "message is required" });
      return;
    }

    const result = await runAgentStream(
      input,
      options.threadId,
      res,
      signal,
      usageTracker,
      options.hitlDecision === "reject"
        ? { abortAfterResume: true }
        : undefined,
    );

    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    if (result.interrupted) {
      sendSseEvent(res, "awaiting_approval", {});
      return;
    }

    if (options.hitlDecision === "reject") {
      const summary = REJECT_MESSAGE;
      sendSseEvent(res, "rejected", { message: summary });
      sendSseEvent(res, "done", {
        summary,
        usage: buildLoopUsage(usageTracker),
      });
      return;
    }

    await streamSummaryTokens(result.summary, res, signal);

    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    sendSseEvent(res, "done", {
      summary: result.summary,
      usage: buildLoopUsage(usageTracker),
    });
  } catch (error) {
    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    sendSseEvent(res, "error", {
      message: error instanceof Error ? error.message : "Stream failed",
    });
    console.error("[chat] stream error:", error);
  } finally {
    res.end();
  }
}
