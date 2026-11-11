/**
 * The Presence edit forms (PE-07): what to draw, what each state says, and what a person may press. PURE - no React, no fetch.
 *
 * ★THE FORM IS DRAWN FROM DECLARED CAPABILITIES. A field the network cannot write has no section here and so no control; a screen
 * never asks "is this Google?". The network's name in every sentence comes from `NetworkCapability.label`, which the api takes from the
 * adapter. Nothing in this file spells one.
 *
 * ★SUBMITTED IS NOT LIVE. "Live" is a word only the `live` status earns; every other state says what is true instead.
 * ★WRITES ARE OFF until the operator switches a network on (`writes.released`). The page says so ONCE, in `publishingBanner`, and never
 * says "saved".
 */

import type { HoursPeriod, PresenceNetworkEntry, PresencePublishing, SpecialHours } from "@/lib/presence-panels";
import { photoValueLines } from "@/lib/presence-photos";
import { PANEL_TITLES, extraValueLines, type ExtraField } from "@/lib/presence-extras";

// ── Shapes the api returns ───────────────────────────────────────────────────

export type EditField =
  | "name"
  | "address"
  | "primaryCategory"
  | "additionalCategories"
  | "phone"
  | "website"
  | "description"
  | "regularHours"
  | "specialHours"
  | "temporaryClosure";

export interface ListingLimits {
  descriptionMaxLength?: number;
  nameMaxLength?: number;
  maxAdditionalCategories?: number;
  maxAdditionalPhones?: number;
}

export interface NetworkCapability {
  network: string;
  /** How a merchant hears the network's name. */
  label: string;
  /** Whether the network declares figures (calls, directions, clicks): only then is what followed a live change asked for (PE-13). Absent on an older api: false. */
  metrics?: boolean;
  writableFields: string[];
  riskyFields: string[];
  limits: ListingLimits;
  options: { categories?: boolean; attributes?: boolean; services?: boolean };
  /** Which of the four extra panels (posts, links, services, details) the network offers (PE-12). Absent on an older api: none. */
  panels?: { posts: boolean; links: boolean; services: boolean; attributes: boolean };
  writes: { released: boolean; reason: string | null };
}

export interface CapabilitiesResponse {
  items: NetworkCapability[];
  /** What the signed-in person's role can do. */
  can: { propose: boolean; approve: boolean };
}

export type ChangeStatus =
  | "proposed"
  | "validated"
  | "approved"
  | "applying"
  | "submitted"
  | "live"
  | "failed"
  | "blocked"
  | "rejected"
  | "expired"
  | "superseded";

export interface ChangeIssue {
  code: string;
  message: string;
  field?: string;
}

/** `GET /v1/presence/changes` item (the api's `view`). */
export interface ChangeCardData {
  id: string;
  listingId: string;
  network: string;
  field: string;
  status: ChangeStatus;
  riskTier: "ordinary" | "careful" | "risky";
  notes: string[];
  source: string;
  before: unknown;
  after: unknown;
  reason: ChangeIssue | null;
  held: { reason: string } | null;
  validation: { checkedAt: string; issues: ChangeIssue[]; networkChecked: boolean } | null;
  createdAt: string;
  expiresAt: string;
  submittedAt: string | null;
  liveAt: string | null;
  liveCheck: { checkedAt: string; outcome: string; note: string | null } | null;
  undone: boolean;
  /** Whether Peakhour can put this change back (the api decides; a photo removal can be undone only when the photo came from Drive). Absent on an older api: treated as true. */
  undoable?: boolean;
}

/**
 * `GET /v1/presence/changes/outcomes?listingId=` (PE-13): what followed each of the listing's NEWEST TEN live changes (on networks that declare
 * figures), in one answer. A live change past the newest ten is not in it. Only what is drawn is typed. The api writes the sentences from the rule that holds the minimum-data, same-length, one-change and holiday
 * rules; a network that declares no figures is simply not in the answer.
 */
export interface ChangeOutcomeItem {
  id: string;
  outcome: {
    /** `measured` is the only status that draws a list of figures. */
    status: string;
    /** Picks the headline. */
    reason: string;
    message: string;
    lines: Array<{ text: string }>;
  };
}
export interface ChangeOutcomesResponse {
  items: ChangeOutcomeItem[];
}

export interface CategoryOption {
  id: string;
  label: string;
}

export interface HolidayOffer {
  key: string;
  /** `YYYY-MM-DD` on the listing's own calendar. */
  date: string;
  name: string;
  region?: string;
  tentative: boolean;
  regionUnknown: boolean;
}

export interface HolidayOffersResponse {
  offers: HolidayOffer[];
  needsRegularHours: boolean;
  openChange: boolean;
  noTimeZone: boolean;
  /** The network could not be read just now; nothing is offered. */
  networkUnreadable: boolean;
}

// ── What to draw ─────────────────────────────────────────────────────────────

export interface SectionSpec {
  field: EditField;
  title: string;
  blurb: string;
}

