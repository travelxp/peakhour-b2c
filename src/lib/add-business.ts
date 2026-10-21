/**
 * Buying a plan for an ADDITIONAL business on the website (billing plan P3.2,
 * on the api's P3.1b routes).
 *
 * - `GET /v1/billing/add-business/preview?tier=&term=&name=` says what the
 *   purchase would do: `{ kind: "new", rail, price }`, or why it is refused.
 *   ★THE PRICE IS THE NEW BUSINESS'S. The campaign subject is the business
 *   being added (D8, P3.1b), so `GET /v1/billing/plans`, which prices the
 *   signed-in business, can quote a first-purchase campaign at the list price
 *   while the purchase charges half. The page quotes the preview, never /plans.
 * - `POST /v1/billing/add-business {name, tier, term}` answers as a new
 *   subscription on `/checkout` does (`{ gateway, embed, summary }`), plus the
 *   `businessId` allocated for it, or `invoice_required`.
 * - The payment creates the business (D12): Stripe's `/confirm` on return, or
 *   the webhook. Only then does the page switch into it.
 *
 * Offers come only from campaigns (owner, 2026-10-06 and 2026-10-21 #5): the
 * percent and the campaign's own label are the api's, and with no label the
 * percent stands alone. No trial (D19): an added business pays first, and
 * nothing here says otherwise.
 *
 * Kept free of React so the page's sentences and decisions are tested in node.
 */
import type { CheckoutResult, CheckoutSummary } from "@/components/upgrade/payment-modal";
import { TERMS, intervalSuffix, type BillingInterval, type BillingTerm } from "@/lib/billing-terms";

/** The api's bound on a business name (`ADDED_BUSINESS_NAME_MAX`). */
export const ADDED_BUSINESS_NAME_MAX = 120;

/** What the preview quotes: the charge for the business being added. */
export interface AddBusinessPrice {
  amount: number;
  currency: string;
  interval: BillingInterval;
  /** The list price, present only beside a campaign discount. */
  listAmount?: number;
  /** The campaign's percent already taken off `amount`, or 0. */
  discountPct: number;
  /** Terms the discounted price lasts; null = for as long as the plan is kept. */
  discountDurationTerms: number | null;
  /** `cfg_campaigns.label`, or null (no campaign, or one without a label). */
  campaignLabel: string | null;
}

export type AddBusinessPreview =
  /** `price` is absent on an api older than the P3.2 companion. */
  | { kind: "new"; rail: string; price?: AddBusinessPrice }
  | { kind: "refused"; code: string; message: string };

/** The code that means the org's plan already covers another business. */
export const ADD_BUSINESS_NOT_NEEDED = "ADD_BUSINESS_NOT_NEEDED";
/** The server's double-pay guard (the billing lane): a checkout of this plan
 *  is already starting for this business. */
export const CHECKOUT_IN_PROGRESS = "CHECKOUT_IN_PROGRESS";

/** The 402 every free add path answers when the org's plan covers no other
 *  business: `/auth/businesses/create` and `/onboarding/confirm`
 *  (BUSINESS_LIMIT_REACHED), the Shopify claim's move-in (CLAIM_BUSINESS_LIMIT).
 *  Its way on is the purchase. */
export const BUSINESS_LIMIT_CODES: readonly string[] = ["BUSINESS_LIMIT_REACHED", "CLAIM_BUSINESS_LIMIT"];

export function isBusinessLimit(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown } | null;
  return !!e && typeof e.code === "string" && BUSINESS_LIMIT_CODES.includes(e.code) && (e.status === undefined || e.status === 402);
}

/** The name as the api will take it, or null (blank, or too long). */
export function cleanBusinessName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= ADDED_BUSINESS_NAME_MAX ? name : null;
}

const UNIT: Record<BillingInterval, [string, string]> = {
  month: ["month", "months"],
  quarter: ["quarter", "quarters"],
  year: ["year", "years"],
};

/**
 * The campaign line beside the price, or null when no campaign applies.
 *
 * ★THE CAMPAIGN'S WORDS, NEVER OURS. With a label it is "<label> · 50% off";
 * without one it is "50% off" alone, never a name invented here. How long the
 * price holds comes from the campaign too: null is the life of the plan.
 */
