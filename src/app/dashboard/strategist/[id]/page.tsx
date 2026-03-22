"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChannelIcon } from "@/components/ui/channel-icon";
import { PipelineStatusBadge } from "../components/status-badge";
import { PipelineStepper } from "../components/pipeline-stepper";
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
  Eye,
  ClipboardList,
  Check,
  Star,
  StickyNote,
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
};

interface StreamProgress { step: number; tools: string[]; label: string }

async function consumeSSE(
  res: Response,
  onStep: (p: StreamProgress) => void,
): Promise<{ event: string; data: any }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported");

  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent: { event: string; data: any } | null = null;

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
          onStep({ step: parsed.step, tools: parsed.tools, label: SKILL_LABELS[toolName] || toolName });
        }
        lastEvent = { event: eventType, data: parsed };
      } catch { /* skip malformed */ }
    }
  }

  if (!lastEvent) throw new Error("Stream ended without a result");
  if (lastEvent.event === "error") throw new Error(lastEvent.data.message || "Generation failed");
  return lastEvent;
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
    contentType?: string; keyDataPoints: string[]; outline: string[];
    estimatedLength: string; toneGuidance: string;
    suggestedPublishDay?: string; whyNow: string; generatedAt: string;
  };
  content?: {
    html: string; subject: string; previewText?: string;
    wordCount: number; version: number; lastEditedAt?: string;
  };
  review?: { submittedAt?: string; verdict?: string; notes?: string };
  publishing?: { beehiivPostId?: string; beehiivUrl?: string; publishedAt?: string };
  createdAt?: string;
  updatedAt?: string;
}

const TABS = ["overview", "brief", "write", "review", "publish"] as const;
type Tab = (typeof TABS)[number];