/** In the order a merchant meets them. The ordinary ones first; the careful ones carry a note; the risky ones are last and set apart. */
export const SECTIONS: readonly SectionSpec[] = [
  { field: "regularHours", title: "Opening hours", blurb: "The hours you are open in a normal week." },
  { field: "specialHours", title: "Holiday hours", blurb: "Days you are closed or open at different times." },
  { field: "temporaryClosure", title: "Temporary closure", blurb: "Mark your business as temporarily closed, or open again." },
  { field: "description", title: "Description", blurb: "A few sentences about your business." },
  { field: "phone", title: "Phone numbers", blurb: "The numbers customers can call." },
  { field: "website", title: "Website", blurb: "Where customers find you online." },
  { field: "additionalCategories", title: "Other categories", blurb: "More ways to describe what you do." },
  { field: "name", title: "Business name", blurb: "The name customers see." },
  { field: "address", title: "Address", blurb: "Where your business is." },
  { field: "primaryCategory", title: "Main category", blurb: "The one category that describes you best." },
];

export interface DrawnSection extends SectionSpec {
  risky: boolean;
}

/** The sections to show for a network: exactly the writable ones, flagged when the network calls the field risky. */
export function drawnSections(cap: NetworkCapability | undefined): DrawnSection[] {
  if (!cap) return [];
  return SECTIONS.filter((s) => cap.writableFields.includes(s.field)).map((s) => ({ ...s, risky: cap.riskyFields.includes(s.field) }));
}

/**
 * What to do when another card asks for a field's form. A button elsewhere on the page must never appear to do nothing, so a form that
 * cannot open says why instead.
 */
export function requestedForm(sections: DrawnSection[], access: FormAccess, field: string): { open: EditField | null; notice: string | null } {
  if (access.mode === "view") return { open: null, notice: access.why };
  const section = sections.find((s) => s.field === field);
  if (!section) return { open: null, notice: "That detail cannot be changed from Peakhour yet." };
  return { open: section.field, notice: null };
}

/**
 * Which network a listing's forms are drawn for: the listing's own, when the api has told us its key, and only if it declares a write.
 * Undefined means "no forms", which is shown as such rather than guessed from another network.
 */
export function capabilityFor(caps: CapabilitiesResponse | undefined, network: string | null | undefined): NetworkCapability | undefined {
  if (!caps || !network) return undefined;
  return caps.items.find((c) => c.network === network);
}

// ── Roles and the switch ─────────────────────────────────────────────────────

export type FormAccess =
  | { mode: "edit" }
  | { mode: "view"; why: string };

/** A viewer sees the forms' sections but no control. The api refuses them as well; this is so nobody is offered a button that fails. */
export function formAccess(can: CapabilitiesResponse["can"] | undefined): FormAccess {
  if (can?.propose) return { mode: "edit" };
  return { mode: "view", why: "Your role can look at your listing but not change it. Ask an editor, admin or owner." };
}

/** What a person can press on a change card. Approve is an admin's; proposing, declining and undoing are an editor's. */
export function cardActions(c: Pick<ChangeCardData, "status" | "undone"> & { undoable?: boolean | undefined }, can: CapabilitiesResponse["can"] | undefined) {
  const decidable = c.status === "proposed" || c.status === "validated";
  return {
    // A change that was never checked can still be approved: the api checks it again first.
    approve: !!can?.approve && decidable,
    reject: !!can?.propose && decidable,
    // Only when the api says it can be put back: a button that always fails is not offered.
    undo: !!can?.propose && (c.status === "submitted" || c.status === "live") && !c.undone && c.undoable !== false,
    // A person who can look but not approve is told who can.
    needsAdmin: !can?.approve && decidable,
  };
}

/**
 * What a person reads after preparing a change. While writes are held the network's own dry run is skipped (it needs the release), so
 * "checked" must say by whom: Peakhour checked it against the network's rules, and the network checks it again when it is sent.
 *
 * ★ONE SOURCE FOR "held": the listing's `publishing`, the same answer the publishing status draws, so the two never disagree while their
 * caches refresh at different times. Only an api that predates it falls back to the capabilities' `writes.released`.
 */
export function preparedWords(
  notChecked: number,
  cap: Pick<NetworkCapability, "label" | "writes">,
  publishing?: Pick<PresencePublishing, "state"> | null,
): string {
  if (notChecked > 0) return `Your change is prepared, but ${cap.label} could not check it just now. It is waiting below.`;
  const released = publishing ? publishing.state !== "held" : cap.writes.released;
  if (released) return "Your change is prepared and checked. Review it below, then approve it.";
  return `Your change is prepared and checked against ${cap.label}'s rules. ${cap.label} checks it again when it is sent. Review it below, then approve it.`;
}

// ── The one publishing status ────────────────────────────────────────────────

export interface PublishingBanner {
  tone: "good" | "warn" | "bad";
  headline: string;
  /** Separate facts, in the order to read them. */
  lines: string[];
  /** The one thing to press, when the merchant can fix what stops a send. `external` opens the network's own site. */
  action: { label: string; href: string; external: boolean } | null;
}

const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const keptFor = (hours: number) => (hours > 0 && hours % 24 === 0 ? unit(hours / 24, "day") : unit(hours, "hour"));

/**
 * GBP Issue 1: the ONE answer to "can I publish, what is stopping me, and what do I do?", shown once above the panels. It replaced a
 * "switched off ... until Peakhour switches it on" paragraph drawn under six panels that never said whether the merchant had to act.
 *
 * Built from the api's `publishing` (the send's own gates) and the person's role. Null when the network writes nothing, or on an api that
 * predates the field: no status is drawn rather than a guessed one.
 */
