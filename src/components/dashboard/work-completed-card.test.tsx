import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/viz/trend-chart-lazy", () => ({ TrendChart: () => null }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ org: { _id: "o1" } }) }));
vi.mock("@/hooks/use-home-work", () => ({
  useHomeWork: () => ({
    isLoading: false,
    data: {
      windowDays: 14,
      since: "2026-01-01",
      today: "2026-01-14",
      days: [],
      totals: {
        actions_executed: 0,
        published: 0,
        drafted: 0,
        leads_captured: 0,
        conversations_resolved: 0,
        reviews_replied: 0,
      },
    },
  }),
}));

let integrations: { provider: string; connected: boolean }[] | undefined;
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: integrations ? { integrations } : undefined }),
}));

const { WorkCompletedCard } = await import("./work-completed-card");

describe("WorkCompletedCard empty state", () => {
  beforeEach(() => {
    integrations = undefined;
  });

  it("asks to connect a channel when none is connected", () => {
    integrations = [{ provider: "linkedin", connected: false }];
    const html = renderToStaticMarkup(<WorkCompletedCard />);
    expect(html).toContain("Connect your first channel");
    expect(html).toContain('href="/dashboard/integrations"');
  });

  it("does not ask an account with connections to connect one", () => {
    integrations = [
      { provider: "linkedin", connected: true },
      { provider: "x", connected: true },
    ];
    const html = renderToStaticMarkup(<WorkCompletedCard />);
    expect(html).not.toContain("Connect your first channel");
    expect(html).toContain("Plan your next post");
    expect(html).toContain('href="/dashboard/content"');
  });
});
