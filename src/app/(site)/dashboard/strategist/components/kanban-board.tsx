"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import { KanbanColumn } from "./kanban-column";
import { PIPELINE_COLUMNS } from "./status-badge";
import type { PipelineIdea } from "./kanban-card";

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Sync when parent data changes
  useEffect(() => {
    setLocalData(data);
  }, [data]);

  async function handleDragEnd(event: DragEndEvent) {
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
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3">
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
    </DndContext>
  );
}