export function publishingBanner(
  entry: Pick<PresenceNetworkEntry, "label" | "publishing"> | null | undefined,
  can: CapabilitiesResponse["can"] | undefined,
): PublishingBanner | null {
  const p = entry?.publishing;
  if (!entry || !p) return null;
  const label = entry.label;
  // The one button, only for someone whose role can change the listing: a viewer is told what is wrong, never sent to a page they cannot
  // use. A link off this site opens in a new tab; that is a property of where it goes, not of the action's kind.
  const href = p.blocker?.href ?? null;
  const fix =
    p.blocker && href && can?.propose
      ? { label: p.blocker.action === "reconnect" ? `Reconnect ${label}` : `Fix this on ${label}`, href, external: /^https?:\/\//i.test(href) }
      : null;
  // Who approves: said once here, so an editor is not surprised by an Approve button they do not have.
  const editorOnly = !!can?.propose && !can.approve;
  const role = editorOnly ? ["You can prepare changes. An admin or owner approves them before anything is sent."] : [];
  // ★WHAT THIS PERSON CAN DO WHILE THEY WAIT, by role: a viewer is never told to prepare, nor an editor to approve.
  const meanwhile = can?.approve
    ? "You can prepare and approve changes now."
    : can?.propose
      ? "You can prepare changes now, and an admin or owner approves them."
      : "Changes your team prepares and approves now are kept.";
  const kept = `A change that has not been sent ${keptFor(p.keptForHours)} after it was prepared is dropped, and has to be made again.`;

  if (p.state === "held") {
    const why = [p.heldReason, p.blocker ? null : "You don't need to do anything."].filter(Boolean).join(" ");
    return {
      tone: "warn",
      headline: `Publishing to ${label} hasn't started yet`,
      lines: [
        // Peakhour's sentence is WHY (a fact; mig 985 and the api's HELD). Whether the merchant must act is said here, because only this
        // status knows whether something on their side also stops a send: never both "nothing to do" and "fix this".
        ...(why ? [why] : []),
        `${meanwhile} They are sent to ${label} once publishing starts. ${kept}`,
        ...(p.blocker ? [`One thing needs you first: ${p.blocker.reason}`] : []),
      ],
      action: fix,
    };
  }
  if (p.state === "blocked") {
    // Prepared changes still expire while blocked, so the lifetime is said here too.
    return {
      tone: "bad",
      headline: `Peakhour can't publish to ${label} right now`,
      lines: [p.blocker?.reason ?? `Something on ${label} is stopping changes.`, `Changes are sent once this is fixed. ${kept}`, ...role],
      action: fix,
    };
  }
  return {
    tone: "good",
    headline: `Publishing to ${label} is on`,
    lines: [`Approved changes are sent to ${label}. ${label} can take a little while to show them.`, ...role],
    action: null,
  };
}

// ── What a state says ────────────────────────────────────────────────────────

export type Tone = "neutral" | "good" | "warn" | "bad";
export interface StatusWords {
  headline: string;
  detail: string | null;
  tone: Tone;
}

const reasonOf = (c: Pick<ChangeCardData, "reason">) => c.reason?.message?.trim() || "No reason was given.";

// ── Where a request stands (GBP L4) ──────────────────────────────────────────

/**
 * ★ONE STAGE FOR EVERY SURFACE. The cards, the "Your requests" list and Ask Peakhour's card all say a request's stage through
 * `requestStatus`, so the same change never reads two ways. Two meanings that look alike stay apart: `rejected` is the merchant's own
 * DECLINE ("Declined by you"); the network refusing a change is stored as `failed` with the reason code `network_rejected`.
 * ★"UNDER REVIEW" COMES FROM ONE SIGNAL ONLY: a submitted change whose last check said `pending`. Never from time, never inferred.
 */
export type RequestStage =
  | "draft"
  | "awaiting_approval"
  | "approved_held"
  | "approved_waiting"
  | "sent"
  | "under_review"
  | "cannot_confirm"
  | "live"
  | "rejected_by_network"
  | "not_published"
  | "failed"
  | "declined"
  | "expired"
  | "replaced";

/** The one thing a merchant can do about a request. `redo` opens the field's editor; `fix` is the publishing status's own link. */
export type RequestNext =
  | { kind: "none" }
  | { kind: "decide" }
  | { kind: "redo"; label: string }
  | { kind: "fix"; label: string; href: string; external: boolean };

export interface RequestStatus {
  stage: RequestStage;
  label: string;
  reason: string | null;
  tone: Tone;
  next: RequestNext;
}

export type RequestSource = Pick<ChangeCardData, "status" | "reason" | "held" | "liveCheck">;

const REDO: RequestNext = { kind: "redo", label: "Make the change again" };

/**
 * The stage of one request, its reason and its next action. `publishing` is the listing's publishing status: it supplies the fix link for a
 * send that something on the merchant's side stops, so a blocked request never invents a link of its own.
 */
export function requestStatus(
  c: RequestSource,
  label: string,
  can: CapabilitiesResponse["can"] | undefined,
  publishing?: Pick<PresencePublishing, "blocker" | "heldReason"> | null,
): RequestStatus {
  const check = c.liveCheck;
  const note = check?.note?.trim() || null;
  // Only a role that can change the listing is offered a way to change it again; a viewer is told, never sent.
  const again: RequestNext = can?.propose ? REDO : { kind: "none" };
  const b = publishing?.blocker ?? null;
  const fix: RequestNext =
    b && b.href && can?.propose
      ? { kind: "fix", label: b.action === "reconnect" ? `Reconnect ${label}` : `Fix this on ${label}`, href: b.href, external: /^https?:\/\//i.test(b.href) }
      : { kind: "none" };
  const stage = (st: RequestStage, lbl: string, reason: string | null, tone: Tone, next: RequestNext = { kind: "none" }): RequestStatus => ({ stage: st, label: lbl, reason, tone, next });
  const decide: RequestNext = can?.approve ? { kind: "decide" } : { kind: "none" };

  switch (c.status) {
    case "proposed":
      return stage("draft", "Draft", `Peakhour has not checked this change with ${label} yet. Nothing has been sent.`, "neutral", decide);
    case "validated":
      return stage(
        "awaiting_approval",
        "Awaiting your approval",
        `Nothing has been sent to ${label}. ${can?.approve ? "Approve it to send it." : "An admin or owner has to approve it."}`,
        "neutral",
        decide,
      );
    case "approved": {
      if (!c.held) return stage("approved_waiting", "Approved, waiting to send", `It has not reached ${label} yet.`, "neutral");
      const why = [c.held.reason, b ? b.reason : null].filter(Boolean).join(" ");
      return stage("approved_held", "Approved, waiting to send", `${why || publishing?.heldReason || "Sending has not started yet."} Nothing has been sent to ${label}.`, "warn", fix);
    }
    case "applying":
      return stage("sent", `Sent to ${label}`, "This can take a moment. It is not live yet.", "neutral");
    case "submitted": {
      switch (check?.outcome) {
        case "pending":
          return stage("under_review", `Under ${label} review`, note || `${label} is still reviewing this change. We will tell you when it is done.`, "neutral");
        case "unknown":
          return stage("cannot_confirm", `Sent, ${label} doesn't let us confirm this`, note || `${label} does not show this kind of change back to us, so we cannot tell you when it is showing.`, "neutral");
        case "not_shown":
          return stage("sent", `Sent to ${label}`, note || `${label} is not showing it yet.`, "warn");
        default:
          return stage("sent", `Sent to ${label}`, `${label} may take time to show it. We will say when it does.${note ? ` ${note}` : ""}`, "neutral");
      }
    }
    case "live":
      return stage("live", `Live on ${label}`, null, "good");
    case "failed":
      if (c.reason?.code === "network_rejected") return stage("rejected_by_network", `Rejected by ${label}`, reasonOf(c), "bad", again);
      if (c.reason?.code === "not_published") return stage("not_published", "Didn't go live", reasonOf(c), "warn", again);
      return stage("failed", "Failed", reasonOf(c), "bad", again);
    case "blocked":
      return stage("failed", "Failed", reasonOf(c), "bad", fix.kind === "fix" ? fix : again);
    case "rejected":
      return stage("declined", "Declined by you", "You declined it. Nothing was sent.", "neutral");
    case "expired":
      return stage("expired", "Expired", "Nobody approved it in time, so nothing was sent.", "neutral", again);
    case "superseded":
      return stage("replaced", "Replaced", "A newer change took its place. Nothing was sent.", "neutral");
  }
}

/** The headline and detail a change card draws: the request's stage, said the same way everywhere. */
export function statusWords(
  c: ChangeCardData,
  label: string,
  can: CapabilitiesResponse["can"] | undefined,
  publishing?: Pick<PresencePublishing, "blocker" | "heldReason"> | null,
): StatusWords {
  const r = requestStatus(c, label, can, publishing);
  return { headline: r.label, detail: r.reason, tone: r.tone };
}

const OPEN_STATUSES: ReadonlySet<ChangeStatus> = new Set(["proposed", "validated", "approved", "applying", "submitted"]);
const RECENT_MS = 7 * 24 * 3_600_000;

/** When a finished request finished, as far as the row says: it went live then, ran out then, or was last sent or made. */
function finishedAt(c: ChangeCardData): number {
  const t = c.status === "live" ? (c.liveAt ?? c.createdAt) : c.status === "expired" ? c.expiresAt : (c.submittedAt ?? c.createdAt);
  const n = Date.parse(t);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * The "Your requests" list: what is still open or in flight first (newest first), then what finished in the last seven days. A replaced
 * request is hidden: another one took its place and is listed. An older one is the history, not a request.
 */
export function requestGroups(changes: readonly ChangeCardData[] | undefined, now: number): { open: ChangeCardData[]; recent: ChangeCardData[] } {
  const open: ChangeCardData[] = [];
  const recent: ChangeCardData[] = [];
  for (const c of changes ?? []) {
    if (c.status === "superseded") continue;
    if (OPEN_STATUSES.has(c.status)) open.push(c);
    else if (now - finishedAt(c) <= RECENT_MS) recent.push(c);
  }
  const byNewest = (a: ChangeCardData, b: ChangeCardData) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
  return { open: open.sort(byNewest), recent: recent.sort((a, b) => finishedAt(b) - finishedAt(a)) };
}

/** A short "before → after" for a row: each side on one line, cut where long. */
export function shortChange(field: string, before: unknown, after: unknown): string {
  const say = (v: unknown) => {
    const t = valueLines(field, v).join("; ");
    if (!t) return "nothing set";
    return t.length > 60 ? `${t.slice(0, 57).trimEnd()}...` : t;
  };
  return `${say(before)} → ${say(after)}`;
}

// ── What followed a live change (PE-13) ──────────────────────────────────────

/**
 * THE HEADLINE IS PICKED BY THE REASON, not the status: two reasons in one status mean different things ("too early" is only for days still
 * to come; a finished stretch with too few calls is not early). A reason this file does not know draws nothing, so a new reason from the api
 * is never shown under the wrong words. The api's sentence stands under it and never repeats it.
 */
const OUTCOME_HEADLINE: Record<string, string> = {
  compared: "What followed this change",
  window_not_finished: "Too early to tell",
  figures_not_in: "Too early to tell",
  holiday_change: "Not compared: this is a holiday-hours change",
  calendar_unknown: "Not compared: your holiday calendar cannot be checked yet",
  other_change: "Not tied to this one change",
  no_baseline: "Not enough figures to compare",
  too_few_days: "Not enough figures to compare",
  figures_missing: "Not enough figures to compare",
  too_few_actions: "Too few to compare",
  after_unread: "Cannot compare",
  not_connected: "Cannot compare",
  no_location: "Cannot compare",
  no_figures: "Cannot compare",
  read_failed: "Could not read this just now",
};

/**
 * What to draw under a live change. `null` is nothing at all: no answer for it (a network with no figures, a loading or failed read), a state
 * with nothing to say, or a reason this file does not know. Figure lines appear only for a real comparison.
 */
export function outcomeWords(item: ChangeOutcomeItem | null | undefined): { headline: string; message: string; lines: string[] } | null {
  const o = item?.outcome;
  const headline = o ? OUTCOME_HEADLINE[o.reason] : undefined;
  if (!o || !headline || !o.message.trim()) return null;
  return { headline, message: o.message, lines: o.status === "measured" ? o.lines.map((l) => l.text) : [] };
}

/** The answer for one change from the single answer. */
export function outcomeFor(r: ChangeOutcomesResponse | undefined, changeId: string): ChangeOutcomeItem | null {
  return r?.items.find((i) => i.id === changeId) ?? null;
}

/**
 * WHETHER A CHANGE ASKS FOR WHAT FOLLOWED IT: it is live, and its network declares figures. (Whether it was undone, and when, is the api's to
 * judge: an undo after the days compared leaves the comparison standing.) One place, beside `cardActions`, so a card and its request agree.
 */
export function showsOutcome(c: Pick<ChangeCardData, "status" | "network">, caps: CapabilitiesResponse | undefined): boolean {
  return c.status === "live" && capabilityFor(caps, c.network)?.metrics === true;
}

/** Whether any change in a list asks for an outcome: the one request is made only then. */
export function wantsOutcomes(changes: readonly Pick<ChangeCardData, "status" | "network">[] | undefined, caps: CapabilitiesResponse | undefined): boolean {
  return (changes ?? []).some((c) => showsOutcome(c, caps));
}

/**
 * ★THE REQUEST IS KEYED ON WHERE EACH CHANGE IS: the ids and statuses of the sent and live changes on networks that declare figures. The change
 * list already polls while something is on its way, so a change that goes live, or one that has just been sent, changes this and the outcomes
 * are asked for again, by whichever path moved it (an approval here, the assistant's card, a worker). Nothing has to remember to invalidate.
 */
export function outcomeSignature(changes: readonly Pick<ChangeCardData, "id" | "status" | "network">[] | undefined, caps: CapabilitiesResponse | undefined): string {
  return (changes ?? [])
    .filter((c) => (c.status === "live" || c.status === "submitted") && capabilityFor(caps, c.network)?.metrics === true)
    .map((c) => `${c.id}:${c.status}`)
    .sort()
    .join(",");
}

/** What a change's card draws about what followed it. */
export type OutcomeSlot =
  | { kind: "none" }
  | { kind: "answer"; item: ChangeOutcomeItem }
  /** A live change past the newest ten: not "no figures", and said so. */
  | { kind: "older" }
  | { kind: "failed"; retry: () => void };

export const OUTCOMES_SHOWN = 10;
export const OUTCOME_OLDER_NOTE = `What followed a change is shown for your ${OUTCOMES_SHOWN} newest live changes. This one is older.`;
export const OUTCOME_FAILED_NOTE = "We could not load what followed this change.";

/**
 * One change's slot from the query's state. Nothing for a change that does not ask. While a newer set of changes is being read, the answer for
 * the older set stands (`isPlaceholderData`), and a change it does not cover is not yet "older": it is simply not read yet.
 */
export function outcomeSlot(
  change: Pick<ChangeCardData, "id" | "status" | "network">,
  caps: CapabilitiesResponse | undefined,
  q: { data: ChangeOutcomesResponse | undefined; isError: boolean; isPlaceholderData: boolean; retry: () => void },
): OutcomeSlot {
  if (!showsOutcome(change, caps)) return { kind: "none" };
  const item = outcomeFor(q.data, change.id);
  if (item) return { kind: "answer", item };
  if (q.data && !q.isPlaceholderData) return { kind: "older" };
  if (q.isError && !q.data) return { kind: "failed", retry: q.retry };
  return { kind: "none" };
}

const SHORT_OUTCOME_MS = 5 * 60_000;
const LONG_OUTCOME_MS = 30 * 60_000;
/**
 * How long an answer is held. The figures move a day at a time, so a settled answer is held a while; one that says "check back" or "nothing
 * yet" is held briefly, so its date does not go stale on a screen left open.
 */
export function outcomesStaleTime(r: ChangeOutcomesResponse | undefined): number {
  if (!r) return 0;
  const waiting = r.items.some((i) => i.outcome.status === "none" || i.outcome.status === "too_early");
  return waiting ? SHORT_OUTCOME_MS : LONG_OUTCOME_MS;
}

/** The same rule as a poll: an open tab asks again as often as a waiting answer goes stale, so its "check back" date moves on; a settled one does not poll. */
export function outcomesRefetchMs(r: ChangeOutcomesResponse | undefined): number | false {
  return outcomesStaleTime(r) === SHORT_OUTCOME_MS ? SHORT_OUTCOME_MS : false;
}

// ── Showing a value ──────────────────────────────────────────────────────────

const DAYS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
export const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAY_ORDER)[number];

const dayLabel = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

/** A change's field as a person reads it. A photo is not a form section, so it has no `SECTIONS` entry. */
export function fieldTitle(field: string): string {
  return SECTIONS.find((s) => s.field === field)?.title ?? (field === "media" ? "Photo" : (PANEL_TITLES[field as ExtraField] ?? field));
}

/** A value as plain lines for a before-and-after card. An empty list of lines is "nothing set". */
export function valueLines(field: string, value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  switch (field) {
    case "media":
      return photoValueLines(value);
    case "posts":
    case "services":
    case "attributes":
    case "links":
      return extraValueLines(field, value);
    case "regularHours": {
      const rows = (Array.isArray(value) ? value : []) as HoursPeriod[];
      return DAY_ORDER.flatMap((d) => {
        const p = rows.filter((r) => r.day === d);
        return p.length ? [`${DAYS[d]}: ${p.map((x) => `${x.open} to ${x.close}`).join(", ")}`] : [];
      });
    }
    case "specialHours": {
      const rows = (Array.isArray(value) ? value : []) as Array<SpecialHours & { note?: string }>;
      return [...rows]
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((r) => `${dayLabel(String(r.date))}${r.note ? ` (${r.note})` : ""}: ${r.closed || !r.open || !r.close ? "closed" : `${r.open} to ${r.close}`}`);
    }
    case "temporaryClosure":
      return [(value as { closed?: boolean }).closed ? "Temporarily closed" : "Open"];
    case "phone": {
      const v = value as { primary?: string; additional?: string[] };
      return [...(v.primary ? [v.primary] : []), ...(v.additional ?? [])];
    }
    case "primaryCategory":
      return [typeof value === "string" ? value : ((value as { label?: string }).label ?? "")].filter(Boolean);
    case "additionalCategories":
      return ((Array.isArray(value) ? value : []) as Array<{ label?: string } | string>).map((c) => (typeof c === "string" ? c : (c.label ?? ""))).filter(Boolean);
    case "address": {
      const a = value as Record<string, string | undefined>;
      return [a.line1, a.line2, [a.city, a.region].filter(Boolean).join(", "), [a.postalCode, a.country].filter(Boolean).join(" ")].filter((x): x is string => !!x);
    }
    default:
      return typeof value === "string" ? [value] : [JSON.stringify(value)];
  }
}

// ── Building a value from a form ─────────────────────────────────────────────

export type Built<T> = { ok: true; value: T } | { ok: false; message: string };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface DayDraft {
  day: Day;
  /** No periods means closed that day. */
  periods: Array<{ open: string; close: string }>;
}

export function hoursDraft(rows: readonly HoursPeriod[] | undefined): DayDraft[] {
  return DAY_ORDER.map((day) => ({ day, periods: (rows ?? []).filter((r) => r.day === day).map((r) => ({ open: r.open, close: r.close })) }));
}

/** The whole week, every period, in the shape the api takes. Lists are always sent whole. */
export function hoursValue(draft: readonly DayDraft[]): Built<HoursPeriod[]> {
  const out: HoursPeriod[] = [];
  for (const d of draft) {
    for (const p of d.periods) {
      if (!HHMM.test(p.open) || !HHMM.test(p.close)) return { ok: false, message: `${DAYS[d.day]}: enter an opening and a closing time.` };
      if (p.open === p.close) return { ok: false, message: `${DAYS[d.day]}: opening and closing time are the same.` };
      out.push({ day: d.day, open: p.open, close: p.close });
    }
  }
  return { ok: true, value: out };
}

export interface SpecialDraft {
  date: string;
  closed: boolean;
  open: string;
  close: string;
  note: string;
}

export function specialDraft(rows: readonly SpecialHours[] | undefined): SpecialDraft[] {
  return (rows ?? []).map((r) => ({ date: String(r.date).slice(0, 10), closed: r.closed || !r.open || !r.close, open: r.open ?? "09:00", close: r.close ?? "17:00", note: r.note ?? "" }));
}

/** The whole list of special days. A day that is open needs both times; a date is listed once. */
export function specialValue(draft: readonly SpecialDraft[]): Built<Array<{ date: string; closed: boolean; open?: string; close?: string; note?: string }>> {
  const seen = new Set<string>();
  const out: Array<{ date: string; closed: boolean; open?: string; close?: string; note?: string }> = [];
  for (const d of [...draft].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(new Date(`${d.date}T00:00:00.000Z`).getTime())) return { ok: false, message: "Pick a date for every day." };
    if (seen.has(d.date)) return { ok: false, message: `${d.date} is listed twice.` };
    seen.add(d.date);
    if (!d.closed && (!HHMM.test(d.open) || !HHMM.test(d.close) || d.open === d.close)) return { ok: false, message: `${d.date}: enter an opening and a different closing time, or mark it closed.` };
    out.push({ date: d.date, closed: d.closed, ...(d.closed ? {} : { open: d.open, close: d.close }), ...(d.note.trim() ? { note: d.note.trim() } : {}) });
  }
  return { ok: true, value: out };
}

export function descriptionValue(text: string, limit: number | undefined): Built<string> {
  const v = text.trim();
  if (limit !== undefined && v.length > limit) return { ok: false, message: `That is ${v.length - limit} characters too long.` };
  return { ok: true, value: v };
}

/** "123 left" or "12 over", for a text box with a limit. */
export function charsLeft(text: string, limit: number | undefined): string | null {
  if (limit === undefined) return null;
  const n = limit - text.trim().length;
  return n >= 0 ? `${n} characters left` : `${-n} characters over`;
}

export function websiteValue(text: string): Built<string> {
  const v = text.trim();
  if (v === "") return { ok: true, value: "" };
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, message: "Start the address with https:// or http://." };
    return { ok: true, value: v };
  } catch {
    return { ok: false, message: "That does not look like a web address. Start it with https://." };
  }
}

