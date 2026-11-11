import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let apps: unknown[] = [];
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({ data: apps, isLoading: false, isError: false, refetch: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ org: { _id: "o1" }, business: { _id: "b1" } }) }));
vi.mock("@/lib/api", () => ({ api: {}, ApiError: class extends Error {} }));

const { FootprintReviewCard } = await import("./footprint-review-card");
const { YourAppsPanel } = await import("./your-apps-panel");

const app = (over: Record<string, unknown>) => ({
  appId: "ios:1",
  platform: "ios",
  storeId: "1",
  storeUrl: "https://apps.apple.com/app/id1",
  source: "website_banner",
  confidence: 0.9,
  status: "pending",
  discoveredAt: "2026-11-11T00:00:00Z",
  ...over,
});

beforeEach(() => {
  apps = [];
});

describe("FootprintReviewCard with apps", () => {
  it("renders when ONLY apps are pending, with the fallback name, evidence and store link", () => {
    const html = renderToStaticMarkup(
      <FootprintReviewCard pending={[]} pendingApps={[app({ evidence: "Your site has an app banner." }) as never]} />,
    );
    expect(html).toContain("iPhone app");
    expect(html).toContain("Your site has an app banner.");
    expect(html).toContain("Yes, iPhone app is mine");
    expect(html).toContain("https://apps.apple.com/app/id1");
    expect(html).toContain("1 to review");
  });
  it("still renders for links alone and counts both kinds together", () => {
    const links = [{ url: "https://x.com/a", source: "x" }];
    expect(renderToStaticMarkup(<FootprintReviewCard pending={links} />)).toContain("1 to review");
    const both = renderToStaticMarkup(<FootprintReviewCard pending={links} pendingApps={[app({ platform: "android", appId: "android:a.b" }) as never]} />);
    expect(both).toContain("2 to review");
    expect(both).toContain("Android app");
  });
  it("renders nothing with neither", () => {
    expect(renderToStaticMarkup(<FootprintReviewCard pending={[]} pendingApps={[]} />)).toBe("");
  });
  it("never renders a non-https store link or icon", () => {
    const html = renderToStaticMarkup(
      <FootprintReviewCard pending={[]} pendingApps={[app({ storeUrl: "javascript:alert(1)", iconUrl: "http://x/i.png" }) as never]} />,
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("http://x/i.png");
  });
});

describe("YourAppsPanel", () => {
  it("shows the empty state and the add field", () => {
    const html = renderToStaticMarkup(<YourAppsPanel />);
    expect(html).toContain("No apps found. If you have one, paste its App Store or Google Play link.");
    expect(html).toContain("Paste an App Store or Google Play link");
    expect(html).not.toContain("aren&#x27;t yours");
  });
  it("lists confirmed apps with Remove, pending with Yes/No, and hides rejected behind a toggle", () => {
    apps = [
      app({ appId: "ios:1", status: "confirmed", name: "Acme" }),
      app({ appId: "android:a.b", platform: "android", status: "pending" }),
      app({ appId: "ios:2", status: "rejected", name: "Old" }),
    ];
    const html = renderToStaticMarkup(<YourAppsPanel />);
    expect(html).toContain("Remove Acme");
    expect(html).toContain("Yes, Android app is mine");
    expect(html).toContain("Show apps you said aren&#x27;t yours");
    expect(html).not.toContain("Restore Old");
    expect(html).not.toContain("No apps found");
  });
});
