import type { ManagedCampaign } from "@/lib/api/linkedin-ads";

/** The claim the audience card is allowed to make about who chose an audience. */
export type AudienceClaim = "auto_unconfirmed" | "approved" | "user_set" | "unverified";

/**
 * ★"WE CANNOT TELL" IS ITS OWN ANSWER. `verified` is false when the provenance
 * fingerprint no longer matches the campaign's targeting, which means the
 * record may describe an audience that has since been replaced. Rendering that
 * as "auto-selected from your business" would be the same class of lie as a row
 * claiming an audience the platform does not have — so it claims nothing, and
 * the card shows the audience without a byline.
 *
 * `verified` is computed by the api because it needs a fingerprint comparison
 * the client cannot make.
 */
export function audienceClaim(origin: ManagedCampaign["audienceOrigin"]): AudienceClaim {
  if (!origin || !origin.verified) return "unverified";
  if (origin.autoSelectedUnconfirmed) return "auto_unconfirmed";
  if (origin.source === "user_set") return "user_set";
  // ★`confirmed` IS READ, and the fallback is not "approved". A
  // `platform_set` audience — one targeted in Campaign Manager, which the
  // schema allows — is confirmed by nobody, and falling through would put a
  // green check reading "You approved this" on a decision no user made.
  // Nothing writes `platform_set` today; a claim that depends on that staying
  // true is a claim waiting to become false.
  return origin.confirmed ? "approved" : "unverified";
}

/**
 * ★A FIXED LOCALE, not the ambient one. `toLocaleString()` groups by whatever
 * locale the runtime has — "2,400,000" in Node's default, "24,00,000" under
 * en-IN — so the same number renders differently on the server and in the
 * browser, which is a React hydration mismatch on a component that SSRs. The
 * sibling `formatMoney` passes `undefined` deliberately (a currency belongs in
 * the reader's own format); a bare count does not have that excuse, and a
 * number that changes between renders is worse than one grouped unfamiliarly.
 */
const REACH_FORMAT = new Intl.NumberFormat("en-US");

/**
 * The reach sentence, or nothing.
 *
 * ★LINKEDIN'S `total: 0` MEANS "FEWER THAN 300", so the number is deliberately
 * absent and `belowFloor` arrives instead. Rendering "0 people" would be a
 * false statement about the customer's market; saying the campaign will not
 * deliver is both true and more useful than the number would have been.
 */
export function reachLine(
  reach: NonNullable<ManagedCampaign["targetingProvenance"]>["reach"],
): string | null {
  if (!reach) return null;
  if (reach.belowFloor) return "Under LinkedIn's 300-member minimum — this won't deliver";
  // ★A LITERAL ZERO IS TREATED AS THE FLOOR, not printed. The api maps
  // LinkedIn's masked `total: 0` to `belowFloor` with no number, so a zero
  // reaching here means something upstream changed — and "About 0 people" is
  // the exact sentence this function's whole reason for existing forbids.
  // Guarding it here rather than trusting a convention two repos away.
  if (reach.value === 0) return "Under LinkedIn's 300-member minimum — this won't deliver";
  if (!reach.supported || typeof reach.value !== "number") {
    return "LinkedIn didn't give us a size for this audience";
  }
  return `About ${REACH_FORMAT.format(reach.value)} people on LinkedIn`;
}
