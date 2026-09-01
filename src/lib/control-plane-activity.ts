import type { ActivityRow, NotificationDomain } from "@/lib/api/control-plane";
import { isTimeZone } from "@/lib/control-plane";

/**
 * The rendering rules behind §07's tab — PR-2.5d.
 *
 * *"Every instruction Peakhour acted on, who gave it, and every one it
 * refused."* `GET /v1/control-plane/activity` (api#1197) returns the rows;
 * everything here decides what a merchant reads.
 *
 * ★★IT IS A SEPARATE MODULE BECAUSE THE DECISIONS ARE TESTABLE AND THE MARKUP
 * IS NOT. This repo's suite is `environment: "node"` with no jsdom, so a rule
 * living inside a component is a rule with no spec — and every rule below is
 * one somebody could get wrong in a way a merchant would believe.
 *
 * ── ⏸★★WHAT 2.5d OWED, AND THE ANSWER IS "NOTHING RENDERS IT" ────────────
 *
 * 2.5a, 2.5b and 2.5c each deferred one question to this row: **what does the
 * tab do with a row that resolved neither an org nor a business** — §07's
 * fourth row, the stranger.
 *
 * ★THE ANSWER IS THAT NO SUCH ROW EXISTS. `recordActivity` in `peakhour-api`
 * returns `no_scope` and writes **nothing** when the actor has no `orgId`:
 * such a document is unreachable by `by_org_recent`, undeletable by either
 * erase filter, and never expired. **So there is no rendering rule to write**,
 * and inventing an empty "blocked strangers" section here would be a promise
 * the database cannot keep.
 *
 * ⏸🚫★★AND THE cms VIEW THE PLAN NAMES WOULD BE EMPTY TOO — a stronger finding
 * than "the view does not exist". A platform-level surface reading
 * `plt_activity` would find no stranger rows either, because the WRITE is the
 * half that was declined and for reasons that do not change with the reader.
 * **What such a surface needs first is somewhere to put them** — a
 * platform-scoped store with its own retention, which is a new row rather than
 * a corner of this one.
 *
 * ── 🚫★★SO WHAT IS THE MASKED NUMBER ON THIS PAGE? ───────────────────────
 *
 * Not a stranger — a stranger's row is never written. Every masked row here had
 * **contact rows in this org**, because that is what supplied the `orgId` the
 * write requires (see `recordActivity`, and `actorFor` in `platform-inbound.ts`
 * for how the two answers are derived separately). It is masked because no
 * single VERIFIED person could be named: a number mid-registration, or one
 * whose rows disagree about whose it is.
 *
 * ★★SO THE CAPTION §07's MOCK DRAWS IS WRONG TWICE OVER. *"Not a registered
 * teammate"* is wrong because `unknown_sender` also covers a
 * registered-but-pending contact — `plt_activity.zod.ts` says so — and wrong
 * again because on THIS page it is the only case that reaches the screen.
 * **The one thing true of every masked row is that the number was not verified
 * when the message arrived**, which is also the thing the merchant can act on:
 * the fix is one tab to the left.
 */

/** The label the left-hand column falls back to when a row has no domain. */
interface OutcomeCopy {
  /**
   * §07's left-hand group, used **only when the row carries no `domain`**.
   *
   * 🚫★NOT A SEVENTH DOMAIN. `plt_activity.domain` is a
   * `cfg_notification_domains` key and "Blocked" is not one — the schema is
   * explicit that Blocked is *"a rendering of the OUTCOME"*. So this is the
   * fallback, and a row that HAS a domain keeps it: a `command_denied` on
   * `LAUNCH` belongs under Ads with a refusal on it, not filed away from the
   * domain the merchant went looking in.
   */
  group: string;
  /** §07's "what" column. `{command}` is replaced by the trigger. */
  what: string;
  /**
   * Whether this row is a REFUSAL, which is the tab's whole argument.
   *
   * ★★IT IS NOT "THE LEFT COLUMN SAYS BLOCKED". A `command_denied` on a known
   * trigger files under its domain and is still a refusal — so the visible
   * marker rides on the row, not on the group, and a merchant scanning for
   * refusals cannot lose one to a domain heading.
   */
  refused: boolean;
}

