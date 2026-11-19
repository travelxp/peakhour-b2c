/**
 * MR-F2 - the one saved ad account, as the dashboard reads it. `savedMetaAdAccountId` mirrors the api's
 * `helpers/meta-saved-ad-account.ts`: the pick while listed, else the only account, else none - never the first of
 * several.
 */
import { describe, it, expect } from "vitest";
import { savedMetaAdAccountId } from "./integrations-meta";
import {
  META_MERCHANT_FACING_CODES,
  metaAdAccountOptionLabel,
  metaAdAccountShortId,
  metaCreatesInLine,
} from "./meta-ads-view";

const A = { id: "act_1111", name: "Quests Travel" };
const B = { id: "act_2222", name: "CMPL" };

describe("savedMetaAdAccountId", () => {
  it("two or more and none chosen: none, never the first", () => {
    expect(savedMetaAdAccountId({ adAccounts: [A, B] })).toBeUndefined();
  });
  it("one account is the answer", () => {
    expect(savedMetaAdAccountId({ adAccounts: [B] })).toBe("act_2222");
  });
  it("no accounts, or no extra: none", () => {
    expect(savedMetaAdAccountId({ adAccounts: [] })).toBeUndefined();
    expect(savedMetaAdAccountId(undefined)).toBeUndefined();
  });
  it("a pick that is still listed wins, in either spelling", () => {
    const caps = { adAccounts: { activeResourceId: "act_2222" } };
    expect(savedMetaAdAccountId({ adAccounts: [A, B], capabilities: caps })).toBe("act_2222");
    expect(savedMetaAdAccountId({ adAccounts: [A, B], capabilities: { adAccounts: { activeResourceId: "2222" } } })).toBe("act_2222");
  });
  it("a stale pick is ignored", () => {
    const caps = { adAccounts: { activeResourceId: "act_9" } };
    expect(savedMetaAdAccountId({ adAccounts: [A, B], capabilities: caps })).toBeUndefined();
    expect(savedMetaAdAccountId({ adAccounts: [B], capabilities: caps })).toBe("act_2222");
  });
});

describe("labels", () => {
  it("shortens an id to its last four digits, whichever spelling", () => {
    expect(metaAdAccountShortId("act_1234567890")).toBe("act_…7890");
    expect(metaAdAccountShortId("1234567890")).toBe("act_…7890");
  });
  it("an option reads Name (CURRENCY) · act_…last4", () => {
    expect(metaAdAccountOptionLabel({ id: "act_1234567890", name: "Quests Travel", currency: "INR" })).toBe(
      "Quests Travel (INR) · act_…7890",
    );
    expect(metaAdAccountOptionLabel({ id: "act_1234567890" })).toBe("Ad account · act_…7890");
  });
  it("a dialog names where it creates, or saves", () => {
    expect(metaCreatesInLine({ id: "act_1234567890", name: "Quests Travel" })).toBe("Creates in Quests Travel (act_…7890)");
    expect(metaCreatesInLine({ id: "act_1234567890", name: "Quests Travel" }, "Saves")).toBe("Saves in Quests Travel (act_…7890)");
  });
});

describe("the api's refusals are shown as written", () => {
  it("both new codes carry merchant-facing messages", () => {
    expect(META_MERCHANT_FACING_CODES.has("AD_ACCOUNT_NOT_CHOSEN")).toBe(true);
    expect(META_MERCHANT_FACING_CODES.has("AD_ACCOUNT_NOT_ACTIVE")).toBe(true);
  });
});
