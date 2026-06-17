import type { Response } from "express";
import textToSqlAgent from "../agents/textToSqlAgent.js";
import { getDb } from "../db/db.js";
import { initSse, sendSseEvent } from "../lib/sse.js";

const SUMMARY_TOKEN_CHUNK_SIZE = 4;

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
  res: Response,
  signal: AbortSignal,
): Promise<void> {
  initSse(res);
  sendSseEvent(res, "started", {});

  try {
    const db = await getDb();

    const run = await textToSqlAgent.streamEvents(
      { messages: [{ role: "user", content: message }] },
      { version: "v3", context: { db }, signal },
    );

    const streamToolCalls = async () => {
      for await (const call of run.toolCalls) {
        if (signal.aborted) return;

        sendSseEvent(res, "tool_start", {
          name: call.name,
          callId: call.callId,
          input: call.input,
        });

        try {
          const output = await call.output;
          sendSseEvent(res, "tool_result", {
            name: call.name,
            callId: call.callId,
            output,
          });
        } catch (error) {
          sendSseEvent(res, "tool_error", {
            name: call.name,
            callId: call.callId,
            message: error instanceof Error ? error.message : "Tool failed",
          });
        }
      }
    };

    await streamToolCalls();

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

    sendSseEvent(res, "done", { summary });
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
