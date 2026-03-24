"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "./components/kanban-board";
import { Sparkles, CalendarDays, Plus, Loader2, CheckCircle, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineIdea } from "./components/kanban-card";

const SKILL_LABELS: Record<string, string> = {
  analyse_library: "Analysing content library",
  check_seasonality: "Checking seasonality",
  check_news: "Checking latest news",
  score_idea: "Scoring ideas",
  extract_content: "Reading articles",
  audience_insights: "Getting audience insights",
};

/** Shared SSE reader for both Get Ideas and Plan Week */
async function readSSEStream(
  res: Response,
  onStep: (p: { step: number; label: string }) => void,
  onComplete: (data: { count: number; ideas: { topic: string }[] }) => void,
  onError: (msg: string) => void,
) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    // Non-SSE response — try to parse as JSON
    const json = await res.json().catch(() => null);
    if (json?.data?.suggestions) {
      onComplete({ count: json.data.suggestions.length, ideas: json.data.suggestions });
    } else if (json?.error) {
      onError(json.error.message || "Failed");
    }
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) return;

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
          onStep({ step: parsed.step, label: parsed.label || SKILL_LABELS[toolName] || toolName || `Step ${parsed.step}` });
        } else if (eventType === "complete") {
          onComplete({ count: parsed.count ?? 0, ideas: parsed.ideas || [] });
        } else if (eventType === "error") {
          onError(parsed.message || "Failed");
        }
      } catch { /* skip malformed */ }
    }
  }
}

export default function StrategistPage() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [genMode, setGenMode] = useState<"ideas" | "plan" | null>(null);
  const [genProgress, setGenProgress] = useState<{ step: number; label: string } | null>(null);
  const [genResult, setGenResult] = useState<{ count: number; ideas: { topic: string }[] } | null>(null);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [showTopicInput, setShowTopicInput] = useState(false);
  const [ideaTopic, setIdeaTopic] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-ideas"],
    queryFn: () =>
      api.get<Record<string, PipelineIdea[]>>("/v1/content/ideas?grouped=true"),
  });

  const handleGetIdeas = useCallback(async (topic?: string) => {
    setGenerating(true);
    setGenMode("ideas");
    setGenProgress({ step: 0, label: "Starting..." });
    setGenResult(null);
    setShowTopicInput(false);

    try {
      const body = topic?.trim() ? { topic: topic.trim() } : undefined;
      const res = await api.streamPost("/v1/content/suggest", body);
      await readSSEStream(res, setGenProgress, setGenResult, (msg) => toast.error(msg));
      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate ideas");
    }

    setGenerating(false);
    setGenProgress(null);
    setGenMode(null);
    setIdeaTopic("");
  }, [queryClient]);

  const handlePlanWeek = useCallback(async () => {
    setGenerating(true);
    setGenMode("plan");
    setGenProgress({ step: 0, label: "Planning your week..." });
    setGenResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/v1/content/weekly-plan`, { credentials: "include" });
      if (!res.ok) { toast.error("Failed to plan week"); setGenerating(false); setGenProgress(null); setGenMode(null); return; }
      await readSSEStream(res, setGenProgress, setGenResult, (msg) => toast.error(msg));
      queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to plan week");
    }

    setGenerating(false);
    setGenProgress(null);
    setGenMode(null);
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

  const progressLabel = genMode === "plan" ? "Planning your week..." : "Generating content ideas...";

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
          <Button variant="outline" size="sm" onClick={() => { setShowNewIdea(!showNewIdea); setShowTopicInput(false); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Idea
          </Button>
          <Button size="sm" onClick={() => { setShowTopicInput(!showTopicInput); setShowNewIdea(false); }} disabled={generating}>
            {genMode === "ideas" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Get Ideas
          </Button>
          <Button variant="outline" size="sm" onClick={handlePlanWeek} disabled={generating}>
            {genMode === "plan" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-1.5 h-4 w-4" />}
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

      {/* Topic input for AI idea generation */}
      {showTopicInput && !generating && (
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Generate content ideas</p>
          </div>
          <Textarea
            autoFocus
            value={ideaTopic}
            onChange={(e) => setIdeaTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGetIdeas(ideaTopic); }
              if (e.key === "Escape") { setShowTopicInput(false); setIdeaTopic(""); }
            }}
            placeholder="Optional: describe a topic, angle, or trend to focus on... (leave empty for AI to decide based on your content + latest news)"
            className="min-h-16 resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              AI will check latest news, analyse your library, and suggest 7 prioritised ideas
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowTopicInput(false); setIdeaTopic(""); }}>Cancel</Button>
              <Button size="sm" onClick={() => handleGetIdeas(ideaTopic)} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generation progress card */}
      {(generating || genResult) && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {generating ? (
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
              <div>
                <p className="font-medium">{progressLabel}</p>
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
              {genResult.ideas.length > 0 && (
                <ul className="space-y-1 pl-8">
                  {genResult.ideas.map((idea, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{idea.topic}</li>
                  ))}
                </ul>
              )}
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
