"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { PageHeader } from "@/components/dashboard/page-shell";
import { ApiError } from "@/lib/api";
import { NEEDS_OK_HREF } from "@/lib/nav-copy";
import { channelLabel } from "@/lib/drive/copy";
import { driveAbilities } from "@/lib/drive/files-state";
import { useAuth } from "@/providers/auth-provider";
import { FirstCommentField } from "@/components/composer/first-comment-field";
import { useMediaRules } from "@/lib/media-rules";
import { firstCommentOverBy, firstCommentRuleOf } from "@/lib/first-comment";
import {
  useDecideRepurposedBatch,
  useRepurposedBatch,
  type RepurposedBatch,
  type VariantEffect,
} from "@/hooks/use-repurposed-batch";

/** The channel key the media rules and the api use: the old "twitter" key is X. */
const channelKey = (p: string): string => (p.toLowerCase() === "twitter" ? "x" : p.toLowerCase());

/** A platform key as a merchant reads it: the shared channel labels, with the old "twitter" key folded into X. */
const platformLabel = (p: string): string => channelLabel(channelKey(p));

/** What this screen says about a batch that can no longer be decided here. */
export function closedSentence(b: RepurposedBatch): string {
  switch (b.status) {
    case "approved":
    case "scheduled":
    case "published":
      return b.decidedVia === "whatsapp" ? "Approved on WhatsApp. Nothing more to do here." : "Approved. Nothing more to do here.";
    case "discarded":
    case "skipped":
      return "Rejected. Nothing goes out.";
    case "expired":
      return "These drafts waited too long for an answer and were closed. Repurpose the source again to get fresh drafts.";
    case "pending_approval":
      // Still pending but past its window (the sweep has not closed it yet).
      return "These drafts waited too long for an answer and can no longer be approved here. Repurpose the source again to get fresh drafts.";
    default:
      return "These drafts are no longer waiting for your approval.";
  }
}

/** One variant's line: what approving does for it. */
export function effectSentence(e: VariantEffect | undefined): string {
  if (!e) return "";
  switch (e.outcome) {
    case "will_publish":
      return e.via === "approval_flow"
        ? "Goes out when you approve: Peakhour publishes it to LinkedIn now."
        : "Goes out when you approve: Peakhour queues it for the next few minutes.";
    case "already_done":
      return e.reason ?? "Already handled.";
    default:
      return e.reason ?? "Will not be published.";
  }
}

/** The line above the buttons: how many of the drafts actually go out. Never "the whole set" when part of it will not. */
export function approveSummary(effects: VariantEffect[]): string {
  const total = effects.length;
  const out = effects.filter((e) => e.outcome === "will_publish").length;
  if (total === 0) return "Approving is free.";
  if (out === total) return `Approving sends all ${total} draft${total === 1 ? "" : "s"} out. Approving is free.`;
  if (out === 0) return "None of these drafts can go out right now (see each one below). Approving only marks them approved. Approving is free.";
  return `Approving sends ${out} of ${total} drafts out; the others will not be published (see each one below). Approving is free.`;
}

