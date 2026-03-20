"use client";

import { useState } from "react";
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
  if (data !== localData && JSON.stringify(data) !== JSON.stringify(localData)) {
    setLocalData(data);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const ideaId = active.id as string;
    const newStatus = over.id as string;

    // Find the idea's current status
    let currentStatus = "";
    for (const [status, ideas] of Object.entries(localData)) {
      if (ideas.find((i) => i._id === ideaId)) {
        currentStatus = status;
        break;
      }
    }

    if (!currentStatus || currentStatus === newStatus) return;

    // Optimistic update
    const idea = localData[currentStatus].find((i) => i._id === ideaId);
    if (!idea) return;

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
      // Revert on failure
      setLocalData(data);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            id={col.key}
            label={col.label}
            color={col.color}
            ideas={localData[col.key] || []}
          />
        ))}
      </div>
    </DndContext>
  );
}
