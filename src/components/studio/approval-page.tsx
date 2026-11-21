"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlowButton, FlowCard, FlowHead, FlowNotice, FlowPage, FlowSpinner } from "@/components/marketing/flow/flow-kit";
import { answerApproval, fetchApproval, type ApprovalPicture } from "@/lib/api/studio-share";
import { safeHref } from "@/lib/demand-insights";
import { STUDIO_COPY } from "@/lib/studio-copy";

const P = STUDIO_COPY.approvalPage;

export type ApprovalView =
  | { step: "loading" }
  | { step: "ready"; picture: ApprovalPicture }
  | { step: "thanks"; business: string; message: string }
  | { step: "answered"; business: string }
  | { step: "stopped"; business?: string }
  | { step: "error" };

export interface ApprovalPageViewProps {
  view: ApprovalView;
  name: string;
  comment: string;
  busy: boolean;
  /** An answer that did not go through, said plainly; the picture stays so the person can try again. */
  problem?: string;
  onName: (v: string) => void;
  onComment: (v: string) => void;
  onAnswer: (answer: "approved" | "rejected") => void;
  onRetry: () => void;
}

/**
 * The page an approval link opens (UX spec S18). PUBLIC: no account, no dashboard. It shows ONE picture (the 768 px preview the link was made for), the business's name, a name
 * field and two answers. Nothing else of the business's is on it: the api sends nothing else. The picture's address is checked before it is used.
 */
export function ApprovalPageView({ view, name, comment, busy, problem, onName, onComment, onAnswer, onRetry }: ApprovalPageViewProps) {
  if (view.step === "loading") {
    return (
      <FlowCard aria-busy="true">
        <h1 className="sr-only">{P.title}</h1>
        <p role="status" className="flex items-center justify-center gap-2.5 py-8 text-sm text-muted-foreground">
          <FlowSpinner />
          {P.loading}
        </p>
      </FlowCard>
    );
  }
  if (view.step === "stopped") {
    return (
      <FlowCard>
        <FlowHead icon={ImageOff} tone="warn" title={P.title}>
          <span role="alert">{P.stopped(view.business)}</span>
        </FlowHead>
      </FlowCard>
    );
  }
  if (view.step === "error") {
    return (
      <FlowCard>
        <FlowHead icon={ImageOff} tone="bad" title={P.title}>
          <span role="alert">{P.error}</span>
        </FlowHead>
        <div className="mt-5">
          <FlowButton onClick={onRetry}>{P.retry}</FlowButton>
        </div>
      </FlowCard>
    );
  }
  if (view.step === "thanks" || view.step === "answered") {
    return (
      <FlowCard>
        <FlowHead icon={CheckCircle2} tone="ok" title={P.title}>
          <span role="status">{view.step === "thanks" ? view.message || P.thanks(view.business) : P.already}</span>
        </FlowHead>
      </FlowCard>
    );
  }
  return <ReadyCard view={view} name={name} comment={comment} busy={busy} problem={problem} onName={onName} onComment={onComment} onAnswer={onAnswer} onRetry={onRetry} />;
}

/**
 * The picture and its two answers. The answers are offered only while the picture can be seen: an address that is not http or https, or a picture that does not load,
 * shows the error and no buttons, so nobody approves what they were not shown.
 */
function ReadyCard({ view, name, comment, busy, problem, onName, onComment, onAnswer }: ApprovalPageViewProps & { view: Extract<ApprovalView, { step: "ready" }> }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { picture } = view;
  const src = safeHref(picture.imageUrl);
  const w = picture.width ?? 768;
  const h = picture.height ?? 960;
  const needName = name.trim().length === 0;
  const seen = !!src && !imgFailed;
  return (
    <FlowCard>
      <FlowHead title={P.title}>{P.from(picture.business)}</FlowHead>
      <div className="mt-5 space-y-4">
        {seen ? (
          <div style={{ aspectRatio: `${w} / ${h}` }} className="w-full overflow-hidden rounded-2xl bg-muted">
            {/* A plain img: the link is a short-lived signed address, and its load error is not ours to optimise. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- merchant media stays off the optimiser (see MediaImage) */}
            <img onError={() => setImgFailed(true)} src={src} alt={P.imageAlt(picture.business)} width={w} height={h} decoding="async" className="size-full object-contain" />
          </div>
        ) : (
          <FlowNotice tone="warn" role="alert">
            {P.error}
          </FlowNotice>
        )}
        {!seen ? null : picture.answered ? (
          <FlowNotice tone="info" role="status">
            {P.answeredEarlier}
          </FlowNotice>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="studio-approval-name">{P.nameLabel(picture.business)}</Label>
              <Input
                id="studio-approval-name"
                value={name}
                maxLength={120}
                autoComplete="name"
                className="h-12"
                aria-describedby={needName ? "studio-approval-name-hint" : undefined}
                onChange={(e) => onName(e.target.value)}
              />
              {needName && (
                <p id="studio-approval-name-hint" className="text-xs text-muted-foreground">
                  {P.needName}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studio-approval-comment">{P.commentLabel}</Label>
              <Textarea id="studio-approval-comment" value={comment} maxLength={500} rows={2} onChange={(e) => onComment(e.target.value)} />
            </div>
            {problem && (
              <FlowNotice tone="bad" role="alert">
                {problem}
              </FlowNotice>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FlowButton disabled={needName || busy} onClick={() => onAnswer("approved")}>
                {P.approve}
              </FlowButton>
              <FlowButton variant="ghost" disabled={needName || busy} onClick={() => onAnswer("rejected")}>
                {P.notYet}
              </FlowButton>
            </div>
            <p className="text-xs text-muted-foreground">{P.privacy}</p>
          </>
        )}
      </div>
    </FlowCard>
  );
}

/** The public approval page: reads the link, shows the one picture, sends one answer. */
export function ApprovalPage({ token }: { token: string }) {
  const [view, setView] = useState<ApprovalView>({ step: "loading" });
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchApproval(token).then((r) => {
      if (!live) return;
      if (r.kind === "ready") setView({ step: "ready", picture: r.picture });
      else if (r.kind === "stopped") setView({ step: "stopped", ...(r.business ? { business: r.business } : {}) });
      else setView({ step: "error" });
    });
    return () => {
      live = false;
    };
  }, [token, attempt]);

  const answer = async (a: "approved" | "rejected") => {
    if (view.step !== "ready" || busy) return;
    const business = view.picture.business;
    setBusy(true);
    setProblem(undefined);
    const r = await answerApproval(token, { answer: a, name, ...(comment.trim() ? { comment } : {}) });
    setBusy(false);
    if (r.kind === "thanks") setView({ step: "thanks", business, message: r.message });
    else if (r.kind === "already") setView({ step: "answered", business });
    else if (r.kind === "stopped") setView({ step: "stopped", business: r.business ?? business });
    else if (r.kind === "busy") setProblem(P.busy);
    else setProblem(P.error);
  };

  return (
    <FlowPage>
      <ApprovalPageView
        view={view}
        name={name}
        comment={comment}
        busy={busy}
        {...(problem ? { problem } : {})}
        onName={setName}
        onComment={setComment}
        onAnswer={(a) => void answer(a)}
        onRetry={() => {
          setView({ step: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    </FlowPage>
  );
}
