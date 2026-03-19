"use client";

import { useState, useCallback } from "react";
import { api, API_BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { label } from "@/lib/content-labels";

// ── Types ────────────────────────────────────────────────────

interface SuggestResponse {
  suggestions: string;
  toolsUsed: string[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

interface BriefResponse {
  brief: {
    title: string;
    hook: string;
    angle: string;
    targetAudience: string;
    contentType: string;
    keyDataPoints: string[];
    outline: string[];
    estimatedLength: string;
    toneGuidance: string;
    suggestedPublishDay?: string;
    whyNow: string;
  } | null;
  reasoning: string;
  toolsUsed: string[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

// ── Main Page ────────────────────────────────────────────────

export default function StrategistPage() {
  const [mode, setMode] = useState<"suggest" | "brief" | "plan">("suggest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");

  // Suggest state
  const [suggestions, setSuggestions] = useState<SuggestResponse | null>(null);

  // Brief state
  const [brief, setBrief] = useState<BriefResponse | null>(null);

  // Plan state
  const [plan, setPlan] = useState<{ plan: string; toolsUsed: string[] } | null>(null);

  const [loadingMessage, setLoadingMessage] = useState("");

  const LOADING_MESSAGES = [
    "Analysing your content library...",
    "Checking audience gaps...",
    "Scanning seasonal events...",
    "Scoring content ideas...",
    "Generating data-driven suggestions...",
    "Evaluating ad potential...",
    "Building your strategy...",
  ];

  const runAgent = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuggestions(null);
    setBrief(null);
    setPlan(null);

    // Rotate loading messages
    let msgIdx = 0;
    setLoadingMessage(LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[msgIdx]);
    }, 3000);

    try {
      if (mode === "suggest") {
        const result = await api.post<SuggestResponse>(
          "/v1/content/suggest",
          topic ? { topic } : {}
        );
        setSuggestions(result);
      } else if (mode === "brief") {
        if (!topic.trim()) {
          setError("Enter a topic for the brief.");
          return;
        }
        const result = await api.post<BriefResponse>(
          "/v1/content/brief",
          { topic }
        );
        setBrief(result);
      } else if (mode === "plan") {
        const result = await api.get<{ plan: string; toolsUsed: string[] }>(
          "/v1/content/weekly-plan"
        );
        setPlan(result);
      }
    } catch (err: any) {
      setError(err.message || "Failed to get AI response. Please try again.");
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMessage("");
    }
  }, [mode, topic]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Content Strategist
        </h2>
        <p className="text-muted-foreground">
          AI-powered content strategy grounded in your library data
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <Button
          variant={mode === "suggest" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("suggest")}
        >
          Get Suggestions
        </Button>
        <Button
          variant={mode === "brief" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("brief")}
        >
          Generate Brief
        </Button>
        <Button
          variant={mode === "plan" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("plan")}
        >
          Weekly Plan
        </Button>
      </div>

      {/* Input area */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Input
              placeholder={
                mode === "suggest"
                  ? "Optional: focus on a topic (e.g., 'aviation', 'sustainability')..."
                  : mode === "brief"
                    ? "Enter the topic for your brief..."
                    : "Weekly plan generates automatically"
              }
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={mode === "plan" || loading}
              onKeyDown={(e) => e.key === "Enter" && !loading && runAgent()}
              className="flex-1"
            />
            <Button onClick={runAgent} disabled={loading}>
              {loading ? "Thinking..." : mode === "suggest" ? "Suggest" : mode === "brief" ? "Generate" : "Plan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-6 text-center space-y-3">
            <div className="inline-flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-sm font-medium">{loadingMessage}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              The AI is calling tools to analyse your content library before making suggestions. This takes 30-90 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-4">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Suggestions result */}
      {suggestions && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tools used:</span>
            {suggestions.toolsUsed.map((t, i) => (
              <Badge key={`${t}-${i}`} variant="secondary" className="text-xs">
                {label(undefined, t)}
              </Badge>
            ))}
            <span className="ml-auto">
              {suggestions.usage.totalTokens.toLocaleString()} tokens
            </span>
          </div>
          <Card>
            <CardContent className="p-6 prose prose-sm max-w-none">
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: formatMarkdown(suggestions.suggestions),
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Brief result */}
      {brief && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tools used:</span>
            {brief.toolsUsed.map((t, i) => (
              <Badge key={`${t}-${i}`} variant="secondary" className="text-xs">
                {label(undefined, t)}
              </Badge>
            ))}
          </div>

          {brief.brief ? (
            <Card>
              <CardHeader>
                <CardTitle>{brief.brief.title}</CardTitle>
                <CardDescription>{brief.brief.whyNow}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Hook</p>
                  <p className="text-sm italic mt-1">&ldquo;{brief.brief.hook}&rdquo;</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Angle</p>
                    <p className="mt-1">{brief.brief.angle}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Target</p>
                    <p className="mt-1">{brief.brief.targetAudience}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Type</p>
                    <p className="mt-1">{brief.brief.contentType}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Length</p>
                    <p className="mt-1">{brief.brief.estimatedLength}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Key Data Points</p>
                  <ul className="space-y-1">
                    {brief.brief.keyDataPoints.map((dp, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        {dp}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Outline</p>
                  <ol className="space-y-1">
                    {brief.brief.outline.map((section, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-muted-foreground font-mono text-xs">{i + 1}.</span>
                        {section}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tone</p>
                  <p className="text-sm mt-1">{brief.brief.toneGuidance}</p>
                </div>

                {brief.brief.suggestedPublishDay && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Best Day</p>
                    <p className="text-sm mt-1">{brief.brief.suggestedPublishDay}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 prose prose-sm max-w-none">
                <div
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(brief.reasoning),
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Plan result */}
      {plan && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tools used:</span>
            {plan.toolsUsed.map((t, i) => (
              <Badge key={`${t}-${i}`} variant="secondary" className="text-xs">
                {label(undefined, t)}
              </Badge>
            ))}
          </div>
          <Card>
            <CardContent className="p-6 prose prose-sm max-w-none">
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: formatMarkdown(plan.plan),
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Simple markdown-to-HTML for headings, bold, lists */
function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4"><span class="font-mono text-xs text-muted-foreground">$1.</span> $2</li>')
    .replace(/---/g, '<hr class="my-4 border-border" />');
}
