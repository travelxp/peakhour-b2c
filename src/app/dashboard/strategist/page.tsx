"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
    } catch { /* error */ }
    setGenerating(null);
  }

  async function handlePlanWeek() {
    setGenerating("plan");
    try {
      await api.get("/v1/content/weekly-plan");
      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch { /* error */ }
    setGenerating(null);
  }

  async function handleNewIdea() {
    if (!newIdeaTitle.trim()) return;
    try {
      await api.post("/v1/content/ideas", { title: newIdeaTitle.trim() });
      setNewIdeaTitle("");
      setShowNewIdea(false);
      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch { /* error */ }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Content Pipeline</h2>
          <p className="text-muted-foreground">
            From idea to published — drag cards to move through stages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewIdea(!showNewIdea)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Idea
          </Button>
          <Button size="sm" onClick={handleGetIdeas} disabled={generating === "ideas"}>
            {generating === "ideas" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Get Ideas
          </Button>
          <Button variant="outline" size="sm" onClick={handlePlanWeek} disabled={generating === "plan"}>
            {generating === "plan" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-1.5 h-4 w-4" />}
            Plan Week
          </Button>
        </div>
      </div>

      {/* New idea inline form */}
      {showNewIdea && (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newIdeaTitle}
            onChange={(e) => setNewIdeaTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNewIdea();
              if (e.key === "Escape") { setShowNewIdea(false); setNewIdeaTitle(""); }
            }}
            placeholder="What's the idea?"
            className="flex-1"
          />
          <Button size="sm" onClick={handleNewIdea}>Add</Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowNewIdea(false); setNewIdeaTitle(""); }}>Cancel</Button>
        </div>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-60 shrink-0 rounded-lg border bg-muted/30 p-2">
              <Skeleton className="mb-2 h-3 w-16" />
              {Array.from({ length: 2 - (i % 2) }).map((_, j) => (
                <div key={j} className="mb-1.5 rounded-lg border bg-card p-3">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="mt-1.5 h-2.5 w-2/3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : data ? (
        <KanbanBoard
          data={data}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] })}
        />
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            No ideas yet. Click &ldquo;Get Ideas&rdquo; to generate AI suggestions.
          </p>
        </div>
      )}
    </div>
  );
}
