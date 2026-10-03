import { describe, it, expect } from "vitest";
import {
  buildGuardrailsPatch,
  describeGuardrails,
  draftFromStored,
  hasGuardrails,
  isCalendarDay,
  isHourMinute,
  parseTerms,
  type GuardrailsDraft,
} from "./guardrails-copy";

const empty = (): GuardrailsDraft => draftFromStored(undefined);

describe("parseTerms", () => {
  it("splits on newlines and commas, trims, drops blanks, keeps each once in order", () => {
    expect(parseTerms(" Acme ,Globex\n\nacme\n  Free trial  ")).toEqual(["Acme", "Globex", "Free trial"]);
  });
});

describe("isHourMinute / isCalendarDay", () => {
  it("HH:MM, 24-hour", () => {
    expect(isHourMinute("00:00")).toBe(true);
    expect(isHourMinute("23:59")).toBe(true);
    for (const s of ["24:00", "9:30", "09:60", "09:30\n", ""]) expect(isHourMinute(s), s).toBe(false);
  });
  it("a real day only", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
    for (const s of ["2026-02-30", "2026-13-01", "2026-1-01", ""]) expect(isCalendarDay(s), s).toBe(false);
  });
});

describe("draftFromStored", () => {
  it("seeds every field from the stored rules", () => {
    const d = draftFromStored({
      deniedChannels: ["meta"],
      blockedTerms: ["acme", "free trial"],
      quietHours: { start: "21:00", end: "06:00" },
      blackoutDates: [{ from: "2026-12-24", to: "2026-12-26", label: "Christmas" }, { from: "2027-01-01", to: "2027-01-01" }],
      timeZone: "Asia/Kolkata",
    });
    expect(d).toEqual({
      deniedChannels: ["meta"],
      termsText: "acme\nfree trial",
      quietEnabled: true,
      quietStart: "21:00",
      quietEnd: "06:00",
      blackouts: [
        { from: "2026-12-24", to: "2026-12-26", label: "Christmas" },
        { from: "2027-01-01", to: "2027-01-01", label: "" },
      ],
    });
  });
  it("an empty form when nothing is stored, quiet hours off", () => {
    expect(empty()).toMatchObject({ deniedChannels: [], termsText: "", quietEnabled: false, blackouts: [] });
  });
});

describe("buildGuardrailsPatch", () => {
  it("★★sends EVERY rule — an emptied list clears it, quiet hours off is null", () => {
    const r = buildGuardrailsPatch(empty());
    expect(r).toEqual({ ok: true, patch: { deniedChannels: [], blockedTerms: [], quietHours: null, blackoutDates: [] } });
  });

  it("builds the full record", () => {
    const r = buildGuardrailsPatch({
      deniedChannels: ["x", "x", "meta"],
      termsText: "Acme\nFree trial",
      quietEnabled: true,
      quietStart: "22:00",
      quietEnd: "07:00",
      blackouts: [{ from: "2026-12-24", to: "2026-12-26", label: "  Christmas " }, { from: "2027-01-01", to: "2027-01-01", label: "" }],
    });
    expect(r).toEqual({
      ok: true,
      patch: {
        deniedChannels: ["x", "meta"],
        blockedTerms: ["Acme", "Free trial"],
        quietHours: { start: "22:00", end: "07:00" },
        blackoutDates: [{ from: "2026-12-24", to: "2026-12-26", label: "Christmas" }, { from: "2027-01-01", to: "2027-01-01" }],
      },
    });
  });

  it("★★sends the STORED zone back when a window or blackout is kept — saving never moves it", () => {
    const d = { ...empty(), quietEnabled: true };
    expect(buildGuardrailsPatch(d, "Asia/Kolkata")).toMatchObject({ ok: true, patch: { timeZone: "Asia/Kolkata" } });
    // …and no zone when nothing reads one.
    const r = buildGuardrailsPatch({ ...empty(), termsText: "acme" }, "Asia/Kolkata");
    expect(r.ok && "timeZone" in r.patch).toBe(false);
  });

  it("★refuses what the api would refuse, in words the merchant can act on", () => {
    const cases: Array<[Partial<GuardrailsDraft>, RegExp]> = [
      [{ quietEnabled: true, quietStart: "9:00", quietEnd: "17:00" }, /like 22:00/],
      [{ quietEnabled: true, quietStart: "09:00", quietEnd: "09:00" }, /different start and end/],
      [{ blackouts: [{ from: "2026-02-30", to: "2026-03-01", label: "" }] }, /start and an end date/],
      [{ blackouts: [{ from: "2026-03-02", to: "2026-03-01", label: "" }] }, /ends before it starts/],
      [{ blackouts: [{ from: "2026-03-01", to: "2026-03-01", label: "x".repeat(81) }] }, /at most 80/],
      [{ termsText: "a".repeat(81) }, /longer than 80/],
      [{ termsText: Array.from({ length: 101 }, (_, i) => `t${i}`).join("\n") }, /up to 100 terms/],
      [{ blackouts: Array.from({ length: 51 }, () => ({ from: "2027-01-01", to: "2027-01-01", label: "" })) }, /up to 50/],
    ];
    for (const [over, msg] of cases) {
      const r = buildGuardrailsPatch({ ...empty(), ...over });
      expect(r.ok, JSON.stringify(over).slice(0, 60)).toBe(false);
      expect(!r.ok && r.error).toMatch(msg);
    }
  });

  it("quiet hours OFF are not validated — the stored times are just not sent", () => {
    expect(buildGuardrailsPatch({ ...empty(), quietEnabled: false, quietStart: "", quietEnd: "" }).ok).toBe(true);
  });
});

describe("describeGuardrails / hasGuardrails", () => {
  it("one line per rule in force, the zone named where it matters", () => {
    expect(
      describeGuardrails({
        deniedChannels: ["meta", "x"],
        blockedTerms: ["acme"],
        quietHours: { start: "22:00", end: "07:00" },
        blackoutDates: [{ from: "2026-12-24", to: "2026-12-26" }, { from: "2027-01-01", to: "2027-01-01" }],
        timeZone: "Asia/Kolkata",
      }),
    ).toEqual([
      "Never advertises on Meta (Facebook & Instagram), X.",
      "Blocks 1 term from every ad: acme.",
      "Starts no spend between 22:00 and 07:00 (Asia/Kolkata).",
      "Starts no spend on 2 blackout periods (Asia/Kolkata).",
    ]);
  });
  it("a long term list is shortened", () => {
    const lines = describeGuardrails({ blockedTerms: ["a", "b", "c", "d", "e", "f"] });
    expect(lines[0]).toBe("Blocks 6 terms from every ad: a, b, c, d, e, ….");
  });
  it("nothing set is nothing to say", () => {
    expect(describeGuardrails(undefined)).toEqual([]);
    expect(hasGuardrails(undefined)).toBe(false);
    expect(hasGuardrails({ setAt: "x" } as never)).toBe(false);
    expect(hasGuardrails({ blockedTerms: ["a"] })).toBe(true);
    // Each rule alone counts — quiet hours are not a list.
    expect(hasGuardrails({ quietHours: { start: "22:00", end: "07:00" } })).toBe(true);
    expect(hasGuardrails({ deniedChannels: ["x"] })).toBe(true);
    expect(hasGuardrails({ blackoutDates: [{ from: "2027-01-01", to: "2027-01-01" }] })).toBe(true);
  });
});
