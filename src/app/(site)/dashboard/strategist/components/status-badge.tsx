import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  brainstorm: { label: "Brainstorm", variant: "secondary" },
  planned: { label: "Planned", variant: "outline", className: "border-state-info/30 text-state-info" },
  brief_ready: { label: "Brief Ready", variant: "outline", className: "border-state-info/30 text-state-info" },
  writing: { label: "Writing", variant: "outline", className: "border-warning/40 text-warning" },
  in_progress: { label: "Writing", variant: "outline", className: "border-warning/40 text-warning" },
  review: { label: "Review", variant: "outline", className: "border-state-progress/30 text-state-progress" },
  approved: { label: "Approved", variant: "outline", className: "border-success/30 text-success" },
  scheduled: { label: "Scheduled", variant: "outline", className: "border-state-info/30 text-state-info" },
  published: { label: "Published", variant: "outline", className: "border-success/30 text-success" },
  archived: { label: "Archived", variant: "secondary", className: "opacity-60" },
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
      {config.label}
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
