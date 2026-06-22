import { Loader2 } from "lucide-react";
import type { DataQualityRun } from "../../store/dataQualityStore";
import { TokenUsageSummary } from "../chat/TokenUsageSummary";
import { ToolCallCard } from "../chat/ToolCallCard";
import { TypewriterMarkdown } from "../chat/TypewriterMarkdown";

interface DataQualityRunViewProps {
  run: DataQualityRun;
}

export function DataQualityRunView({ run }: DataQualityRunViewProps) {
  const isStreaming = run.streamStatus === "streaming";
  const hasReport = run.report.length > 0;
  const hasTools = run.toolCalls.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-foreground-subtle">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-muted text-[10px] font-bold text-brand">
          DQ
        </div>
        <span>Data Quality Agent</span>
        <span className="text-foreground-muted">· schema: {run.schema}</span>
        {isStreaming && (
          <span className="inline-flex items-center gap-1 text-info">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running
          </span>
        )}
        {run.streamStatus === "done" && (
          <span className="text-brand">Complete</span>
        )}
        {run.streamStatus === "error" && (
          <span className="text-danger">Error</span>
        )}
        {run.streamStatus === "cancelled" && (
          <span className="text-warning">Cancelled</span>
        )}
      </div>

      {hasTools && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
              Tool calls ({run.toolCalls.length})
            </p>
          </div>
          {run.toolCalls.map((tool, index) => (
            <ToolCallCard
              key={tool.callId}
              tool={tool}
              attemptLabel={`Step ${index + 1}`}
              collapseOnComplete
              defaultCollapsed={tool.status !== "running"}
            />
          ))}
        </div>
      )}

      {(run.usage.combined.total > 0 || isStreaming) && (
        <TokenUsageSummary usage={run.usage} />
      )}

      {(hasReport || isStreaming) && (
        <div className="rounded-2xl border border-surface-500 bg-surface-300 px-4 py-3 text-sm text-foreground">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            Report
          </p>
          {hasReport ? (
            <TypewriterMarkdown
              text={run.report}
              messageId={run.id}
              streamStatus={run.streamStatus}
            />
          ) : (
            <span className="text-foreground-muted">Preparing report…</span>
          )}
        </div>
      )}

      {run.error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {run.error}
        </div>
      )}
    </div>
  );
}
