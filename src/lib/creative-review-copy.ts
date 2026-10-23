/**
 * D-05c — the creative-review screen and the guardrails card's approved-assets
 * switch, as pure functions.
 *
 * ★THE API DECIDES WHAT "APPROVED" MEANS; THIS FILE ONLY SAYS IT. Each
 * creative arrives with `approvalState` (the engine gate's own reading: the
 * approval still matches the copy) and `canApprove`/`canWithdraw` (what the
 * approval writer will accept). Nothing here re-derives either, so the screen
 * cannot call a creative approved that the engine would refuse, nor offer a
 * button the api refuses.
 */
import type { CreativeReviewItem, CreativeStatus, CreativesSummary } from "@/lib/api/growth";
import { GUARDRAIL_CHANNELS } from "@/lib/guardrails-copy";

/** Where the screen lives (not under /dashboard/ads: the hub is one surface). */
export const CREATIVE_REVIEW_PATH = "/dashboard/growth/creatives";

export type CreativeFilterKey = "to_review" | "approved" | "running" | "retired" | "all";

/** The screen's tabs, in order. `statuses: []` = every status. */
export const CREATIVE_FILTERS: ReadonlyArray<{ key: CreativeFilterKey; label: string; statuses: readonly CreativeStatus[] }> = [
  { key: "to_review", label: "To review", statuses: ["draft", "review"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "running", label: "Running or ran", statuses: ["deployed", "paused"] },
  { key: "retired", label: "Retired", statuses: ["retired"] },
  { key: "all", label: "All", statuses: [] },
];

export function filterFor(key: string | null | undefined) {
  return CREATIVE_FILTERS.find((f) => f.key === key) ?? CREATIVE_FILTERS[0]!;
}

export function platformLabel(key: string): string {
  return GUARDRAIL_CHANNELS.find((c) => c.key === key)?.label ?? key;
}

const FORMAT_LABELS: Readonly<Record<string, string>> = {
  single_image: "Single image",
  carousel: "Carousel",
  video: "Video",
  lead_gen_form: "Lead form",
  text_only: "Text only",
  banner: "Banner",
};

export function formatLabel(format: string | null): string | null {
  if (!format) return null;
  return FORMAT_LABELS[format] ?? format.replace(/_/g, " ");
}

export type BadgeTone = "approved" | "changed" | "pending" | "muted";

/**
 * The creative's one badge. ★"Approved" ONLY when the api's state says so —
 * never from `status`: a creative whose copy changed after it was approved
 * still has status "approved" (or deployed/paused), and the engine no longer
 * uses it.
 */
export function approvalBadge(
  item: Pick<CreativeReviewItem, "approvalState" | "status" | "coverageGap">,
): { label: string; tone: BadgeTone } {
  if (item.approvalState === "approved") {
    // ★Approved, but no ad can use it (api review R1): not a green badge.
    return item.coverageGap ? { label: "Approved — can't be used", tone: "changed" } : { label: "Approved", tone: "approved" };
  }
  if (item.approvalState === "changed_since_approved") return { label: "Changed since approved", tone: "changed" };
  switch (item.status) {
    case "generating":
      return { label: "Being generated", tone: "muted" };
    case "retired":
      return { label: "Retired", tone: "muted" };
    default:
      return { label: "Not approved", tone: "pending" };
  }
}

const GAP_REASON: Readonly<Record<NonNullable<CreativeReviewItem["coverageGap"]>, string>> = {
  no_landing_page: "it has no landing page",
  no_headline: "it has no headline",
};

/**
 * One sentence on what the state means for the engine, and what the merchant
 * can do. `when` is the approval's date, already formatted for the reader.
 */
export function approvalDetail(
  item: Pick<CreativeReviewItem, "approvalState" | "status" | "approval" | "canApprove" | "preflight" | "coverageGap">,
  when: string | null,
): string {
  const by = item.approval ? (item.approval.byYou ? "by you" : "by someone on your team") : "";
  const on = when ? ` on ${when}` : "";
  if (item.approvalState === "approved") {
    return item.coverageGap
      ? `Approved ${by}${on}, but no ad can use it: ${GAP_REASON[item.coverageGap]}.`
      : `Approved ${by}${on}. Peakhour may use it in ads it creates, exactly as it reads here.`;
  }
  if (item.approvalState === "changed_since_approved") {
    return item.canApprove
      ? `Approved ${by}${on}, but its wording or landing page has changed since, so Peakhour won't use it until you approve it again.`
      : `Approved ${by}${on}, but it has changed since. It is running or has run, so it can't be approved again here, and Peakhour won't use it in a new ad.`;
  }
  switch (item.status) {
    case "generating":
      return "Still being written. You can review it once it's ready.";
    case "retired":
      return "Retired — Peakhour won't use it.";
    case "deployed":
    case "paused":
      return "It ran without your approval, so Peakhour won't use it in a new ad while you only allow approved creatives.";
    default:
      return item.preflight?.decision === "warn"
        ? "Not approved. Our ad-policy check flagged it — read the note below before you approve it."
        : "Not approved. Peakhour won't use it while you only allow approved creatives.";
  }
}

/**
 * ★AN EMPTY LIST IS NEVER "ALL FINE". With no creative at all, say plainly
 * that nothing was ever generated — so there is nothing to approve, and the
 * approved-only switch would stop every ad Peakhour creates. With creatives
 * that this view filters out, say that instead.
 */
export function emptyState(summary: CreativesSummary, filter: CreativeFilterKey): { title: string; body: string } {
  if (summary.total === 0) {
    return {
      title: "No ad creatives yet",
      body:
        "Peakhour hasn't written any ad creatives for this business, so there is nothing to review or approve. " +
        "If you turn on “Only use creatives I have approved” now, Peakhour will create no ads of its own.",
    };
  }
  const n = summary.total;
  const all = `You have ${n} creative${n === 1 ? "" : "s"} in all.`;
  switch (filter) {
    case "to_review":
      return { title: "Nothing waiting for you", body: `No creative is waiting for your review. ${all}` };
    case "approved":
      return { title: "None approved", body: `No creative is approved and waiting to run. ${all}` };
    case "running":
      return { title: "None running", body: `No creative is running or has run. ${all}` };
    case "retired":
      return { title: "None retired", body: `No creative has been retired. ${all}` };
    default:
      return { title: "No creatives", body: all };
  }
}

/**
 * Whether the guardrails card offers "Only use creatives I have approved".
 * ★NOT WHILE THERE IS NOTHING TO APPROVE (the D-05c row's done-definition):
 * with no creative approved or awaiting approval, turning it on would stop
 * every ad the engine creates, and nothing could be approved to undo that.
 * Always offered while it is on (stored or in the form), so it can be turned
 * off; `unknown` while the summary is loading or failed — the card must not
 * claim "nothing to approve" from nothing.
 */
export function approvedAssetsOffer(
  summary: CreativesSummary | undefined,
  on: boolean,
): "offer" | "nothing_to_approve" | "unknown" {
  if (on) return "offer";
  if (!summary) return "unknown";
  return summary.inForce + summary.approvable > 0 ? "offer" : "nothing_to_approve";
}

/**
 * The read-only card's warning when the switch is on and no creative is
 * approved as it reads now — every ad the engine would create is refused.
 */
export function approvedAssetsWarning(summary: CreativesSummary | undefined, on: boolean): string | null {
  if (!on || !summary || summary.inForce > 0) return null;
  if (summary.approvable > 0) {
    const n = summary.approvable;
    return `No creative is approved as it reads now, so Peakhour creates no ads of its own. ${n} ${n === 1 ? "is" : "are"} waiting for your review.`;
  }
  return "No creative is approved, and there is none to approve, so Peakhour creates no ads of its own.";
}

/** A short line for the Ads page's entry, from the summary. */
export function reviewEntryLine(summary: CreativesSummary): string {
  if (summary.total === 0) return "No ad creatives yet — nothing to review.";
  const parts: string[] = [];
  if (summary.approvable > 0) parts.push(`${summary.approvable} waiting for your review`);
  if (summary.inForce > 0) parts.push(`${summary.inForce} approved`);
  if (summary.approvedUnusable > 0) parts.push(`${summary.approvedUnusable} approved but unusable`);
  if (summary.changedSinceApproved > 0) parts.push(`${summary.changedSinceApproved} changed since approved`);
  return parts.length ? `${parts.join(" · ")}.` : `${summary.total} creative${summary.total === 1 ? "" : "s"}, none to review.`;
}

/** What went wrong with an approve or withdraw, in words the merchant can act on. */
export function creativeActionError(
  err: { code?: string; message?: string; status?: number } | null | undefined,
  action: "approve" | "withdraw",
): string {
  if (!err) return "We couldn't reach Peakhour. Check your connection, then try again.";
  if (err.status === 401) return "Your session has ended. Sign in again, then try again.";
  if (err.status === 403) return "You don't have access to approve this business's creatives. Ask an owner or admin.";
  if (err.status === 404) return "This creative no longer exists.";
  switch (err.code) {
    case "CREATIVE_CHANGED":
      return "This creative changed while you were looking at it. We've reloaded it — read it again, then approve.";
    case "NOT_APPROVABLE":
      return "This creative can't be approved now: it is still being written, is running or has run, or has been retired.";
    case "NOT_APPROVED":
      return "Only an approved creative that isn't running can have its approval taken back.";
    default:
      return action === "approve" ? "We couldn't approve this creative. Try again." : "We couldn't take this approval back. Try again.";
  }
}
