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
    "bg-success/10 text-success-on-tint border-success/30",
  warning:
    "bg-warning/10 text-warning-on-tint border-warning/30",
  error:
    "bg-destructive/10 text-destructive-on-tint border-destructive/30",
  info: "bg-state-info/10 text-state-info-on-tint border-state-info/30",
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
  needs_reauth: "warning",
  // Background-job statuses (Tasks dashboard + /cms/jobs ops view)
  queued: "muted",
  pending: "info",
  running: "warning",
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
            "bg-success": resolvedVariant === "success",
            "bg-warning": resolvedVariant === "warning",
            "bg-destructive": resolvedVariant === "error",
            "bg-state-info": resolvedVariant === "info",
            "bg-muted-foreground": resolvedVariant === "muted",
          })}
        />
      )}
      {label}
    </Badge>
  );
}
