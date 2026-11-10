import { describe, it, expect, vi } from "vitest";
import { carryQuery } from "@/lib/insights";

// next/navigation's redirect throws to stop rendering; the double records where to.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

type Q = Record<string, string | string[] | undefined>;
const target = async (fn: (p: { searchParams: Promise<Q> }) => unknown, q: Q = {}): Promise<string> => {
  try {
    await fn({ searchParams: Promise.resolve(q) });
  } catch (e) {
    return (e as Error).message;
  }
  return "no redirect";
};

describe("the removed WhatsApp analytics page redirects to Insights (the Shopify app still links to it)", () => {
  it("/dashboard/content/whatsapp/analytics opens Insights, where the support results now are", async () => {
    const { default: Page } = await import("./content/whatsapp/analytics/page");
    expect(await target(Page)).toBe("REDIRECT:/dashboard/inbox?tab=insights");
  });
  it("it carries the old address's query string over (SA-12)", async () => {
    const analytics = (await import("./content/whatsapp/analytics/page")).default;
    expect(await target(analytics, { days: "7", channel: ["a", "b"] })).toBe("REDIRECT:/dashboard/inbox?tab=insights&days=7&channel=a&channel=b");
  });
});

describe("carryQuery", () => {
  it("adds nothing when there is nothing to carry, and skips an unset key", () => {
    expect(carryQuery("/x?tab=insights", {})).toBe("/x?tab=insights");
    expect(carryQuery("/x?tab=insights", undefined)).toBe("/x?tab=insights");
    expect(carryQuery("/x?tab=insights", { a: undefined })).toBe("/x?tab=insights");
    expect(carryQuery("/x", { a: "1" })).toBe("/x?a=1");
  });
  it("encodes what it carries", () => {
    expect(carryQuery("/x?tab=insights", { q: "a b&c" })).toBe("/x?tab=insights&q=a+b%26c");
  });
});
