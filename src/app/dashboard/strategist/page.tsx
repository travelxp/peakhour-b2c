"use client";

import { useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
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

const LOADING_MESSAGES = [
  "Analysing your content library...",
  "Checking audience gaps...",
  "Scanning seasonal events...",
  "Scoring content ideas...",
  "Generating data-driven suggestions...",
  "Evaluating ad potential...",
  "Building your strategy...",
];

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
  const abortRef = useRef<AbortController | null>(null);

  const runAgent = useCallback(async () => {
    // Validate before starting (prevents loading flicker)
    if (mode === "brief" && !topic.trim()) {
      setError("Enter a topic for the brief.");
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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
      if (controller.signal.aborted) return;

      if (mode === "suggest") {
        const result = await api.post<SuggestResponse>(
          "/v1/content/suggest",
          topic ? { topic } : {}
        );
        if (!controller.signal.aborted) setSuggestions(result);
      } else if (mode === "brief") {
        const result = await api.post<BriefResponse>(
          "/v1/content/brief",
          { topic }
        );
        if (!controller.signal.aborted) setBrief(result);
      } else if (mode === "plan") {
        const result = await api.get<{ plan: string; toolsUsed: string[] }>(
          "/v1/content/weekly-plan"
        );
        if (!controller.signal.aborted) setPlan(result);
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setError(err.message || "Failed to get AI response. Please try again.");
      }
    } finally {
      clearInterval(interval);
      if (!controller.signal.aborted) {
        setLoading(false);
        setLoadingMessage("");
      }
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
            <ToolBadges tools={suggestions.toolsUsed ?? []} />
            <span className="ml-auto">
              {(suggestions.usage?.totalTokens ?? 0).toLocaleString()} tokens
            </span>
          </div>
          <Card>
            <CardContent className="p-6 prose prose-sm max-w-none">
              <MarkdownContent content={suggestions.suggestions} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Brief result */}
      {brief && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tools used:</span>
            <ToolBadges tools={brief.toolsUsed ?? []} />
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
                    {(brief.brief.keyDataPoints ?? []).map((dp, i) => (
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
                    {(brief.brief.outline ?? []).map((section, i) => (
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
                <MarkdownContent content={brief.reasoning} />
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
            <ToolBadges tools={plan.toolsUsed ?? []} />
          </div>
          <Card>
            <CardContent className="p-6 prose prose-sm max-w-none">
              <MarkdownContent content={plan.plan} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Simple markdown-to-HTML for headings, bold, lists */
/** Deduplicate tool names and show counts */
function ToolBadges({ tools }: { tools: string[] }) {
  const counts = new Map<string, number>();
  for (const t of tools) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return (
    <>
      {Array.from(counts.entries()).map(([name, count]) => (
        <Badge key={name} variant="secondary" className="text-xs">
          {label(undefined, name)}
          {count > 1 && <span className="ml-1 text-muted-foreground">×{count}</span>}
        </Badge>
      ))}
    </>
  );
}

/** Styled markdown renderer */
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mt-5 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>,
        p: ({ children }) => <p className="text-sm leading-relaxed mb-3">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
        hr: () => <hr className="my-4 border-border" />,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/30 pl-4 my-3 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