export function offerLine(price: AddBusinessPrice | undefined | null): string | null {
  if (!price || !(price.discountPct > 0)) return null;
  const pct = `${price.discountPct}% off`;
  const head = price.campaignLabel ? `${price.campaignLabel} · ${pct}` : pct;
  const n = price.discountDurationTerms;
  if (n == null) return `${head}, for as long as you keep this plan`;
  const [one, many] = UNIT[price.interval] ?? UNIT.month;
  return `${head}, for your first ${n === 1 ? one : `${n} ${many}`}`;
}

/** The price as the card shows it: now, and the struck list price beside a
 *  campaign discount. */
export function priceParts(
  price: AddBusinessPrice,
  format: (amount: number, currency: string) => string,
): { now: string; was: string | null } {
  const suffix = intervalSuffix(price.interval);
  return {
    now: `${format(price.amount, price.currency)}${suffix}`,
    was:
      price.discountPct > 0 && price.listAmount != null && price.listAmount > price.amount
        ? `${format(price.listAmount, price.currency)}${suffix}`
        : null,
  };
}

/** A plan from `GET /v1/billing/plans`, the parts the add-business picker
 *  reads. ★ONLY THE CATALOG: its prices, `isCurrent`, `trialApplies` and
 *  `heldTerm` are the SIGNED-IN business's, and none of them is true of the
 *  business being added (it holds nothing and has no trial, D19). */
export interface CatalogPlan {
  tier: string;
  name: string;
  tagline?: string;
  contactSales?: boolean;
  bundle?: boolean;
  termPrices?: Array<{ term: BillingTerm }>;
}

/**
 * The plans the picker offers: the catalog's sellable plans (each with the
 * terms it sells, in month → quarter → year order), and the talk-to-sales ones
 * (Enterprise), which have no Pay. Nothing here names a plan: the catalog
 * decides (D19), so a plan the CMS stops selling leaves the picker with it.
 */
export function planChoices(plans: readonly CatalogPlan[]): {
  buy: Array<{ tier: string; name: string; tagline?: string; bundle: boolean; terms: BillingTerm[] }>;
  contact: Array<{ tier: string; name: string; tagline?: string }>;
} {
  const buy = plans
    .filter((p) => !p.contactSales)
    .map((p) => {
      const sold = new Set((p.termPrices ?? []).map((t) => t.term));
      return { tier: p.tier, name: p.name, tagline: p.tagline, bundle: !!p.bundle, terms: TERMS.filter((t) => sold.has(t)) };
    })
    .filter((p) => p.terms.length > 0);
  const contact = plans.filter((p) => p.contactSales).map((p) => ({ tier: p.tier, name: p.name, tagline: p.tagline }));
  return { buy, contact };
}

/** The plan and term picked: the buyer's choice while the catalog still
 *  sells it, else the first plan for one business (bundles are for many), on
 *  its first term, which is monthly when sold (`planChoices` orders them). */
export function pickedPlan(
  buy: ReturnType<typeof planChoices>["buy"],
  pick: { tier: string | null; term: BillingTerm | null },
): { tier: string; term: BillingTerm } | null {
  const plan = buy.find((p) => p.tier === pick.tier) ?? buy.find((p) => !p.bundle) ?? buy[0];
  if (!plan) return null;
  const term = pick.term && plan.terms.includes(pick.term) ? pick.term : plan.terms[0]!;
  return { tier: plan.tier, term };
}

/** What the Pay button and the line beside it say. */
export interface AddBusinessAction {
  label: string;
  disabled: boolean;
  /** The line beside the button, or null. */
  note: string | null;
  /** The note is a refusal (shown as an error). */
  refused: boolean;
  /** The refusal is "your plan already covers it": the free path is the way on. */
  notNeeded: boolean;
}