export interface PhoneDraft {
  primary: string;
  additional: string[];
}

export function phoneDraft(contact: { phone?: string | null; additionalPhones?: string[] | null } | null | undefined): PhoneDraft {
  return { primary: contact?.phone ?? "", additional: [...(contact?.additionalPhones ?? [])] };
}

/** The whole list of numbers. A blank line is dropped; a number is never dropped silently otherwise. */
export function phoneValue(d: PhoneDraft, limits: ListingLimits): Built<{ primary?: string; additional: string[] }> {
  const primary = d.primary.trim();
  const additional = d.additional.map((n) => n.trim()).filter(Boolean);
  if (limits.maxAdditionalPhones !== undefined && additional.length > limits.maxAdditionalPhones) {
    return { ok: false, message: `Use at most ${limits.maxAdditionalPhones} extra numbers.` };
  }
  if (additional.length > 0 && !primary) return { ok: false, message: "Add your main number before the others." };
  const all = [primary, ...additional].filter(Boolean);
  if (new Set(all).size !== all.length) return { ok: false, message: "A number is listed twice." };
  return { ok: true, value: { ...(primary ? { primary } : {}), additional } };
}

export function categoriesValue(list: readonly CategoryOption[], limits: ListingLimits): Built<CategoryOption[]> {
  if (new Set(list.map((c) => c.id)).size !== list.length) return { ok: false, message: "A category is listed twice." };
  if (limits.maxAdditionalCategories !== undefined && list.length > limits.maxAdditionalCategories) {
    return { ok: false, message: `Use at most ${limits.maxAdditionalCategories} other categories.` };
  }
  return { ok: true, value: [...list] };
}

