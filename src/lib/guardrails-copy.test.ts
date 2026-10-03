import { describe, it, expect } from "vitest";
import {
  activeBlackouts,
  buildGuardrailsPatch,
  describeGuardrails,
  draftFromStored,
  guardrailsSaveError,
  hasGuardrails,
  isCalendarDay,
  isHourMinute,
  isReadableZone,
  parseTerms,
  timeZoneOptions,
  todayIn,
  type GuardrailsDraft,
} from "./guardrails-copy";

const TODAY = "2026-10-03";
const empty = (): GuardrailsDraft => draftFromStored(undefined, TODAY);

describe("parseTerms", () => {
  it("ONE PER LINE: trimmed, blanks dropped, each once in order", () => {
    expect(parseTerms(" Acme \nGlobex\n\nacme\n  Free trial  ")).toEqual(["Acme", "Globex", "Free trial"]);
  });
  it("★★a comma is part of a name, not a separator (R1)", () => {
    expect(parseTerms("Acme, Inc.\nFree trial, no card needed")).toEqual(["Acme, Inc.", "Free trial, no card needed"]);
  });
});

describe("isHourMinute / isCalendarDay / isReadableZone", () => {
  it("HH:MM, 24-hour", () => {
    expect(isHourMinute("00:00")).toBe(true);
    expect(isHourMinute("23:59")).toBe(true);
    for (const s of ["24:00", "9:30", "09:60", "09:30\n", ""]) expect(isHourMinute(s), s).toBe(false);
  });
  it("a real day only", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
    for (const s of ["2026-02-30", "2026-13-01", "2026-1-01", ""]) expect(isCalendarDay(s), s).toBe(false);
  });
  it("a zone Intl reads", () => {
    expect(isReadableZone("Asia/Kolkata")).toBe(true);
    expect(isReadableZone("Mars/Olympus")).toBe(false);
    expect(isReadableZone(undefined)).toBe(false);
    expect(isReadableZone("")).toBe(false);
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
    }, TODAY);
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
      timeZone: "Asia/Kolkata",
    });
  });
  it("★★the stored zone is seeded WHATEVER it is — this browser's zone list may lag the server's (R2)", () => {
    expect(draftFromStored({ quietHours: { start: "22:00", end: "07:00" }, timeZone: "Mars/Olympus" }, TODAY).timeZone).toBe("Mars/Olympus");
  });
  it("★★blackouts that have ENDED are not carried into the form — saving drops them (R3)", () => {
    const d = draftFromStored(
      { blackoutDates: [{ from: "2025-12-24", to: "2025-12-26" }, { from: "2026-10-01", to: "2026-10-03" }, { from: "2026-12-24", to: "2026-12-24" }] },
      TODAY,
    );
    expect(d.blackouts.map((b) => b.from)).toEqual(["2026-10-01", "2026-12-24"]);
  });
  it("an empty form when nothing is stored, quiet hours off", () => {
    expect(empty()).toMatchObject({ deniedChannels: [], termsText: "", quietEnabled: false, blackouts: [], timeZone: "" });
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
      timeZone: "",
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

  it("★★sends the draft's zone when a window or blackout reads one — saving never moves it", () => {
    const r = buildGuardrailsPatch({ ...empty(), quietEnabled: true, timeZone: "Asia/Kolkata" });
    expect(r).toMatchObject({ ok: true, patch: { timeZone: "Asia/Kolkata" } });
  });

  it("★★no zone when nothing reads one, or when it is left empty (the api uses the business's own)", () => {
    const termsOnly = buildGuardrailsPatch({ ...empty(), termsText: "acme", timeZone: "Asia/Kolkata" });
    expect(termsOnly.ok).toBe(true);
    expect(termsOnly.ok && "timeZone" in termsOnly.patch).toBe(false);
    const emptyZone = buildGuardrailsPatch({ ...empty(), quietEnabled: true, timeZone: "  " });
    expect(emptyZone.ok).toBe(true);
    expect(emptyZone.ok && "timeZone" in emptyZone.patch).toBe(false);
  });

  it("★refuses what the merchant can fix in the form, in words they can act on", () => {
    const cases: Array<[Partial<GuardrailsDraft>, RegExp]> = [
      [{ quietEnabled: true, quietStart: "9:00", quietEnd: "17:00" }, /like 22:00/],
      [{ quietEnabled: true, quietStart: "09:00", quietEnd: "09:00" }, /different start and end/],
      [{ blackouts: [{ from: "2026-02-30", to: "2026-03-01", label: "" }] }, /start and an end date/],
      [{ blackouts: [{ from: "2026-03-02", to: "2026-03-01", label: "" }] }, /ends before it starts/],
      [{ blackouts: [{ from: "2026-03-01", to: "2026-03-01", label: "x".repeat(81) }] }, /at most 80/],
      [{ blackouts: Array.from({ length: 51 }, () => ({ from: "2027-01-01", to: "2027-01-01", label: "" })) }, /up to 50/],
      [{ termsText: "a".repeat(201) }, /longer than 200 characters/],
    ];
    for (const [over, msg] of cases) {
      const r = buildGuardrailsPatch({ ...empty(), ...over });
      expect(r.ok, JSON.stringify(over).slice(0, 60)).toBe(false);
      expect(!r.ok && r.error).toMatch(msg);
    }
  });

  it("★★the zone is the server's to judge — sent as chosen or kept (R2, R3)", () => {
    const kept = buildGuardrailsPatch({ ...empty(), quietEnabled: true, timeZone: "Mars/Olympus" });
    expect(kept).toMatchObject({ ok: true, patch: { timeZone: "Mars/Olympus" } });
  });

  it("★★the normalised length and count are the api's to judge (R1); only its RAW cap of 200 is here (R2)", () => {
    const long = buildGuardrailsPatch({ ...empty(), termsText: "a".repeat(200) });
    expect(long.ok).toBe(true);
    const many = buildGuardrailsPatch({ ...empty(), termsText: Array.from({ length: 101 }, (_, i) => `t${i}`).join("\n") });
    expect(many.ok).toBe(true);
  });

  it("quiet hours OFF are not validated — the stored times are just not sent", () => {
    expect(buildGuardrailsPatch({ ...empty(), quietEnabled: false, quietStart: "", quietEnd: "" }).ok).toBe(true);
  });
});

