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
  onChanged,
}: {
  id: string;
  label: string;
  ideas: PipelineIdea[];
  onChanged?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const dotColor = COLUMN_COLORS[id] || "bg-muted-foreground";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // `min-h-screen/2` was not a real utility — Tailwind has no fractional
        // modifier for min-height, so it compiled to nothing and the column
        // had no minimum height at all. `min-h-80` (320px) is what it was
        // reaching for: enough that an empty column still reads as a drop
        // target.
        //
        // `min-w-70 flex-1`, not a width plus a breakpoint: 280px is the
        // narrowest width at which a KanbanCard's title, badge row and meta
        // line hold their layout, so it is a floor the column must never go
        // below — and above that it should use whatever room there is. This
        // pair says exactly that at every viewport. It replaced `w-70
        // shrink-0 xl:flex-1`, which handed back 186px columns from 1280px
        // (five 280px columns need a ~1750px viewport to fit).
        "flex min-h-80 min-w-70 flex-1 flex-col rounded-xl bg-muted/40 p-3",
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
            <KanbanCard key={idea._id} idea={idea} onChanged={onChanged} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