/**
 * Categories the listing holds today that the new list leaves out, by label. The listing keeps a category by label only (the network's id is
 * not stored), so the form cannot carry an existing one over: the person picks each one to keep again, and anything left out is REMOVED.
 */
export function categoriesDropped(existingLabels: readonly string[], picked: readonly CategoryOption[]): string[] {
  const keep = new Set(picked.map((c) => c.label.trim().toLowerCase()));
  return existingLabels.filter((l) => l.trim() && !keep.has(l.trim().toLowerCase()));
}

/** What an empty value would wipe, said before it is sent. Null when the value is not a wipe. */
export function wipeNote(field: EditField, value: unknown): string | null {
  if (field === "regularHours" && Array.isArray(value) && value.length === 0) return "No opening hours are set, so this marks you closed every day. Press the button again to go ahead.";
  if (field === "phone" && !(value as { primary?: string; additional?: string[] }).primary && !(value as { additional?: string[] }).additional?.length) return "This removes every phone number. Press the button again to go ahead.";
  if (field === "website" && value === "") return "This removes your website. Press the button again to go ahead.";
  if (field === "specialHours" && Array.isArray(value) && value.length === 0) return "This removes every holiday-hours day. Press the button again to go ahead.";
  if (field === "additionalCategories" && Array.isArray(value) && value.length === 0) return "This removes every other category. Press the button again to go ahead.";
  return null;
}

