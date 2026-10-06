/**
 * Every marketing sentence that promises a trial, derived from the catalog.
 *
 * ── OWNER RULE, 2026-10-06 (official review R2 on b2c#591) ──────────────────
 *
 * Offers come from CAMPAIGNS (D8: the one campaign resolver prices every
 * surface, and `/v1/platform/pricing` carries the campaign price and
 * discount), and the Suite trial's length comes from the plan's `trialDays`.
 * So no surface hard-codes "free trial", "no credit card", "X% off" or a
 * founding price: each is said only when the pricing payload backs it.
 *
 *   - The trial: `suiteTrialDays(pricing)` (number, or null for no trial),
 *     asked through `hasTrial`. "No credit card" belongs to the trial (the
 *     signup trial collects none, D19; without one a business pays first),
 *     so it is said only beside it.
 *   - A discount: only the payload's own (`hasFoundingOffer`, `offerBadge` in
 *     `lib/pricing`), on the surfaces that read a price.
 *   - Static metadata, which cannot fetch, promises neither.
 *
 * Server pages read the trial with `marketingTrialDays` (one cached
 * `/v1/platform/pricing` read, as /auth does) and pass it to these helpers.
 */

/** Whether a trial may be promised: `suiteTrialDays` served a length. */
export function hasTrial(trialDays: number | null | undefined): trialDays is number {
  return typeof trialDays === "number" && trialDays > 0;
}

/** The signup button when signups are open: the trial it starts, or a plain
 *  start when the catalog gives none (`signupCta`, the header, /peaks). */
export function trialCtaLabel(trialDays: number | null): string {
  return hasTrial(trialDays) ? "Start free trial" : "Get started";
}

/** The one-line trial note under a CTA ("14-day free trial · No credit
 *  card"), or null: no trial, no line. */
export function trialNote(trialDays: number | null): string | null {
  return hasTrial(trialDays) ? `${trialDays}-day free trial · No credit card` : null;
}

/** The homepage's announcement bar, or null (the bar is not rendered). */
export function announcementBar(trialDays: number | null): { lead: string; tail: string } | null {
  if (!hasTrial(trialDays)) return null;
  return {
    lead: `Try every module free for ${trialDays} days — no credit card required.`,
    tail: "One plan keeps all five on when your trial ends.",
  };
}

/** The homepage's "start → keep going" panel: its eyebrow, lede and points. */
export function startPanel(trialDays: number | null): {
  eyebrow: string;
  lede: string;
  points: ReadonlyArray<{ title: string; detail: string }>;
} {
  const peaks = {
    title: "One AI currency across every product",
    detail:
      "Peaks power AI across Commerce, Content, Growth, Support, and Presence, giving you one simple way to manage AI usage across your business.",
  };
  if (hasTrial(trialDays)) {
    return {
      eyebrow: "Try it free. Scale when you’re ready.",
      lede: `Start with a ${trialDays}-day free trial of everything Peakhour does. Connect your business, explore every product, and see real value before you buy. Keep going on Peakhour Suite when your trial ends, or on Agency when you run many businesses.`,
      points: [
        {
          title: "Start in minutes",
          detail: `No credit card required. Connect your business and start your ${trialDays}-day Peakhour Suite trial.`,
        },
        {
          title: "Keep going on one plan",
          detail:
            "When your trial ends, Peakhour Suite keeps every module on for one monthly or yearly price. Running many businesses? Agency covers them all.",
        },
        peaks,
      ],
    };
  }
  return {
    eyebrow: "One plan. Scale when you’re ready.",
    lede: "Connect your business and run every product on one plan: Peakhour Suite, or Agency when you run many businesses.",
    points: [
      { title: "Start in minutes", detail: "Connect your business and choose the plan that fits." },
      {
        title: "Everything on one plan",
        detail:
          "Peakhour Suite keeps every module on for one monthly or yearly price. Running many businesses? Agency covers them all.",
      },
      peaks,
    ],
  };
}

/** A module page's trial line under its CTA, and its closing panel. */
export function pillarTrialCopy(
  planLabel: string,
  name: string,
  trialDays: number | null,
): { note: string; closingAccent: string; closingLead: string; closing: string } {
  if (hasTrial(trialDays)) {
    return {
      note: `${planLabel} · ${trialDays}-day free trial, no credit card`,
      closingLead: `Try ${name}`,
      closingAccent: "free.",
      closing: `${planLabel} — start with a ${trialDays}-day free trial, no credit card.`,
    };
  }
  return {
    note: planLabel,
    closingLead: `Get ${name}`,
    closingAccent: "today.",
    closing: `${planLabel} — one plan for all five modules.`,
  };
}

/** The pricing FAQ's trial entry: how the trial works, or, without one, how
 *  a business starts. */
export function trialFaq(trialDays: number | null): { q: string; a: string } {
  const after =
    "buy Peakhour Suite (monthly or yearly) or Agency (quarterly or yearly) to keep going; until you do, your business has no plan and Peakhour pauses.";
  return hasTrial(trialDays)
    ? {
        q: "How does the free trial work?",
        a: `Every new business starts on a ${trialDays}-day Peakhour Suite trial — every module, no card. When it ends, ${after}`,
      }
    : {
        q: "How do I start?",
        a: "Buy Peakhour Suite (monthly or yearly) or Agency (quarterly or yearly) for your business. Until a plan covers it, your business has no plan and Peakhour pauses.",
      };
}
