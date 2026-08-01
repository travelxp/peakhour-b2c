import { describe, it, expect } from "vitest";
import {
  highestTier,
  dedupeLabels,
  correctionBlockedReason,
  correctionIsNoop,
  mergeSources,
  topSource,
} from "./audience-profile-rules";
import type { CorrectableFieldSpec } from "@/lib/api/audiences";

const listSpec: CorrectableFieldSpec = {
  field: "icp",
  shape: "list",
  maxLength: 256,
  maxItems: 20,
};
const geoSpec: CorrectableFieldSpec = {
  field: "classification.regionalPresence",
  shape: "scalar",
  maxLength: 512,
  csv: "iso2",
  maxCount: 50,
};
const enumSpec: CorrectableFieldSpec = {
  field: "classification.marketType",
  shape: "scalar",
  maxLength: 16,
  values: ["b2b", "b2c", "b2b2c", "unknown"],
};

describe("highestTier", () => {
  it("★takes the HIGHEST tier, not the first", () => {
    // A segment the business declared AND that we then measured is a stated
    // fact with corroboration. Showing it as "we measured" understates what we
    // know, and the whole panel is an argument that the difference matters.
    expect(highestTier([{ tier: "observed", kind: "x" }, { tier: "stated", kind: "y" }])).toBe(
      "stated",
    );
    expect(highestTier([{ tier: "inferred", kind: "x" }, { tier: "observed", kind: "y" }])).toBe(
      "observed",
    );
  });

  it("says nothing rather than guessing when there is no evidence", () => {
    expect(highestTier([])).toBeUndefined();
    expect(highestTier(undefined)).toBeUndefined();
  });
});

describe("dedupeLabels — the client must collapse what the server collapses", () => {
  it("removes case-colliding entries, first occurrence winning", () => {
    expect(dedupeLabels(["ICP A", "icp a", "ICP B"])).toEqual(["ICP A", "ICP B"]);
  });

  it("trims and drops blanks", () => {
    expect(dedupeLabels(["  Kept  ", "   ", ""])).toEqual(["Kept"]);
  });
});

describe("correctionBlockedReason", () => {
  it("★never blocks an EMPTY list — that is how a user says 'none of these apply'", () => {
    // The server treats an explicitly-empty list as a statement. A client that
    // refused to send one would make the clear unreachable.
    expect(correctionBlockedReason(listSpec, { value: "", list: [] })).toBeUndefined();
  });

  it("blocks a list entry over the field's own cap", () => {
    expect(
      correctionBlockedReason(listSpec, { value: "", list: ["x".repeat(257)] }),
    ).toContain("256");
  });

  it("counts the DEDUPED list against maxItems", () => {
    // 21 raw entries that collapse to 1 is a legal correction; counting the
    // raw list would refuse it.
    const list = Array.from({ length: 21 }, (_, i) => (i % 2 ? "same" : "SAME"));
    expect(correctionBlockedReason(listSpec, { value: "", list })).toBeUndefined();
  });

  it("blocks a blank scalar rather than letting the server refuse it", () => {
    expect(correctionBlockedReason(enumSpec, { value: "   ", list: [] })).toBeTruthy();
  });

  it("blocks a value outside a closed vocabulary — including the right word in the wrong case", () => {
    expect(correctionBlockedReason(enumSpec, { value: "B2B", list: [] })).toBeTruthy();
    expect(correctionBlockedReason(enumSpec, { value: "b2b", list: [] })).toBeUndefined();
  });

  it("★names the offending country code rather than saying 'invalid'", () => {
    const reason = correctionBlockedReason(geoSpec, { value: "IN, United States", list: [] });
    expect(reason).toContain("United States");
  });

  it("accepts lowercase codes, because the server uppercases them", () => {
    expect(correctionBlockedReason(geoSpec, { value: "in, sg", list: [] })).toBeUndefined();
  });

  it("blocks more countries than the server will apply", () => {
    const many = Array.from({ length: 60 }, () => "IN").join(",");
    expect(correctionBlockedReason(geoSpec, { value: many, list: [] })).toContain("50");
  });
});

describe("topSource — the detail must belong to the tier that won", () => {
  it("★never attributes a measurement's detail to a stated claim", () => {
    // Live in the server's own data: a segment the business DECLARED and that
    // we then tagged carries a stated source with no detail and an observed
    // one reading "tagged on 12 pieces". "First source with a detail" renders
    // "You told us — tagged on 12 pieces": a measurement presented as the
    // provenance of a stated fact, on a panel whose thesis is that the
    // difference matters.
    const sources = [
      { tier: "stated" as const, kind: "org_businesses.taxonomy.audienceSegments" },
      { tier: "observed" as const, kind: "cnt_content_tags", detail: "tagged on 12 pieces" },
    ];
    expect(highestTier(sources)).toBe("stated");
    expect(topSource(sources)?.detail).toBeUndefined();
  });

  it("prefers a detailed source WITHIN the winning tier", () => {
    const sources = [
      { tier: "observed" as const, kind: "a" },
      { tier: "observed" as const, kind: "b", detail: "seen on 41 pages" },
    ];
    expect(topSource(sources)?.detail).toBe("seen on 41 pages");
  });
});

describe("mergeSources", () => {
  it("badges a multi-entry line from ALL its entries, not the first", () => {
    // The geography line is one sentence built from many claims; taking [0]
    // calls the whole list "You told us" because one country came from the
    // business record.
    const merged = mergeSources([
      [{ tier: "stated", kind: "org_businesses.location.country" }],
      [{ tier: "inferred", kind: "llm" }],
    ]);
    expect(merged).toHaveLength(2);
    expect(highestTier(merged)).toBe("stated");
  });
});

describe("correctionIsNoop — saving nothing must not restate everything", () => {
  it("★an unchanged list is a no-op", () => {
    // Every entry a list correction names is rewritten as stated/user_correction,
    // so a no-op save turns inferred claims into "You told us" ones the user
    // never made — and appends a null delta to the learning log. The server
    // cannot tell the difference.
    expect(
      correctionIsNoop(listSpec, { value: "", list: ["A", "B"] }, { value: "", list: ["A", "B"] }),
    ).toBe(true);
  });

  it("reordering IS a change, because order is meaningful", () => {
    expect(
      correctionIsNoop(listSpec, { value: "", list: ["A", "B"] }, { value: "", list: ["B", "A"] }),
    ).toBe(false);
  });

  it("a case-only retype is a no-op, because the server would collapse it anyway", () => {
    expect(
      correctionIsNoop(listSpec, { value: "", list: ["A", "a"] }, { value: "", list: ["A"] }),
    ).toBe(true);
  });

  it("clearing a non-empty list is a real correction", () => {
    expect(correctionIsNoop(listSpec, { value: "", list: ["A"] }, { value: "", list: [] })).toBe(
      false,
    );
  });

  it("whitespace-only scalar edits are no-ops", () => {
    expect(correctionIsNoop(enumSpec, { value: "b2b", list: [] }, { value: " b2b ", list: [] })).toBe(
      true,
    );
  });
});
