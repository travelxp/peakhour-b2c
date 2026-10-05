/**
 * What the Shopify claim page says, as pure functions the page renders.
 *
 * The Table Story report: the merchant chose "add to an existing workspace",
 * the store was merged into Silk Store's business, and the dashboard said
 * nothing. A business is a brand, and pricing is per business, so the page now
 * asks the real question (a separate brand, or another storefront of one of
 * your brands?), warns when a store looks like a different brand, and says
 * afterwards exactly where the store went.
 *
 * Kept free of React so the page's sentences can be tested in node, and so a
 * test asserts the sentence the page shows rather than a copy of it.
 */
import type { ClaimBusiness, ClaimFit, ClaimResult } from "@/lib/api/shopify-claim";

/**
 * Where the store went, from the api's answer, or from what the page sent when
 * the api does not say. An api without `newBusiness`/`businessName` would
 * otherwise read as "added to a brand" for a store claimed as its own
 * workspace: the misreport this page fixes.
 */
export function claimOutcome(
  res: ClaimResult,
  sentBusinessId: string | undefined,
  businesses: ClaimBusiness[],
): ClaimResult {
  return {
    ...res,
    newBusiness: res.newBusiness ?? sentBusinessId === undefined,
    businessName: res.businessName ?? businesses.find((b) => b.businessId === sentBusinessId)?.name ?? null,
  };
}

/**
 * What the page says under "another storefront of <business>", and whether
 * that option can be picked at all.
 *
 * ★A BLOCKED BUSINESS CANNOT BE PICKED (D6 revised, D13): the api refuses the
 * attach whatever the merchant says, so offering the button would only lead to
 * an error. The reason says what each side sells, which is the thing a shop
 * owner can check. An older api sends no `attach`, and the brand note stands.
 */
export function businessOption(b: ClaimBusiness): { blocked: boolean; note: string | null } {
  if (b.attach === "block") {
    return { blocked: true, note: `Can't be added here. ${b.attachReason ?? "It's a different business."}` };
  }
  if (b.attach === "confirm") {
    return {
      blocked: false,
      note: `${b.attachReason ?? `We couldn't confirm this store belongs to ${b.name}.`} You'll be asked to confirm.`,
    };
  }
  if (b.attach === "allow") return { blocked: false, note: null };
  return { blocked: false, note: fitWarning(b.fit, b.name) };
}

/** The warning shown on "another storefront of <business>" by an api that
 *  predates the context check, or null. */
export function fitWarning(fit: ClaimFit | undefined, businessName: string): string | null {
  if (!fit) return null;
  if (fit.verdict === "mismatch") {
    return `Looks like a different brand from ${fit.anchor ?? businessName}. A separate brand works best as its own workspace.`;
  }
  if (fit.verdict === "ambiguous") {
    return `We couldn't confirm this store belongs to ${businessName}. You'll be asked to confirm.`;
  }
  return null;
}

/** Where the store went, said plainly. */
export function doneCopy(
  result: Pick<ClaimResult, "newBusiness" | "businessName" | "adopted" | "separate">,
  storeName: string,
  orgName: string,
): { title: string; body: string; integrationsHint: boolean } {
  if (result.separate) {
    return {
      title: "Kept as its own account",
      body: `${storeName} now has its own Peakhour account, separate from your other businesses. Switch between your accounts from the workspace menu.`,
      integrationsHint: false,
    };
  }
  if (result.adopted) {
    return {
      title: "Your account is ready",
      body: `${storeName} is set up as your first Peakhour workspace.`,
      integrationsHint: false,
    };
  }
  if (result.newBusiness) {
    return {
      title: "Added as its own workspace",
      body: `${storeName} is now its own workspace in ${orgName}. You can switch to it from the workspace menu.`,
      integrationsHint: false,
    };
  }
  const business = result.businessName ?? "your workspace";
  return {
    title: `Added to ${business}`,
    body: `${storeName} was added to ${business} as another store. It shows under Integrations, next to the stores ${business} already has.`,
    integrationsHint: true,
  };
}

/** The server's error codes, in the merchant's words. */
export function errCopy(code: string, fallback: string): { title: string; body: string } {
  switch (code) {
    case "CLAIM_ALREADY_CLAIMED":
      return { title: "Already claimed", body: "This store is already linked to a Peakhour account." };
    case "CLAIM_EXPIRED":
      return { title: "This link has expired", body: "Open the Peakhour app in your Shopify admin and use the fresh “Claim this store” button." };
    case "CLAIM_INVALID":
      return { title: "Invalid claim link", body: "Open the Peakhour app in your Shopify admin and use the “Claim this store” button there." };
    case "CLAIM_FORBIDDEN_ORG":
      return { title: "No permission", body: "You can only attach a store to an account you own or admin." };
    case "CLAIM_BUSINESS_LIMIT":
      // ★NOT "attach it to an existing brand instead". Each workspace is a
      // brand and is priced as one; steering a separate brand into another
      // brand's workspace is the Table Story report, not a way around a limit.
      return {
        title: "Your plan covers your current workspaces",
        // ★NO "BUY IT IN SETTINGS": that purchase is plan P3 and does not exist
        // yet. Point at what does: keeping the store as its own account (D14).
        body: "Each workspace in an account is priced as its own business, and buying an extra one isn't available yet. Keep this store as its own account instead; you can switch between accounts any time.",
      };
    case "CLAIM_DIFFERENT_BUSINESS":
      return {
        title: "That's a different business",
        body: "This store sells something different from that workspace, so it can't be added there. Keep it as its own account instead; you can switch between accounts any time.",
      };
    case "CLAIM_ORG_HAS_STORE":
      return { title: "Already connected", body: "That account is already connected to this store." };
    case "CLAIM_BUSINESS_NOT_FOUND":
      return { title: "Workspace not found", body: "That workspace isn't in the selected account. Pick another." };
    case "CLAIM_STORE_NOT_FOUND":
      return { title: "Store not found", body: "This store is no longer available to claim." };
    default:
      return { title: "Something went wrong", body: fallback };
  }
}

/** The 409 that asks the merchant to confirm a store joins a brand it may not belong to. */
export const BRAND_CONFIRM = "CLAIM_BRAND_CONFIRM";

/** Refusals whose way forward is keeping the store as its own account: the page
 *  returns to the choice with that option picked, rather than a dead end. */
export const KEEP_SEPARATE_CODES: readonly string[] = ["CLAIM_DIFFERENT_BUSINESS", "CLAIM_BUSINESS_LIMIT"];
