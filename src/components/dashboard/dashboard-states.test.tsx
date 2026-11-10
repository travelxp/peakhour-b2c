import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const { PageIntro } = await import("./page-intro");
const { PillarError } = await import("./pillar-error");
const { QueryError } = await import("./query-error");
const store = await import("@/lib/page-intro-store");
const { PAGE_INTRO_COPY } = await import("@/lib/page-intro-copy");

function fakeStorage(opts: { throws?: boolean } = {}) {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (opts.throws) throw new Error("blocked");
      return m.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.throws) throw new Error("blocked");
      m.set(k, v);
    },
  };
}

describe("PageIntro", () => {
  beforeEach(() => store.resetPageIntroSession());
  afterEach(() => vi.unstubAllGlobals());

  it("renders with no window at all (server render)", () => {
    const html = renderToStaticMarkup(<PageIntro id="strategist" />);
    expect(html).toContain(PAGE_INTRO_COPY.strategist.title);
    expect(html).toContain("Hide this tip");
  });

  it("stays hidden once dismissed and the choice is stored", () => {
    const ls = fakeStorage();
    vi.stubGlobal("window", { localStorage: ls });
    store.dismissPageIntro("news");
    expect(store.isPageIntroDismissed("news")).toBe(true);
    store.resetPageIntroSession();
    expect(store.isPageIntroDismissed("news")).toBe(true); // from storage
    expect(store.isPageIntroDismissed("ledger")).toBe(false);
  });

  it("survives storage that throws: renders, and dismissal holds for the session", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage({ throws: true }) });
    expect(store.isPageIntroDismissed("sources")).toBe(false);
    expect(() => store.dismissPageIntro("sources")).not.toThrow();
    expect(store.isPageIntroDismissed("sources")).toBe(true);
  });

  it("every intro names what to do first", () => {
    for (const id of Object.keys(PAGE_INTRO_COPY)) {
      const html = renderToStaticMarkup(<PageIntro id={id as keyof typeof PAGE_INTRO_COPY} />);
      expect(html).toContain("Start here:");
    }
  });
});

describe("PillarError", () => {
  it("offers retry, a way home and a report link", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToStaticMarkup(<PillarError href="/dashboard/integrations" error={new Error("boom")} reset={() => {}} />);
    // The section is named from nav-copy, not from the route folder.
    expect(html).toContain("Connected accounts hit a problem");
    expect(html).toContain("Back to Home");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/dashboard/overview"');
    expect(html).toContain("Report this");
  });
});

describe("QueryError", () => {
  it("says the load failed (not empty) and offers Retry", () => {
    const html = renderToStaticMarkup(<QueryError what="your tickets" onRetry={() => {}} />);
    expect(html).toContain("We couldn&#x27;t load your tickets");
    expect(html).toContain("Retry");
    expect(html).toContain('role="alert"');
  });
  it("the offline strip has no Retry and says why", () => {
    const html = renderToStaticMarkup(<QueryError what="your tickets" kind="offline" onRetry={() => {}} />);
    expect(html).toContain("offline");
    expect(html).not.toContain("Retry");
  });
});
