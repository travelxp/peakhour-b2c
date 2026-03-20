import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  brainstorm: { label: "Brainstorm", dot: "bg-gray-400", text: "text-gray-400" },
  planned: { label: "Planned", dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]", text: "text-blue-400" },
  brief_ready: { label: "Brief Ready", dot: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]", text: "text-indigo-400" },
  writing: { label: "Writing", dot: "bg-[--ph-amber-500] shadow-[0_0_8px_rgba(245,158,11,0.5)]", text: "text-[--ph-amber-400]" },
  in_progress: { label: "Writing", dot: "bg-[--ph-amber-500] shadow-[0_0_8px_rgba(245,158,11,0.5)]", text: "text-[--ph-amber-400]" },
  review: { label: "Review", dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]", text: "text-purple-400" },
  approved: { label: "Approved", dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]", text: "text-emerald-400" },
  scheduled: { label: "Scheduled", dot: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]", text: "text-cyan-400" },
  published: { label: "Published", dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]", text: "text-green-400" },
  archived: { label: "Archived", dot: "bg-gray-500", text: "text-gray-500" },
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
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      <span className={cn("font-mono text-[10px] uppercase tracking-widest", config.text)}>
        {config.label}
      </span>
    </div>
  );
}

export const PIPELINE_COLUMNS = [
  { key: "brainstorm", label: "Brainstorm", color: "border-gray-500/30" },
  { key: "planned", label: "Planned", color: "border-blue-500/30" },
  { key: "brief_ready", label: "Brief Ready", color: "border-indigo-500/30" },
  { key: "writing", label: "Writing", color: "border-[--ph-amber-500]/30" },
  { key: "review", label: "Review", color: "border-purple-500/30" },
  { key: "approved", label: "Approved", color: "border-emerald-500/30" },
  { key: "scheduled", label: "Scheduled", color: "border-cyan-500/30" },
  { key: "published", label: "Published", color: "border-green-500/30" },
] as const;
