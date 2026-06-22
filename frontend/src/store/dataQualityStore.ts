import { create } from "zustand";
import { streamDataQualityAnalysis } from "../api/dataQuality";
import {
  applyToolTokenEvent,
  applyUsageEvent,
  createEmptyLoopUsage,
  logLoopUsage,
  logToolTokens,
} from "../lib/tokenUsage";
import type {
  LoopTokenUsage,
  SseEvent,
  StreamStatus,
  ToolCall,
  ToolCallProgress,
} from "../types/chat";

function createId(): string {
  return crypto.randomUUID();
}

function toDisplayText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value === "[object Object]" ? undefined : value;
  }

  return undefined;
}

export interface DataQualityRun {
  id: string;
  schema: string;
  report: string;
  toolCalls: ToolCall[];
  streamStatus: StreamStatus;
  error?: string;
  usage: LoopTokenUsage;
  createdAt: number;
}

interface DataQualityState {
  schema: string;
  run: DataQualityRun | null;
  isStreaming: boolean;
  abortController: AbortController | null;
  setSchema: (schema: string) => void;
  startAnalysis: () => Promise<void>;
  stopAnalysis: () => void;
  reset: () => void;
}

function handleSseEvent(run: DataQualityRun, event: SseEvent): DataQualityRun {
  switch (event.type) {
    case "started":
      return {
        ...run,
        schema: toDisplayText(event.data.schema) ?? run.schema,
        streamStatus: "streaming",
      };

    case "token": {
      const token = toDisplayText(event.data.report) ?? "";
      return {
        ...run,
        report: run.report + token,
        streamStatus: "streaming",
      };
    }

    case "tool_start": {
      const toolCall: ToolCall = {
        callId: String(event.data.callId ?? createId()),
        name: String(event.data.name ?? "tool"),
        input: event.data.input,
        status: "running",
        inputTokens: Number(event.data.inputTokens ?? 0) || undefined,
      };

      logToolTokens(
        "data-quality",
        toolCall.name,
        toolCall.callId,
        toolCall.inputTokens,
      );

      return {
        ...run,
        toolCalls: [...run.toolCalls, toolCall],
        streamStatus: "streaming",
        usage: applyUsageEvent(run.usage, event),
      };
    }

    case "tool_progress": {
      const callId = String(event.data.callId);
      const progress: ToolCallProgress = {
        label: String(event.data.label ?? "Working"),
        current: Number(event.data.current ?? 0),
        total: Number(event.data.total ?? 0),
        item:
          typeof event.data.item === "string" ? event.data.item : undefined,
      };

      return {
        ...run,
        toolCalls: run.toolCalls.map((tool) =>
          tool.callId === callId ? { ...tool, progress } : tool,
        ),
      };
    }

    case "tool_result": {
      const callId = String(event.data.callId);
      const outputTokens = Number(event.data.outputTokens ?? 0) || undefined;
      const toolCalls = applyToolTokenEvent(
        run.toolCalls.map((tool) =>
          tool.callId === callId
            ? {
                ...tool,
                output: event.data.output,
                status: "success" as const,
                progress: undefined,
              }
            : tool,
        ),
        event,
      );

      const tool = toolCalls.find((entry) => entry.callId === callId);
      if (tool) {
        logToolTokens(
          "data-quality",
          tool.name,
          tool.callId,
          tool.inputTokens,
          outputTokens,
        );
      }

      return {
        ...run,
        toolCalls,
        usage: applyUsageEvent(run.usage, event),
      };
    }

    case "tool_error": {
      const callId = String(event.data.callId);
      const toolCalls = applyToolTokenEvent(
        run.toolCalls.map((tool) =>
          tool.callId === callId
            ? {
                ...tool,
                error: String(event.data.message ?? "Tool failed"),
                status: "error" as const,
                progress: undefined,
              }
            : tool,
        ),
        event,
      );

      return {
        ...run,
        toolCalls,
        usage: applyUsageEvent(run.usage, event),
      };
    }

    case "llm_usage":
      return {
        ...run,
        usage: applyUsageEvent(run.usage, event),
      };

    case "done": {
      const finalReport = toDisplayText(event.data.report);
      const usage = applyUsageEvent(run.usage, event);
      logLoopUsage("data-quality", usage);
      return {
        ...run,
        report: finalReport ?? run.report,
        streamStatus: "done",
        usage,
      };
    }

    case "error":
      return {
        ...run,
        streamStatus: "error",
        error: String(event.data.message ?? "Analysis failed"),
      };

    case "cancelled":
      return { ...run, streamStatus: "cancelled" };

    default:
      return run;
  }
}

export const useDataQualityStore = create<DataQualityState>((set, get) => ({
  schema: "public",
  run: null,
  isStreaming: false,
  abortController: null,

  setSchema: (schema) => set({ schema }),

  startAnalysis: async () => {
    if (get().isStreaming) return;

    const schema = get().schema.trim() || "public";
    const runId = createId();
    const abortController = new AbortController();

    const run: DataQualityRun = {
      id: runId,
      schema,
      report: "",
      toolCalls: [],
      streamStatus: "idle",
      usage: createEmptyLoopUsage(),
      createdAt: Date.now(),
    };

    set({ run, isStreaming: true, abortController, schema });

    try {
      await streamDataQualityAnalysis(
        schema,
        (event) => {
          set((state) =>
            state.run
              ? { run: handleSseEvent(state.run, event) }
              : state,
          );
        },
        abortController.signal,
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        set((state) =>
          state.run
            ? { run: { ...state.run, streamStatus: "cancelled" } }
            : state,
        );
      } else {
        const message =
          error instanceof Error ? error.message : "Request failed";
        set((state) =>
          state.run
            ? {
                run: {
                  ...state.run,
                  streamStatus: "error",
                  error: message,
                },
              }
            : state,
        );
      }
    } finally {
      set({ isStreaming: false, abortController: null });
    }
  },

  stopAnalysis: () => {
    get().abortController?.abort();
    set({ isStreaming: false, abortController: null });
  },

  reset: () => {
    get().abortController?.abort();
    set({ run: null, isStreaming: false, abortController: null });
  },
}));
