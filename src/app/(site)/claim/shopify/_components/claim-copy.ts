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
import type { ClaimFit, ClaimResult } from "@/lib/api/shopify-claim";

/** The warning shown on "another storefront of <business>", or null. */
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
  result: Pick<ClaimResult, "newBusiness" | "businessName" | "adopted">,
  storeName: string,
  orgName: string,
): { title: string; body: string; integrationsHint: boolean } {
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
        // yet. Point at what does.
        body: "Each workspace is priced as its own business. To add one for this store, contact support; buying an extra workspace from your dashboard is coming soon. If it's another storefront of a brand you already have, add it to that workspace instead.",
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
