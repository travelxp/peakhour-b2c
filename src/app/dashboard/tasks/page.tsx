"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { flexRender } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/molecules/status-badge";
import {
  useDataTable,
  FacetedFilter,
  DataTablePagination,
  type FacetedFilterOption,
} from "@/components/molecules/data-table";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { EmptyState } from "@/components/molecules/empty-state";
import { ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useJobs,
  useJobDetail,
  useCancelJob,
  type Job,
} from "@/hooks/use-jobs";
import { getTaskColumns, formatKind } from "./columns";

type TaskFilter = "active" | "completed" | "all";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const focusJobId = searchParams.get("jobId");

  const { data: active, isLoading: activeLoading } = useJobs("active");
  const { data: recent, isLoading: recentLoading } = useJobs("recent");

  // Deep-linked jobs may be in either bucket — default to "all" so the
  // linked row is always present to highlight; otherwise default to the
  // ongoing view.
  const [filter, setFilter] = useState<TaskFilter>(focusJobId ? "all" : "active");

  const activeRows = useMemo(() => active?.rows ?? [], [active]);
  const recentRows = useMemo(() => recent?.rows ?? [], [recent]);
  const rows = useMemo(() => {
    if (filter === "active") return activeRows;
    if (filter === "completed") return recentRows;
    return [...activeRows, ...recentRows];
  }, [filter, activeRows, recentRows]);

  const loading =
    (filter === "active" && activeLoading && !active) ||
    (filter === "completed" && recentLoading && !recent) ||
    (filter === "all" && (activeLoading || recentLoading) && !active && !recent);

  // ── Expansion (batch drill-down) ──────────────────────────────
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = useCallback(
    (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  );
  const isExpanded = useCallback((id: string) => !!expanded[id], [expanded]);

  // ── Cancel ────────────────────────────────────────────────────
  const cancelMutation = useCancelJob();
  const onCancel = useCallback(
    (job: Job) => {
      cancelMutation.mutate(job._id, {
        onSuccess: () => toast.success("Cancellation requested"),
        onError: (err: Error) =>
          toast.error(err.message || "Failed to cancel task"),
      });
    },
    [cancelMutation],
  );

  const columns = useMemo(
    () => getTaskColumns({ isExpanded, toggleExpand, onCancel }),
    [isExpanded, toggleExpand, onCancel],
  );

  const { table, globalFilter, setGlobalFilter } = useDataTable<Job>({
    data: rows,
    columns,
    getRowId: (row) => row._id,
    // "kind" backs the Type filter chip but is never rendered as a column.
    initialVisibility: { kind: false },
    pageSize: 25,
  });

  // Type filter options — unique kinds present in the current bucket,
  // labelled with the same friendly map the rows use.
  const typeOptions: FacetedFilterOption[] = useMemo(() => {
    const kinds = Array.from(new Set(rows.map((r) => r.kind)));
    return kinds
      .sort()
      .map((k) => ({ value: k, label: formatKind(k) }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <CronToolbar
        crons={["jobs-runner"]}
        onTriggered={() => queryClient.invalidateQueries({ queryKey: ["jobs"] })}
      />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        <p className="text-muted-foreground">
          Background work running on your library — analysis, syncs, and more.
        </p>
      </div>

      {/* Button tabs: ongoing vs completed */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskFilter)}>
          <TabsList>
            <TabsTrigger value="active">
              In progress{activeRows.length ? ` (${activeRows.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed{recentRows.length ? ` (${recentRows.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        {(activeLoading || recentLoading) && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        filter === "completed" ? (
          <p className="text-sm text-muted-foreground">
            No completed tasks in the last 24 hours.
          </p>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="Nothing running right now"
            description="Kick off an analysis or sync from the Content page and we'll track progress here."
          />
        )
      ) : (
        <div className="space-y-3">
          {/* Toolbar: search + Type filter chip */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search tasks..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-8 w-full lg:w-64"
            />
            {typeOptions.length > 1 && (
              <FacetedFilter
                column={table.getColumn("kind")}
                title="Type"
                options={typeOptions}
                align="start"
              />
            )}
            {table.getState().columnFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => table.resetColumnFilters()}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <JobRowGroup
                      key={row.id}
                      job={row.original}
                      focused={focusJobId === row.original._id}
                      expanded={isExpanded(row.original._id)}
                      colSpan={row.getVisibleCells().length}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="align-top">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </JobRowGroup>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No tasks match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} />
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────

/**
 * Renders a job's main row plus (when expanded) its batch-children row.
 * Owns the deep-link highlight: when `focused`, scrolls into view and
 * briefly rings the row.
 */
function JobRowGroup({
  job,
  focused,
  expanded,
  colSpan,
  children,
}: {
  job: Job;
  focused: boolean;
  expanded: boolean;
  colSpan: number;
  children: React.ReactNode;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [highlighted, setHighlighted] = useState(focused);
  useEffect(() => {
    if (!focused) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlighted(false), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const hasChildren = job.childrenTotal != null && job.childrenTotal > 0;

  return (
    <>
      <TableRow
        ref={rowRef}
        className={cn(
          highlighted &&
            "bg-primary/5 ring-1 ring-inset ring-primary transition-colors",
        )}
      >
        {children}
      </TableRow>
      {expanded && hasChildren && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={colSpan} className="py-3">
            <JobChildrenList jobId={job._id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function JobChildrenList({ jobId }: { jobId: string }) {
  const { data, isLoading } = useJobDetail(jobId);
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  if (!data?.children?.length) return null;
  return (
    <div className="space-y-2">
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
            <span className="text-muted-foreground tabular-nums">
              {done} / {total}
            </span>
            <div className="w-20">
              <Progress value={pct} className="h-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Task</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-2/3" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
