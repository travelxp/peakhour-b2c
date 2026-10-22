import { describe, it, expect } from "vitest";
import type { AudienceExclusions, AudienceSet } from "@/lib/api/audiences";
import { formatMembers, hasExclusions, overlapLine, summarizeExclusions, variantNote } from "./audience-exclusions";

/** A library row as `GET /v1/audiences/sets` returns it — only the fields read here. */
function set(id: string, name: string, exclusions?: AudienceExclusions, status: AudienceSet["status"] = "proposed"): AudienceSet {
  return { id, name, source: "generated", status, channels: [], createdAt: "2026-10-22T09:00:00Z", ...(exclusions ? { exclusions } : {}) } as AudienceSet;
}
const ex = (over: Partial<AudienceExclusions> = {}): AudienceExclusions => ({
  overlapBasis: "computed",
  overlaps: [],
  computedAt: "2026-10-22T09:00:00Z",
  ...over,
});
const OWN = { attribute: "company_name", variant: "current" as const, values: ["Acme"], reason: "your own employees" };
/** The pair fields a reader sees, without the internal key. */
const pairs = (s: ReturnType<typeof summarizeExclusions>) =>
  s.overlaps.map((o) => ({ a: o.a, b: o.b, ...(o.approxMembers !== undefined ? { approxMembers: o.approxMembers } : {}), ...(o.reason ? { reason: o.reason } : {}) }));

describe("★★summarizeExclusions — suggestions", () => {
  it("★★one line per distinct suggestion, naming every audience it was suggested for, each once", () => {
    const s = summarizeExclusions([
      set("a", "Founders", ex({ suggested: [OWN] })),
      set("b", "CFOs", ex({ suggested: [{ ...OWN }] })),
      set("c", "CTOs", ex({ suggested: [OWN, OWN] })),
    ]);
    expect(s.suggested).toHaveLength(1);
    expect(s.suggested[0]).toMatchObject({ reason: "your own employees", label: "Companies", variant: "current", values: ["Acme"], audiences: ["Founders", "CFOs", "CTOs"] });
  });

  it("★★two audiences that SHARE A NAME are both counted (review R1: by id, not name)", () => {
    const s = summarizeExclusions([set("a", "Founders", ex({ suggested: [OWN] })), set("b", "Founders", ex({ suggested: [OWN] }))]);
    expect(s.suggested[0]!.audiences).toEqual(["Founders", "Founders"]);
  });

  it("★the same reason over different values — or another variant — is a different suggestion, with its own key; value order is not", () => {
    const s = summarizeExclusions([
      set("a", "A", ex({ suggested: [{ ...OWN, values: ["Acme", "Acme Labs"] }] })),
      set("b", "B", ex({ suggested: [{ ...OWN, values: ["Acme Labs", "Acme"] }] })),
      set("c", "C", ex({ suggested: [{ ...OWN, values: ["Other"] }] })),
      set("d", "D", ex({ suggested: [{ ...OWN, variant: "past" }] })),
      set("e", "E", ex({ suggested: [OWN] })),
    ]);
    expect(s.suggested.map((x) => x.audiences)).toEqual([["A", "B"], ["C"], ["D"], ["E"]]);
    expect(new Set(s.suggested.map((x) => x.key)).size).toBe(4);
  });

  it("★a past or any variant is said; current is the obvious one", () => {
    expect(variantNote("past")).toBe(" — people who used to work there");
    expect(variantNote("any")).toBe(" — current or past");
    expect(variantNote("current")).toBe("");
  });

  it("★★a DISCARDED or SUPERSEDED audience suggests nothing — it cannot run", () => {
    const s = summarizeExclusions([
      set("a", "Gone", ex({ suggested: [OWN] }), "discarded"),
      set("b", "Old", ex({ suggested: [OWN] }), "superseded"),
      set("c", "Live", ex({ suggested: [OWN] }), "applied"),
    ]);
    expect(s.suggested[0]!.audiences).toEqual(["Live"]);
    expect(s.audiences).toBe(1);
  });
});

