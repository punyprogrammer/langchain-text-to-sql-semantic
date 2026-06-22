import { Play, RotateCcw, Square } from "lucide-react";
import { useDataQualityStore } from "../../store/dataQualityStore";
import { DataQualityRunView } from "./DataQualityRunView";

export function DataQualityPage() {
  const {
    schema,
    run,
    isStreaming,
    setSchema,
    startAnalysis,
    stopAnalysis,
    reset,
  } = useDataQualityStore();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-surface-500 px-4 md:px-8">
        <div>
          <h1 className="text-sm font-semibold text-foreground">
            Data Quality Analysis
          </h1>
          <p className="text-xs text-foreground-subtle">
            Plan → inspect tables → run checks → markdown report
          </p>
        </div>

        {run && !isStreaming && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-500 px-3 py-1.5 text-xs text-foreground-muted transition hover:border-brand hover:text-brand"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-xl border border-surface-500 bg-surface-200 p-4">
            <label
              htmlFor="dq-schema"
              className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground-subtle"
            >
              Schema
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="dq-schema"
                type="text"
                value={schema}
                onChange={(event) => setSchema(event.target.value)}
                disabled={isStreaming}
                placeholder="public"
                className="flex-1 rounded-lg border border-surface-500 bg-surface-100 px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand disabled:opacity-50"
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopAnalysis}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/20"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startAnalysis()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface-100 transition hover:bg-brand-hover"
                >
                  <Play className="h-4 w-4" />
                  Run analysis
                </button>
              )}
            </div>
          </div>

          {!run && (
            <div className="rounded-xl border border-dashed border-surface-500 px-6 py-12 text-center">
              <p className="text-sm text-foreground-muted">
                Run an analysis to profile every table, execute quality checks,
                and generate a markdown report.
              </p>
            </div>
          )}

          {run && <DataQualityRunView run={run} />}
        </div>
      </div>
    </div>
  );
}
