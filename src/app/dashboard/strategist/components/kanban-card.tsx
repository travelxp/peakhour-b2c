"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Sparkles, GripVertical } from "lucide-react";

export interface PipelineIdea {
  _id: string;
  title: string;
  description?: string;
  status: string;
  source?: string;
  sector?: string;
  targetAudience?: string;
  contentType?: string;
  angle?: string;
  aiScore?: number;
  channels?: string[];
  priority?: number;
  targetDate?: string;
  scheduledAt?: string;
  brief?: { title?: string; generatedAt?: string };
  content?: { subject?: string; wordCount?: number; version?: number; lastEditedAt?: string };
  review?: { verdict?: string; notes?: string };
  publishing?: { beehiivPostId?: string; beehiivUrl?: string };
  createdAt?: string;
  updatedAt?: string;
}

/** Map status to pipeline step progress */
const STATUS_PROGRESS: Record<string, number> = {
  brainstorm: 0,
  planned: 1,
  brief_ready: 2,
  writing: 3,
  in_progress: 3,
  review: 4,
  approved: 4,
  scheduled: 5,
  published: 5,
};
const TOTAL_STEPS = 5;

function getPriorityLabel(score?: number): { label: string; className: string } | null {
  if (score == null) return null;
  if (score >= 8) return { label: "High", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" };
  if (score >= 6) return { label: "Medium", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" };
  return { label: "Low", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };
}

export function KanbanCard({ idea }: { idea: PipelineIdea }) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idea._id, data: { idea } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = getPriorityLabel(idea.aiScore);
  const progress = STATUS_PROGRESS[idea.status] ?? 0;
  const progressPct = Math.round((progress / TOTAL_STEPS) * 100);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all duration-150",
        "hover:shadow-md hover:border-primary/20",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/20",
      )}
      onClick={() => router.push(`/dashboard/strategist/${idea._id}`)}
    >
      {/* Title row with drag handle */}
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
        <h4 className="flex-1 text-sm font-medium leading-snug line-clamp-2">
          {idea.title}
        </h4>
        {idea.source === "ai_suggested" && (
          <Sparkles className="size-3 shrink-0 text-amber-500 mt-0.5" />
        )}
      </div>

      {/* Tags + priority row */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {priority && (
          <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px] font-medium border-0", priority.className)}>
            {priority.label}
          </Badge>
        )}
        {idea.sector && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {idea.sector}
          </Badge>
        )}
      </div>

      {/* Progress bar + metrics footer */}
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{progress}/{TOTAL_STEPS} steps</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
