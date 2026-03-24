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

  const scoreColor =
    (idea.aiScore ?? 0) >= 8
      ? "bg-emerald-500"
      : (idea.aiScore ?? 0) >= 6
        ? "bg-amber-500"
        : (idea.aiScore ?? 0) >= 4
          ? "bg-orange-400"
          : "bg-muted";

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
      {/* Drag handle + source indicator */}
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium leading-snug line-clamp-2">
            {idea.title}
          </h4>
        </div>
        {idea.source === "ai_suggested" && (
          <Sparkles className="size-3 shrink-0 text-amber-500" />
        )}
      </div>

      {idea.description && (
        <p className="mt-1 ml-5.5 text-xs text-muted-foreground line-clamp-1">
          {idea.description}
        </p>
      )}

      {/* Tags */}
      {(idea.sector || idea.contentType) && (
        <div className="mt-2 ml-5.5 flex flex-wrap gap-1">
          {idea.sector && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {idea.sector}
            </Badge>
          )}
          {idea.contentType && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {idea.contentType}
            </Badge>
          )}
        </div>
      )}

      {/* Footer: score + word count */}
      {(idea.aiScore != null || idea.content?.wordCount) && (
        <div className="mt-2 ml-5.5 flex items-center justify-between text-xs text-muted-foreground">
          {idea.aiScore != null && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-10 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", scoreColor)}
                  style={{ width: `${idea.aiScore * 10}%` }}
                />
              </div>
              <span className="font-medium text-foreground text-[11px]">{idea.aiScore}</span>
            </div>
          )}
          {idea.content?.wordCount ? (
            <span className="text-[11px]">{idea.content.wordCount}w</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
