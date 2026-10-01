/**
 * What the cockpit says about a commerce action's ledger status — in ONE
 * place, so the ready-to-ship list, the activity digest and the toasts cannot
 * disagree (api#1434, mongodb mig 366).
 *
 * ★`outcome_unknown` IS A STORE WRITE THAT WAS SENT AND MAY HAVE APPLIED — a
 * timeout, a store error after the request went out. Until mig 366 it read
 * `failed` ("nothing happened", no undo) while the store could be showing the
 * markdown. It can be undone, a few minutes after it happened (the server
 * answers `UNDO_SETTLING` until then). `failed` now means the write was
 * refused and nothing was sent — ⚠️for a row that SAYS so (`failure`): one
 * failed before mig 366 has no `failure`, and may well have applied.
 *
 * ★A SURFACE DECIDES BY `status`, never by whether `failure` is present: an
 * undone unknown outcome is `reverted` and keeps its `failure` as a record.
 *
 * Pure (no React, no toasts) so it is unit-tested in node.
 */

export type BadgeTone = "secondary" | "outline" | "warning";

/** Why an execution did not end `executed` — `cmrc_actions.failure`. */
export interface ActionFailure {
  detail: string;
  at?: string;
}

/** The statuses the ready-to-ship list asks for: approve, ship, or undo. */
export const ACTIONABLE_STATUSES = ["proposed", "approved", "executed", "outcome_unknown", "staged"] as const;

/** A status whose action can be undone from the cockpit. */
export function canRevert(status: string): boolean {
  return status === "executed" || status === "outcome_unknown" || status === "staged";
}

interface StatusMeta {
  /** The list's badge. */
  label: string;
  /** The digest's past-tense verb. */
  verb: string;
  tone: BadgeTone;
}

const META: Record<string, StatusMeta> = {
  proposed: { label: "Proposed", verb: "proposed", tone: "outline" },
  approved: { label: "Approved", verb: "approved", tone: "secondary" },
  executing: { label: "Applying", verb: "running", tone: "secondary" },
  executed: { label: "Shipped", verb: "shipped", tone: "secondary" },
  outcome_unknown: { label: "Unconfirmed", verb: "unconfirmed", tone: "warning" },
  staged: { label: "Staged", verb: "staged", tone: "outline" },
  failed: { label: "Failed", verb: "failed", tone: "outline" },
  rejected: { label: "Dismissed", verb: "dismissed", tone: "outline" },
  reverted: { label: "Reverted", verb: "reverted", tone: "outline" },
};

/** Badge + verb for a status. An unknown status shows as itself, never as
 *  something it is not — and a missing one as "updated", never a crash. */
export function statusMeta(status: unknown): StatusMeta {
  const key = typeof status === "string" && status ? status : "";
  return META[key] ?? { label: key || "Updated", verb: key || "updated", tone: "outline" };
}

/** The Badge props for a tone. ★ONE place for what "warning" looks like:
 *  the Badge has no such variant, so it is an outline in the house warning
 *  colours (as the CMS pages use them). */
export function badgeProps(tone: BadgeTone): { variant: "secondary" | "outline"; className: string } {
  return tone === "warning"
    ? { variant: "outline", className: "shrink-0 border-warning/40 bg-warning/10 text-warning-on-tint" }
    : { variant: tone, className: "shrink-0" };
}

/** The store's detail as a sentence: trimmed, and ending in a full stop
 *  when it ends in neither one nor another closing mark (the api's own
 *  `failureDetail` never adds one). Empty when there is none. */
function asSentence(detail: string | undefined | null): string {
  const d = (detail ?? "").trim();
  if (!d) return "";
  return /[.!?…)"']$/.test(d) ? d : `${d}.`;
}

/**
 * The line shown beneath a row that did not end `executed`: what it means,
 * then the store's own account. Null for every other status — including
 * `reverted`, whose `failure` is history.
 */
export function failureLine(status: string, failure: ActionFailure | null | undefined): string | null {
  const detail = asSentence(failure?.detail);
  if (status === "outcome_unknown") {
    return `We couldn't confirm your store applied this.${detail ? ` ${detail}` : ""} Undo it to be sure.`;
  }
  if (status === "failed") {
    // ⚠️★"NOTHING WAS CHANGED" ONLY WHERE THE ROW SAYS WHY (review round 1).
    //  A `failed` row with no `failure` predates mig 366, when a timeout or a
    //  store error was recorded `failed` too: it may have applied.
    return detail
      ? `Not applied — nothing was changed. ${detail}`
      : "This change didn't complete, and Peakhour has no record of why.";
  }
  return null;
}

export interface ToastSpec {
  kind: "success" | "warning" | "error";
  title: string;
  description?: string;
}

/** What to tell the merchant after "Ship it", from the server's answer. */
export function executeToast(res: { status?: unknown; failure?: ActionFailure | null }): ToastSpec {
  const detail = asSentence(res.failure?.detail);
  switch (res.status) {
    case "executed":
      return { kind: "success", title: "Shipped — applied to your store" };
    case "staged":
      return {
        kind: "success",
        title: "Staged",
        description: "Prepared as advisory — live apply isn't available on this channel yet.",
      };
    case "outcome_unknown":
      // ⚠️★NOT "Done" and NOT "nothing was changed": the store may be
      //  showing it. The undo opens a few minutes after (UNDO_SETTLING).
      return {
        kind: "warning",
        title: "We couldn't confirm your store applied this",
        description: `${detail ? `${detail} ` : ""}You can undo it from Ready to ship in a few minutes.`,
      };
    case "failed":
      // A refusal: nothing was sent. "Try again" is not promised — a
      // read-only key, say, does not get better by itself.
      return {
        kind: "error",
        title: "Couldn't apply on the store",
        description: `${detail ? `${detail} ` : ""}Nothing was changed.`,
      };
    default:
      // A status this build does not know: say what the server said rather
      // than a green "Done" that may not be true.
      return { kind: "warning", title: `The action is now ${statusMeta(res.status).label.toLowerCase()}` };
  }
}

/** What to tell the merchant when an undo is refused. */
export function revertErrorToast(e: { code?: string; message?: string }): ToastSpec {
  if (e.code === "UNDO_SETTLING") {
    // ★A WAIT, NOT A FAILURE (review round 1): the store may still be
    //  applying the write; the server's message says when to try again.
    return { kind: "warning", title: "Not yet — your store may still be applying this", description: e.message };
  }
  return { kind: "error", title: e.message || "Couldn't revert this action" };
}

/** What to tell the merchant when proposing a markdown fails. */
export function proposeErrorToast(e: { code?: string; message?: string }): ToastSpec {
  if (e.code === "LIVE_MARKDOWN") {
    // ★Retrying never helps: the existing markdown has to be undone first
    //  (one live markdown per product, api#1434). ★A NEUTRAL title (review
    //  round 1): the standing markdown may be one whose result is unknown,
    //  and the server's description says which.
    return { kind: "warning", title: "Can't propose another markdown for this product", description: e.message };
  }
  return { kind: "error", title: "Couldn't propose markdown", description: "Please try again shortly." };
}
