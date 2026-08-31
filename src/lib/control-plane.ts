import type {
  MerchantContact,
  NotificationDomain,
  RoutingAssignment,
  RoutingAssignmentInput,
  RoutingChannel,
} from "@/lib/api/control-plane";
import type { TeamMember } from "@/lib/auth";

/**
 * The pure half of the WhatsApp settings page (PR-1.6b).
 *
 * ── ★★WHY THIS IS A SEPARATE MODULE ──────────────────────────────────────
 *
 * `vitest.config.ts` runs in `environment: "node"` and this repo has no
 * component render tests at all — the testable seam is always a pure helper
 * extracted into a sibling module. **So anything here that could be wrong lives
 * here**, and the components below it do layout. The three things most likely
 * to be wrong on this page are all in this file: which cells the matrix has,
 * what a `PUT` body looks like, and what a pending row's countdown says.
 */

// ── The channel axis ──────────────────────────────────────────────────────

/**
 * ★★HARD-CODED, AND THAT IS CORRECT HERE WHERE IT IS WRONG FOR DOMAINS.
 *
 * `plt_routing.channel` is a closed `enum` in the collection's own schema, and
 * `PUT /routing` validates against the same five. **A sixth channel is not a
 * config row somebody seeds — it is a surface Peakhour cannot currently see, so
 * it implies new code anyway.** ⚠️Domains are the opposite: a collection, read
 * at write time, precisely so ops can add one without a deploy — which is why
 * `buildDomainRows` takes them as an argument and this list is a constant.
 */
export const ROUTING_CHANNELS: ReadonlyArray<{
  key: RoutingChannel;
  label: string;
}> = [
  { key: "shopify", label: "Shopify" },
  { key: "woocommerce", label: "WooCommerce" },
  { key: "wordpress", label: "WordPress" },
  { key: "linkedin", label: "LinkedIn" },
  // ★§02 labels this one "WhatsApp (your customers)" — and the parenthesis is
  //  load-bearing, not decoration. This page is Flow A, Peakhour talking to the
  //  merchant; the `whatsapp` CHANNEL is Flow B, the merchant's own shoppers.
  //  **A cell reading plain "WhatsApp" on this page would name the wrong
  //  plane**, on the one page whose subject is the difference between them.
  { key: "whatsapp", label: "WhatsApp (your customers)" },
];

// ── One cell of the matrix ────────────────────────────────────────────────

export interface MatrixCell {
  /** `domain:support` / `channel:shopify` — stable across re-renders and
   *  independent of whether a row exists. */
  id: string;
  axis: "domain" | "channel";
  key: string;
  label: string;
  description: string | null;
  /** The stored row, when the cell has one. */
  assignment: RoutingAssignment | null;
  /** The assignee's display name, or their email, or null. ★Never "Unknown":
   *  a name we could not resolve and a person with no name on file are the same
   *  to a renderer and different to whoever has to fix it. */
  assigneeLabel: string | null;
  /**
   * ⚠️★★THE ASSIGNEE'S NUMBER IS NOT VERIFIED — so this cell resolves to the
   * Owner in practice, whatever it says. `resolveRecipients` requires a
   * `status: "verified"` contact; an assignment to somebody who has not
   * confirmed a number is a real row that routes nowhere. **§02 draws this as
   * "Pending verification" and a page that showed only the name would be
   * telling the merchant something false.**
   */
  assigneeUnverified: boolean;
}

/**
 * Is this assignee's number verified?
 *
 * ★★"NO CONTACT ROW" AND "A REVOKED ONE" ARE THE SAME ANSWER HERE and it is
 * deliberate: `resolveRecipients` asks for `status: "verified"` and gets
 * nothing in either case. Distinguishing them on the page would imply a
 * difference in where the message goes, and there is none.
 */
function isVerified(userId: string, contacts: MerchantContact[]): boolean {
  return contacts.some((c) => c.userId === userId && c.status === "verified");
}

