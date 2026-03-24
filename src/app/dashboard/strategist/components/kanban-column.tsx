"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard, type PipelineIdea } from "./kanban-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLUMN_COLORS: Record<string, string> = {
  ideate: "bg-blue-500",
  brief: "bg-indigo-500",
  write: "bg-amber-500",
  review: "bg-purple-500",
  publish: "bg-emerald-500",
};

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
  const dotColor = COLUMN_COLORS[id] || "bg-muted-foreground";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-screen/2 flex-1 flex-col rounded-xl bg-muted/40 p-3",
        isOver && "bg-accent/50 ring-2 ring-primary/20"
      )}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", dotColor)} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-medium">
          {ideas.length}
        </Badge>
      </div>

      <SortableContext
        items={ideas.map((i) => i._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {ideas.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 py-12">
              <p className="text-xs text-muted-foreground/40">Drop here</p>
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