/** Add an offered category to the list once. */
export function withCategory(list: readonly CategoryOption[], add: CategoryOption): CategoryOption[] {
  return list.some((c) => c.id === add.id) ? [...list] : [...list, add];
}

/** What a person must have typed before the category list is asked for, so a keystroke is not a call. */
export const MIN_CATEGORY_QUERY = 2;
export const categoryQueryReady = (q: string) => q.trim().length >= MIN_CATEGORY_QUERY;

// ── Submitting ───────────────────────────────────────────────────────────────

export interface ProposeBody {
  listingId: string;
  network: string;
  changes: Array<{ field: EditField; value: unknown }>;
}

/**
 * ★ONE FIELD PER SUBMIT. Every form submits exactly one field, so a risky field is never in one change with another, whatever the form.
 * The api refuses the combination as well; this makes it unrepresentable here.
 */
export function proposeBody(listingId: string, network: string, field: EditField, value: unknown): ProposeBody {
  return { listingId, network, changes: [{ field, value }] };
}

/** The warning above a risky field's form. "May", never a rule the network has not stated. */
export function riskWarning(field: EditField, label: string): string[] {
  const out = [`Changing this may mean ${label} asks you to verify your business again, and it can take time to show.`];
  if (field === "name" || field === "address") {
    out.push(`If a verification postcard from ${label} is on its way, changing your name or address may cancel its code.`);
  } else {
    out.push("Check it matches what your customers see in real life.");
  }
  out.push("Risky fields are changed one at a time.");
  return out;
}

