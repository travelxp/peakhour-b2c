"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MonoLabel } from "@/components/ui/mono-label";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PipelineStatusBadge } from "../components/status-badge";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  FileText,
  Pen,
  Send,
  CheckCircle,
  XCircle,
  Calendar,
  ExternalLink,
} from "lucide-react";

interface IdeaDetail {
  _id: string;
  title: string;
  description?: string;
  status: string;
  source?: string;
  sector?: string;
  targetAudience?: string;
  contentType?: string;
  angle?: string;
  aiScore?: number;
  channels?: string[];
  priority?: number;
  targetDate?: string;
  scheduledAt?: string;
  tags?: string[];
  notes?: string;
  brief?: {
    title: string;
    hook: string;
    angle: string;
    targetAudience: string;
    contentType?: string;
    keyDataPoints: string[];
    outline: string[];
    estimatedLength: string;
    toneGuidance: string;
    suggestedPublishDay?: string;
    whyNow: string;
    generatedAt: string;
  };
  content?: {
    html: string;
    subject: string;
    previewText?: string;
    wordCount: number;
    version: number;
    lastEditedAt?: string;
  };
  review?: {
    submittedAt?: string;
    verdict?: string;
    notes?: string;
  };
  publishing?: {
    beehiivPostId?: string;
    beehiivUrl?: string;
    publishedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const TABS = ["overview", "brief", "write", "review", "publish"] as const;
type Tab = (typeof TABS)[number];

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ideaId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: idea, isLoading } = useQuery({
    queryKey: ["idea-detail", ideaId],
    queryFn: () => api.get<IdeaDetail>(`/v1/content/ideas/${ideaId}`),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["idea-detail", ideaId] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
  }

  async function action(path: string, body?: any) {
    setLoading(path);
    try {
      await api.post(`/v1/content/ideas/${ideaId}/${path}`, body || {});
      refresh();
    } catch (err: any) {
      alert(err?.message || "Action failed");
    }
    setLoading(null);
  }

  if (isLoading || !idea) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusIndex = ["brainstorm", "planned", "brief_ready", "writing", "review", "approved", "scheduled", "published"].indexOf(idea.status);

  return (
    <div className="space-y-8">
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
            <PipelineStatusBadge status={idea.status} className="mb-3" />
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              {idea.title}
            </h1>
            {idea.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {idea.description}
              </p>
            )}
          </div>

          {/* Metadata sidebar */}
          <div className="flex flex-wrap gap-3">
            {idea.sector && (
              <span className="rounded-full border border-border/30 px-3 py-1 text-xs uppercase">
                {idea.sector}
              </span>
            )}
            {idea.contentType && (
              <span className="rounded bg-[--ph-surface-250] px-2 py-1 font-mono text-xs">
                {idea.contentType}
              </span>
            )}
            {idea.aiScore != null && (
              <span className="rounded bg-[--ph-accent-muted] px-2 py-1 font-mono text-xs text-primary">
                Score: {idea.aiScore}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-border/15">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 pb-4 text-sm font-bold capitalize transition-colors ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            {tab === "brief" ? "Brief" : tab === "write" ? "Write" : tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab idea={idea} />
      )}

      {activeTab === "brief" && (
        <BriefTab
          idea={idea}
          loading={loading}
          onGenerate={() => action("generate-brief")}
        />
      )}

      {activeTab === "write" && (
        <WriteTab
          idea={idea}
          ideaId={ideaId}
          loading={loading}
          onGenerate={() => action("generate-content")}
          onRefresh={refresh}
        />
      )}

      {activeTab === "review" && (
        <ReviewTab
          idea={idea}
          loading={loading}
          onSubmitReview={() => action("submit-review")}
          onApprove={() => action("approve")}
          onReject={(notes: string) => action("reject-review", { notes })}
        />
      )}

      {activeTab === "publish" && (
        <PublishTab
          idea={idea}
          loading={loading}
          onSchedule={(date: string) => action("schedule", { scheduledAt: date })}
          onPublish={() => action("publish")}
        />
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────

function OverviewTab({ idea }: { idea: IdeaDetail }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <GlassPanel padding="md">
        <MonoLabel size="xs" color="muted" className="mb-4 block">Metadata</MonoLabel>
        <dl className="space-y-3">
          {[
            ["Source", idea.source],
            ["Sector", idea.sector],
            ["Audience", idea.targetAudience],
            ["Content Type", idea.contentType],
            ["Angle", idea.angle],
            ["Channels", idea.channels?.join(", ")],
          ].map(([label, value]) =>
            value ? (
              <div key={label as string} className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ) : null
          )}
        </dl>
      </GlassPanel>
      <GlassPanel padding="md">
        <MonoLabel size="xs" color="muted" className="mb-4 block">Timeline</MonoLabel>
        <dl className="space-y-3">
          {[
            ["Created", idea.createdAt ? new Date(idea.createdAt).toLocaleString() : null],
            ["Updated", idea.updatedAt ? new Date(idea.updatedAt).toLocaleString() : null],
            ["Target Date", idea.targetDate ? new Date(idea.targetDate).toLocaleDateString() : null],
            ["Scheduled", idea.scheduledAt ? new Date(idea.scheduledAt).toLocaleString() : null],
          ].map(([label, value]) =>
            value ? (
              <div key={label as string} className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ) : null
          )}
        </dl>
      </GlassPanel>
    </div>
  );
}

// ── Brief Tab ─────────────────────────────────────────────────

function BriefTab({
  idea,
  loading,
  onGenerate,
}: {
  idea: IdeaDetail;
  loading: string | null;
  onGenerate: () => void;
}) {
  if (!idea.brief) {
    return (
      <div className="py-16 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="mb-6 text-muted-foreground">
          No brief generated yet. AI will analyze your library, score the idea,
          and create a detailed brief.
        </p>
        <button
          onClick={onGenerate}
          disabled={loading === "generate-brief"}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
        >
          {loading === "generate-brief" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Brief
        </button>
      </div>
    );
  }

  const b = idea.brief;
  return (
    <div className="space-y-6">
      <GlassPanel padding="lg">
        <h3 className="font-display text-2xl font-bold">{b.title}</h3>
        <p className="mt-2 text-lg italic text-muted-foreground">{b.hook}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Angle", b.angle],
            ["Audience", b.targetAudience],
            ["Type", b.contentType],
            ["Length", b.estimatedLength],
            ["Publish Day", b.suggestedPublishDay],
          ].map(([label, value]) =>
            value ? (
              <div key={label as string}>
                <MonoLabel size="xs" color="muted">{label}</MonoLabel>
                <p className="mt-1 text-sm font-medium">{value}</p>
              </div>
            ) : null
          )}
        </div>

        <div className="mt-6">
          <MonoLabel size="xs" color="muted" className="mb-2 block">Tone Guidance</MonoLabel>
          <p className="text-sm text-muted-foreground">{b.toneGuidance}</p>
        </div>

        {b.whyNow && (
          <div className="mt-4">
            <MonoLabel size="xs" color="muted" className="mb-2 block">Why Now</MonoLabel>
            <p className="text-sm text-muted-foreground">{b.whyNow}</p>
          </div>
        )}
      </GlassPanel>

      <div className="grid gap-6 md:grid-cols-2">
        <GlassPanel padding="md">
          <MonoLabel size="xs" color="muted" className="mb-3 block">Key Data Points</MonoLabel>
          <ul className="space-y-2">
            {b.keyDataPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {p}
              </li>
            ))}
          </ul>
        </GlassPanel>
        <GlassPanel padding="md">
          <MonoLabel size="xs" color="muted" className="mb-3 block">Outline</MonoLabel>
          <ol className="space-y-2">
            {b.outline.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0 font-mono text-xs text-primary">
                  {i + 1}.
                </span>
                {s}
              </li>
            ))}
          </ol>
        </GlassPanel>
      </div>
    </div>
  );
}