const STATUS_TAB_MAP: Record<string, Tab> = {
  brainstorm: "overview",
  planned: "overview",
  brief_ready: "brief",
  writing: "write",
  review: "review",
  approved: "publish",
  scheduled: "publish",
  published: "publish",
  in_progress: "write",
};

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
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: idea, isLoading } = useQuery({
    queryKey: ["idea-detail", ideaId],
    queryFn: () => api.get<IdeaDetail>(`/v1/content/ideas/${ideaId}`),
  });

  useEffect(() => {
    if (idea?.status) {
      setActiveTab(STATUS_TAB_MAP[idea.status] || "overview");
    }
  }, [idea?.status]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["idea-detail", ideaId] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
  }

  async function action(path: string, body?: any) {
    setLoading(path);
    try {
      await api.post(`/v1/content/ideas/${ideaId}/${path}`, body || {});
      refresh();
      toast.success(ACTION_LABELS[path] || "Done");
    } catch (err: any) {
      toast.error(err?.message || "Action failed");
    }
    setLoading(null);
  }

  if (isLoading || !idea) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
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

        {/* Pipeline Stepper */}
        <PipelineStepper currentStatus={idea.status} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
          <TabsList variant="line">
            <TabsTrigger value="overview">
              <Eye className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="brief">
              <ClipboardList className="h-3.5 w-3.5" />
              Brief
              {idea.brief && <Check className="h-3 w-3 text-emerald-500" />}
            </TabsTrigger>
            <TabsTrigger value="write">
              <Pen className="h-3.5 w-3.5" />
              Write
              {idea.content?.html && <Check className="h-3 w-3 text-emerald-500" />}
            </TabsTrigger>
            <TabsTrigger value="review">
              <Send className="h-3.5 w-3.5" />
              Review
              {idea.review?.verdict === "approved" && <Check className="h-3 w-3 text-emerald-500" />}
            </TabsTrigger>
            <TabsTrigger value="publish">
              <ExternalLink className="h-3.5 w-3.5" />
              Publish
              {idea.publishing?.beehiivPostId && <Check className="h-3 w-3 text-emerald-500" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab idea={idea} />
          </TabsContent>
          <TabsContent value="brief">
            <BriefTab idea={idea} ideaId={ideaId} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="write">
            <WriteTab idea={idea} ideaId={ideaId} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="review">
            <ReviewTab idea={idea} loading={loading} onSubmitReview={() => action("submit-review")} onApprove={() => action("approve")} onReject={(notes: string) => action("reject-review", { notes })} />
          </TabsContent>
          <TabsContent value="publish">
            <PublishTab idea={idea} loading={loading} onSchedule={(date: string) => action("schedule", { scheduledAt: date })} onPublish={() => action("publish")} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function OverviewTab({ idea }: { idea: IdeaDetail }) {
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
                ["Created", idea.createdAt ? new Date(idea.createdAt).toLocaleString() : null],
                ["Updated", idea.updatedAt ? new Date(idea.updatedAt).toLocaleString() : null],
                ["Target", idea.targetDate ? new Date(idea.targetDate).toLocaleDateString() : null],
                ["Scheduled", idea.scheduledAt ? new Date(idea.scheduledAt).toLocaleString() : null],
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
    } catch (err: any) {
      toast.error(err?.message || "Brief generation failed");
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
          <CardContent><ul className="space-y-1.5">{b.keyDataPoints.map((p, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{p}</li>)}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Outline</CardTitle></CardHeader>
          <CardContent><ol className="space-y-1.5">{b.outline.map((s, i) => <li key={i} className="text-sm"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{s}</li>)}</ol></CardContent>
        </Card>
      </div>
    </div>
  );
}

function WriteTab({ idea, ideaId, onRefresh }: { idea: IdeaDetail; ideaId: string; onRefresh: () => void }) {
  const [html, setHtml] = useState(idea.content?.html || "");
  const [subject, setSubject] = useState(idea.content?.subject || "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);

  useEffect(() => {
    if (idea.content?.html) setHtml(idea.content.html);
    if (idea.content?.subject) setSubject(idea.content.subject);
  }, [idea.content?.html, idea.content?.subject]);

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
    } catch (err: any) {
      toast.error(err?.message || "Content generation failed");
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

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Subject Line</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line..." />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Content</label>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {idea.content?.wordCount != null && <span>{idea.content.wordCount} words · v{idea.content.version}</span>}
          </div>
        </div>
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={20} className="w-full rounded-md border bg-background p-4 font-mono text-sm outline-none focus:ring-1 focus:ring-ring" placeholder="Newsletter content (HTML)..." />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
        </Button>
        <Button variant="outline" onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          Regenerate
        </Button>
      </div>
    </div>
  );
}

function ReviewTab({ idea, loading, onSubmitReview, onApprove, onReject }: { idea: IdeaDetail; loading: string | null; onSubmitReview: () => void; onApprove: () => void; onReject: (n: string) => void }) {
  const [rejectNotes, setRejectNotes] = useState("");

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
      <Card>
        <CardHeader><CardTitle>Review Content</CardTitle><CardDescription>Approve or request revisions.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {idea.content?.subject && <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Subject</p><p className="font-medium">{idea.content.subject}</p></div>}
          <div className="flex gap-2">
            <Button onClick={onApprove} disabled={loading === "approve"} className="bg-emerald-600 hover:bg-emerald-500">
              {loading === "approve" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1.5 h-4 w-4" />}Approve
            </Button>
            <Input value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Revision notes..." className="flex-1" />
            <Button variant="outline" onClick={() => { if (!rejectNotes.trim()) { toast.warning("Add revision notes before rejecting"); return; } onReject(rejectNotes); }} disabled={loading === "reject-review"} className="text-destructive border-destructive/30">
              <XCircle className="mr-1.5 h-4 w-4" />Revise
            </Button>
          </div>
          {idea.review?.verdict === "revision_requested" && idea.review.notes && (
            <div className="rounded-md border-destructive/20 bg-destructive/5 p-3 text-sm"><p className="text-xs text-muted-foreground mb-1">Previous notes</p>{idea.review.notes}</div>
          )}
        </CardContent>
      </Card>
    );
  }

  return <Card><CardContent className="py-8"><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-500" /><span className="font-medium">{idea.review?.verdict === "approved" ? "Approved" : "Reviewed"}</span></div>{idea.review?.notes && <p className="mt-2 text-sm text-muted-foreground">{idea.review.notes}</p>}</CardContent></Card>;
}

function PublishTab({ idea, loading, onSchedule, onPublish }: { idea: IdeaDetail; loading: string | null; onSchedule: (d: string) => void; onPublish: () => void }) {
  const [scheduleDate, setScheduleDate] = useState("");

  if (idea.publishing?.beehiivPostId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="font-medium">Published to Beehiiv</span></div>
          {idea.publishing.publishedAt && <p className="mt-1 text-sm text-muted-foreground">Published {new Date(idea.publishing.publishedAt).toLocaleString()}</p>}
          {idea.publishing.beehiivUrl && <a href={idea.publishing.beehiivUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />View on Beehiiv</a>}
        </CardContent>
      </Card>
    );
  }

  if (!["approved", "scheduled"].includes(idea.status)) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Content must be approved before publishing.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Schedule & Publish</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Schedule Date</label>
            <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => { if (!scheduleDate) { toast.warning("Select a date first"); return; } onSchedule(new Date(scheduleDate).toISOString()); }} disabled={loading === "schedule"}>
            <Calendar className="mr-1.5 h-4 w-4" />Schedule
          </Button>
        </div>
        <div className="border-t pt-4">
          <p className="mb-3 text-sm text-muted-foreground">Push as a draft to Beehiiv. You can finalize and send from your Beehiiv dashboard.</p>
          <Button onClick={onPublish} disabled={loading === "publish"}>
            {loading === "publish" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Push to Beehiiv
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
