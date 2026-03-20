"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard, type PipelineIdea } from "./kanban-card";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  id,
  label,
  ideas,
}: {
  id: string;
  label: string;
  ideas: PipelineIdea[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-75 w-60 shrink-0 flex-col rounded-lg border bg-muted/30 p-2",
        isOver && "bg-accent/30"
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1 py-1">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {ideas.length}
        </span>
      </div>

      <SortableContext
        items={ideas.map((i) => i._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          {ideas.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded border border-dashed py-8">
              <p className="text-xs text-muted-foreground/50">Drop here</p>
            </div>
          )}
          {ideas.map((idea) => (
            <KanbanCard key={idea._id} idea={idea} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
