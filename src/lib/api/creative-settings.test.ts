import { describe, expect, it } from "vitest";
import { DEFAULT_STUDIO_SETTINGS, mergeSettings, parseAvailability, parseSettings } from "./creative";

describe("Studio settings as the api sends them", () => {
  it("reads every field", () => {
    expect(parseSettings({ noAiPeople: true, monthlyCapPeaks: 5000, remindShortlist: false, whatsappUpdates: true, usedThisMonthPeaks: 1240 })).toEqual({
      noAiPeople: true,
      monthlyCapPeaks: 5000,
      remindShortlist: false,
      whatsappUpdates: true,
      usedThisMonthPeaks: 1240,
    });
  });
  it("a missing or odd answer is the api's own default, never a guess", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_STUDIO_SETTINGS);
    expect(parseSettings({ monthlyCapPeaks: "5000", noAiPeople: "yes", usedThisMonthPeaks: -4 })).toEqual(DEFAULT_STUDIO_SETTINGS);
    expect(parseSettings({ monthlyCapPeaks: 0 }).monthlyCapPeaks).toBeNull();
    expect(parseSettings({ monthlyCapPeaks: 2.5 }).monthlyCapPeaks).toBeNull();
  });
  it("travel with the availability answer", () => {
    expect(parseAvailability({ capabilities: {}, proTools: true, settings: { monthlyCapPeaks: 100 } }).settings.monthlyCapPeaks).toBe(100);
  });
});

describe("one change saved", () => {
  const held = { ...DEFAULT_STUDIO_SETTINGS, noAiPeople: true, monthlyCapPeaks: 5000, remindShortlist: false, usedThisMonthPeaks: 900 };
  it("an answer that names one field leaves the others as they were held", () => {
    expect(mergeSettings(held, { whatsappUpdates: true })).toEqual({ ...held, whatsappUpdates: true });
  });
  it("an answer may clear the limit, and never changes what was used this month", () => {
    expect(mergeSettings(held, { monthlyCapPeaks: null, usedThisMonthPeaks: 1 })).toEqual({ ...held, monthlyCapPeaks: null });
  });
  it("an unreadable answer changes nothing", () => {
    expect(mergeSettings(held, undefined)).toEqual(held);
  });
});
