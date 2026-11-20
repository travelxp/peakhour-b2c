/**
 * MR-F3 - the dashboard's reading and writing of routing tags (mirrors the api's helper; the api re-cleans every value).
 */
import { describe, expect, it } from "vitest";
import { AD_ACCOUNT_PURPOSES, purposeLabel, sameTags, savedMetaAdAccountTags, tagsForSave, withTag } from "./meta-ad-account-tags";

describe("savedMetaAdAccountTags", () => {
  it("reads the tags saved under account.extra.metaAdAccounts, keyed by the id the connection lists, cleaned", () => {
    const extra = {
      adAccounts: [{ id: "act_1" }, { id: "act_2" }],
      metaAdAccounts: { enabledIds: ["act_1"], tags: { "1": { markets: ["in", "IN", "India"], purposes: ["conversion", "prospecting"] }, act_2: {} } },
    };
    expect(savedMetaAdAccountTags(extra)).toEqual({ act_1: { markets: ["IN"], purposes: ["conversion"] } });
  });

  it("nothing saved is no tags", () => {
    expect(savedMetaAdAccountTags(undefined)).toEqual({});
    expect(savedMetaAdAccountTags({ metaAdAccounts: { enabledIds: ["a"] } })).toEqual({});
  });
});

describe("tagsForSave", () => {
  it("keeps only ticked accounts and dimensions with a value", () => {
    const tags = { act_1: { markets: ["GB"], collections: [] }, act_2: { markets: ["IN"] }, act_3: {} };
    expect(tagsForSave(tags, ["act_1", "act_3"])).toEqual({ act_1: { markets: ["GB"] } });
  });
});

describe("withTag and sameTags", () => {
  it("an emptied dimension is left out, and an account with none equals a missing one", () => {
    expect(withTag({ markets: ["IN"], purposes: ["awareness"] }, "markets", [])).toEqual({ purposes: ["awareness"] });
    expect(sameTags({ a: {} }, {})).toBe(true);
    expect(sameTags({ a: { markets: ["IN"] } }, { a: { markets: ["GB"] } })).toBe(false);
  });
});

describe("purposes", () => {
  it("are the growth phases, in words a merchant reads", () => {
    expect(AD_ACCOUNT_PURPOSES.map((p) => p.id)).toEqual(["awareness", "conversion", "retention"]);
    expect(purposeLabel("conversion")).toBe("Sales");
  });
});