/**
 * The Pay button's state.
 *
 * ★NO DOUBLE CHARGE ON A DOUBLE CLICK (owner answer 4, 2026-10-21). Pay is
 * shut while the purchase starts (`starting`) AND while its payment surface is
 * open (`paying`): a second press while the first overlay is up would start a
 * second subscription for a second business of the same name.
 *
 * ★AND NEVER "PAY" BEFORE THE PREVIEW HAS SPOKEN. While it is pending (or
 * paused offline) the button waits, so it never offers a purchase that is then
 * refused. A FAILED preview does not hold it shut: the purchase decides again,
 * and the payment step states the price before anything is charged.
 */
export function addBusinessAction(s: {
  name: string | null;
  preview: AddBusinessPreview | null;
  previewWaiting: boolean;
  previewFailed: boolean;
  starting: boolean;
  paying: boolean;
}): AddBusinessAction {
  const base = { label: "Continue to payment", note: null, refused: false, notNeeded: false };
  if (s.starting) return { ...base, label: "Starting…", disabled: true };
  if (s.paying) return { ...base, disabled: true, note: "Finish the payment in the window that opened." };
  if (s.preview?.kind === "refused") {
    return {
      ...base,
      disabled: true,
      note: s.preview.message,
      refused: true,
      notNeeded: s.preview.code === ADD_BUSINESS_NOT_NEEDED,
    };
  }
  if (!s.name) return { ...base, disabled: true, note: "Name the business to continue." };
  if (s.previewWaiting) return { ...base, disabled: true };
  if (s.previewFailed) {
    return { ...base, disabled: false, note: "We couldn't load the price. The payment step shows it before you pay." };
  }
  return { ...base, disabled: false };
}

/** POST /add-business's answer. */
export type AddBusinessAnswer =
  | (CheckoutResult & { businessId?: string; businessName?: string; collectionTier?: string })
  | { mode: "invoice_required"; tier?: string; tierLabel?: string; summary?: CheckoutSummary };

export type AddBusinessOutcome =
  | { kind: "pay"; checkout: CheckoutResult; businessId: string | null; businessName: string | null }
  | { kind: "invoice"; message: string }
  | { kind: "unknown" };

/**
 * What to do with POST /add-business's answer.
 *
 * ★AN INVOICE CREATES NO BUSINESS. Above the RBI mandate cap the api answers
 * `invoice_required` with no business id, because nothing will create the
 * business until the invoice flow (Phase 5) carries it. So the page says the
 * purchase needs an invoice and that we will be in touch; it never says the
 * business is on its way.
 */
export function addBusinessOutcome(res: unknown, name: string): AddBusinessOutcome {
  if (!res || typeof res !== "object") return { kind: "unknown" };
  const r = res as Record<string, unknown>;
  if (r.mode === "invoice_required") {
    const plan = typeof r.tierLabel === "string" && r.tierLabel ? r.tierLabel : "This plan";
    return {
      kind: "invoice",
      message: `${plan} for ${name} is above the limit banks allow for automatic payments, so it is billed by invoice. Nothing was charged and ${name} was not created; contact us and we'll set it up.`,
    };
  }
  const gateway = r.gateway;
  if ((gateway === "stripe" || gateway === "razorpay" || gateway === "payu") && r.embed && typeof r.embed === "object") {
    return {
      kind: "pay",
      checkout: res as CheckoutResult,
      businessId: typeof r.businessId === "string" && /^[0-9a-f]{24}$/.test(r.businessId) ? r.businessId : null,
      businessName: typeof r.businessName === "string" ? r.businessName : null,
    };
  }
  return { kind: "unknown" };
}

/**
 * A refused purchase, in the buyer's words.
 *
 * ★CHECKOUT_IN_PROGRESS IS SAID AS WHAT IT IS. Another request for this plan
 * is already starting (a second tab, a double press): it may open a payment of
 * its own. The honest way on is to wait and look, not to press again.
 */
export function addBusinessErrorCopy(code: string | undefined, message: string | undefined): string {
  if (code === CHECKOUT_IN_PROGRESS) {
    return "A payment for this plan is already starting. Wait a moment, then check Billing before you try again, so you aren't charged twice.";
  }
  return message?.trim() || "We couldn't start the payment. Please try again.";
}