/**
 * Every outcome `plt_activity` can hold, and what a merchant reads.
 *
 * ⚠️★★ELEVEN, AND THE TWELFTH IS ABSENT ON PURPOSE. `duplicate_skipped` is a
 * `PlatformInboundOutcome` that the ledger deliberately never writes — *"a
 * redelivery is not a second event"* — so a bucket for it here would be copy
 * for a row that cannot arrive.
 *
 * 🚫★AND `owner_only` / `not_your_domain` ARE NOT OUTCOMES. `platform-inbound.ts`
 * collapses both into `command_denied`; the merchant needs those two SENTENCES
 * apart and got them on WhatsApp, and a ledger does not.
 *
 * ⚠️★AN UNKNOWN KEY IS RENDERED, NOT DROPPED. See `activityCopy`: this map is a
 * COPY of an enum in another repo, and the one thing a ledger must never do is
 * silently lose a line because a twelfth outcome shipped before this file
 * heard about it.
 */
const OUTCOME_COPY: Record<string, OutcomeCopy> = {
  // ── the refusals ────────────────────────────────────────────────────────
  unknown_sender: {
    group: "Blocked",
    // ★NO TRIGGER IN THIS SENTENCE, BECAUSE THERE IS NO TRIGGER IN THE ROW.
    //  `plt_activity.command` is absent here on purpose — an unverified
    //  sender's text is not stored, so the page cannot repeat it and does not
    //  pretend to.
    what: "Ignored an instruction from a number that was not verified",
    refused: true,
  },
  no_longer_a_member: {
    group: "Blocked",
    what: "Ignored {command} — the person this number belongs to is no longer on the team",
    refused: true,
  },
  ambiguous_business: {
    group: "Blocked",
    what: "Could not tell which business {command} was meant for",
    refused: true,
  },
  command_denied: {
    group: "Blocked",
    what: "Refused {command}",
    refused: true,
  },
  // ── things that happened ────────────────────────────────────────────────
  not_a_command: {
    // 🚫★NOT "Blocked". A verified merchant saying "thanks" was not refused
    //  anything, and filing ordinary chatter under a wall the tab exists to
    //  prove is real would empty the word of meaning.
    group: "Message",
    what: "Sent a message that was not an instruction",
    refused: false,
  },
  command_handled: {
    group: "Instruction",
    what: "Ran {command}",
    refused: false,
  },
  command_silent: {
    group: "Instruction",
    // ★THE SAME SENTENCE AS `command_handled`, AND THE DIFFERENCE IS NOT THE
    //  MERCHANT'S. The two differ only in whether Peakhour replied on
    //  WhatsApp — which the merchant saw in their own chat — and both mean the
    //  instruction ran. 🚫Splitting them here would ask them to care about the
    //  shape of a reply rather than what was done.
    what: "Ran {command}",
    refused: false,
  },
  confirmation_requested: {
    group: "Instruction",
    // 🚫★NOT "Asked YOU to confirm". This ledger is ORG-wide — every business
    //  of the org sees the rows that resolved no single one, and every reader
    //  sees their colleagues' lines — so the second person contradicts the
    //  actor's name rendered beside it. **The row says who; the sentence says
    //  what.**
    what: "Asked for confirmation before running {command}",
    refused: false,
  },
  nothing_to_confirm: {
    group: "Instruction",
    what: "Sent CONFIRM when nothing was waiting to be confirmed",
    refused: false,
  },
  // ── compliance ──────────────────────────────────────────────────────────
  consent_opted_out: {
    group: "Messaging",
    what: "Asked Peakhour to stop messaging this number",
    refused: false,
  },
  consent_opted_in: {
    group: "Messaging",
    what: "Asked Peakhour to message this number again",
    refused: false,
  },
};

/** What one row says, with its trigger filled in. */
export interface ActivityCopy {
  /** §07's left-hand column — a domain's display name, or the fallback. */
  group: string;
  /** §07's "what" column. */
  what: string;
  /** Whether to draw the refusal marker. */
  refused: boolean;
}

