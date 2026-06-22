export type ToolCallStatus = "running" | "success" | "error";

export interface HitlActionRequest {
  name: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface HitlReviewConfig {
  actionName: string;
  allowedDecisions: Array<"approve" | "edit" | "reject">;
}

export interface PendingApproval {
  interruptId: string;
  actionRequests: HitlActionRequest[];
  reviewConfigs: HitlReviewConfig[];
}

export type HitlDecision = "approve" | "reject";

export interface ToolCallProgress {
  label: string;
  current: number;
  total: number;
  item?: string;
}

export interface ToolCall {
  callId: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  status: ToolCallStatus;
  progress?: ToolCallProgress;
  inputTokens?: number;
  outputTokens?: number;
}

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

export type StreamStatus =
  | "idle"
  | "streaming"
  | "awaiting_approval"
  | "done"
  | "error"
  | "cancelled";

export interface UserMessage {
  id: string;
  role: "user";
  content: string;
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  summary: string;
  toolCalls: ToolCall[];
  streamStatus: StreamStatus;
  error?: string;
  pendingApproval?: PendingApproval;
  usage: LoopTokenUsage;
  createdAt: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

export type SseEventType =
  | "started"
  | "token"
  | "tool_start"
  | "tool_progress"
  | "tool_result"
  | "tool_error"
  | "llm_usage"
  | "approval_required"
  | "awaiting_approval"
  | "rejected"
  | "done"
  | "error"
  | "cancelled";

export interface SseEvent {
  type: SseEventType;
  data: Record<string, unknown>;
}
