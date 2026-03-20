"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MonoLabel } from "@/components/ui/mono-label";
import { KanbanCard, type PipelineIdea } from "./kanban-card";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  id,
  label,
  color,
  ideas,
}: {
  id: string;
  label: string;
  color: string;
  ideas: PipelineIdea[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] w-64 shrink-0 flex-col rounded-xl border-t-2 bg-[--ph-bg-shell]/50 p-3",
        color,
        isOver && "bg-[--ph-accent-muted-2]"
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <MonoLabel size="xs" className="tracking-widest">
          {label}
        </MonoLabel>
        <span className="rounded-full bg-[--ph-surface-250] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {ideas.length}
        </span>
      </div>

      <SortableContext
        items={ideas.map((i) => i._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {ideas.map((idea) => (
            <KanbanCard key={idea._id} idea={idea} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
