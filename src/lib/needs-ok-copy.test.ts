import { describe, expect, it } from "vitest";
import { MAX_DESCRIPTION, NEEDS_OK_HREF, NEEDS_OK_LABEL, SUB_COPY } from "./nav-copy";

/** W1-B places this page in the nav from these exports; the page title and the command menu read the same words. */
describe("Needs your OK nav copy", () => {
  it("exports the route and the label, and SUB_COPY carries them", () => {
    expect(NEEDS_OK_HREF).toBe("/dashboard/content/needs-ok");
    expect(NEEDS_OK_LABEL).toBe("Needs your OK");
    expect(SUB_COPY[NEEDS_OK_HREF].label).toBe(NEEDS_OK_LABEL);
  });

  it("keeps the description to one short line, and the old names searchable", () => {
    const c = SUB_COPY[NEEDS_OK_HREF];
    expect(c.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(c.aliases).toEqual(["Auto-publish", "Autopilot", "Approvals"]);
  });
});