function labelFor(a: RoutingAssignment): string | null {
  return a.assignee.name ?? a.assignee.email ?? null;
}

/**
 * The domain half of the matrix — **one cell per ACTIVE registry row**, in the
 * registry's own `sortOrder`, whether or not anybody is assigned.
 *
 * ⚠️★★THE ROWS ARE NOT A LIST TO COPY, AND §02'S OWN HISTORY IS THE ARGUMENT.
 * That table drew five domains, was right for four months, and was stale within
 * a day of mongodb migration 279 seeding `insights` — because `weekly_digest`
 * (the GA4 + Search Console brief) fitted none of the original five and PR-1.5
 * had shipped it on `content` as a recorded loose fit. **A page built to the
 * table as drawn would have shipped five rows and left `Insights`
 * unassignable**, which is precisely the silent hole the sixth domain was
 * seeded to avoid.
 *
 * ★A domain with no matching registry row is NOT dropped silently — see
 * `orphanedDomainRows`.
 */
export function buildDomainRows(
  domains: NotificationDomain[],
  assignments: RoutingAssignment[],
  contacts: MerchantContact[],
): MatrixCell[] {
  return [...domains]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => {
      const assignment = assignments.find((a) => a.domain === d.key) ?? null;
      return {
        id: `domain:${d.key}`,
        axis: "domain" as const,
        key: d.key,
        label: d.displayName,
        description: d.description,
        assignment,
        assigneeLabel: assignment ? labelFor(assignment) : null,
        assigneeUnverified: assignment
          ? !isVerified(assignment.assignee.userId, contacts)
          : false,
      };
    });
}

/**
 * ⚠️★★ASSIGNMENTS TO A DOMAIN THE REGISTRY NO LONGER OFFERS.
 *
 * `GET /domains` returns `{status: "active"}` only, and a DEPRECATED domain
 * keeps routing — `resolveRecipients` deliberately does not join that registry,
 * because deleting the row instead would silently redirect those notifications
 * to the Owner. **So a live assignment can point at a domain this page's own
 * domain list does not contain**, and rendering only the list would hide a cell
 * that is still delivering mail.
 *
 * ★They are shown separately, and they can be cleared but not re-created:
 * `PUT /routing` answers `DOMAIN_DEPRECATED` for a NEW assignment to one and
 * accepts a REASSIGNMENT of an existing cell.
 */
export function orphanedDomainRows(
  domains: NotificationDomain[],
  assignments: RoutingAssignment[],
  contacts: MerchantContact[],
): MatrixCell[] {
  const known = new Set(domains.map((d) => d.key));
  return assignments
    .filter((a) => typeof a.domain === "string" && !known.has(a.domain))
    .map((a) => ({
      id: `domain:${a.domain}`,
      axis: "domain" as const,
      key: a.domain as string,
      label: a.domain as string,
      description: null,
      assignment: a,
      assigneeLabel: labelFor(a),
      assigneeUnverified: !isVerified(a.assignee.userId, contacts),
    }));
}

/** The channel half — one cell per member of the closed set, always all five. */
export function buildChannelRows(
  assignments: RoutingAssignment[],
  contacts: MerchantContact[],
): MatrixCell[] {
  return ROUTING_CHANNELS.map(({ key, label }) => {
    const assignment = assignments.find((a) => a.channel === key) ?? null;
    return {
      id: `channel:${key}`,
      axis: "channel" as const,
      key,
      label,
      description: null,
      assignment,
      assigneeLabel: assignment ? labelFor(assignment) : null,
      assigneeUnverified: assignment
        ? !isVerified(assignment.assignee.userId, contacts)
        : false,
    };
  });
}

// ── The write ─────────────────────────────────────────────────────────────

