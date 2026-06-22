import type { Response } from "express";
import dataQualityAgent from "../agents/dataQualityAgent.js";
import { getDb } from "../db/db.js";
import {
  buildLoopUsage,
  streamToolCallsWithUsage,
  trackLlmMessageUsageWithEvents,
} from "../lib/streamAgentLoop.js";
import { initSse, sendSseEvent } from "../lib/sse.js";
import type { ToolProgressUpdate } from "../types/dataQualityContext.js";

const REPORT_TOKEN_CHUNK_SIZE = 4;
const RECURSION_LIMIT = 75;
const LOG_TAG = "data-quality";

async function streamReportTokens(
  report: string,
  res: Response,
  signal: AbortSignal,
): Promise<void> {
  for (let i = 0; i < report.length; i += REPORT_TOKEN_CHUNK_SIZE) {
    if (signal.aborted) return;

    sendSseEvent(res, "token", {
      report: report.slice(i, i + REPORT_TOKEN_CHUNK_SIZE),
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function buildAnalysisTask(schema: string): string {
  return `Run a full data-quality analysis on the PostgreSQL schema "${schema}".

Analyze every base table in the schema. Start by calling create_analysis_plan, then use scan_tables once for all tables, batch all SQL checks into run_quality_checks, and produce a complete markdown report.`;
}

export async function streamDataQualityAnalysis(
  schema: string,
  res: Response,
  signal: AbortSignal,
): Promise<void> {
  initSse(res);
  sendSseEvent(res, "started", { schema });

  let activeCallId: string | null = null;
  const usageTracker = {
    toolInput: 0,
    toolOutput: 0,
    llmInput: 0,
    llmOutput: 0,
  };

  const onProgress = (update: ToolProgressUpdate) => {
    if (!activeCallId) return;

    sendSseEvent(res, "tool_progress", {
      callId: activeCallId,
      ...update,
    });
  };

  try {
    const db = await getDb();

    const run = await dataQualityAgent.streamEvents(
      { messages: [{ role: "user", content: buildAnalysisTask(schema) }] },
      {
        version: "v3",
        context: { db, onProgress },
        signal,
        recursionLimit: RECURSION_LIMIT,
      },
    );

    const streamToolCalls = async () => {
      for await (const call of run.toolCalls) {
        if (signal.aborted) return;

        activeCallId = call.callId;

        await streamToolCallsWithUsage({
          tag: LOG_TAG,
          res,
          signal,
          toolCalls: (async function* () {
            yield call;
          })(),
          tracker: usageTracker,
        });

        activeCallId = null;
      }
    };

    await Promise.all([
      streamToolCalls(),
      trackLlmMessageUsageWithEvents(LOG_TAG, run.messages, res, usageTracker),
    ]);

    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    const finalState = await run.output;
    const structuredResponse = finalState.structuredResponse as
      | { report?: string }
      | undefined;
    const report =
      typeof structuredResponse?.report === "string"
        ? structuredResponse.report
        : "";

    await streamReportTokens(report, res, signal);

    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    sendSseEvent(res, "done", {
      report,
      usage: buildLoopUsage(usageTracker),
    });
  } catch (error) {
    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    sendSseEvent(res, "error", {
      message: error instanceof Error ? error.message : "Analysis failed",
    });
    console.error("[data-quality] stream error:", error);
  } finally {
    res.end();
  }
}
