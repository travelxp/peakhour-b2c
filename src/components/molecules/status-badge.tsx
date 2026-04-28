import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "muted";

const STATUS_STYLES: Record<StatusVariant, string> = {
  default:
    "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary dark:border-primary/30",
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  error:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  muted:
    "bg-muted text-muted-foreground border-border",
};

/** Map common status strings to visual variants */
const STATUS_MAP: Record<string, StatusVariant> = {
  // Draft/content statuses
  ingested: "muted",
  partial_tagged: "warning",
  tagged: "info",
  ready: "success",
  used: "default",
  archived: "muted",
  // Idea statuses
  brainstorm: "muted",
  planned: "info",
  brief_ready: "info",
  writing: "warning",
  in_progress: "warning",
  review: "warning",
  approved: "success",
  scheduled: "info",
  published: "success",
  // Campaign statuses
  draft: "muted",
  active: "success",
  paused: "warning",
  completed: "default",
  // Creative statuses
  generating: "warning",
  deployed: "success",
  retired: "muted",
  // Connection statuses
  connected: "success",
  disconnected: "error",
  expired: "error",
  error: "error",
  // Background-job statuses (Tasks dashboard)
  queued: "muted",
  cancelling: "warning",
  cancelled: "muted",
  failed: "error",
  done: "success",
};

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({
  status,
  variant,
  className,
  dot = false,
}: StatusBadgeProps) {
  const resolvedVariant = variant || STATUS_MAP[status] || "muted";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        STATUS_STYLES[resolvedVariant],
        className
      )}
    >
      {dot && (
        <span
          className={cn("mr-1.5 inline-block size-1.5 rounded-full", {
            "bg-primary": resolvedVariant === "default",
            "bg-emerald-500": resolvedVariant === "success",
            "bg-amber-500": resolvedVariant === "warning",
            "bg-red-500": resolvedVariant === "error",
            "bg-blue-500": resolvedVariant === "info",
            "bg-muted-foreground": resolvedVariant === "muted",
          })}
        />
      )}
      {label}
    </Badge>
  );
}
