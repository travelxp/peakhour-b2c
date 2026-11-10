"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RejectReasonDialog } from "@/components/molecules/reject-reason-dialog";
import { Loader2, Send, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { IdeaDetail, sanitizeContentHtml } from "./shared";

export function ReviewTab({ idea, loading, onSubmitReview, onApprove, onReject }: { idea: IdeaDetail; loading: string | null; onSubmitReview: () => void; onApprove: () => void; onReject: (n: string) => Promise<void> }) {
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
              <Button onClick={onApprove} disabled={loading === "approve"} className="bg-success hover:bg-success/25">
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

  return <Card><CardContent className="py-8"><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-success" /><span className="font-medium">{idea.review?.verdict === "approved" ? "Approved" : "Reviewed"}</span></div>{idea.review?.notes && <p className="mt-2 text-sm text-muted-foreground">{idea.review.notes}</p>}</CardContent></Card>;
}

export function DataCitationsPanel({ citations }: { citations: NonNullable<IdeaDetail["content"]>["dataCitations"] }) {
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
            const borderColor = c.confidence === "verified" ? "border-success/40" : c.confidence === "inferred" ? "border-warning/40" : "border-destructive/30";
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
