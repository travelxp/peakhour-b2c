import { describe, expect, it } from "vitest";
import { CALENDAR_TABS, CALENDAR_TAB_LABELS, parseCalendarTab } from "./calendar-tabs";

describe("the calendar's tabs", () => {
  it("each tab opens from its own ?tab= value", () => {
    for (const t of CALENDAR_TABS) expect(parseCalendarTab(t)).toBe(t);
  });
  it("anything else opens the calendar", () => {
    for (const v of [null, undefined, "", "Ideas", "settings"]) expect(parseCalendarTab(v)).toBe("calendar");
  });
  it("labels are merchant words", () => {
    expect(CALENDAR_TAB_LABELS.ideas).toBe("Planned ideas");
    expect(CALENDAR_TAB_LABELS.recurring).toBe("Recurring");
  });
});
