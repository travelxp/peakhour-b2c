/**
 * MR-G1: how the dashboard labels a campaign against the business's enabled LinkedIn ad accounts.
 */
import { describe, expect, it } from "vitest";
import { campaignAccountState, linkedinAdAccountBareId, linkedinAdAccountLabel } from "./linkedin-ad-accounts";

const A = { id: "111", name: "Quests", currency: "INR" };
const B = { id: "222", name: "CMPL", currency: "USD" };

describe("campaignAccountState", () => {
  it("a campaign in an enabled account is used, in either spelling of the id", () => {
    expect(campaignAccountState({ adAccountId: "111" }, [A, B])).toMatchObject({ notUsed: false, unconfirmed: false, ownAccount: "111", account: A });
    expect(campaignAccountState({ adAccountId: "urn:li:sponsoredAccount:222" }, [A, B])).toMatchObject({ notUsed: false, account: B });
  });

  it("★a campaign in an account the business does not use is notUsed: pause only", () => {
    expect(campaignAccountState({ adAccountId: "999" }, [A, B])).toMatchObject({ notUsed: true, unconfirmed: false, ownAccount: "999" });
  });

  it("★V1: an EMPTY or absent list is unknown, not notUsed (nothing chosen yet, an older api, or a connection that did not resolve)", () => {
    expect(campaignAccountState({ adAccountId: "111" }, [])).toMatchObject({ notUsed: false, unconfirmed: false });
    expect(campaignAccountState({ adAccountId: "999" }, undefined)).toMatchObject({ notUsed: false, unconfirmed: false });
    expect(campaignAccountState({ platformCampaignId: "7" }, [])).toMatchObject({ unconfirmed: false });
  });

  it("★V4: a row with no account of its own, against a known list, is unconfirmed; with no platform campaign there is nothing to confirm", () => {
    expect(campaignAccountState({ platformCampaignId: "7" }, [A])).toMatchObject({ unconfirmed: true, notUsed: false, ownAccount: undefined });
    expect(campaignAccountState({}, [A]).unconfirmed).toBe(false);
    expect(campaignAccountState({ platformCampaignId: "7" }, undefined).unconfirmed).toBe(false);
  });

  it("V10: the account line is computed once, and its currency is the enabled account's, else the campaign's", () => {
    expect(campaignAccountState({ adAccountId: "111", currency: "USD" }, [A]).line).toBe("Quests · Account ID 111 · INR");
    expect(campaignAccountState({ adAccountId: "999", currency: "USD" }, [A]).line).toBe("Account ID 999 · USD");
    expect(campaignAccountState({ adAccountId: "999" }, [A]).line).toBe("Account ID 999");
    expect(campaignAccountState({}, [A]).line).toBeUndefined();
  });
});

describe("helpers", () => {
  it("the bare id strips the urn and whitespace", () => {
    expect(linkedinAdAccountBareId(" urn:li:sponsoredAccount:5 ")).toBe("5");
  });
  it("the label is the name, else Account <id>", () => {
    expect(linkedinAdAccountLabel({ id: "urn:li:sponsoredAccount:7", name: null })).toBe("Account 7");
    expect(linkedinAdAccountLabel({ id: "7", name: "N" })).toBe("N");
  });
});
