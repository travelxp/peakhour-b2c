import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ideaStatusLabel } from "@/lib/idea-status";

/** Look only: the words come from lib/idea-status.ts. */
export const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  brainstorm: { variant: "secondary" },
  planned: { variant: "outline", className: "border-state-info/30 text-state-info" },
  brief_ready: { variant: "outline", className: "border-state-info/30 text-state-info" },
  writing: { variant: "outline", className: "border-warning/40 text-warning" },
  in_progress: { variant: "outline", className: "border-warning/40 text-warning" },
  review: { variant: "outline", className: "border-state-progress/30 text-state-progress" },
  approved: { variant: "outline", className: "border-success/30 text-success" },
  scheduled: { variant: "outline", className: "border-state-info/30 text-state-info" },
  published: { variant: "outline", className: "border-success/30 text-success" },
  archived: { variant: "secondary", className: "opacity-60" },
};

export function PipelineStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.brainstorm;
  return (
    <Badge variant={config.variant} className={cn("text-xs", config.className, className)}>
      {ideaStatusLabel(status)}
    </Badge>
  );
}

export const PIPELINE_COLUMNS = [
  { key: "ideate", label: "Ideate", statuses: ["brainstorm", "planned"] },
  { key: "brief", label: "Brief", statuses: ["brief_ready"] },
  { key: "write", label: "Write", statuses: ["writing", "in_progress"] },
  { key: "review", label: "Review", statuses: ["review", "approved"] },
  { key: "publish", label: "Publish", statuses: ["scheduled", "published"] },
] as const;
