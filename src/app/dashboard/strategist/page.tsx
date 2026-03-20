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
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState("");

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
    if (!newIdeaTitle.trim()) return;
    try {
      await api.post("/v1/content/ideas", { title: newIdeaTitle.trim() });
      setNewIdeaTitle("");
      setShowNewIdea(false);
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
            onClick={() => setShowNewIdea(!showNewIdea)}
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

      {/* New idea inline form */}
      {showNewIdea && (
        <div className="flex gap-3">
          <input
            autoFocus
            value={newIdeaTitle}
            onChange={(e) => setNewIdeaTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNewIdea()}
            placeholder="What's the idea?"
            className="flex-1 rounded-lg border border-border/15 bg-[--ph-bg-input] px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleNewIdea}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110"
          >
            Add
          </button>
          <button
            onClick={() => { setShowNewIdea(false); setNewIdeaTitle(""); }}
            className="rounded-lg border border-border/30 px-4 py-3 text-sm transition-all hover:bg-[--ph-surface-200]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-64 shrink-0 rounded-xl border-t-2 border-foreground/5 bg-[--ph-bg-shell]/50 p-3"
            >
              <div className="mb-3 h-3 w-20 animate-pulse rounded bg-[--ph-surface-250]" />
              {Array.from({ length: 2 - (i % 2) }).map((_, j) => (
                <div key={j} className="mb-2 rounded-lg border border-foreground/5 bg-[--ph-bg-card] p-4">
                  <div className="h-3.5 w-full animate-pulse rounded bg-[--ph-surface-250]" />
                  <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-[--ph-surface-200]" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-4 w-14 animate-pulse rounded-full bg-[--ph-surface-200]" />
                    <div className="h-4 w-10 animate-pulse rounded bg-[--ph-surface-200]" />
                  </div>
                </div>
              ))}
            </div>
          ))}
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
