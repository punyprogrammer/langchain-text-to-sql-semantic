import { create } from "zustand";
import { streamChat } from "../api/chat";
import type {
  AssistantMessage,
  ChatMessage,
  SseEvent,
  StreamStatus,
  ToolCall,
} from "../types/chat";

function createId(): string {
  return crypto.randomUUID();
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  abortController: AbortController | null;
  sendMessage: (content: string) => Promise<void>;
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
      }));

    case "token": {
      const token = toDisplayText(event.data.content) ?? "";
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        content: message.content + token,
        streamStatus: "streaming",
      }));
    }

    case "tool_start": {
      const toolCall: ToolCall = {
        callId: String(event.data.callId ?? createId()),
        name: String(event.data.name ?? "tool"),
        input: event.data.input,
        status: "running",
      };

      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        toolCalls: [...message.toolCalls, toolCall],
        streamStatus: "streaming",
      }));
    }

    case "tool_result": {
      const callId = String(event.data.callId);
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        toolCalls: message.toolCalls.map((tool) =>
          tool.callId === callId
            ? {
                ...tool,
                output: event.data.output,
                status: "success",
              }
            : tool,
        ),
      }));
    }

    case "tool_error": {
      const callId = String(event.data.callId);
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        toolCalls: message.toolCalls.map((tool) =>
          tool.callId === callId
            ? {
                ...tool,
                error: String(event.data.message ?? "Tool failed"),
                status: "error",
              }
            : tool,
        ),
      }));
    }

    case "done": {
      const finalContent = toDisplayText(event.data.content);
      return updateAssistant(messages, assistantId, (message) => ({
        ...message,
        content: finalContent ?? message.content,
        streamStatus: "done",
      }));
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

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  abortController: null,

  sendMessage: async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

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
      content: "",
      toolCalls: [],
      streamStatus: "idle" as StreamStatus,
      createdAt: Date.now(),
    };

    const abortController = new AbortController();

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      abortController,
    }));

    try {
      await streamChat(
        trimmed,
        (event) => {
          set((state) => ({
            messages: handleSseEvent(state.messages, assistantId, event),
          }));
        },
        abortController.signal,
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
    set({ messages: [], isStreaming: false, abortController: null });
  },
}));
