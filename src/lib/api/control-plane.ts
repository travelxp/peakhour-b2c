import { api } from "@/lib/api";

/**
 * `/v1/control-plane` — who at this business may command Peakhour, which of
 * them hears about what, and how they want to be spoken to.
 *
 * ── ★★THIS IS FLOW A, AND IT IS NOT THE WHATSAPP ALREADY IN THIS REPO ─────
 *
 * `dashboard/content/whatsapp` and `hooks/use-wa-conversations` are **Flow B**:
 * the merchant talking to their own shoppers, from the merchant's own WABA.
 * ⚠️This is the other plane — **Peakhour** talking to the **merchant**, from
 * Peakhour's number — and the two must not be joined up in the client any more
 * than they are on the server. A control that mixed them would let a merchant
 * route their shoppers' messages to a teammate's personal number.
 *
 * ★The api is PR-1.6a (api#1187). The page is PR-1.6b. They shipped apart
 * because §02's brief was tabled as b2c-only and **nothing anywhere read or
 * wrote `plt_routing`** — the fourth time this programme has found a row
 * needing a sibling nobody scoped.
 */

// ── Contacts ──────────────────────────────────────────────────────────────

/** `plt_merchant_contacts.status`. ★`verified` IS THE PERMISSION — there is no
 *  separate role field, and nothing else grants authority to a number. */
export type ContactStatus = "pending" | "verified" | "revoked";

/** How plainly this person wants to be written to. Inferred from how they
 *  write to us, sticky, and overridable here. */
export type ContactRegister = "formal" | "casual";

export interface QuietHours {
  /** 24-hour `HH:MM`. */
  start: string;
  end: string;
  /**
   * ★★AN IANA ZONE, REQUIRED, BECAUSE THE OTHER TWO ARE MEANINGLESS WITHOUT
   * IT. "Do not message me between 22:00 and 07:00" is a different instruction
   * in Mumbai and in London. 🚫It is deliberately NOT defaulted to the
   * business's zone: a merchant setting quiet hours for a teammate abroad
   * would then set them in the wrong day.
   */
  tz: string;
}

export interface MerchantContact {
  id: string;
  /** E.164 digits, no leading `+` — the form Meta uses. */
  waId: string;
  userId: string;
  status: ContactStatus;
  verifiedAt: string | null;
  revokedAt: string | null;
  locale: string | null;
  register: ContactRegister | null;
  quietHours: QuietHours | null;
  /** §02 renders "Code sent · 4:12 left" from this pair. */
  codeExpiresAt: string | null;
  codeSentAt: string | null;
}

// ── Routing ───────────────────────────────────────────────────────────────

/** The closed set `plt_routing` declares. ★A new channel implies new code —
 *  there is no notification about a surface Peakhour cannot see. */
export type RoutingChannel =
  | "shopify"
  | "woocommerce"
  | "wordpress"
  | "linkedin"
  | "whatsapp";

/** One row of `cfg_notification_domains` at `{status: "active"}`.
 *
 *  ⚠️★★NOT A LIST TO HARD-CODE. §02 drew five domains and was stale within a
 *  day of migration 279 seeding a sixth (`insights`), because `weekly_digest`
 *  fitted none of the original five. **A page that hard-codes the set is wrong
 *  the first time ops seed another** — and ops seeding another needs no deploy,
 *  which is the whole reason the registry is a collection. */
export interface NotificationDomain {
  key: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
}

export interface RoutingAssignment {
  id: string;
  /** ★EXACTLY ONE IS NON-NULL — the collection's whole shape. Both keys are
   *  always present so the page reads the axis rather than inferring it from
   *  which property happens to exist. */
  domain: string | null;
  channel: string | null;
  assignee: {
    userId: string;
    /** `null`, not "Unknown" — a name we could not resolve and a person with
     *  no name on file are the same to a renderer and different to whoever has
     *  to fix it. */
    name: string | null;
    email: string | null;
  };
}

export interface RoutingMatrix {
  byDomain: RoutingAssignment[];
  byChannel: RoutingAssignment[];
  /**
   * ⚠️★★ROWS CARRYING BOTH AXES, OR NEITHER — returned rather than hidden.
   * "Exactly one axis" is cross-field, so `$jsonSchema` cannot express it and
   * the emitted validator does not. The resolver makes such a row INERT (both
   * its lookups exclude the other axis), so the cell behaves as unassigned and
   * falls to the Owner. **A merchant who configured it sees it doing nothing,
   * and a page that omitted it would give them nothing to click.**
   */
  malformed: RoutingAssignment[];
}

