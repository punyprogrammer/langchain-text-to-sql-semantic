import { ShieldAlert } from "lucide-react";
import type { PendingApproval } from "../../types/chat";
import { getSqlFromInput, SqlBlock } from "./SqlBlock";

interface SqlApprovalCardProps {
  approval: PendingApproval;
  disabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function SqlApprovalCard({
  approval,
  disabled = false,
  onApprove,
  onReject,
}: SqlApprovalCardProps) {
  const action = approval.actionRequests[0];
  const sql = action ? getSqlFromInput(action.args) : null;
  const description = action?.description;

  return (
    <div className="overflow-hidden rounded-lg border border-warning/40 bg-warning/5">
      <div className="flex items-center gap-2 border-b border-warning/30 px-3 py-2">
        <ShieldAlert className="h-4 w-4 text-warning" />
        <div>
          <p className="text-sm font-medium text-foreground">
            SQL approval required
          </p>
          <p className="text-xs text-foreground-muted">
            Review the query below before it runs against the database.
          </p>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {sql ? (
          <SqlBlock code={sql} />
        ) : (
          <pre className="overflow-x-auto rounded-md bg-surface-100 p-2 text-xs text-foreground-muted">
            {JSON.stringify(action?.args ?? {}, null, 2)}
          </pre>
        )}

        {description && !sql && (
          <p className="text-xs text-foreground-muted">{description}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Approve & run
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={disabled}
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
