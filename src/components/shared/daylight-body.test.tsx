import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let path: string | null = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

import { DaylightBody } from "./daylight-body";

const classOf = (p: string | null) => {
  path = p;
  return /<body class="([^"]*)"/.exec(renderToStaticMarkup(<DaylightBody className="font-sans">x</DaylightBody>))?.[1] ?? "";
};

describe("DaylightBody", () => {
  it("is Daylight on public routes, the old pages and the 404 included", () => {
    for (const p of ["/", "/pricing", "/privacy-policy", "/auth", "/shopify", "/some/cms/page", "/dashboardish"]) {
      expect(classOf(p)).toContain("theme-daylight");
    }
    expect(classOf(null)).toContain("theme-daylight");
  });
  it("leaves the signed-in app on the device theme", () => {
    for (const p of ["/dashboard", "/dashboard/growth", "/onboarding", "/onboarding/x", "/cms", "/cms/pages"]) {
      expect(classOf(p)).toBe("font-sans");
    }
  });
});
