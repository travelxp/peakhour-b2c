/**
 * What the plan picker says about the selected plan before checkout (billing
 * plan D21, P4.2). The api answers `GET /v1/billing/checkout/preview` with the
 * same rules POST /checkout applies, so the picker never re-implements them
 * (review R1 on b2c#589): this only turns that answer into the button and the
 * line beside it.
 */

/** What checkout WOULD do for a plan and term. */
export type CheckoutPreview =
  | { kind: "new" }
  | { kind: "switch"; fromTier: string; fromName: string; startsAt: string | null }
  /** The plan and term a cancel is ending, taken up again from when it ends. */
  | { kind: "resume"; startsAt: string | null }
  | { kind: "refused"; code: string; message: string };

export interface CheckoutAction {
  /** The primary button's label. */
  label: string;
  /** The line beside it, or null. */
  note: string | null;
  /** True when the note is a refusal (shown as an error). */
  refused: boolean;
}

/**
 * The picker's action for the selected plan. `preview` is null while it loads
 * or when it failed: the plan's own trial copy then stands, and checkout
 * decides (a failed preview never blocks the buyer).
 */
export function checkoutAction(
  plan: { name: string; trialApplies: boolean; trialDays: number } | null,
  preview: CheckoutPreview | null,
  fmtDate: (iso: string) => string,
): CheckoutAction {
  if (preview?.kind === "refused") {
    return { label: "Continue to payment", note: preview.message, refused: true };
  }
  if (plan && preview?.kind === "switch") {
    return {
      label: `Switch to ${plan.name}`,
      note: preview.startsAt
        ? `You keep ${preview.fromName} until ${fmtDate(preview.startsAt)}; ${plan.name} is billed from then, and you have it now.`
        : `${plan.name} replaces ${preview.fromName} now.`,
      refused: false,
    };
  }
  if (plan && preview?.kind === "resume") {
    return {
      label: `Keep ${plan.name}`,
      note: preview.startsAt
        ? `${plan.name} carries on after ${fmtDate(preview.startsAt)}, billed from then. Nothing to pay until then.`
        : `${plan.name} carries on, billed from now.`,
      refused: false,
    };
  }
  if (plan?.trialApplies) {
    return {
      label: `Start ${plan.trialDays}-day free trial`,
      note: `We’ll ask for a card now and charge nothing for ${plan.trialDays} days. Cancel anytime.`,
      refused: false,
    };
  }
  return { label: "Continue to payment", note: null, refused: false };
}
