import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
} from "lucide-react";
import { formatTokenCount } from "../../lib/tokenUsage";
import type { ToolCall } from "../../types/chat";
import { getSqlFromInput, SqlBlock, truncateSql } from "./SqlBlock";

interface ToolCallCardProps {
  tool: ToolCall;
  defaultCollapsed?: boolean;
  collapseOnComplete?: boolean;
  attemptLabel?: string;
  displayName?: string;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  create_analysis_plan: "Analysis plan",
  list_tables: "List tables",
  scan_tables: "Scan tables",
  run_quality_checks: "Quality checks",
  execute_readonly_sql: "SQL checks",
  inspect_table: "Inspect table",
  execute_sql: "Execute SQL",
};

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

function getProgressText(tool: ToolCall): string | undefined {
  if (!tool.progress) return undefined;

  const { label, current, total, item } = tool.progress;
  const counter = total > 0 ? ` (${current}/${total})` : "";

  if (item) {
    return `${label}: ${item}${counter}`;
  }

  return `${label}${counter}`;
}

function getTokenText(tool: ToolCall): string | undefined {
  const hasInput = typeof tool.inputTokens === "number";
  const hasOutput = typeof tool.outputTokens === "number";

  if (!hasInput && !hasOutput) return undefined;

  const input = hasInput ? formatTokenCount(tool.inputTokens!) : "—";
  const output = hasOutput ? formatTokenCount(tool.outputTokens!) : "—";
  return `in ${input} · out ${output}`;
}

export function ToolCallCard({
  tool,
  defaultCollapsed = false,
  collapseOnComplete = false,
  attemptLabel,
  displayName,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const sql = getSqlFromInput(tool.input);
  const isFinished = tool.status === "success" || tool.status === "error";
  const progressText = getProgressText(tool);
  const tokenText = getTokenText(tool);
  const title = displayName ?? TOOL_DISPLAY_NAMES[tool.name] ?? tool.name;

  useEffect(() => {
    if (tool.status === "running") {
      setExpanded(true);
      return;
    }

    if (collapseOnComplete || defaultCollapsed) {
      setExpanded(false);
    }
  }, [tool.status, defaultCollapsed, collapseOnComplete]);

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{title}</span>
            {attemptLabel && (
              <span className="text-xs text-foreground-subtle">
                {attemptLabel}
              </span>
            )}
            {tokenText && (
              <span className="font-mono text-[10px] text-foreground-muted">
                {tokenText}
              </span>
            )}
          </div>
          {progressText && tool.status === "running" && (
            <p className="mt-0.5 truncate text-xs text-info">{progressText}</p>
          )}
          {!expanded && !progressText && sql && (
            <p className="mt-0.5 truncate font-mono text-xs text-foreground-muted">
              {truncateSql(sql)}
            </p>
          )}
          {!expanded && !progressText && !sql && tool.error && (
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
          {tokenText && (
            <p className="font-mono text-[10px] text-foreground-muted">
              Tokens: {tokenText}
            </p>
          )}

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
              <pre className="max-h-96 overflow-auto rounded-md bg-surface-100 p-2 text-xs text-brand">
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
