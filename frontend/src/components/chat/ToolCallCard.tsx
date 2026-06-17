import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from "lucide-react";
import type { ToolCall } from "../../types/chat";
import { getSqlFromInput, SqlBlock, truncateSql } from "./SqlBlock";

interface ToolCallCardProps {
  tool: ToolCall;
  defaultCollapsed?: boolean;
  attemptLabel?: string;
}

function formatJson(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  return JSON.stringify(value, null, 2);
}

export function ToolCallCard({
  tool,
  defaultCollapsed = false,
  attemptLabel,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const sql = getSqlFromInput(tool.input);
  const isFinished = tool.status === "success" || tool.status === "error";

  useEffect(() => {
    if (tool.status === "running") {
      setExpanded(true);
      return;
    }

    if (defaultCollapsed) {
      setExpanded(false);
    }
  }, [tool.status, defaultCollapsed]);

  const statusIcon =
    tool.status === "running" ? (
      <Loader2 className="h-4 w-4 animate-spin text-info" />
    ) : tool.status === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-brand" />
    ) : (
      <XCircle className="h-4 w-4 text-danger" />
    );

  const statusClass =
    tool.status === "success"
      ? "text-brand"
      : tool.status === "error"
        ? "text-danger"
        : "text-info";

  return (
    <div className="overflow-hidden rounded-lg border border-surface-500 bg-surface-200">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 border-b border-surface-500 px-3 py-2 text-left transition hover:bg-surface-300/60"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-foreground-subtle" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-foreground-subtle" />
        )}
        {statusIcon}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {tool.name}
            </span>
            {attemptLabel && (
              <span className="text-xs text-foreground-subtle">
                {attemptLabel}
              </span>
            )}
          </div>
          {!expanded && sql && (
            <p className="mt-0.5 truncate font-mono text-xs text-foreground-muted">
              {truncateSql(sql)}
            </p>
          )}
          {!expanded && !sql && tool.error && (
            <p className="mt-0.5 truncate text-xs text-danger">{tool.error}</p>
          )}
        </div>
        <span
          className={`shrink-0 text-xs uppercase tracking-wide ${statusClass}`}
        >
          {tool.status}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 p-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
              Input
            </p>
            {sql ? (
              <SqlBlock code={sql} />
            ) : (
              <pre className="overflow-x-auto rounded-md bg-surface-100 p-2 text-xs text-foreground-muted">
                {formatJson(tool.input)}
              </pre>
            )}
          </div>

          {tool.output !== undefined && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                Output
              </p>
              <pre className="overflow-x-auto rounded-md bg-surface-100 p-2 text-xs text-brand">
                {formatJson(tool.output)}
              </pre>
            </div>
          )}

          {tool.error && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-danger">
                Error
              </p>
              <pre className="overflow-x-auto rounded-md bg-surface-100 p-2 text-xs text-danger">
                {tool.error}
              </pre>
            </div>
          )}
        </div>
      )}

      {!expanded && isFinished && sql && tool.error && (
        <div className="border-t border-surface-500 px-3 py-2 text-xs text-danger">
          {tool.error}
        </div>
      )}
    </div>
  );
}
