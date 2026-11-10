"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { api, newActionKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ActionCost } from "@/components/dashboard/action-cost";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, FileText, ExternalLink } from "lucide-react";
import { safeHref } from "@/lib/demand-insights";
import { IdeaDetail, StreamProgress, consumeSSE } from "./shared";

export function BriefTab({ idea, ideaId, onRefresh }: { idea: IdeaDetail; ideaId: string; onRefresh: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setProgress(null);
    try {
      const res = await api.streamPost(`/v1/content/ideas/${ideaId}/generate-brief`, undefined, newActionKey());
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
              <ActionCost action="contentBrief" className="mt-2 block text-xs" />
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
            const dotColor = confidence === "verified" ? "bg-success" : confidence === "inferred" ? "bg-warning" : confidence === "ai_estimated" ? "bg-destructive" : "bg-primary";
            return (
              <li key={i} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                  <span>{claim}</span>
                </div>
                {isObj && (
                  <div className="ml-4 mt-1 flex items-center gap-2">
                    <Badge variant={confidence === "verified" ? "default" : confidence === "inferred" ? "secondary" : "destructive"} className="text-micro">{confidence}</Badge>
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
          {m.seoKeywords?.length ? <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">SEO keywords</p><div className="flex flex-wrap gap-1.5 mt-1">{m.seoKeywords.map((k) => <Badge key={k} variant="secondary" className="text-micro">{k}</Badge>)}</div></div> : null}
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
              ? <span className="text-destructive-on-tint font-medium">{blockingQuotes.length} quote(s) need confirmation before publish</span>
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
                        <Badge variant={statusTone} className="text-micro">{q.status}</Badge>
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
              : <span className="text-warning-on-tint font-medium">No disclosure copy — Suggest Disclosure helper required before publish</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {m.sponsorName && <div><p className="text-xs text-muted-foreground">Sponsor</p><p className="text-sm font-medium">{m.sponsorName}</p></div>}
            {m.ctaBlock && (
              <div>
                <p className="text-xs text-muted-foreground">CTA</p>
                {/* The CTA URL is model/merchant-supplied: only an http(s) URL becomes a
                    link, so a `javascript:` value can never run on click. */}
                <p className="text-sm">
                  {m.ctaBlock.label} →{" "}
                  {safeHref(m.ctaBlock.url) ? (
                    <a href={safeHref(m.ctaBlock.url)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{m.ctaBlock.url}</a>
                  ) : (
                    <span className="break-all">{m.ctaBlock.url}</span>
                  )}
                </p>
              </div>
            )}
          </div>
          {m.disclosureCopy && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Disclosure (FTC)</p>
              <p className="text-sm bg-warning/10 border border-warning/30 rounded-md p-3">{m.disclosureCopy}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
