import { describe, expect, it } from "vitest";
import { IDEA_STATUS_LABEL, ideaStatusLabel } from "./idea-status";
import { STATUS_CONFIG } from "@/app/(site)/dashboard/strategist/components/status-badge";

describe("ideaStatusLabel", () => {
  it("has a merchant label for every status the board knows", () => {
    for (const status of Object.keys(STATUS_CONFIG)) {
      expect(IDEA_STATUS_LABEL[status], status).toBeTruthy();
    }
  });

  it("never prints a raw value", () => {
    for (const label of Object.values(IDEA_STATUS_LABEL)) {
      expect(label).not.toMatch(/_|brainstorm|in progress/i);
    }
    expect(ideaStatusLabel("brainstorm")).toBe("New idea");
    expect(ideaStatusLabel("in_progress")).toBe("Being written");
    expect(ideaStatusLabel("brief_ready")).toBe("Brief ready");
  });

  it("calls the two writing statuses the same thing", () => {
    expect(ideaStatusLabel("writing")).toBe(ideaStatusLabel("in_progress"));
  });

  it("turns an unknown value into words rather than snake_case", () => {
    expect(ideaStatusLabel("needs_legal_check")).toBe("Needs legal check");
    expect(ideaStatusLabel("")).toBe("New idea");
  });
});
