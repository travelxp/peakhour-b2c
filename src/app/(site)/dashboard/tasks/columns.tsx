"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/molecules/status-badge";
import { ElapsedTimer } from "@/components/molecules/elapsed-timer";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { DataTableColumnHeader } from "@/components/molecules/data-table";
import { formatDate } from "@/lib/locale";
import type { Job, JobDetail } from "@/hooks/use-jobs";

/**
 * Callbacks the page wires into the columns. Expansion state + the cancel
 * mutation live in the page (they need React-Query + per-row UI state);
 * the column defs stay pure and just call back.
 */
export interface TaskColumnsCtx {
  isExpanded: (id: string) => boolean;
  toggleExpand: (id: string) => void;
  onCancel: (job: Job) => void;
}

function isActiveJob(job: Job): boolean {
  return job.status === "running" || job.status === "pending";
}

export function getTaskColumns(ctx: TaskColumnsCtx): ColumnDef<Job, unknown>[] {
  return [
    {
      // The searchable / sortable label. accessorFn returns the friendly
      // name so the toolbar's global search matches what the user reads.
      id: "task",
      accessorFn: (row) => row.displayName || formatKind(row.kind),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Task" />,
      enableHiding: false,
      cell: ({ row }) => {
        const job = row.original;
        const hasChildren = job.childrenTotal != null && job.childrenTotal > 0;
        const expanded = ctx.isExpanded(job._id);
        return (
          <div className="flex items-start gap-1.5">
            {hasChildren ? (
              <button
                type="button"
                aria-label={expanded ? "Hide batches" : "Show batches"}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.toggleExpand(job._id);
                }}
              >
                {expanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {job.displayName || formatKind(job.kind)}
              </div>
              {job.displayHint && (
                <div className="truncate text-xs text-muted-foreground">
                  {job.displayHint}
                </div>
              )}
              {hasChildren && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.toggleExpand(job._id);
                  }}
                >
                  {job.childrenTotal} batch{job.childrenTotal === 1 ? "" : "es"}
                </button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      // Hidden — drives the "Type" faceted-filter chip only (kind is the
      // machine value; we never render a raw-kind column). initialVisibility
      // keeps it out of the rendered table.
      accessorKey: "kind",
      header: "Type",
      enableSorting: false,
      filterFn: (row, id, value) => {
        if (!Array.isArray(value) || value.length === 0) return true;
        return value.includes(String(row.getValue(id)));
      },
    },
    {
      id: "status",
      accessorFn: (row) => statusForBadge(row),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const job = row.original;
        const active = isActiveJob(job);
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge status={statusForBadge(job)} dot={active} />
            {job.cancelRequested && active && (
              <span className="text-xs text-amber-600">Cancelling…</span>
            )}
            {job.status === "failed" && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Hit a snag — retry
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "progress",
      enableSorting: false,
      header: "Progress",
      cell: ({ row }) => {
        const job = row.original;
        const total = job.progress?.totalUnits ?? 0;
        const done = job.progress?.processedUnits ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        if (total > 0) {
          return (
            <div className="w-32 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                <span>{pct}%</span>
                <span>
                  {done}/{total}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        }
        if (isActiveJob(job)) {
          return (
            <span className="text-xs text-muted-foreground">
              {job.progress?.currentLabel || "Working…"}
            </span>
          );
        }
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "started",
      accessorFn: (row) => row.createdAt,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Started" />,
      cell: ({ row }) => {
        const job = row.original;
        return (
          <div className="whitespace-nowrap text-xs text-muted-foreground">
            <div>{formatDate(job.createdAt, null)}</div>
            {isActiveJob(job) && (
              <ElapsedTimer running startedAt={job.createdAt} etaMs={job.progress?.etaMs} />
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const job = row.original;
        if (!isActiveJob(job) || job.cancelRequested) return null;
        return (
          <div className="text-right">
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Cancel
                </Button>
              }
              title="Cancel this task?"
              description="In-flight work will finish, then everything else stops. You can restart later."
              confirmLabel="Cancel task"
              onConfirm={() => ctx.onCancel(job)}
            />
          </div>
        );
      },
    },
  ];
}

// ── Shared helpers ───────────────────────────────────────────────

/**
 * Map raw kind to a human label for jobs without a `displayName`.
 * displayName is set at submit time and should always be present going
 * forward; this is a fallback for ad-hoc enqueues.
 */
export function formatKind(kind: string): string {
  switch (kind) {
    case "content_analyse":
      return "Re-analysing content library";
    case "tag_drafts":
      return "Tagging batch";
    case "voice_card_refresh":
      return "Refreshing brand voice";
    case "beehiiv_sync_full":
      return "Syncing Beehiiv";
    default:
      return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/**
 * Map job.status to the label rendered in the badge. Synthetic labels
 * (queued, cancelling, in_progress) read better than the raw enum.
 * StatusBadge's STATUS_MAP knows about all of these.
 */
export function statusForBadge(job: Job | JobDetail): string {
  if (job.cancelRequested && (job.status === "running" || job.status === "pending")) {
    return "cancelling";
  }
  if (job.status === "pending") return "queued";
  if (job.status === "running") return "in_progress";
  return job.status;
}
