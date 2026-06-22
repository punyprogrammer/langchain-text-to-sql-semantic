import type { LoopTokenUsage, SseEvent, ToolCall } from "../types/chat";

export function createEmptyLoopUsage(): LoopTokenUsage {
  const empty = { input: 0, output: 0, total: 0 };
  return { tool: { ...empty }, llm: { ...empty }, combined: { ...empty } };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLoopUsage(value: unknown): LoopTokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const parseCounts = (key: string) => {
    const counts = record[key];
    if (!counts || typeof counts !== "object") {
      return { input: 0, output: 0, total: 0 };
    }

    const c = counts as Record<string, unknown>;
    const input = toNumber(c.input);
    const output = toNumber(c.output);
    return {
      input,
      output,
      total: toNumber(c.total) || input + output,
    };
  };

  return {
    tool: parseCounts("tool"),
    llm: parseCounts("llm"),
    combined: parseCounts("combined"),
  };
}

export function logLoopUsage(label: string, usage: LoopTokenUsage): void {
  console.info(`[tokens] ${label}`, {
    tool: usage.tool,
    llm: usage.llm,
    combined: usage.combined,
  });
}

export function logToolTokens(
  label: string,
  name: string,
  callId: string,
  inputTokens?: number,
  outputTokens?: number,
): void {
  console.info(`[tokens] ${label} tool=${name} callId=${callId}`, {
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
  });
}

function recomputeCombined(usage: LoopTokenUsage): LoopTokenUsage {
  return {
    ...usage,
    combined: {
      input: usage.tool.input + usage.llm.input,
      output: usage.tool.output + usage.llm.output,
      total: usage.tool.total + usage.llm.total,
    },
  };
}

export function applyUsageEvent(
  usage: LoopTokenUsage,
  event: SseEvent,
): LoopTokenUsage {
  switch (event.type) {
    case "tool_start": {
      const inputTokens = toNumber(event.data.inputTokens);
      const next = {
        ...usage,
        tool: {
          input: usage.tool.input + inputTokens,
          output: usage.tool.output,
          total: usage.tool.total + inputTokens,
        },
      };
      return recomputeCombined(next);
    }

    case "tool_result":
    case "tool_error": {
      const outputTokens = toNumber(event.data.outputTokens);
      const next = {
        ...usage,
        tool: {
          input: usage.tool.input,
          output: usage.tool.output + outputTokens,
          total: usage.tool.total + outputTokens,
        },
      };
      return recomputeCombined(next);
    }

    case "llm_usage": {
      const inputTokens = toNumber(event.data.inputTokens);
      const outputTokens = toNumber(event.data.outputTokens);
      const next = {
        ...usage,
        llm: {
          input: usage.llm.input + inputTokens,
          output: usage.llm.output + outputTokens,
          total: usage.llm.total + inputTokens + outputTokens,
        },
      };
      return recomputeCombined(next);
    }

    case "done": {
      const parsed = parseLoopUsage(event.data.usage);
      return parsed ?? usage;
    }

    default:
      return usage;
  }
}

export function applyToolTokenEvent(
  toolCalls: ToolCall[],
  event: SseEvent,
): ToolCall[] {
  switch (event.type) {
    case "tool_start": {
      const callId = String(event.data.callId);
      const inputTokens = toNumber(event.data.inputTokens);
      return toolCalls.map((tool) =>
        tool.callId === callId ? { ...tool, inputTokens } : tool,
      );
    }

    case "tool_result": {
      const callId = String(event.data.callId);
      const outputTokens = toNumber(event.data.outputTokens);
      return toolCalls.map((tool) =>
        tool.callId === callId ? { ...tool, outputTokens } : tool,
      );
    }

    case "tool_error": {
      const callId = String(event.data.callId);
      const outputTokens = toNumber(event.data.outputTokens);
      return toolCalls.map((tool) =>
        tool.callId === callId ? { ...tool, outputTokens } : tool,
      );
    }

    default:
      return toolCalls;
  }
}

export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}
