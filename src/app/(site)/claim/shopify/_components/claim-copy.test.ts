import { describe, it, expect } from "vitest";
import { BRAND_CONFIRM, claimOutcome, doneCopy, errCopy, fitWarning } from "./claim-copy";

/**
 * The claim page's sentences (claim-copy.ts, rendered by shopify-claim.tsx).
 *
 * The Table Story report: a store "added to an existing workspace" was merged
 * into that brand and the page said only "Claimed!". These pin what the page
 * now says about where the store went, and when it warns.
 */

describe("fitWarning", () => {
  it("warns on a different brand, naming the brand it was compared with", () => {
    expect(fitWarning({ verdict: "mismatch", anchor: "silkstore.in" }, "Silk Store")).toBe(
      "Looks like a different brand from silkstore.in. A separate brand works best as its own workspace.",
    );
  });

  it("falls back to the workspace name when the check has no anchor", () => {
    expect(fitWarning({ verdict: "mismatch" }, "Silk Store")).toContain("different brand from Silk Store");
  });

  it("says a confirmation is coming when the check is unsure", () => {
    expect(fitWarning({ verdict: "ambiguous" }, "Silk Store")).toBe(
      "We couldn't confirm this store belongs to Silk Store. You'll be asked to confirm.",
    );
  });

  it("says nothing for a match, a first store, an unknown verdict, or an older api", () => {
    expect(fitWarning({ verdict: "match" }, "Silk Store")).toBeNull();
    expect(fitWarning({ verdict: "anchor" }, "Silk Store")).toBeNull();
    expect(fitWarning({ verdict: "unknown" }, "Silk Store")).toBeNull();
    expect(fitWarning(undefined, "Silk Store")).toBeNull();
  });
});

describe("doneCopy: where the store went", () => {
  it("attached to a brand: names the workspace, says it is another store, points at Integrations", () => {
    const d = doneCopy({ newBusiness: false, businessName: "Silk Store" }, "Table Story", "Silk Co");
    expect(d.title).toBe("Added to Silk Store");
    expect(d.body).toBe(
      "Table Story was added to Silk Store as another store. It shows under Integrations, next to the stores Silk Store already has.",
    );
    expect(d.integrationsHint).toBe(true);
  });

  it("its own workspace: says so, and where to switch to it", () => {
    const d = doneCopy({ newBusiness: true, businessName: "Table Story" }, "Table Story", "Silk Co");
    expect(d.title).toBe("Added as its own workspace");
    expect(d.body).toBe("Table Story is now its own workspace in Silk Co. You can switch to it from the workspace menu.");
    expect(d.integrationsHint).toBe(false);
  });

  it("adopted as a first account: no 'part of itself' tautology", () => {
    const d = doneCopy({ adopted: true }, "Table Story", "Table Story");
    expect(d.body).toBe("Table Story is set up as your first Peakhour workspace.");
  });
});

describe("claimOutcome: an api that does not say where the store went", () => {
  const businesses = [{ businessId: "b1", name: "Silk Store" }];
  const bare = { claimed: true, orgId: "o1", businessId: "x" };

  it("claimed as its own workspace (nothing sent) reads as a new workspace", () => {
    expect(claimOutcome(bare, undefined, businesses)).toMatchObject({ newBusiness: true, businessName: null });
  });

  it("attached to a business reads as that business, by the name the page showed", () => {
    expect(claimOutcome(bare, "b1", businesses)).toMatchObject({ newBusiness: false, businessName: "Silk Store" });
  });

  it("the api's own answer wins when it gives one", () => {
    expect(
      claimOutcome({ ...bare, newBusiness: false, businessName: "Silk Store Co" }, undefined, businesses),
    ).toMatchObject({ newBusiness: false, businessName: "Silk Store Co" });
  });
});

describe("errCopy", () => {
  it("the business limit no longer steers a separate brand into another brand's workspace", () => {
    const e = errCopy("CLAIM_BUSINESS_LIMIT", "");
    expect(e.body).not.toMatch(/attach the store to one of your existing brands instead/);
    expect(e.body).toContain("priced as its own business");
    // No purchase path is claimed that the dashboard does not have yet.
    expect(e.body).not.toMatch(/Settings → Billing/);
  });

  it("an unknown code shows the server's message", () => {
    expect(errCopy("NOPE", "The server said so.")).toEqual({ title: "Something went wrong", body: "The server said so." });
  });

  it("the confirm code is the api's", () => {
    expect(BRAND_CONFIRM).toBe("CLAIM_BRAND_CONFIRM");
  });
});
