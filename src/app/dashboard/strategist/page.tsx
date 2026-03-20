"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MonoLabel } from "@/components/ui/mono-label";
import { KanbanBoard } from "./components/kanban-board";
import { Sparkles, CalendarDays, Plus, Loader2 } from "lucide-react";
import type { PipelineIdea } from "./components/kanban-card";

export default function StrategistPage() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-ideas"],
    queryFn: () =>
      api.get<Record<string, PipelineIdea[]>>("/v1/content/ideas?grouped=true"),
  });

  async function handleGetIdeas() {
    setGenerating("ideas");
    try {
      await api.post("/v1/content/suggest", {});
      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch {
      // error handled by UI
    }
    setGenerating(null);
  }

  async function handlePlanWeek() {
    setGenerating("plan");
    try {
      await api.get("/v1/content/weekly-plan");
      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch {
      // error handled by UI
    }
    setGenerating(null);
  }

  async function handleNewIdea() {
    const title = window.prompt("Idea title:");
    if (!title?.trim()) return;
    try {
      await api.post("/v1/content/ideas", { title: title.trim() });
      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch {
      // error
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="mb-2 font-display text-5xl font-extrabold tracking-tighter">
            Content Pipeline
          </h2>
          <p className="text-lg text-muted-foreground opacity-80">
            From idea to published — drag cards to move through stages
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleNewIdea}
            className="flex items-center gap-2 rounded-lg border border-border/30 bg-[--ph-surface-100] px-4 py-2.5 text-sm font-bold transition-all hover:bg-[--ph-surface-200]"
          >
            <Plus className="h-4 w-4" />
            New Idea
          </button>
          <button
            onClick={handleGetIdeas}
            disabled={generating === "ideas"}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {generating === "ideas" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Get Ideas
          </button>
          <button
            onClick={handlePlanWeek}
            disabled={generating === "plan"}
            className="flex items-center gap-2 rounded-lg border border-border/30 bg-[--ph-surface-100] px-4 py-2.5 text-sm font-bold transition-all hover:bg-[--ph-surface-200] disabled:opacity-50"
          >
            {generating === "plan" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="h-4 w-4" />
            )}
            Plan Week
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <div className="space-y-4 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <MonoLabel size="xs" color="muted">
              Loading pipeline...
            </MonoLabel>
          </div>
        </div>
      ) : data ? (
        <KanbanBoard
          data={data}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] })
          }
        />
      ) : (
        <div className="py-32 text-center">
          <p className="text-muted-foreground">
            No ideas yet. Click &ldquo;Get Ideas&rdquo; to generate AI
            suggestions.
          </p>
        </div>
      )}
    </div>
  );
}
