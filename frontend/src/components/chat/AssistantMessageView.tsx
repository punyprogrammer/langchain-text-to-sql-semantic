import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useChatStore } from "../../store/chatStore";
import type { AssistantMessage } from "../../types/chat";
import { SqlApprovalCard } from "./SqlApprovalCard";
import { ToolCallCard } from "./ToolCallCard";
import { TokenUsageSummary } from "./TokenUsageSummary";
import { TypewriterMarkdown } from "./TypewriterMarkdown";

interface AssistantMessageViewProps {
  message: AssistantMessage;
}

export function AssistantMessageView({ message }: AssistantMessageViewProps) {
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const respondToApproval = useChatStore((state) => state.respondToApproval);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const isAwaitingApproval = message.streamStatus === "awaiting_approval";
  const isActiveStream =
    message.streamStatus === "streaming" || isAwaitingApproval;
  const isDone = message.streamStatus === "done";
  const hasSummary = message.summary.length > 0;
  const { toolCalls } = message;
  const hasTools = toolCalls.length > 0;
  const hasMultipleAttempts = toolCalls.length > 1;
  const hiddenAttemptCount = toolCalls.length - 1;

  useEffect(() => {
    if (!isDone) {
      setShowAllAttempts(false);
    }
  }, [isDone, message.id]);

  const visibleTools =
    hasMultipleAttempts && isDone && !showAllAttempts
      ? [toolCalls[toolCalls.length - 1]]
      : toolCalls;

  const getAttemptMeta = (callId: string) => {
    const index = toolCalls.findIndex((tool) => tool.callId === callId);
    if (index < 0 || !hasMultipleAttempts) return undefined;

    return `Attempt ${index + 1} of ${toolCalls.length}`;
  };

  const shouldCollapse = (callId: string, status: string) => {
    if (status === "running") return false;

    const index = toolCalls.findIndex((tool) => tool.callId === callId);
    const isLatest = index === toolCalls.length - 1;

    if (status === "error") {
      return isDone && !isLatest;
    }

    if (status === "success") {
      return isDone || !isLatest;
    }

    return false;
  };

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-3xl space-y-3">
        <div className="flex items-center gap-2 text-xs text-foreground-subtle">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-muted text-[10px] font-bold text-brand">
            AI
          </div>
          <span>Assistant</span>
          {message.streamStatus === "streaming" && (
            <span className="inline-flex items-center gap-1 text-info">
              <Loader2 className="h-3 w-3 animate-spin" />
              Streaming
            </span>
          )}
          {isAwaitingApproval && (
            <span className="text-warning">Awaiting approval</span>
          )}
          {message.streamStatus === "done" && (
            <span className="text-brand">Complete</span>
          )}
          {message.streamStatus === "error" && (
            <span className="text-danger">Error</span>
          )}
          {message.streamStatus === "cancelled" && (
            <span className="text-warning">Cancelled</span>
          )}
        </div>

        {message.pendingApproval && (
          <SqlApprovalCard
            approval={message.pendingApproval}
            disabled={isStreaming}
            onApprove={() => void respondToApproval(message.id, "approve")}
            onReject={() => void respondToApproval(message.id, "reject")}
          />
        )}

        {hasTools && (
          <div className="space-y-2">
            {hasMultipleAttempts && isDone && !showAllAttempts && (
              <button
                type="button"
                onClick={() => setShowAllAttempts(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-500 px-3 py-1.5 text-xs text-foreground-muted transition hover:border-brand hover:text-brand"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Show all attempts ({toolCalls.length})
              </button>
            )}

            {hasMultipleAttempts && isDone && showAllAttempts && (
              <button
                type="button"
                onClick={() => setShowAllAttempts(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-500 px-3 py-1.5 text-xs text-foreground-muted transition hover:border-brand hover:text-brand"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Show final attempt only
              </button>
            )}

            {visibleTools.map((tool) => (
              <ToolCallCard
                key={tool.callId}
                tool={tool}
                attemptLabel={getAttemptMeta(tool.callId)}
                defaultCollapsed={shouldCollapse(tool.callId, tool.status)}
              />
            ))}

            {hasMultipleAttempts && isDone && !showAllAttempts && (
              <p className="text-xs text-foreground-subtle">
                {hiddenAttemptCount} earlier attempt
                {hiddenAttemptCount === 1 ? "" : "s"} hidden
              </p>
            )}
          </div>
        )}

        {(message.usage.combined.total > 0 || isActiveStream) && (
          <TokenUsageSummary usage={message.usage} />
        )}

        {(hasSummary || message.streamStatus === "streaming") && (
          <div className="rounded-2xl rounded-tl-md border border-surface-500 bg-surface-300 px-4 py-3 text-sm text-foreground">
            {hasSummary ? (
              <TypewriterMarkdown
                text={message.summary}
                messageId={message.id}
                streamStatus={message.streamStatus}
              />
            ) : (
              <span className="text-foreground-muted">Preparing summary…</span>
            )}
          </div>
        )}

        {message.error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {message.error}
          </div>
        )}
      </div>
    </div>
  );
}