/**
 * §07's left column and "what", for one row.
 *
 * ── ⚠️★★THE DOMAIN NAME COMES FROM THE REGISTRY, NEVER FROM A LIST HERE ───
 *
 * `cfg_notification_domains` is a collection precisely so ops can seed one
 * without a deploy — §02's page learned this when migration 279 added
 * `insights` and a hard-coded set of five went stale the same day. So the
 * caller passes `GET /control-plane/domains` through and this looks the key up.
 *
 * ★A KEY WITH NO REGISTRY ROW STILL RENDERS, as its own key. A domain can be
 * `deprecated` — `GET /domains` returns the ACTIVE ones — and a ledger line
 * written while it was active must not become blank when it is retired.
 *
 * ── ⚠️★★AND AN UNKNOWN OUTCOME RENDERS TOO ───────────────────────────────
 *
 * `OUTCOME_COPY` is a copy of an enum that lives in two other repos and is
 * checked by neither compiler. `plt_activity.zod.ts` says adding a twelfth
 * outcome is a migration, and this file would learn about it late. **A ledger
 * that dropped the line would hide exactly the event somebody added an outcome
 * to make visible**, so an unrecognised outcome renders under "Activity" with
 * its own key as the sentence.
 */
export function activityCopy(
  row: ActivityRow,
  domains: NotificationDomain[],
): ActivityCopy {
  const copy = OUTCOME_COPY[row.outcome];
  const group =
    (row.domain
      ? domains.find((d) => d.key === row.domain)?.displayName ?? row.domain
      : null) ??
    copy?.group ??
    "Activity";
  if (!copy) return { group, what: row.outcome, refused: false };
  return {
    group,
    what: fillCommand(copy.what, row.command),
    // ⚠️★A ROW THAT WAS CONFIRMED IS NEVER A REFUSAL, and nothing needs to
    //  check that here: `plt_activity` forbids `confirmed` on an outcome that
    //  did not act, and `recordActivity` refuses the pair before the insert.
    refused: copy.refused,
  };
}

/**
 * `"Refused {command}"` → `"Refused LAUNCH"`.
 *
 * ── ⚠️🚫★★AND THE TRIGGERLESS FORM IS THE COMMON ONE, NOT THE EDGE ───────
 *
 * A first version simply DELETED the placeholder, on the assumption that a row
 * without a trigger was rare. Measured in `platform-inbound.ts`: **it does not
 * set `command` on `ambiguous_business` or `no_longer_a_member` at all** — so
 * the two refusals that most need a sentence rendered *"Could not tell which
 * business was meant for"* and *"Ignored — the person this number belongs
 * to…"*. ★A merchant reading a broken sentence on a ledger stops trusting the
 * ledger.
 *
 * ★SO THE PLACEHOLDER FALLS BACK TO A NOUN RATHER THAN TO NOTHING. Every
 * template reads with it — *"Refused an instruction"*, *"Could not tell which
 * business an instruction was meant for"* — and none of them claims to know
 * which one it was.
 *
 * ⏸★THE api COULD SUPPLY IT, and that is a `PlatformInboundResult` gap rather
 * than a rendering one. 🚫**But it is not the one-line field-set this docblock
 * first called it** — the retraction is here because the claim was: *"it has
 * the trigger in hand at both"* is true on an ORDINARY turn and false on a
 * `CONFIRM` one, where `trigger` is `null` by construction and the command
 * being confirmed sits in the stored `pendingCommand.command`, **read only
 * after both refusal returns**. ★Recorded in the rollout plan's §2.5; this file
 * must read correctly either way, and does.
 */
const UNNAMED_COMMAND = "an instruction";

function fillCommand(template: string, command: string | null): string {
  return template.replace("{command}", command || UNNAMED_COMMAND);
}

/**
 * `"+9198XXXXXX07"` → `"+91 98XXX XXX07"`.
 *
 * ── ★★THE SAME RULE `formatWaId` USES, AND FOR THE SAME REASON ───────────
 *
 * The STORED form is deliberately table-free: `+`, the first four digits, a run
 * of `X`, the last two. `plt_activity.zod.ts` explains why — splitting a
 * country code needs `helpers/phone.ts`'s `COUNTRY_DIALLING`, which **declines
 * outside a fixed set**, and the writer would then produce nothing for exactly
 * the foreign senders these rows are about. ★So the spacing is a presentation
 * choice and it is made here, where being wrong costs a space rather than a row.
 *
 * ★AND ONLY FOR A PREFIX WE RECOGNISE. `formatWaId` groups Indian numbers and
 * hands every other country back its digits, because *"a merchant who cannot
 * recognise their own number cannot confirm the row is right"*. **The argument
 * is stronger here**: the merchant is being asked to recognise a number that is
 * mostly `X`, so a confidently mis-grouped one is worse than an ungrouped one.
 *
 * ⚠️★THE LENGTH IS CHECKED, NOT JUST THE PREFIX. `+91` groups as 2+5+5 only for
 * a 12-digit Indian number; a masked value of any other length is left alone
 * rather than sliced into a shape India does not use.
 */
