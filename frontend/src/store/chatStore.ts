import { create } from "zustand";
import { streamChat } from "../api/chat";
import {
  applyToolTokenEvent,
  applyUsageEvent,
  createEmptyLoopUsage,
  logLoopUsage,
  logToolTokens,
} from "../lib/tokenUsage";
import type {
  AssistantMessage,
  ChatMessage,
  HitlActionRequest,
  HitlDecision,
  HitlReviewConfig,
  PendingApproval,
  SseEvent,
  StreamStatus,
  ToolCall,
} from "../types/chat";

function createId(): string {
  return crypto.randomUUID();
}

interface ChatState {
  messages: ChatMessage[];
  threadId: string | null;
  isStreaming: boolean;
  abortController: AbortController | null;
  sendMessage: (content: string) => Promise<void>;
  respondToApproval: (
    assistantId: string,
    decision: HitlDecision,
  ) => Promise<void>;
  stopStreaming: () => void;
  clearChat: () => void;
}

function updateAssistant(
  messages: ChatMessage[],
  assistantId: string,
  updater: (message: AssistantMessage) => AssistantMessage,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === assistantId && message.role === "assistant"
      ? updater(message)
      : message,
  );
}

function toDisplayText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value === "[object Object]" ? undefined : value;
  }

  if (value === null || value === undefined) return undefined;

  return undefined;
}

function parsePendingApproval(data: Record<string, unknown>): PendingApproval {
  return {
    interruptId: String(data.interruptId ?? ""),
    actionRequests: Array.isArray(data.actionRequests)
      ? (data.actionRequests as HitlActionRequest[])
      : [],
    reviewConfigs: Array.isArray(data.reviewConfigs)
      ? (data.reviewConfigs as HitlReviewConfig[])
      : [],
  };
}

function handleSseEvent(
  messages: ChatMessage[],
  assistantId: string,
  event: SseEvent,
): ChatMessage[] {
  switch (event.type) {
    case "started":
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        streamStatus: "streaming",
        pendingApproval: undefined,
      }));

    case "token": {
      const token = toDisplayText(event.data.summary) ?? "";
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        summary: message.summary + token,
        streamStatus: "streaming",
      }));
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
        "chat",
        toolCall.name,
        toolCall.callId,
        toolCall.inputTokens,
      );

      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        toolCalls: [...message.toolCalls, toolCall],
        streamStatus: "streaming",
        usage: applyUsageEvent(message.usage, event),
      }));
    }

    case "tool_result": {
      const callId = String(event.data.callId);
      const outputTokens = Number(event.data.outputTokens ?? 0) || undefined;

      return updateAssistant(messages, assistantId, (message) => {
        const toolCalls = applyToolTokenEvent(
          message.toolCalls.map((tool) =>
            tool.callId === callId
              ? {
                  ...tool,
                  output: event.data.output,
                  status: "success" as const,
                }
              : tool,
          ),
          event,
        );

        const tool = toolCalls.find((entry) => entry.callId === callId);
        if (tool) {
          logToolTokens(
            "chat",
            tool.name,
            tool.callId,
            tool.inputTokens,
            outputTokens,
          );
        }

        return {
          ...message,
          toolCalls,
          usage: applyUsageEvent(message.usage, event),
        };
      });
    }

    case "tool_error": {
      const callId = String(event.data.callId);

      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        toolCalls: applyToolTokenEvent(
          message.toolCalls.map((tool) =>
            tool.callId === callId
              ? {
                  ...tool,
                  error: String(event.data.message ?? "Tool failed"),
                  status: "error" as const,
                }
              : tool,
          ),
          event,
        ),
        usage: applyUsageEvent(message.usage, event),
      }));
    }

    case "llm_usage":
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        usage: applyUsageEvent(message.usage, event),
      }));

    case "approval_required":
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        pendingApproval: parsePendingApproval(event.data),
        streamStatus: "awaiting_approval",
      }));

    case "awaiting_approval":
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        streamStatus: "awaiting_approval",
      }));

    case "rejected": {
      const rejectionMessage = toDisplayText(event.data.message);
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        pendingApproval: undefined,
        summary: rejectionMessage ?? message.summary,
        streamStatus: "done",
      }));
    }

    case "done": {
      const finalSummary = toDisplayText(event.data.summary);
      return updateAssistant(messages, assistantId, (message) => {
        const usage = applyUsageEvent(message.usage, event);
        logLoopUsage("chat", usage);
        return {
          ...message,
          summary: finalSummary ?? message.summary,
          pendingApproval: undefined,
          streamStatus: "done",
          usage,
        };
      });
    }

    case "error":
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        streamStatus: "error",
        error: String(event.data.message ?? "Stream failed"),
      }));

    case "cancelled":
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        streamStatus: "cancelled",
      }));

    default:
      return messages;
  }
}