export function RepurposedReview({ id }: { id: string }) {
  const { data: batch, isLoading, isError, error, refetch } = useRepurposedBatch(id);
  const decide = useDecideRepurposedBatch(id);
  const rules = useMediaRules();
  // What the person typed in each first-comment box, by channel. A channel with no entry shows the writer's suggestion; an entry (even blank) is the person's own words.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const { org, orgs } = useAuth();
  const canEdit = driveAbilities(orgs?.find((o) => o._id === org?._id)?.role).canEdit;

  // The live region exists from the first render (a region mounted WITH its text is not announced), and holds the result.
  const [announcement, setAnnouncement] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link href={NEEDS_OK_HREF}>
        <ArrowLeft className="size-4" />
        Back to Needs your OK
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <>
        {back}
        <PageHeader title="Repurposed posts" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </>
    );
  }
  const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
  if (isError && !notFound) {
    // A dropped connection or a server error says nothing about the drafts: never "not found".
    return (
      <>
        {back}
        <PageHeader title="Repurposed posts" />
        <EmptyState
          icon={Repeat2}
          title="Could not load these drafts"
          description="Something went wrong on our side, and your drafts are untouched. Try again in a moment."
          action={{ label: "Try again", onClick: () => void refetch() }}
        />
      </>
    );
  }
  if (isError || !batch) {
    return (
      <>
        {back}
        <PageHeader title="Repurposed posts" />
        <EmptyState
          icon={Repeat2}
          title="Drafts not found"
          description="These drafts may belong to another business, or may have been removed. Head back to Needs your OK."
          action={{ label: "Back to Needs your OK", href: NEEDS_OK_HREF }}
        />
      </>
    );
  }

  const showBoxes = batch.canDecide && canEdit;
  // The api reads ONE first comment per channel (the channel's first variant), so only that variant gets a box.
  const hasBox = (index: number): boolean => batch.variants.findIndex((x) => channelKey(x.platform) === channelKey(batch.variants[index]!.platform)) === index;
  /** What this variant's box shows: the person's own words if they typed (or cleared it), else the writer's suggestion. */
  const commentOf = (v: RepurposedBatch["variants"][number]): string => edits[channelKey(v.platform)] ?? v.firstComment ?? "";
  /** The boxes the person changed from what was suggested: sent with the approval, blank clearing the suggestion. */
  const changedComments = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [i, v] of batch.variants.entries()) {
      if (!hasBox(i)) continue;
      const channel = channelKey(v.platform);
      if (edits[channel] !== undefined && edits[channel]!.trim() !== (v.firstComment ?? "").trim()) out[channel] = edits[channel]!.trim();
    }
    return out;
  };
  // A comment over its channel's length cannot be approved: the api would refuse it, and says so here first.
  const tooLong = showBoxes && batch.variants.some((v, i) => hasBox(i) && firstCommentOverBy(firstCommentRuleOf(rules.data, channelKey(v.platform)), commentOf(v)) > 0);

  async function run(decision: "approve" | "reject") {
    // One decision at a time: a second confirm while one is in flight (or its refetch is landing) is ignored.
    if (decide.isPending) return;
    try {
      const firstComments = decision === "approve" ? changedComments() : undefined;
      const res = await decide.mutateAsync(decision === "approve" ? { decision, ...(firstComments ? { firstComments } : {}) } : { decision });
      // Already decided elsewhere (WhatsApp, a teammate): say so, as information, not as this click's success.
      (res.alreadyDecided ? toast.info : toast.success)(res.message);
      setAnnouncement(res.message);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "That did not go through. Please try again.";
      toast.error(message);
      setAnnouncement(message);
    }
    // A tick later: the closing dialog hands focus back to its trigger in a timeout of its own, and ours must land after.
    setTimeout(() => statusRef.current?.focus(), 0);
  }

  const effects = batch.approveEffect;
  const effectFor = (platform: string) => effects.find((e) => e.platform === platform);
  const pending = decide.isPending;

  return (
    <>
      {back}
      <PageHeader
        title="Repurposed posts"
        description={`Drafts made from “${batch.title}”, one per channel. Each one below says whether approving sends it out.`}
      />
      {batch.mediaUrls.length > 0 && (
        <ul aria-label="Pictures" className="flex flex-wrap gap-2">
          {batch.mediaUrls.map((u, i) => (
            <li key={u}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Picture ${i + 1} of ${batch.mediaUrls.length}`} className="h-24 w-24 rounded-md border object-cover" />
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-3">
        {batch.variants.map((v, i) => {
          const effect = batch.canDecide ? effectFor(v.platform) : undefined;
          return (
            <li key={`${v.platform}-${i}`} className="rounded-lg border p-4">
              <h2 className="text-sm font-semibold">{platformLabel(v.platform)}</h2>
              {v.hook && <p className="mt-1 text-sm font-medium">{v.hook}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm">{v.text}</p>
              {v.hashtags.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{v.hashtags.join(" ")}</p>}
              {showBoxes && hasBox(i) && (
                <div className="mt-3">
                  <FirstCommentField
                    channel={channelKey(v.platform)}
                    value={commentOf(v)}
                    onChange={(next) => setEdits((prev) => ({ ...prev, [channelKey(v.platform)]: next }))}
                    readOnly={pending}
                  />
                </div>
              )}
              {effect && (
                <p data-effect={effect.outcome} className={`mt-2 text-xs ${effect.outcome === "will_publish" ? "text-muted-foreground" : "font-medium"}`}>
                  {effectSentence(effect)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {/* Present from the first render, so a result written into it is announced; focus moves here after a decision. */}
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="text-sm outline-none" data-testid="decision-status">
        {announcement}
      </p>
      {batch.canDecide ? (
        canEdit ? (
          <div className="space-y-2" aria-busy={pending}>
            <p className="text-sm text-muted-foreground">{approveSummary(effects)} You can also reply YES on WhatsApp.</p>
            <div className="flex items-center gap-2">
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={pending}>
                    Reject
                  </Button>
                }
                title="Reject these drafts?"
                description="Nothing from this set goes out. To get new drafts, repurpose the source again."
                confirmLabel="Reject"
                variant="destructive"
                confirmDisabled={pending}
                onConfirm={() => run("reject")}
              />
              <ConfirmDialog
                trigger={<Button disabled={pending || tooLong}>Approve</Button>}
                title="Approve these drafts?"
                description={approveSummary(effects)}
                confirmLabel="Approve"
                confirmDisabled={pending || tooLong}
                onConfirm={() => run("approve")}
              />
            </div>
          </div>
        ) : (
          <p className="rounded-lg border bg-muted/40 p-4 text-sm">
            Only an editor, admin or owner can approve or reject these drafts. Ask one of them to open this page, or to reply YES on WhatsApp.
          </p>
        )
      ) : (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm">{closedSentence(batch)}</p>
      )}
    </>
  );
}