// ── Holiday-hours offers ─────────────────────────────────────────────────────

export function offerLine(o: HolidayOffer): string {
  return `${o.name}, ${dayLabel(o.date)}${o.tentative ? " (the date may still move)" : ""}`;
}

/** What an offer card can do. A regional day with no known region asks first; a listing without regular hours cannot take one. */
export function offerState(r: HolidayOffersResponse, label: string): { show: boolean; message: string | null; canAccept: boolean } {
  const say = (message: string) => ({ show: true, message, canAccept: false });
  if (r.noTimeZone) return say("We cannot suggest holiday hours yet, because we do not know your time zone.");
  if (r.networkUnreadable) return say(`We could not read your listing from ${label} just now, so no holiday days are suggested. Try again in a moment.`);
  if (r.needsRegularHours) return say("Set your opening hours first. Holiday hours change them for a day.");
  if (r.openChange) return say("A holiday-hours change is already waiting. Finish it first.");
  if (r.offers.length === 0) return { show: false, message: null, canAccept: false };
  return { show: true, message: null, canAccept: true };
}

/**
 * What accepting an offer did, from the rows the api returned with their statuses. A row that was not checked clean is NOT "prepared": a
 * blocked one says why, and one still waiting for a check says so.
 */
export function offerOutcome(items: ReadonlyArray<Pick<ChangeCardData, "status" | "reason">>, name: string, label: string): { ok: boolean; message: string } {
  const bad = items.find((i) => i.status === "blocked" || i.status === "failed" || i.status === "rejected");
  if (bad) return { ok: false, message: `${name} could not be prepared. ${bad.reason?.message ?? "No reason was given."} Nothing has been sent to ${label}.` };
  if (items.length === 0) return { ok: false, message: `${name} was not prepared.` };
  if (items.some((i) => i.status === "proposed")) return { ok: true, message: `${name} is prepared, but ${label} has not checked it yet. Review it under Changes below. Nothing has been sent to ${label}.` };
  return { ok: true, message: `${name} is prepared. Review it under Changes below, then approve it. Nothing has been sent to ${label}.` };
}