export function formatMaskedNumber(masked: string): string {
  // `+` + 4 digits + X-run + 2 digits, per `zMaskedPhone`. An Indian mobile is
  // 12 digits, so the body after `+91` is 10 characters wide.
  const body = masked.startsWith("+91") ? masked.slice(3) : null;
  if (body && body.length === 10) {
    return `+91 ${body.slice(0, 5)} ${body.slice(5)}`;
  }
  return masked;
}

/**
 * §07's "who" column.
 *
 * ── ★★A PERSON, OR A NUMBER — NEVER BOTH AND NEVER NEITHER ───────────────
 *
 * That pair is `plt_activity`'s headline invariant, installed in the
 * collection's own validator: a verified teammate is a PERSON, and anybody else
 * is a masked number and nothing more. A verified sender's number is not stored
 * here at all, not even masked, because §02 already shows the merchant that
 * number and repeating it would put a live one in a second place.
 *
 * ⚠️★AND A NAMED ACTOR MAY HAVE NO NAME. The endpoint reads `users` for the
 * page's actors and returns `null` for both fields when the document is gone —
 * an erased account, a deleted user — and **the line is still the merchant's to
 * read**: `no_longer_a_member` is one of the outcomes this page exists to show.
 * 🚫So a missing name is a fallback, never a dropped row.
 */
export function activityActor(row: ActivityRow): {
  label: string;
  /** True when this is a masked number rather than a named person. */
  masked: boolean;
} {
  if (row.actor) {
    return {
      label: row.actor.name ?? row.actor.email ?? "A deleted account",
      masked: false,
    };
  }
  if (row.actorMasked) {
    return { label: formatMaskedNumber(row.actorMasked), masked: true };
  }
  // ⚠️★UNREACHABLE THROUGH THE API, AND RENDERED ANYWAY. The collection forbids
  //  a row with neither, so this is the shape of a bug rather than a state —
  //  and a ledger line with no attribution is still evidence that something
  //  happened. 🚫Returning nothing would delete it from the merchant's view to
  //  tidy up a case that should be impossible.
  return { label: "Unattributed", masked: false };
}

/**
 * §07's right-hand column: `"18:03"`, `"Yesterday"`, `"11 Aug"`.
 *
 * ── ⚠️★★AND `"11 Aug 2025"` ONCE THE ROW IS A YEAR OLD ───────────────────
 *
 * §07's mock draws *"11 Aug"* and stops there, which is fine for a mock and
 * wrong for this collection: **`plt_activity` carries no TTL, deliberately** —
 * migration 282's whole argument is that an expiry would erase the slow probe
 * preferentially. So rows here outlive the year they were written in, and a
 * bare *"11 Aug"* would show a merchant two identical dates a year apart.
 *
 * ★THE ZONE IS THE MERCHANT'S, NOT THE BROWSER'S, when they have set one.
 * *"Today"* is a claim about a calendar, and a merchant in Mumbai reading from
 * an airport in London is still asking about their own day. ⚠️Both the bucket
 * and the clock use the same zone: deciding the day in one and printing the
 * time in another produces *"Yesterday"* beside a time from today.
 */
export function activityWhen(
  occurredAt: string,
  now: Date,
  timeZone: string,
): string {
  const at = new Date(occurredAt);
  if (Number.isNaN(at.getTime())) return "";

  const day = calendarDay(at, timeZone);
  const today = calendarDay(now, timeZone);
  if (day === today) return clock(at, timeZone);
  if (day === previousDay(today)) return "Yesterday";
  return dayAndMonth(at, timeZone, day.slice(0, 4) !== today.slice(0, 4));
}

/**
 * `"2026-09-01"` in a given zone.
 *
 * ★`en-CA` FOR THE ORDER, NOT FOR THE COUNTRY. It is the locale this repo's
 * `formatDate` already reaches for when it wants ISO field order, and the
 * string is compared, never shown.
 */