/**
 * The `PUT /routing` body for a cell.
 *
 * ⚠️★★A `RoutingAssignment` IS NOT A LEGAL `PUT` BODY, and both endpoints ship
 * `.strict()` so the difference is a 400 rather than a silent strip. The row
 * carries `id` and an `assignee` OBJECT; the write takes `assigneeUserId` and
 * no id at all. ★What round-trips is the AXIS PAIR — the api accepts `null` as
 * absent precisely so a caller can hand back the axis it was given without
 * inspecting which key exists.
 *
 * ★The other axis is sent EXPLICITLY as `null` rather than omitted. Both are
 * accepted; `null` is the shape `GET` hands back, so sending it keeps one
 * spelling on this page instead of two.
 */
export function assignmentInputFor(
  cell: Pick<MatrixCell, "axis" | "key">,
  assigneeUserId: string,
): RoutingAssignmentInput {
  return cell.axis === "domain"
    ? { domain: cell.key, channel: null, assigneeUserId }
    : { domain: null, channel: cell.key as RoutingChannel, assigneeUserId };
}

// ── Numbers ───────────────────────────────────────────────────────────────

/**
 * `919820411207` → `+91 98204 11207`.
 *
 * ★★A BEST-EFFORT GROUPING FOR INDIAN NUMBERS ONLY, AND EVERY OTHER COUNTRY
 * GETS `+` AND THE DIGITS. 🚫Guessing at grouping for a country whose format we
 * do not know produces a number that reads as wrong to the only person who can
 * tell — the one it belongs to. **A merchant who cannot recognise their own
 * number cannot confirm the row is right**, so an ungrouped `+4915112345678`
 * beats a confidently mis-spaced one.
 */
export function formatWaId(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}

/** E.164 digits, no leading `+` — exactly what `waIdSchema` accepts, so the
 *  page refuses locally what the api would refuse anyway. */
export function normaliseWaIdInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** ★8–15 DIGITS, matching the api's own bound. Below 8 there is no country on
 *  earth it could be; above 15 it is outside E.164 itself. */
export function isPlausibleWaId(digits: string): boolean {
  return /^[1-9][0-9]{7,14}$/.test(digits);
}


/**
 * The `POST /contacts` body, or `null` when the form is not answerable yet.
 *
 * ── ⚠️★★`userId` IS ALWAYS SENT, AND THE API'S DEFAULT IS WHY ────────────
 *
 * `POST /contacts` defaults `userId` to the CALLER when it is omitted — right
 * for a script, and wrong for a form whose first question is *"whose number is
 * it?"*. 🚫A first version omitted it whenever nothing was selected, so "Add a
 * teammate" registered **a teammate's handset against the Owner's `userId`**.
 *
 * ★That is not merely a wrong row. Only the person a row NAMES can verify it,
 * so either the number is unconfirmable — or the Owner confirms it and **a
 * teammate's phone is now authorised as the Owner**, which is the precise
 * failure `plt_merchant_contacts` exists to prevent.
 */
export function registrationInputFor(
  rawWaId: string,
  subjectUserId: string | null,
): { waId: string; userId: string } | null {
  const waId = normaliseWaIdInput(rawWaId);
  if (!isPlausibleWaId(waId)) return null;
  if (!subjectUserId) return null;
  return { waId, userId: subjectUserId };
}

// ── The countdown ─────────────────────────────────────────────────────────

/**
 * "4:12 left", or null once it has run out.
 *
 * ★★A PENDING ROW SHOWS A COUNTDOWN, NOT A STATUS WORD, and §02 is explicit
 * about it. "Code sent" alone cannot tell somebody whether to wait or to press
 * Resend, and the answer changes every second.
 *
 * ★NULL AT ZERO RATHER THAN "0:00": an expired code is not a code with no time
 * left on it, it is a row that needs Resend, and the two want different
 * controls. 🚫Clamping to "0:00" would leave the page inviting somebody to type
 * a code the api will refuse.
 */
