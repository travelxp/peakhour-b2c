import { describe, it, expect, vi } from "vitest";

// next/navigation's redirect throws to stop rendering; the double records where to.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const target = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return "no redirect";
};

describe("the removed pages redirect to Insights, so old links stay alive", () => {
  it("/dashboard/commerce/demand opens Product demand", async () => {
    const { default: Page } = await import("./commerce/demand/page");
    expect(target(Page)).toBe("REDIRECT:/dashboard/inbox?tab=insights&type=product_demand");
  });
  it("/dashboard/content/whatsapp/analytics opens Insights, where the support results now are", async () => {
    const { default: Page } = await import("./content/whatsapp/analytics/page");
    expect(target(Page)).toBe("REDIRECT:/dashboard/inbox?tab=insights");
  });
});
