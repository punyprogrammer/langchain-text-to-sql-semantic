export type ToolCallStatus = "running" | "success" | "error";

export interface ToolCall {
  callId: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  status: ToolCallStatus;
}

export type StreamStatus = "idle" | "streaming" | "done" | "error" | "cancelled";

export interface UserMessage {
  id: string;
  role: "user";
  content: string;
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  content: string;
  toolCalls: ToolCall[];
  streamStatus: StreamStatus;
  error?: string;
  createdAt: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

export type SseEventType =
  | "started"
  | "token"
  | "tool_start"
  | "tool_result"
  | "tool_error"
  | "done"
  | "error"
  | "cancelled";

export interface SseEvent {
  type: SseEventType;
  data: Record<string, unknown>;
}
