"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
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
        "cursor-pointer rounded-lg border bg-card p-3 transition-all duration-150 hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <h4 className="text-sm font-medium leading-snug line-clamp-2">
        {idea.title}
      </h4>

      {idea.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {idea.description}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {idea.sector && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {idea.sector}
          </span>
        )}
        {idea.contentType && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
            {idea.contentType}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {idea.aiScore != null && (
          <div className="flex items-center gap-1">
            <span className="font-medium text-foreground">{idea.aiScore}</span>
            <div className="h-1 w-8 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${idea.aiScore * 10}%` }}
              />
            </div>
          </div>
        )}
        {idea.content?.wordCount && (
          <span>{idea.content.wordCount}w</span>
        )}
      </div>
    </div>
  );
}