describe("timeZoneOptions", () => {
  it("★★legacy ids are offered by today's name, UTC is always offered, each once, sorted (R3)", () => {
    expect(timeZoneOptions(["Asia/Calcutta", "Europe/Kiev", "Asia/Kolkata", "America/New_York"])).toEqual([
      "America/New_York",
      "Asia/Kolkata",
      "Europe/Kyiv",
      "UTC",
    ]);
  });
  it("an id with no modern name is kept as listed", () => {
    expect(timeZoneOptions(["Europe/London"])).toEqual(["Europe/London", "UTC"]);
  });
});

describe("todayIn / activeBlackouts", () => {
  it("today on the zone's calendar — 11:00Z on the 3rd is already the 4th at +14", () => {
    const now = new Date("2026-10-03T11:00:00Z");
    expect(todayIn("Pacific/Kiritimati", now)).toBe("2026-10-04");
    expect(todayIn("UTC", now)).toBe("2026-10-03");
  });
  it("★★a blackout that has ended is not in force (R1); one ending today still is", () => {
    const g = {
      blackoutDates: [
        { from: "2025-12-24", to: "2025-12-26" },
        { from: "2026-10-01", to: "2026-10-03" },
        { from: "2026-12-24", to: "2026-12-26" },
      ],
    };
    expect(activeBlackouts(g, "2026-10-03")).toEqual([g.blackoutDates[1], g.blackoutDates[2]]);
  });
});

describe("describeGuardrails / hasGuardrails", () => {
  it("one line per rule in force, the zone named where it matters", () => {
    expect(
      describeGuardrails(
        {
          deniedChannels: ["meta", "x"],
          blockedTerms: ["acme"],
          quietHours: { start: "22:00", end: "07:00" },
          blackoutDates: [{ from: "2026-12-24", to: "2026-12-26" }, { from: "2027-01-01", to: "2027-01-01" }],
          timeZone: "Asia/Kolkata",
        },
        "2026-10-03",
      ),
    ).toEqual([
      "Never advertises on Meta (Facebook & Instagram), X.",
      "Blocks 1 term from every ad: acme.",
      "Starts no spend between 22:00 and 07:00 (Asia/Kolkata).",
      "Starts no spend on 2 blackout periods (Asia/Kolkata).",
    ]);
  });
  it("★★a blackout in force TODAY is said to be — not 'upcoming' (R2)", () => {
    expect(describeGuardrails({ blackoutDates: [{ from: "2026-10-01", to: "2026-10-05" }] }, "2026-10-03")).toEqual([
      "Starts no spend on 1 blackout period, including today.",
    ]);
  });
  it("★only blackouts not yet ended are counted (R1)", () => {
    expect(describeGuardrails({ blackoutDates: [{ from: "2025-12-24", to: "2025-12-26" }] }, "2026-10-03")).toEqual([]);
  });
  it("a long term list is shortened", () => {
    const lines = describeGuardrails({ blockedTerms: ["a", "b", "c", "d", "e", "f"] }, "2026-10-03");
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

describe("guardrailsSaveError", () => {
  it("★★a failure the rules cannot fix says what can (R3)", () => {
    expect(guardrailsSaveError({ code: "UNAUTHORIZED", message: "x", status: 401 })).toMatch(/Sign in again/);
    expect(guardrailsSaveError({ code: "FORBIDDEN", message: "Active business required", status: 403 })).toMatch(/owner or admin/);
    expect(guardrailsSaveError(null)).toMatch(/Check your connection/);
  });
  it("★★'Send timeZone.' becomes what to DO in this form (R2)", () => {
    const msg = guardrailsSaveError({
      code: "VALIDATION_ERROR",
      message: "Quiet hours and blackout dates need a time zone, and this business has none we can read. Send timeZone.",
    });
    expect(msg).toMatch(/Choose one in the Time zone field/);
    expect(msg).not.toMatch(/Send timeZone/);
  });
  it("★★the api's sentence only for a merchant-facing VALIDATION_ERROR (R1)", () => {
    expect(guardrailsSaveError({ code: "VALIDATION_ERROR", message: "Quiet hours need different start and end times." })).toBe(
      "Quiet hours need different start and end times.",
    );
  });
  it("★★anything else — a proxy's text, zod's 'Invalid body', a config error — is the generic sentence", () => {
    for (const err of [
      { code: "VALIDATION_ERROR", message: "Invalid body" },
      { code: "VALIDATION_ERROR", message: "Invalid JSON body" },
      { code: "NON_JSON", message: "Server returned non-JSON response (502)" },
      { code: "CONFIG", message: "NEXT_PUBLIC_API_URL is not configured" },
    ]) {
      expect(guardrailsSaveError(err)).toMatch(/couldn't save your guardrails/);
    }
  });
});
