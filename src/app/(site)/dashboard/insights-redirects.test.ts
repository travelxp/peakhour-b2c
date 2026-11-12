import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

// The WhatsApp analytics redirect (/dashboard/content/whatsapp/analytics -> Inbox Insights) is deleted:
// its last caller, the Shopify app's Results link, now opens /dashboard/inbox?tab=insights directly
// (peakhour-shopify#297, live on the app's host 2026-11-10). An old link gets the dashboard 404.
describe("the retired WhatsApp analytics address", () => {
  it("has no page any more", () => {
    expect(existsSync(join(__dirname, "content", "whatsapp", "analytics", "page.tsx"))).toBe(false);
  });
});
