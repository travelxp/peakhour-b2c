import { describe, expect, it } from "vitest";
import { DEFAULT_STUDIO_SETTINGS, parseAvailability, parseSettings } from "./creative";

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