// ── The pending purchase, across the payment's round trip ───────────────────
//
// Stripe returns the buyer to the billing page (`?checkout=success&
// addedBusiness=<id>&session_id=cs_…`), leaving the page that sold the
// business behind. What that page wanted to do next (the claim to finish, the
// channel to reconnect) is kept for the tab, keyed by the business id.

export const PENDING_ADD_KEY = "addBusiness:pending";
/** A pending purchase older than this is forgotten. */
export const PENDING_ADD_TTL_MS = 60 * 60 * 1000;

export interface PendingAdd {
  businessId: string;
  name: string;
  /** Where to go once the business exists, a same-site path. */
  next?: string;
  at: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A same-site path (`/x`), never a protocol-relative or absolute URL. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export function rememberPendingAdd(storage: StorageLike | null, p: PendingAdd): void {
  try {
    storage?.setItem(PENDING_ADD_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: the return still switches, it just forgets "next" */
  }
}

/** The pending purchase for `businessId`, unexpired, or null. */
export function readPendingAdd(storage: StorageLike | null, businessId: string, now: number): PendingAdd | null {
  try {
    const raw = storage?.getItem(PENDING_ADD_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingAdd>;
    if (p.businessId !== businessId || typeof p.at !== "number" || now - p.at > PENDING_ADD_TTL_MS || p.at > now) return null;
    return {
      businessId,
      name: typeof p.name === "string" ? p.name : "",
      ...(safeNext(p.next) ? { next: safeNext(p.next)! } : {}),
      at: p.at,
    };
  } catch {
    return null;
  }
}

export function clearPendingAdd(storage: StorageLike | null): void {
  try {
    storage?.removeItem(PENDING_ADD_KEY);
  } catch {
    /* nothing to clear */
  }
}

// ── The arrival: wait for the business the payment creates ─────────────────

export interface ArrivalDeps {
  businessId: string;
  /** Stripe's `session_id` on return; absent for Razorpay and PayU. */
  sessionId?: string | null;
  confirm: (sessionId: string) => Promise<{ activated?: boolean } | null | undefined>;
  listBusinessIds: () => Promise<string[]>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** How long to wait for the webhook before saying so. */
  maxWaitMs?: number;
  intervalMs?: number;
  /** Stop early (the page went away). */
  cancelled?: () => boolean;
}

/**
 * Wait until the purchased business exists, then answer "arrived".
 *
 * ★ONLY THE API'S WORD MOVES THE BUYER. `/confirm` answers activated only
 * once the business exists (P3.1b, review R1), and the business list names it
 * once the webhook has created it; either is enough. Anything else (pending,
 * a failed read, a thrown confirm) waits, and after `maxWaitMs` the answer is
 * "timeout": the payment went through but the business is not here YET, which
 * the page says, rather than switching to a business that is not there.
 *
 * Stripe's `/confirm` is asked on every round, so a dev deployment without a
 * webhook still activates; Razorpay has no session and relies on the webhook.
 */
export async function awaitAddedBusiness(d: ArrivalDeps): Promise<"arrived" | "timeout" | "cancelled"> {
  const maxWait = d.maxWaitMs ?? 60_000;
  const interval = d.intervalMs ?? 2_500;
  const start = d.now();
  for (;;) {
    if (d.cancelled?.()) return "cancelled";
    if (d.sessionId) {
      try {
        const r = await d.confirm(d.sessionId);
        if (r?.activated === true) return "arrived";
      } catch {
        /* pending, as far as the buyer is concerned */
      }
    }
    try {
      if ((await d.listBusinessIds()).includes(d.businessId)) return "arrived";
    } catch {
      /* a failed read says nothing */
    }
    if (d.now() - start >= maxWait) return "timeout";
    await d.sleep(interval);
  }
}

/** What the page says once the wait ends. */
export function arrivalCopy(outcome: "arrived" | "timeout", name: string): { title: string; description: string } {
  const who = name || "Your new business";
  if (outcome === "arrived") {
    return { title: `${who} is ready`, description: `You're now working in ${who}. Switch back any time from the workspace menu.` };
  }
  return {
    title: "Payment received",
    description: `${who} is still being set up. It will appear in the workspace menu in a moment.`,
  };
}
