"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import { KanbanColumn } from "./kanban-column";
import { PIPELINE_COLUMNS } from "./status-badge";
import { KanbanCard, type PipelineIdea } from "./kanban-card";

// Client-side state machine matching the API
const VALID_TRANSITIONS: Record<string, string[]> = {
  brainstorm: ["planned", "archived"],
  planned: ["brief_ready", "brainstorm", "archived"],
  brief_ready: ["writing", "planned", "archived"],
  writing: ["review", "brief_ready", "archived"],
  in_progress: ["review", "brief_ready", "archived"],
  review: ["approved", "writing", "archived"],
  approved: ["scheduled", "writing", "archived"],
  scheduled: ["published", "approved", "archived"],
  published: ["archived"],
};

interface KanbanBoardProps {
  data: Record<string, PipelineIdea[]>;
  onRefresh: () => void;
}

export function KanbanBoard({ data, onRefresh }: KanbanBoardProps) {
  const [localData, setLocalData] = useState(data);
  // The card being dragged, mirrored into a <DragOverlay>. Required now that
  // the board is a horizontal scroller: `overflow-x: auto` forces the computed
  // `overflow-y` to `auto` too, so the board clips to its padding box and a
  // card dragged up or out of it simply disappeared mid-drag. The overlay is
  // portaled and positioned outside that clip.
  const [activeIdea, setActiveIdea] = useState<PipelineIdea | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Sync when parent data changes
  useEffect(() => {
    setLocalData(data);
  }, [data]);

  function handleDragStart(event: DragStartEvent) {
    setActiveIdea((event.active.data.current?.idea as PipelineIdea) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    // Clear the overlay first — every path below returns or awaits, and
    // leaving it set would strand a floating card over the board.
    setActiveIdea(null);
    const { active, over } = event;
    if (!over) return;

    const ideaId = active.id as string;
    const overId = over.id as string;

    // Resolve which COLUMN was dropped onto. `over` is either the column
    // droppable (id = column key) OR — when dropping onto a column that
    // already has cards — one of its cards (a sortable droppable, id =
    // idea._id). Previously we only handled the column-key case, so any
    // drop onto a populated column silently no-opped (the visible "drag
    // and drop not working" bug). Map a card-over back to its column.
    let targetCol = PIPELINE_COLUMNS.find((c) => c.key === overId);
    if (!targetCol) {
      for (const [status, ideas] of Object.entries(localData)) {
        if (ideas.some((i) => i._id === overId)) {
          targetCol = PIPELINE_COLUMNS.find((c) =>
            (c.statuses as readonly string[]).includes(status),
          );
          break;
        }
      }
    }
    if (!targetCol) return;

    // Find the idea's current status
    let currentStatus = "";
    for (const [status, ideas] of Object.entries(localData)) {
      if (ideas.find((i) => i._id === ideaId)) {
        currentStatus = status;
        break;
      }
    }

    if (!currentStatus) return;

    // If already in this column group, do nothing
    if ((targetCol.statuses as readonly string[]).includes(currentStatus)) return;

    // Find the first valid target status from this column's statuses
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    const newStatus = (targetCol.statuses as readonly string[]).find((s) => allowed.includes(s));
    if (!newStatus) return;

    // Snapshot before optimistic update
    const preSnapshot = { ...localData };
    for (const key of Object.keys(preSnapshot)) {
      preSnapshot[key] = [...preSnapshot[key]];
    }

    const idea = localData[currentStatus].find((i) => i._id === ideaId);
    if (!idea) return;

    // Optimistic update
    setLocalData((prev) => {
      const next = { ...prev };
      next[currentStatus] = prev[currentStatus].filter((i) => i._id !== ideaId);
      next[newStatus] = [{ ...idea, status: newStatus }, ...(prev[newStatus] || [])];
      return next;
    });

    try {
      await api.patch(`/v1/content/ideas/${ideaId}/status`, { status: newStatus });
      onRefresh();
    } catch {
      // Revert to pre-drag snapshot
      setLocalData(preSnapshot);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveIdea(null)}
    >
      {/* The board scrolls sideways below `xl` instead of dividing whatever
          width it is given between five `flex-1` columns. It used to do the
          latter, with no min-width and no overflow, so the columns collapsed
          with the container: ~56px each on a 375px phone and ~83px at a 768px
          tablet with the sidebar expanded — narrow enough that a card title
          wrapped to a couple of characters per line.

          The columns carry `min-w-70 flex-1`, so there is no breakpoint to
          get wrong: they hold 280px and scroll when the board is narrower
          than 5x280 + gaps, and share the row once it is wider. A first
          attempt dropped the scroller at `xl` on the assumption the columns
          fit by then — they do not. Five 280px columns plus gaps need
          ~1448px of board, i.e. a ~1750px viewport with the sidebar
          expanded, so `xl` (1280px) handed back 186px columns and quietly
          reintroduced the very defect this fixes.

          No scroll-snap: dnd-kit auto-scrolls this container when a drag
          nears its edge, and mandatory snapping fights that.

          Note `overflow-x: auto` forces the computed `overflow-y` to `auto`
          too, so this clips its own children — which is why the dragged card
          renders in a <DragOverlay> below rather than in flow. */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_COLUMNS.map((col) => {
          // Merge ideas from all statuses that belong to this column group
          const ideas = col.statuses.flatMap((s) => localData[s] || []);
          return (
            <KanbanColumn
              key={col.key}
              id={col.key}
              label={col.label}
              ideas={ideas}
              onChanged={onRefresh}
            />
          );
        })}
      </div>

      {/* Portaled out of the clipping scroll container, so the card stays
          visible wherever the pointer takes it. `w-70` matches the column so
          the overlay is the same size as the card it replaces. */}
      <DragOverlay dropAnimation={null}>
        {activeIdea ? (
          <div className="w-70 cursor-grabbing">
            <KanbanCard idea={activeIdea} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