function calendarDay(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * The calendar day before this one, by LABEL arithmetic.
 *
 * ⚠️🚫★★AND SUBTRACTING 24 HOURS FROM THE INSTANT IS THE WRONG ANSWER, which
 * a first version of this function did and a comment beside it called
 * DST-correct. It is the opposite. In `America/New_York`, "now" at
 * 2026-03-09 00:30 EDT minus 86,400,000 ms is 2026-03-07 23:30 EST — because
 * the 8th was 23 hours long — so **the whole of "yesterday" renders as a date**
 * on the two days a year a zone jumps.
 *
 * ★THIS NEVER TOUCHES A ZONE. The day has already been resolved to a `Y-M-D`
 * label; stepping that label back one is `Date.UTC` arithmetic on three
 * integers, and UTC has no offsets to jump. **Do the zone work once, then do
 * arithmetic on the answer.**
 */
function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! - 1));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** `"18:03"`. ★24-hour, which is what §07 draws and what a ledger wants: an
 *  `am`/`pm` on a dense list is one glance more per row. */
function clock(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** `"11 Aug"`, or `"11 Aug 2025"` once the year differs. */
function dayAndMonth(d: Date, timeZone: string, withYear: boolean): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(d);
}

/**
 * The note §07 owes on a row that belongs to no single business.
 *
 * ⚠️★★`businessId: null` IS NOT "THIS BUSINESS". The endpoint's query is
 * ORG-scoped though the tab is per-business, because the rows that carry no
 * business are the refusals the surface exists for — an `ambiguous_business`
 * is about several of them by definition. **So those rows appear on every
 * business's tab**, and a page that said nothing would be attributing an event
 * to whichever business the merchant happened to be looking at.
 *
 * ★NULL RATHER THAN A SENTENCE FOR THE ORDINARY CASE: a note on every row is a
 * note nobody reads.
 *
 * ⚠️🚫★★AND IT SAYS WHAT THE ABSENCE MEANS, NOT WHAT IT IMPLIES. A first
 * version read *"Concerns more than one of your businesses"* — a COUNT, and the
 * field does not carry one. The api omits `businessId` whenever no **single**
 * business resolved, which is not the same claim: `actorFor` drops the field
 * when the sender's contact rows disagree, and *"they disagree"* is all anybody
 * knows. ★A ledger is evidence, and **a sentence a merchant cannot check
 * against anything is the one kind of line it must not carry.**
 */
export function activityScopeNote(row: ActivityRow): string | null {
  return row.businessId === null ? "Not tied to a single business" : null;
}

/**
 * The merchant's zone if they have set a resolvable one, else the browser's.
 *
 * ⚠️🚫★★AND IT IS VALIDATED, BECAUSE A STORED ZONE IS FREE TEXT. A first
 * version passed `preferences.timezone` straight through — and `Intl` throws
 * `RangeError` for a zone it does not know, **inside the render**, which takes
 * the whole page to an error boundary. ★`Asia/Kolkta` is the likeliest mistake
 * on a form somebody types a zone into, and `control-plane.ts` already answers
 * this exact question for quiet hours: *"a typo in a free-text zone is the one
 * that fails silently."*
 *
 * ★IT VALIDATES WITH `canonicalTimeZone` AND RETURNS WHAT WAS TYPED. Same rule
 * `quietHoursPatch` follows, and for the reason recorded there: canonicalising
 * rewrites the modern `Asia/Kolkata` into the deprecated `Asia/Calcutta`.
 *
 * ⚠️🚫★★AND IT RETURNS THE **TRIMMED** STRING, WHICH A FIRST VERSION DID NOT.
 * `canonicalTimeZone` trims before asking `Intl`, so `" Asia/Kolkata "` passed
 * the check — and then the untrimmed value went to `Intl.DateTimeFormat`, which
 * throws `RangeError` for it. **The guard validated one string and handed back
 * another**, which is the exact crash this function exists to prevent, reached
 * through the function added to prevent it.
 */
export function displayTimeZone(preferred: string | null | undefined): string {
  const trimmed = preferred?.trim();
  if (trimmed && isTimeZone(trimmed)) return trimmed;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
