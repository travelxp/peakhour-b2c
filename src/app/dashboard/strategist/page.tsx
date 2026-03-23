"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "./components/kanban-board";
import { Sparkles, CalendarDays, Plus, Loader2, CheckCircle } from "lucide-react";
import type { PipelineIdea } from "./components/kanban-card";

const SKILL_LABELS: Record<string, string> = {
  analyse_library: "Analysing content library",
  check_seasonality: "Checking seasonality",
  check_news: "Checking latest news",
  score_idea: "Scoring ideas",
  extract_content: "Reading articles",
  audience_insights: "Getting audience insights",
};

export default function StrategistPage() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ step: number; label: string } | null>(null);
  const [genResult, setGenResult] = useState<{ count: number; ideas: { topic: string }[] } | null>(null);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-ideas"],
    queryFn: () =>
      api.get<Record<string, PipelineIdea[]>>("/v1/content/ideas?grouped=true"),
  });

  const handleGetIdeas = useCallback(async () => {
    setGenerating(true);
    setGenProgress({ step: 0, label: "Starting..." });
    setGenResult(null);

    try {
      const res = await api.streamPost("/v1/content/suggest");
      const ct = res.headers.get("content-type") || "";

      if (!ct.includes("text/event-stream")) {
        // Fallback: non-streaming response
        const json = await res.json().catch(() => null);
        if (json?.data?.suggestions) {
          setGenResult({ count: json.data.suggestions.length, ideas: json.data.suggestions });
        }
        queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
        setGenerating(false);
        setGenProgress(null);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setGenerating(false); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const lines = raw.split("\n");
          let eventType = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) data = line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (eventType === "step") {
              const toolName = parsed.tools?.[0] || "";
              const label = parsed.label || SKILL_LABELS[toolName] || toolName || `Step ${parsed.step}`;
              setGenProgress({ step: parsed.step, label });
            } else if (eventType === "complete") {
              setGenResult({ count: parsed.count, ideas: parsed.ideas || [] });
            } else if (eventType === "error") {
              toast.error(parsed.message || "Failed to generate ideas");
            }
          } catch { /* skip malformed */ }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate ideas");
    }

    setGenerating(false);
    setGenProgress(null);
  }, [queryClient]);

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
          <Button size="sm" onClick={handleGetIdeas} disabled={generating}>
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Get Ideas
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

      {/* Generation progress dialog (overlays kanban) */}
      {(generating || genResult) && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {generating ? (
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
              <div>
                <p className="font-medium">Generating content ideas...</p>
                {genProgress && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    {genProgress.label}
                  </p>
                )}
              </div>
            </div>
          ) : genResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="font-medium">{genResult.count} ideas generated</p>
                <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setGenResult(null)}>Dismiss</Button>
              </div>
              <ul className="space-y-1 pl-8">
                {genResult.ideas.map((idea, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {idea.topic}</li>
                ))}
              </ul>
            </div>
          ) : null}
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