describe("★★summarizeExclusions — overlaps", () => {
  it("★★each pair ONCE, though both audiences record it", () => {
    const s = summarizeExclusions([
      set("a", "Founders", ex({ overlaps: [{ setId: "b", name: "CFOs", approxMembers: 2400, approximate: true }] })),
      set("b", "CFOs", ex({ overlaps: [{ setId: "a", name: "Founders", approxMembers: 2400, approximate: true }] })),
    ]);
    expect(pairs(s)).toEqual([{ a: "Founders", b: "CFOs", approxMembers: 2400 }]);
  });

  it("★★two pairs between same-named audiences keep distinct keys (review R1)", () => {
    const s = summarizeExclusions([
      set("a", "Founders", ex({ overlaps: [{ setId: "c", name: "CFOs", approxMembers: 10 }] })),
      set("b", "Founders", ex({ overlaps: [{ setId: "c", name: "CFOs", approxMembers: 20 }] })),
      set("c", "CFOs"),
    ]);
    expect(s.overlaps).toHaveLength(2);
    expect(new Set(s.overlaps.map((o) => o.key)).size).toBe(2);
  });

  it("★★a figure beats a reason, in whichever order the two rows arrive", () => {
    const withReasonFirst = summarizeExclusions([
      set("a", "A", ex({ overlaps: [{ setId: "b", name: "B", reason: "we ran out of time before we could price it" }] })),
      set("b", "B", ex({ overlaps: [{ setId: "a", name: "A", approxMembers: 900, approximate: true }] })),
    ]);
    expect(pairs(withReasonFirst)).toEqual([{ a: "A", b: "B", approxMembers: 900 }]);
    const withFigureFirst = summarizeExclusions([
      set("b", "B", ex({ overlaps: [{ setId: "a", name: "A", approxMembers: 900, approximate: true }] })),
      set("a", "A", ex({ overlaps: [{ setId: "b", name: "B", reason: "we ran out of time before we could price it" }] })),
    ]);
    expect(pairs(withFigureFirst)).toEqual([{ a: "A", b: "B", approxMembers: 900 }]);
  });

  it("★★a reason with no figure is kept AS a reason — never a zero", () => {
    const s = summarizeExclusions([
      set("a", "A", ex({ overlaps: [{ setId: "b", name: "B", reason: "any overlap is under the platform's reporting minimum" }] })),
      set("b", "B", ex()),
    ]);
    expect(pairs(s)).toEqual([{ a: "A", b: "B", reason: "any overlap is under the platform's reporting minimum" }]);
    expect(overlapLine(s.overlaps[0]!)).toBe("A and B: not measured — any overlap is under the platform's reporting minimum.");
  });

  it("★★a stored 0 is NOT a measurement — no 'share about 0 people … bid against each other' (review R1)", () => {
    const s = summarizeExclusions([set("a", "A", ex({ overlaps: [{ setId: "b", name: "B", approxMembers: 0, approximate: true }] })), set("b", "B")]);
    expect(pairs(s)).toEqual([{ a: "A", b: "B", reason: "the platform reported no count for the two together" }]);
    expect(overlapLine(s.overlaps[0]!)).not.toMatch(/share about|bid against/);
  });

  it("★★on a COMPLETE read, an overlap with an audience no longer live is dropped", () => {
    const s = summarizeExclusions([
      set("a", "A", ex({ overlaps: [{ setId: "b", name: "B", approxMembers: 50 }, { setId: "zz", name: "Elsewhere", approxMembers: 70 }] })),
      set("b", "B", ex(), "discarded"),
    ]);
    expect(s.overlaps).toEqual([]);
  });

  it("★★on a PARTIAL read, a sibling off the page is kept under its stored name — each side named for itself (review R1)", () => {
    const s = summarizeExclusions([set("m", "Mine", ex({ overlaps: [{ setId: "zz", name: "Off the page", approxMembers: 70 }] }))], { complete: false });
    expect(pairs(s)).toEqual([{ a: "Mine", b: "Off the page", approxMembers: 70 }]);
    const t = summarizeExclusions([set("zz", "Mine", ex({ overlaps: [{ setId: "aa", name: "Off the page", approxMembers: 70 }] }))], { complete: false });
    expect(pairs(t)).toEqual([{ a: "Off the page", b: "Mine", approxMembers: 70 }]);
  });

  it("★the largest figures first, then the unmeasured pairs", () => {
    const s = summarizeExclusions([
      set("a", "A", ex({ overlaps: [
        { setId: "b", name: "B", approxMembers: 300 },
        { setId: "c", name: "C", reason: "the platform didn't give us a count for the two together" },
        { setId: "d", name: "D", approxMembers: 5000 },
      ] })),
      set("b", "B"),
      set("c", "C"),
      set("d", "D"),
    ]);
    expect(s.overlaps.map((o) => `${o.a}-${o.b}`)).toEqual(["A-D", "A-B", "A-C"]);
  });

  it("a set's row about itself is ignored", () => {
    expect(summarizeExclusions([set("a", "A", ex({ overlaps: [{ setId: "a", name: "A", approxMembers: 10 }] }))], { complete: false }).overlaps).toEqual([]);
  });

  it("★the names are the audiences' own, not the row's copy (renamed since)", () => {
    const s = summarizeExclusions([
      set("a", "Founders (renamed)", ex({ overlaps: [{ setId: "b", name: "CFOs old name", approxMembers: 10 }] })),
      set("b", "CFOs"),
    ]);
    expect(s.overlaps[0]).toMatchObject({ a: "Founders (renamed)", b: "CFOs" });
  });
});

