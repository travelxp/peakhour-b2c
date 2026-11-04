import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NOT_OPENED_YET, daysText, detailsRemovedText, openedAtText, shareDialogNotice, visitorNotice } from "./drive-share-copy";

/**
 * Share-link visitor data (owner decision 2026-11-04): the exact sentences, and the rule that the number is the api's.
 */
describe("the sentences", () => {
  it("say what the owner approved, with the number from the api", () => {
    expect(shareDialogNotice(90)).toBe("When someone opens this link, we keep their IP address and device for 90 days so you can spot a leak.");
    expect(visitorNotice(90)).toBe("Opening this link records your IP address and device. We keep these for 90 days.");
    expect(detailsRemovedText(90)).toBe("Details removed after 90 days");
    expect(NOT_OPENED_YET).toBe("Not opened yet.");
  });

  it("follow the number: 30 and 365 are what is said, and one day is singular", () => {
    expect(shareDialogNotice(30)).toContain("for 30 days so");
    expect(visitorNotice(365)).toContain("for 365 days.");
    expect(detailsRemovedText(1)).toBe("Details removed after 1 day");
    expect(daysText(1)).toBe("1 day");
    expect(shareDialogNotice(30)).not.toContain("90");
    expect(visitorNotice(30)).not.toContain("90");
  });

  it("an unreadable date is said plainly, not as 'Invalid Date'", () => {
    expect(openedAtText("not a date")).toBe("Unknown time");
    expect(openedAtText("2026-11-04T10:00:00.000Z", "en-US")).toContain("2026");
  });
});

describe("no component or copy file holds a day count of its own", () => {
  const files = ["./drive-share-copy.ts", "../components/drive/share-privacy.tsx", "../components/drive/share-page.tsx", "./api/drive-share.ts"];
  it.each(files)("%s", (rel) => {
    const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
    // Comment lines may talk about 90; code may not. (A line-based strip: these files keep comments on their own lines.)
    const code = src
      .split(/\r?\n/)
      .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
      .join("\n");
    expect(code).not.toMatch(/\b(90|30|180|365)\b/);
    // "1 day" is the singular in daysText, not a retention number
    expect(code).not.toMatch(/\b(?!1 day\b)\d+ days?\b/);
  });
});
