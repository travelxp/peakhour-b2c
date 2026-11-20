/**
 * MR-G1: how the dashboard labels a campaign against the business's enabled LinkedIn ad accounts.
 */
import { describe, expect, it } from "vitest";
import { campaignAccountState, linkedinAdAccountBareId } from "./linkedin-ad-accounts";

const A = { id: "111", name: "Quests", currency: "INR" };
const B = { id: "222", name: "CMPL", currency: "USD" };

describe("campaignAccountState", () => {
  it("a campaign in an enabled account is used, in either spelling of the id", () => {
    expect(campaignAccountState({ adAccountId: "111" }, [A, B])).toMatchObject({ notUsed: false, ownAccount: "111", account: A });
    expect(campaignAccountState({ adAccountId: "urn:li:sponsoredAccount:222" }, [A, B])).toMatchObject({ notUsed: false, account: B });
  });
  it("★a campaign in an account the business does not use is notUsed: pause only", () => {
    expect(campaignAccountState({ adAccountId: "999" }, [A, B])).toMatchObject({ notUsed: true, ownAccount: "999" });
    // nothing enabled at all: every campaign is in an account the business does not use
    expect(campaignAccountState({ adAccountId: "111" }, [])).toMatchObject({ notUsed: true });
  });
  it("an older api (no list) or a row with no account of its own never locks anything", () => {
    expect(campaignAccountState({ adAccountId: "999" }, undefined).notUsed).toBe(false);
    expect(campaignAccountState({}, [A]).notUsed).toBe(false);
  });
  it("the bare id strips the urn and whitespace", () => {
    expect(linkedinAdAccountBareId(" urn:li:sponsoredAccount:5 ")).toBe("5");
  });
});