describe("★★summarizeExclusions — an unavailable basis", () => {
  it("★★is said as not measured, by reason, and its overlap rows are not read as measured", () => {
    const s = summarizeExclusions([
      set("a", "A", ex({ overlapBasis: "unavailable", overlapUnavailableReason: "X publishes no audience counts", overlaps: [{ setId: "b", name: "B", approxMembers: 1 }] })),
      set("b", "B", ex({ overlapBasis: "unavailable", overlapUnavailableReason: "X publishes no audience counts" })),
    ]);
    expect(s.unmeasured).toEqual([{ reason: "X publishes no audience counts", audiences: ["A", "B"] }]);
    expect(s.overlaps).toEqual([]);
  });

  it("a blank reason still says why in general terms", () => {
    const s = summarizeExclusions([set("a", "A", ex({ overlapBasis: "unavailable", overlapUnavailableReason: "  " })), set("b", "B")]);
    expect(s.unmeasured).toEqual([{ reason: "The platform could not measure overlap.", audiences: ["A"] }]);
  });

  it("★★ONE audience has nothing to compare: no 'not measured' caveat about it (review R1)", () => {
    expect(summarizeExclusions([set("a", "A", ex({ overlapBasis: "unavailable", overlapUnavailableReason: "no counts" }))]).unmeasured).toEqual([]);
  });
});

describe("overlapLine / formatMembers / hasExclusions", () => {
  it("★a figure reads 'about', grouped, rounded", () => {
    expect(formatMembers(2400.4)).toBe("2,400");
    expect(overlapLine({ key: "a|b", a: "A", b: "B", approxMembers: 12345 })).toBe(
      "A and B share about 12,345 people — running both makes them bid against each other.",
    );
  });

  it("★nothing read is nothing to show; any one kind is something", () => {
    expect(hasExclusions(summarizeExclusions([]))).toBe(false);
    expect(hasExclusions(summarizeExclusions([set("a", "A", ex())]))).toBe(false);
    expect(hasExclusions(summarizeExclusions([set("a", "A", ex({ overlapBasis: "unavailable" }))]))).toBe(false);
    expect(hasExclusions(summarizeExclusions([set("a", "A", ex({ suggested: [OWN] }))]))).toBe(true);
    expect(hasExclusions(summarizeExclusions([set("a", "A", ex({ overlapBasis: "unavailable" })), set("b", "B")]))).toBe(true);
    expect(
      hasExclusions(summarizeExclusions([set("a", "A", ex({ overlaps: [{ setId: "b", name: "B", approxMembers: 5 }] })), set("b", "B")])),
    ).toBe(true);
  });
});