export const regionQuestion = (o: HolidayOffer) =>
  `We do not know where your business is, and ${o.name} is not observed everywhere. Is your business in a place that observes it?`;

// ── Errors ───────────────────────────────────────────────────────────────────

/** A sentence for a failed request: the api's own plain message, then each issue it listed. */
export function errorWords(err: unknown): string {
  const e = err as { message?: string; details?: unknown } | null;
  const issues = Array.isArray(e?.details) ? (e!.details as Array<{ message?: unknown }>).map((i) => (typeof i?.message === "string" ? i.message : "")).filter(Boolean) : [];
  const head = typeof e?.message === "string" && e.message ? e.message : "Something went wrong. Try again in a moment.";
  return [head, ...issues.filter((m) => m !== head)].join(" ");
}

export const presenceEditKeys = {
  capabilities: ["presence", "edit", "capabilities"] as const,
  changes: (listingId: string) => ["presence", "edit", "changes", listingId] as const,
  /** One answer per listing and per `outcomeSignature`, so a change that has moved is asked for. */
  outcomes: (listingId: string, signature: string) => ["presence", "edit", "outcomes", listingId, signature] as const,
  offers: (listingId: string, network: string) => ["presence", "edit", "offers", listingId, network] as const,
  categories: (listingId: string, network: string, q: string) => ["presence", "edit", "categories", listingId, network, q.trim().toLowerCase()] as const,
};

/**
 * One change list from the OPEN changes (read on their own, so none is dropped however much history there is) and a capped page of recent history:
 * every open change is always present, and only the settled ones are capped. De-duplicated by id, newest first.
 */
export function mergeChanges(open: readonly ChangeCardData[], history: readonly ChangeCardData[]): ChangeCardData[] {
  const byId = new Map<string, ChangeCardData>();
  for (const c of [...history, ...open]) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
}
