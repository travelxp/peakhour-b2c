import { describe, it, expect } from "vitest";
import { withHolidayFields, type HolidayFields } from "./seasonal-event-wire";

const holiday: HolidayFields = {
  type: "public_holiday",
  region: "GB-SCT",
  closureLikely: true,
  source: "https://www.gov.uk/bank-holidays.json",
};

describe("withHolidayFields: the editor does not erase what it has no control for", () => {
  it("carries all four through onto the rebuilt event", () => {
    const wire = withHolidayFields({ name: "2nd January (Scotland)", month: 1, relevance: "edited note" }, holiday);
    expect(wire).toEqual({ name: "2nd January (Scotland)", month: 1, relevance: "edited note", ...holiday });
  });

  it("each field survives on its own", () => {
    for (const k of ["type", "region", "closureLikely", "source"] as const) {
      const out = withHolidayFields({ name: "X", month: 1 }, { [k]: holiday[k] });
      expect(out[k], `${k} was dropped`).toEqual(holiday[k]);
    }
  });

  it("closureLikely false is kept, not treated as blank", () => {
    expect(withHolidayFields({ name: "Boxing Day", month: 12 }, { closureLikely: false })).toHaveProperty("closureLikely", false);
  });

  it("adds nothing to an event with none, or to a new event", () => {
    const old = withHolidayFields({ name: "Diwali", month: 11 }, {});
    expect(Object.keys(old).sort()).toEqual(["month", "name"]);
    expect(Object.keys(withHolidayFields({ name: "New", month: 2 }, null)).sort()).toEqual(["month", "name"]);
  });

  it("does not mutate the object it is given", () => {
    const wire = { name: "X", month: 1 };
    withHolidayFields(wire, holiday);
    expect(wire).toEqual({ name: "X", month: 1 });
  });
});
