import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  brainstorm: { label: "Brainstorm", variant: "secondary" },
  planned: { label: "Planned", variant: "outline", className: "border-blue-500/30 text-blue-500" },
  brief_ready: { label: "Brief Ready", variant: "outline", className: "border-indigo-500/30 text-indigo-500" },
  writing: { label: "Writing", variant: "outline", className: "border-amber-500/30 text-amber-500" },
  in_progress: { label: "Writing", variant: "outline", className: "border-amber-500/30 text-amber-500" },
  review: { label: "Review", variant: "outline", className: "border-purple-500/30 text-purple-500" },
  approved: { label: "Approved", variant: "outline", className: "border-emerald-500/30 text-emerald-500" },
  scheduled: { label: "Scheduled", variant: "outline", className: "border-cyan-500/30 text-cyan-500" },
  published: { label: "Published", variant: "outline", className: "border-green-500/30 text-green-500" },
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
  { key: "brainstorm", label: "Brainstorm", color: "" },
  { key: "planned", label: "Planned", color: "" },
  { key: "brief_ready", label: "Brief Ready", color: "" },
  { key: "writing", label: "Writing", color: "" },
  { key: "review", label: "Review", color: "" },
  { key: "approved", label: "Approved", color: "" },
  { key: "scheduled", label: "Scheduled", color: "" },
  { key: "published", label: "Published", color: "" },
] as const;
