"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { cn } from "@/lib/utils";

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/dashboard/strategist/${idea._id}`)}
      className={cn(
        "animate-card-in cursor-pointer rounded-lg border border-foreground/6 bg-[--ph-bg-card] p-4 transition-all duration-200 hover:border-primary/25 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
        isDragging && "opacity-50 shadow-xl rotate-2 scale-105"
      )}
    >
      <h4 className="font-display text-sm font-bold leading-snug line-clamp-2">
        {idea.title}
      </h4>

      {idea.description && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
          {idea.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {idea.sector && (
          <span className="rounded-full border border-border/30 px-2 py-0.5 text-[9px] uppercase text-muted-foreground">
            {idea.sector}
          </span>
        )}
        {idea.contentType && (
          <span className="rounded bg-[--ph-surface-250] px-1.5 py-0.5 font-mono text-[9px]">
            {idea.contentType}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {idea.aiScore != null && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-primary">{idea.aiScore}</span>
            <div className="h-1 w-8 overflow-hidden rounded-full bg-[--ph-surface-250]">
              <div className="h-full bg-primary" style={{ width: `${idea.aiScore * 10}%` }} />
            </div>
          </div>
        )}
        {idea.content?.wordCount && (
          <MonoLabel size="xs" color="faint">
            {idea.content.wordCount}w
          </MonoLabel>
        )}
      </div>
    </div>
  );
}