// ── Write Tab ─────────────────────────────────────────────────

function WriteTab({
  idea,
  ideaId,
  loading,
  onGenerate,
  onRefresh,
}: {
  idea: IdeaDetail;
  ideaId: string;
  loading: string | null;
  onGenerate: () => void;
  onRefresh: () => void;
}) {
  const [html, setHtml] = useState(idea.content?.html || "");
  const [subject, setSubject] = useState(idea.content?.subject || "");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  if (!idea.brief) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Generate a brief first before writing content.
      </div>
    );
  }

  if (!idea.content?.html && !html) {
    return (
      <div className="py-16 text-center">
        <Pen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="mb-6 text-muted-foreground">
          AI will write the first draft from your brief. You can edit it
          afterwards.
        </p>
        <button
          onClick={onGenerate}
          disabled={loading === "generate-content"}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
        >
          {loading === "generate-content" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate First Draft
        </button>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/v1/content/ideas/${ideaId}/content`, { html, subject });
      setLastSaved(new Date().toLocaleTimeString());
      onRefresh();
    } catch {
      alert("Save failed");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Subject line */}
      <div>
        <MonoLabel size="xs" color="muted" className="mb-2 block">Subject Line</MonoLabel>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-border/15 bg-[--ph-bg-input] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
          placeholder="Email subject line..."
        />
      </div>

      {/* Content editor (textarea for now — TipTap can be added later) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <MonoLabel size="xs" color="muted">Content</MonoLabel>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <MonoLabel size="xs" color="faint">
                Saved {lastSaved}
              </MonoLabel>
            )}
            {idea.content?.wordCount && (
              <MonoLabel size="xs" color="faint">
                {idea.content.wordCount} words • v{idea.content.version}
              </MonoLabel>
            )}
          </div>
        </div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={20}
          className="w-full rounded-lg border border-border/15 bg-[--ph-bg-input] p-4 font-mono text-sm outline-none focus:border-primary"
          placeholder="Newsletter content (HTML)..."
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Content
        </button>
        <button
          onClick={onGenerate}
          disabled={loading === "generate-content"}
          className="flex items-center gap-2 rounded-lg border border-border/30 px-4 py-3 text-sm font-bold transition-all hover:bg-[--ph-surface-200] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          Regenerate
        </button>
      </div>
    </div>
  );
}

// ── Review Tab ────────────────────────────────────────────────

function ReviewTab({
  idea,
  loading,
  onSubmitReview,
  onApprove,
  onReject,
}: {
  idea: IdeaDetail;
  loading: string | null;
  onSubmitReview: () => void;
  onApprove: () => void;
  onReject: (notes: string) => void;
}) {
  const [rejectNotes, setRejectNotes] = useState("");

  if (idea.status === "writing" || idea.status === "brief_ready") {
    return (
      <div className="py-16 text-center">
        <Send className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="mb-6 text-muted-foreground">
          {idea.content?.html
            ? "Content is ready. Submit it for review when you're satisfied."
            : "Write the content first before submitting for review."}
        </p>
        {idea.content?.html && (
          <button
            onClick={onSubmitReview}
            disabled={loading === "submit-review"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading === "submit-review" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit for Review
          </button>
        )}
      </div>
    );
  }

  if (idea.status === "review") {
    return (
      <div className="space-y-6">
        <GlassPanel padding="lg">
          <h3 className="font-display text-xl font-bold">Review Content</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Review the content and approve or request revisions.
          </p>

          {idea.content?.subject && (
            <div className="mt-4 rounded-lg bg-[--ph-surface-200] p-4">
              <MonoLabel size="xs" color="muted" className="mb-1 block">Subject</MonoLabel>
              <p className="font-bold">{idea.content.subject}</p>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={onApprove}
              disabled={loading === "approve"}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve
            </button>
            <div className="flex flex-1 gap-2">
              <input
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Revision notes..."
                className="flex-1 rounded-lg border border-border/15 bg-[--ph-bg-input] px-4 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  if (!rejectNotes.trim()) return alert("Please add revision notes");
                  onReject(rejectNotes);
                }}
                disabled={loading === "reject-review"}
                className="flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-3 text-sm font-bold text-red-400 transition-all hover:bg-red-500/10 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Request Revision
              </button>
            </div>
          </div>
        </GlassPanel>

        {idea.review?.verdict === "revision_requested" && idea.review.notes && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <MonoLabel size="xs" color="muted" className="mb-2 block">Previous Revision Notes</MonoLabel>
            <p className="text-sm">{idea.review.notes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <GlassPanel padding="lg">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-6 w-6 text-emerald-500" />
        <div>
          <p className="font-bold">Content {idea.review?.verdict === "approved" ? "Approved" : "Reviewed"}</p>
          {idea.review?.notes && (
            <p className="mt-1 text-sm text-muted-foreground">{idea.review.notes}</p>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

// ── Publish Tab ───────────────────────────────────────────────

function PublishTab({
  idea,
  loading,
  onSchedule,
  onPublish,
}: {
  idea: IdeaDetail;
  loading: string | null;
  onSchedule: (date: string) => void;
  onPublish: () => void;
}) {
  const [scheduleDate, setScheduleDate] = useState("");

  if (idea.publishing?.beehiivPostId) {
    return (
      <GlassPanel padding="lg">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-bold">Published to Beehiiv</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {idea.publishing.publishedAt
                ? `Published ${new Date(idea.publishing.publishedAt).toLocaleString()}`
                : "Published"}
            </p>
          </div>
        </div>
        {idea.publishing.beehiivUrl && (
          <a
            href={idea.publishing.beehiivUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-primary transition-colors hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            View on Beehiiv
          </a>
        )}
      </GlassPanel>
    );
  }

  if (!["approved", "scheduled"].includes(idea.status)) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Content must be approved before publishing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel padding="lg">
        <h3 className="font-display text-xl font-bold">Schedule & Publish</h3>

        <div className="mt-6 flex items-end gap-4">
          <div className="flex-1">
            <MonoLabel size="xs" color="muted" className="mb-2 block">Schedule Date</MonoLabel>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full rounded-lg border border-border/15 bg-[--ph-bg-input] px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => {
              if (!scheduleDate) return alert("Select a date first");
              onSchedule(new Date(scheduleDate).toISOString());
            }}
            disabled={loading === "schedule"}
            className="flex items-center gap-2 rounded-lg border border-border/30 px-4 py-3 text-sm font-bold transition-all hover:bg-[--ph-surface-200] disabled:opacity-50"
          >
            <Calendar className="h-4 w-4" />
            Schedule
          </button>
        </div>

        <div className="mt-8 border-t border-border/15 pt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Push this content as a draft to Beehiiv. You can finalize and send it from your Beehiiv dashboard.
          </p>
          <button
            onClick={onPublish}
            disabled={loading === "publish"}
            className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading === "publish" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Push to Beehiiv
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
