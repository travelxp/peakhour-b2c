"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/molecules/status-badge";
import { ElapsedTimer } from "@/components/molecules/elapsed-timer";
import { EmptyState } from "@/components/molecules/empty-state";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/locale";
import {
  useJobs,
  useJobDetail,
  useCancelJob,
  type Job,
  type JobDetail,
} from "@/hooks/use-jobs";

export default function TasksPage() {
  const searchParams = useSearchParams();
  const focusJobId = searchParams.get("jobId");

  const { data: active, isLoading: activeLoading } = useJobs("active");
  const { data: recent, isLoading: recentLoading } = useJobs("recent");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        <p className="text-muted-foreground">
          Background work running on your library — analysis, syncs, and more.
        </p>
      </div>

      {/* In-progress section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">In progress</h3>
          {activeLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </div>
        {activeLoading && !active ? (
          <JobListSkeleton />
        ) : !active?.rows.length ? (
          <EmptyState
            icon={ListChecks}
            title="Nothing running right now"
            description="Kick off an analysis or sync from the Content page and we'll track progress here."
          />
        ) : (
          <div className="space-y-3">
            {active.rows.map((job) => (
              <JobCard
                key={job._id}
                job={job}
                expanded={focusJobId === job._id}
                focused={focusJobId === job._id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent section */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Recently completed</h3>
        {recentLoading && !recent ? (
          <JobListSkeleton />
        ) : !recent?.rows.length ? (
          <p className="text-sm text-muted-foreground">No completed tasks in the last 24 hours.</p>
        ) : (
          <div className="space-y-3">
            {recent.rows.map((job) => (
              <JobCard
                key={job._id}
                job={job}
                expanded={focusJobId === job._id}
                focused={focusJobId === job._id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────

function JobCard({
  job,
  expanded: initialExpanded = false,
  focused = false,
}: {
  job: Job;
  expanded?: boolean;
  focused?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const isActive = job.status === "running" || job.status === "pending";
  const cancelMutation = useCancelJob();
  // When a deep-link lands here with ?jobId=<id>, scroll the matched
  // card into view and apply a brief ring so the user can spot which
  // job they were sent to. Only fires once on mount; subsequent
  // re-renders (poll updates etc.) don't re-trigger.
  const cardRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(focused);
  useEffect(() => {
    if (!focused) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlighted(false), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const totalUnits = job.progress?.totalUnits ?? 0;
  const processedUnits = job.progress?.processedUnits ?? 0;
  const pct = totalUnits > 0 ? Math.round((processedUnits / totalUnits) * 100) : 0;

  const onCancel = () => {
    cancelMutation.mutate(job._id, {
      onSuccess: () => toast.success("Cancellation requested"),
      onError: (err: Error) => toast.error(err.message || "Failed to cancel task"),
    });
  };

  return (
    <Card
      ref={cardRef}
      className={
        highlighted
          ? "ring-2 ring-primary transition-shadow duration-300"
          : "transition-shadow duration-300"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              {job.displayName || formatKind(job.kind)}
            </CardTitle>
            {job.displayHint && (
              <CardDescription className="mt-1 line-clamp-2">{job.displayHint}</CardDescription>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge
              status={statusForBadge(job)}
              dot={isActive}
            />
            {isActive && (
              <ElapsedTimer
                running
                startedAt={job.createdAt}
                etaMs={job.progress?.etaMs}
              />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {totalUnits > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span className="truncate pr-2">
                {job.progress?.currentLabel || (isActive ? "Working…" : `${pct}% complete`)}
              </span>
              <span>{processedUnits} / {totalUnits}</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Started {formatDate(job.createdAt, null)}</span>
          <div className="flex items-center gap-2">
            {job.childrenTotal != null && (
              <button
                type="button"
                className="hover:text-foreground hover:underline"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Hide" : "Show"} {job.childrenTotal} batch{job.childrenTotal === 1 ? "" : "es"}
              </button>
            )}
            {isActive && !job.cancelRequested && (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    Cancel
                  </Button>
                }
                title="Cancel this task?"
                description="In-flight work will finish, then everything else stops. You can restart later."
                confirmLabel="Cancel task"
                onConfirm={onCancel}
              />
            )}
            {job.cancelRequested && isActive && (
              <span className="text-amber-600">Cancelling…</span>
            )}
          </div>
        </div>

        {job.status === "failed" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            We hit a snag. The team has been notified — try again or contact support.
          </p>
        )}

        {expanded && <JobChildrenList jobId={job._id} />}
      </CardContent>
    </Card>
  );
}

function JobChildrenList({ jobId }: { jobId: string }) {
  const { data, isLoading } = useJobDetail(jobId);
  if (isLoading) {
    return (
      <div className="space-y-2 border-t pt-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  if (!data?.children?.length) return null;
  return (
    <div className="space-y-2 border-t pt-3">
      {data.children.map((child) => {
        const total = child.progress?.totalUnits ?? 0;
        const done = child.progress?.processedUnits ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={child._id} className="flex items-center gap-3 text-xs">
            <StatusBadge
              status={child.status}
              dot={child.status === "running" || child.status === "pending"}
            />
            <span className="min-w-0 flex-1 truncate">
              {child.displayName || `Batch ${child._id.slice(-6)}`}
            </span>
            <span className="text-muted-foreground tabular-nums">{done} / {total}</span>
            <div className="w-20">
              <Progress value={pct} className="h-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-1/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Map raw kind to a human label for jobs without a `displayName`.
 * displayName is set at submit time and should always be present going
 * forward; this is a fallback for ad-hoc enqueues.
 */
function formatKind(kind: string): string {
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
 * Pick the badge label. We surface "running" as "In Progress" via the
 * StatusBadge map, but for "pending" we want "Queued" (clearer for users).
 */
/**
 * Map job.status to the label rendered in the badge. Synthetic labels
 * (queued, cancelling, in_progress) read better than the raw enum.
 * StatusBadge's STATUS_MAP knows about all of these.
 */
function statusForBadge(job: Job | JobDetail): string {
  if (job.cancelRequested && (job.status === "running" || job.status === "pending")) {
    return "cancelling";
  }
  if (job.status === "pending") return "queued";
  if (job.status === "running") return "in_progress";
  return job.status;
}
