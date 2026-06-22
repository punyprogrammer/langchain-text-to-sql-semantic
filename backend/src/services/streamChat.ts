import type { Response } from "express";
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

export async function streamChatResponse(
  message: string,
  threadId: string,
  res: Response,
  signal: AbortSignal,
): Promise<void> {
  initSse(res);
  sendSseEvent(res, "started", { thread_id: threadId });

  const usageTracker = {
    toolInput: 0,
    toolOutput: 0,
    llmInput: 0,
    llmOutput: 0,
  };

  try {
    const db = await getDb();

    const run = await textToSqlAgent.streamEvents(
      { messages: [{ role: "user", content: message }] },
      {
        version: "v3",
        context: { db },
        signal,
        configurable: { thread_id: threadId },
      },
    );

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
      sendSseEvent(res, "cancelled", {});
      return;
    }

    const finalState = await run.output;
    const structuredResponse = finalState.structuredResponse as
      | { summary?: string }
      | undefined;
    const summary =
      typeof structuredResponse?.summary === "string"
        ? structuredResponse.summary
        : "";

    await streamSummaryTokens(summary, res, signal);

    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    sendSseEvent(res, "done", {
      summary,
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
