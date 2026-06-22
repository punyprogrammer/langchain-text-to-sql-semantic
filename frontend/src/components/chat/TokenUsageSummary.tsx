import type { LoopTokenUsage } from "../../types/chat";
import { formatTokenCount } from "../../lib/tokenUsage";

interface TokenUsageSummaryProps {
  usage: LoopTokenUsage;
  title?: string;
}

function CountRow({
  label,
  input,
  output,
  total,
}: {
  label: string;
  input: number;
  output: number;
  total: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-foreground-muted">{label}</span>
      <span className="font-mono text-foreground">
        in {formatTokenCount(input)} · out {formatTokenCount(output)} · Σ{" "}
        {formatTokenCount(total)}
      </span>
    </div>
  );
}

export function TokenUsageSummary({
  usage,
  title = "Token usage",
}: TokenUsageSummaryProps) {
  return (
    <div className="rounded-lg border border-surface-500 bg-surface-200 px-3 py-2">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {title}
      </p>
      <div className="space-y-1.5">
        <CountRow
          label="Tool payloads"
          input={usage.tool.input}
          output={usage.tool.output}
          total={usage.tool.total}
        />
        <CountRow
          label="LLM"
          input={usage.llm.input}
          output={usage.llm.output}
          total={usage.llm.total}
        />
        <CountRow
          label="Combined"
          input={usage.combined.input}
          output={usage.combined.output}
          total={usage.combined.total}
        />
      </div>
    </div>
  );
}
