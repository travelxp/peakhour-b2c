import { describe, it, expect } from "vitest";
import { paidNote, paidStaleNote } from "./outcomes-paid";
import type { OutcomesResponse, PaidChannel } from "@/lib/api/growth";

/**
 * ★WHAT THE "SAW YOUR ADS" NOTE SAYS WHEN THE api REFUSES A TOTAL (D-01). The
 * refusal has more than one cause, and a sentence that names one of them is
 * false for the others.
 */
type Paid = NonNullable<OutcomesResponse["reach"]["paid"]>;
const ch = (over: Partial<PaidChannel>): PaidChannel => ({
  platform: "linkedin",
  impressions: 100,
  clicks: 5,
  spend: 40,
  currency: "USD",
  conversions: 1,
  campaigns: 1,
  stale: false,
  lastReadAt: null,
  ...over,
});
const paid = (over: Partial<Paid>): Paid => ({
  impressions: 100,
  campaigns: 1,
  spend: 40,
  currency: "USD",
  byChannel: [ch({})],
  ...over,
});

describe("paidNote", () => {
  it("totals one currency", () => {
    expect(paidNote(paid({}))).toBe("1 campaign · USD 40 spent");
  });

  it("★★two currencies: each channel's own spend, never 'more than one currency' with no numbers", () => {
    const note = paidNote(
      paid({
        campaigns: 2,
        spend: null,
        currency: undefined,
        byChannel: [ch({}), ch({ platform: "meta", spend: 80, currency: "EUR" })],
      }),
    );
    expect(note).toBe("2 campaigns · spent LinkedIn ads USD 40, Meta ads EUR 80");
  });

  it("★★a campaign with NO currency is not called 'more than one currency'", () => {
    const note = paidNote(paid({ spend: null, currency: undefined, byChannel: [ch({ spend: null, currency: undefined })] }));
    // ★ROUND 3: and not "in one currency" either — that still implies a conflict.
    expect(note).toBe("1 campaign · spend couldn't be totalled");
    expect(note).not.toMatch(/more than one|in one currency/);
  });

  it("★a partial per-channel list SAYS it is partial", () => {
    const note = paidNote(
      paid({
        campaigns: 2,
        spend: null,
        currency: undefined,
        byChannel: [ch({}), ch({ platform: "meta", spend: null, currency: undefined })],
      }),
    );
    expect(note).toBe("2 campaigns · spent LinkedIn ads USD 40 (the rest couldn't be totalled)");
  });

  it("★★a channel with a currency but NO spend is never printed as an amount — the repos deploy apart", () => {
    // The api pairs them (currency present exactly when spend is a number), but
    // this build can meet an api that does not; "USD NaN" or "USD 0" would be a
    // figure nobody measured.
    const note = paidNote(
      paid({
        campaigns: 2,
        spend: null,
        currency: undefined,
        byChannel: [ch({}), ch({ platform: "meta", spend: null, currency: "EUR" })],
      }),
    );
    expect(note).toBe("2 campaigns · spent LinkedIn ads USD 40 (the rest couldn't be totalled)");
  });

  it("★★a STALE channel that neither served nor spent is not printed as a zero", () => {
    const note = paidNote(
      paid({
        campaigns: 1,
        spend: null,
        currency: undefined,
        byChannel: [ch({}), ch({ platform: "meta", impressions: 0, spend: 0, currency: "EUR", stale: true, campaigns: 0, moved: false })],
      }),
    );
    expect(note).not.toMatch(/EUR 0/);
    expect(note).toBe("1 campaign · spent LinkedIn ads USD 40 · some ad figures stopped updating");
  });

  it("★an UNKNOWN spend with no impressions is still 'the rest' — it may not be zero", () => {
    const note = paidNote(
      paid({
        campaigns: 1,
        spend: null,
        currency: undefined,
        byChannel: [ch({}), ch({ platform: "meta", impressions: 0, spend: null, currency: undefined, campaigns: 0 })],
      }),
    );
    expect(note).toBe("1 campaign · spent LinkedIn ads USD 40 (the rest couldn't be totalled)");
  });

  it("PASS: an api that sends no byChannel still gets a sentence (this build merges first)", () => {
    expect(paidNote(paid({ spend: null, currency: undefined, byChannel: undefined }))).toBe(
      "1 campaign · spend couldn't be totalled",
    );
  });

  it("★★the api on MASTER (a number, no currency) is not called a refusal — this build meets it first", () => {
    // That api totalled the spend; it just had no currency to name. It always
    // printed only the campaign count, and must still.
    expect(paidNote(paid({ spend: 120, currency: undefined, byChannel: undefined }))).toBe("1 campaign");
  });

  it("★★a channel the api says did NOT move is skipped — the rule is the api's, not ours", () => {
    const note = paidNote(
      paid({
        campaigns: 1,
        spend: null,
        currency: undefined,
        // Impressions and spend look "moved" here on purpose: only the flag decides.
        byChannel: [ch({ moved: true }), ch({ platform: "meta", spend: 9, currency: "EUR", moved: false })],
      }),
    );
    expect(note).toBe("1 campaign · spent LinkedIn ads USD 40");
  });

  it("paidStaleNote serves both figures, and is null when nothing is stale", () => {
    expect(paidStaleNote(paid({ byChannel: [ch({ stale: true })] }))).toBe("some ad figures stopped updating");
    expect(paidStaleNote(paid({}))).toBeNull();
    expect(paidStaleNote(null)).toBeNull();
  });

  it("★says a channel STOPPED UPDATING, beside the figure it shrinks", () => {
    expect(paidNote(paid({ byChannel: [ch({ stale: true })] }))).toBe(
      "1 campaign · USD 40 spent · some ad figures stopped updating",
    );
  });
});