export function codeCountdown(
  codeExpiresAt: string | null,
  now: number = Date.now(),
): string | null {
  if (!codeExpiresAt) return null;
  const expiry = Date.parse(codeExpiresAt);
  if (Number.isNaN(expiry)) return null;
  const remaining = Math.floor((expiry - now) / 1000);
  if (remaining <= 0) return null;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ── Quiet hours ───────────────────────────────────────────────────────────

/** 24-hour `HH:MM`, matching migration 275's own pattern exactly. */
export function isClock(v: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
}

/**
 * The browser's IANA zone, for the quiet-hours default.
 *
 * ⚠️★★A DEFAULT THE PERSON CAN SEE AND CHANGE, NOT ONE THE API SUPPLIES. The
 * api requires `tz` and deliberately does NOT default it to the business's
 * zone: a merchant setting quiet hours for a teammate abroad would then set
 * them in the wrong day. **Pre-filling the BROWSER's zone has the same failure
 * mode** — an Owner in Mumbai editing a teammate in London — so the control has
 * to show the value it is about to send, which is what this is for.
 */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export type QuietHoursDraft = { start: string; end: string; tz: string };

/**
 * Validate a quiet-hours draft into the patch the api takes, or say why not.
 *
 * ★★ALL THREE OR NONE — the collection requires them together, and a partial
 * row would be refused by the validator as a code 121 on a path whose insert
 * failure is caught and logged, i.e. silently. **The page has to refuse it
 * first**, because the api's own refusal would arrive somewhere nobody reads.
 *
 * ★`start === end` IS REFUSED. It reads as either "no quiet hours" or "quiet
 * for twenty-four hours", the two are opposites, and neither is what somebody
 * typing the same time twice meant. 🚫A `start` LATER than `end` is NOT refused
 * — that is an overnight window, `22:00`–`07:00`, which is the commonest quiet
 * period there is.
 */
export function quietHoursPatch(
  draft: QuietHoursDraft,
): { ok: true; value: QuietHoursDraft } | { ok: false; error: string } {
  const start = draft.start.trim();
  const end = draft.end.trim();
  const tz = draft.tz.trim();
  if (!isClock(start) || !isClock(end)) {
    return { ok: false, error: "Use 24-hour times, like 22:00 and 07:00." };
  }
  if (!tz) {
    return {
      ok: false,
      error:
        "Pick a time zone — quiet hours mean different things in different places.",
    };
  }
  if (start === end) {
    return {
      ok: false,
      error:
        "Start and end are the same. Leave quiet hours off instead, or set a real window.",
    };
  }
  return { ok: true, value: { start, end, tz } };
}

/** "22:00–07:00 · Asia/Kolkata (overnight)" — the window as the person set it. */
export function describeQuietHours(q: QuietHoursDraft): string {
  const overnight = q.start > q.end ? " (overnight)" : "";
  return `${q.start}–${q.end} · ${q.tz}${overnight}`;
}

// ── People ────────────────────────────────────────────────────────────────

/**
 * Who can be assigned a cell.
 *
 * ★★EVERY ACTIVE ORG MEMBER, NOT ONLY THOSE WITH A VERIFIED NUMBER, because
 * that is what `PUT /routing` accepts and narrowing the picker would make the
 * page disagree with the api it writes to. ⚠️An assignment to somebody with no
 * verified number is a real row that routes to the Owner in practice — so the
 * CELL says so (`assigneeUnverified`) rather than the picker hiding the person.
 * **Hiding them would leave a merchant unable to assign the teammate they are
 * about to onboard, with no explanation.**
 */
export function assignableMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );
}

/** The display name for a member, falling back to their email. */
export function memberLabel(m: TeamMember): string {
  return m.name ?? m.email;
}

/** The contact rows for one person, newest first — §02 lists one row per
 *  person, and `waId` is unique per BUSINESS rather than per person, so a
 *  teammate can hold more than one. */
export function contactsFor(
  userId: string,
  contacts: MerchantContact[],
): MerchantContact[] {
  return contacts.filter((c) => c.userId === userId);
}

