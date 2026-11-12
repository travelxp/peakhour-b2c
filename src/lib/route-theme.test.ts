import { describe, expect, it } from "vitest";
import { forcedThemeFor } from "./route-theme";

describe("forcedThemeFor", () => {
  it.each(["/", "/shopify", "/shopify/connect", "/pricing", "/growth", "/help/getting-started", "/auth", "/share/abc", "/claim/shopify", "/privacy-policy"])(
    "forces light on the public page %s",
    (path) => {
      expect(forcedThemeFor(path)).toBe("light");
    },
  );

  it.each(["/dashboard", "/dashboard/ask", "/onboarding", "/onboarding/brand-kit", "/cms", "/cms/jobs"])(
    "lets the signed-in route %s follow the device setting",
    (path) => {
      expect(forcedThemeFor(path)).toBeUndefined();
    },
  );

  it("does not treat a lookalike prefix as the app", () => {
    expect(forcedThemeFor("/dashboards")).toBe("light");
    expect(forcedThemeFor("/onboarding-guide")).toBe("light");
    expect(forcedThemeFor("/cmsx")).toBe("light");
  });

  it("forces light when the path is not known", () => {
    expect(forcedThemeFor(null)).toBe("light");
  });
});