async function runAssistantStream(
  assistantId: string,
  options: {
    message?: string;
    threadId: string;
    hitlDecision?: HitlDecision;
    signal: AbortSignal;
  },
  set: (
    partial:
      | Partial<ChatState>
      | ((state: ChatState) => Partial<ChatState> | ChatState),
  ) => void,
): Promise<void> {
  await streamChat({
    message: options.message,
    threadId: options.threadId,
    hitlDecision: options.hitlDecision,
    signal: options.signal,
    onEvent: (event) => {
      set((state) => {
        const nextThreadId =
          event.type === "started" && typeof event.data.thread_id === "string"
            ? event.data.thread_id
            : state.threadId;

        return {
          threadId: nextThreadId,
          messages: handleSseEvent(state.messages, assistantId, event),
        };
      });
    },
  });
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  threadId: null,
  isStreaming: false,
  abortController: null,

  sendMessage: async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    const threadId = get().threadId ?? createId();

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    const assistantId = createId();
    const assistantMessage: AssistantMessage = {
      id: assistantId,
      role: "assistant",
      summary: "",
      toolCalls: [],
      streamStatus: "idle" as StreamStatus,
      usage: createEmptyLoopUsage(),
      createdAt: Date.now(),
    };

    const abortController = new AbortController();

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      threadId,
      isStreaming: true,
      abortController,
    }));

    try {
      await runAssistantStream(
        assistantId,
        { message: trimmed, threadId, signal: abortController.signal },
        set,
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        set((state) => ({
          messages: updateAssistant(state.messages, assistantId, (message) => ({
            ...message,
            streamStatus: "cancelled",
          })),
        }));
      } else {
        const message =
          error instanceof Error ? error.message : "Request failed";
        set((state) => ({
          messages: updateAssistant(state.messages, assistantId, (msg) => ({
            ...msg,
            streamStatus: "error",
            error: message,
          })),
        }));
      }
    } finally {
      set({ isStreaming: false, abortController: null });
    }
  },

  respondToApproval: async (assistantId: string, decision: HitlDecision) => {
    const { threadId, isStreaming } = get();
    if (!threadId || isStreaming) return;

    const assistant = get().messages.find(
      (message): message is AssistantMessage =>
        message.id === assistantId && message.role === "assistant",
    );

    if (
      !assistant ||
      assistant.streamStatus !== "awaiting_approval" ||
      !assistant.pendingApproval
    ) {
      return;
    }

    const abortController = new AbortController();

    set({
      isStreaming: true,
      abortController,
    });

    try {
      await runAssistantStream(
        assistantId,
        {
          threadId,
          hitlDecision: decision,
          signal: abortController.signal,
        },
        set,
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        set((state) => ({
          messages: updateAssistant(state.messages, assistantId, (message) => ({
            ...message,
            streamStatus: "cancelled",
          })),
        }));
      } else {
        const message =
          error instanceof Error ? error.message : "Request failed";
        set((state) => ({
          messages: updateAssistant(state.messages, assistantId, (msg) => ({
            ...msg,
            streamStatus: "error",
            error: message,
          })),
        }));
      }
    } finally {
      set({ isStreaming: false, abortController: null });
    }
  },

  stopStreaming: () => {
    get().abortController?.abort();
    set({ isStreaming: false, abortController: null });
  },

  clearChat: () => {
    get().abortController?.abort();
    set({
      messages: [],
      threadId: null,
      isStreaming: false,
      abortController: null,
    });
  },
}));