// ── People who left ───────────────────────────────────────────────────────

/** One person the page has to draw, whether or not they are still on the team. */
export interface ContactHolder {
  userId: string;
  label: string;
  /** The org role, or null for somebody no longer in `members[]`. */
  role: string | null;
  /** ⚠️False means they have LEFT THE ORG and their rows are still here. */
  isMember: boolean;
}

/**
 * Everybody with a row to draw: every org member, plus **anybody holding a
 * contact row who is no longer one.**
 *
 * ── ⚠️★★A NUMBER OUTLIVES THE MEMBERSHIP THAT REGISTERED IT ──────────────
 *
 * `plt_merchant_contacts` is not touched when somebody is removed from
 * `org_organizations.members[]`, and **`resolveRecipients` does not join the
 * member list either** — it asks for `status: "verified"`. So a teammate who
 * left still holds a number Peakhour will take an instruction from.
 *
 * 🚫**A first version iterated the MEMBER list**, so that row was invisible:
 * not shown, not revocable, and still able to command. **The one control that
 * could close it was the one thing the page did not draw.** This is the same
 * shape as `orphanedDomainRows` and it is here for the same reason — a live
 * thing the obvious list does not contain.
 */
export function contactHolders(
  members: TeamMember[],
  contacts: MerchantContact[],
): ContactHolder[] {
  const holders: ContactHolder[] = assignableMembers(members).map((m) => ({
    userId: m.userId,
    label: memberLabel(m),
    role: m.role,
    isMember: true,
  }));
  const known = new Set(holders.map((h) => h.userId));
  for (const c of contacts) {
    if (known.has(c.userId)) continue;
    known.add(c.userId);
    holders.push({
      userId: c.userId,
      // ★THE NUMBER IS THE ONLY LABEL LEFT. `GET /contacts` carries no name —
      //  it never needed one while every holder was a member — so the row is
      //  identified by the thing that still matters: the number that can
      //  command Peakhour.
      label: formatWaId(c.waId),
      role: null,
      isMember: false,
    });
  }
  return holders;
}

/**
 * The options an assignee picker must offer for one cell.
 *
 * ★★THE CURRENT ASSIGNEE IS ALWAYS AMONG THEM, EVEN IF THEY LEFT. A `Select`
 * whose value is not in its options renders **blank** — so an Admin would see
 * an empty control on a cell that is assigned, while a viewer reading the same
 * row sees the name. ⚠️Blank reads as "not assigned", which is the opposite of
 * what is stored, and the remedy (reassign it) is the one thing the blank
 * control makes hard.
 */
export function pickerOptions(
  members: TeamMember[],
  assignment: RoutingAssignment | null,
): Array<{ userId: string; label: string; isMember: boolean }> {
  const options = assignableMembers(members).map((m) => ({
    userId: m.userId,
    label: memberLabel(m),
    isMember: true,
  }));
  const current = assignment?.assignee;
  if (current && !options.some((o) => o.userId === current.userId)) {
    options.unshift({
      userId: current.userId,
      label: current.name ?? current.email ?? "Someone who has left",
      isMember: false,
    });
  }
  return options;
}

/**
 * The options a locale picker must offer, given what is stored.
 *
 * ★★`locale` IS A FREE STRING, NOT AN ENUM — a BCP-47-ish value capped at 32,
 * the same type the shopper plane uses. The suggestions are a starting point,
 * and 🚫a `Select` limited to them renders **blank** for anything else — which
 * is indistinguishable from "infer it from how they write", **the opposite
 * setting.** So a stored value outside the list becomes an option.
 */
export function localeOptions(
  suggestions: ReadonlyArray<{ value: string; label: string }>,
  stored: string | null,
): Array<{ value: string; label: string }> {
  if (!stored || suggestions.some((s) => s.value === stored)) {
    return [...suggestions];
  }
  return [{ value: stored, label: stored }, ...suggestions];
}