/**
 * The body `PUT /routing` accepts — a discriminated union, `.strict()` on both
 * branches.
 *
 * 🚫★A `RoutingAssignment` IS NOT ONE OF THESE. It carries `id` and an
 * `assignee` object; the write takes `assigneeUserId` and no id at all. ★What
 * round-trips is the AXIS PAIR: `null` is accepted as absent precisely so a
 * page can hand back the axis it was given without inspecting which key exists.
 */
export type RoutingAssignmentInput =
  | { domain: string; channel?: null; assigneeUserId: string }
  | { domain?: null; channel: RoutingChannel; assigneeUserId: string };

// ── Calls ─────────────────────────────────────────────────────────────────

/** ★NOT business-scoped, and the api agrees: the registry is global. This
 *  resolves for an org that has not made a business yet. */
export async function getNotificationDomains(): Promise<NotificationDomain[]> {
  const r = await api.get<{ domains: NotificationDomain[] }>(
    "/v1/control-plane/domains",
  );
  return r.domains;
}

export async function getRoutingMatrix(): Promise<RoutingMatrix> {
  return api.get<RoutingMatrix>("/v1/control-plane/routing");
}

/** Owner/Admin. Upserts on the CELL, so re-assigning replaces rather than adds. */
export async function putRoutingAssignment(
  input: RoutingAssignmentInput,
): Promise<{ assignment: RoutingAssignment }> {
  return api.put<{ assignment: RoutingAssignment }>(
    "/v1/control-plane/routing",
    input,
  );
}

/** Owner/Admin. ★A HARD DELETE — an assignment is a live instruction, and an
 *  unassigned cell is a real, meaningful state (it falls to the Owner), not a
 *  gap where a tombstone should sit. */
export async function deleteRoutingAssignment(id: string): Promise<void> {
  await api.delete<{ id: string }>(`/v1/control-plane/routing/${id}`);
}

export async function getMerchantContacts(): Promise<MerchantContact[]> {
  const r = await api.get<{ contacts: MerchantContact[] }>(
    "/v1/control-plane/contacts",
  );
  return r.contacts;
}

/** Owner/Admin. Registers a number AND sends its first code.
 *
 *  ★`userId` DEFAULTS TO THE CALLER, which is the ordinary case — an Owner
 *  registering their own number. Pass it to register somebody else's, which is
 *  the case that needs the Owner/Admin role in the first place. */
export async function registerContact(input: {
  waId: string;
  userId?: string;
}): Promise<{ id: string; waId: string; expiresAt: string }> {
  return api.post<{ id: string; waId: string; expiresAt: string }>(
    "/v1/control-plane/contacts",
    input,
  );
}

/** Owner/Admin. Throttled per row AND per number — both answer 429. */
export async function resendContactCode(
  id: string,
): Promise<{ id: string; expiresAt: string }> {
  return api.post<{ id: string; expiresAt: string }>(
    `/v1/control-plane/contacts/${id}/resend`,
    {},
  );
}

/**
 * ⚠️★★THE CONTACT'S OWN ACTION AND NOBODY ELSE'S. An Owner entering somebody
 * else's code gets 403 `NOT_YOUR_NUMBER`, deliberately: the row asserts
 * `waId → userId`, and an authenticated submit is what proves BOTH halves — the
 * session says which user, the code says which number. **So the person who can
 * finish a pending row is usually not the person looking at the screen.**
 */
export async function verifyContact(
  id: string,
  code: string,
): Promise<{ id: string; status: string }> {
  return api.post<{ id: string; status: string }>(
    `/v1/control-plane/contacts/${id}/verify`,
    { code },
  );
}

/** Owner/Admin. ★Revoking also kills any live code — a pending row's code
 *  would otherwise outlive the authority it was issued under. */
export async function revokeContact(
  id: string,
): Promise<{ id: string; status: string }> {
  return api.post<{ id: string; status: string }>(
    `/v1/control-plane/contacts/${id}/revoke`,
    {},
  );
}

/**
 * Locale, register and quiet hours.
 *
 * ★★DELIBERATELY NOT Owner/Admin-ONLY. Registering a number is an assertion
 * about somebody else's identity; **the language a person reads and the hours
 * they will not take a message are assertions about themselves.** So the api
 * takes the contact's own action, plus Owner/Admin who administer the team.
 * 🚫An Owner/Admin-only rule would mean an Editor could not set their own quiet
 * hours, on the page whose entire subject is who hears what and when.
 *
 * ★`null` clears a field; omitting it leaves it alone. The two are different
 * requests and the api treats them as such (`$unset` versus untouched).
 */
export async function patchContactPreferences(
  id: string,
  patch: {
    locale?: string | null;
    register?: ContactRegister | null;
    quietHours?: QuietHours | null;
  },
): Promise<{ contact: MerchantContact }> {
  return api.patch<{ contact: MerchantContact }>(
    `/v1/control-plane/contacts/${id}`,
    patch,
  );
}
