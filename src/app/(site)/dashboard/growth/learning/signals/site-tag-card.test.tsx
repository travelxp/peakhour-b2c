import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * GG-3c+: the Signals page shows the business's own Peakhour site tag whether or not LinkedIn is set up, and the
 * LinkedIn Remove dialog no longer speaks for the tag (its key is its own).
 */

const KEY = "0123456789abcdef0123456789abcdef";
const h = vi.hoisted(() => ({
  signals: { signals: [] as unknown[], availableProviders: ["linkedin_insight"], availableRails: ["manual"] },
  siteTag: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: () => {},
  } as Record<string, unknown>,
  list: { pending: false, data: true },
}));

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1" } }) }));
vi.mock("@/hooks/use-signals", () => ({
  useSignals: () => ({ data: h.list.data ? h.signals : undefined, isPending: h.list.pending, error: null, refetch: () => {}, isFetching: false }),
  useSiteTag: () => h.siteTag,
  useSignalSnippet: () => ({ data: undefined, isPending: true, isError: false }),
  useCreateSignal: () => ({ mutate: () => {}, isPending: false }),
  useUpdateSignal: () => ({ mutate: () => {}, isPending: false }),
  useRemoveSignal: () => ({ mutate: () => {}, isPending: false }),
}));

const { default: SignalsPage } = await import("./page");

beforeEach(() => {
  h.signals.signals = [];
  h.list = { pending: false, data: true };
  h.siteTag = {
    isFetching: false,
    refetch: () => {},
    data: {
      siteKey: KEY,
      tagSnippet: `<script>peakhour("init", "${KEY}");</script>`,
      placement: "x",
      state: "never_fired",
      lastFiredAt: null,
      lastFiredHost: null,
      freshWindowDays: 7,
    },
    isPending: false,
    isError: false,
  };
});

describe("the Peakhour site tag card", () => {
  it("★shows the tag snippet and the consent rule with NO LinkedIn signal set up", () => {
    const html = renderToStaticMarkup(<SignalsPage />);
    expect(html).toContain("Peakhour site tag");
    expect(html).toContain(KEY);
    expect(html).toContain("It sends nothing until a visitor agrees to analytics.");
    expect(html).toContain("quiet start is normal");
  });

  it("an error building it says so, and never shows an older copy", () => {
    h.siteTag = { data: undefined, isPending: false, isError: true, isFetching: false, refetch: () => {} };
    const html = renderToStaticMarkup(<SignalsPage />);
    expect(html).toContain("couldn&#x27;t build your site tag");
    expect(html).toContain("Try again");
    expect(html).not.toContain(KEY);
  });

  it("★shows while the LinkedIn list is still loading, and when it failed", () => {
    h.list = { pending: true, data: false };
    expect(renderToStaticMarkup(<SignalsPage />)).toContain(KEY);
    h.list = { pending: false, data: false };
    expect(renderToStaticMarkup(<SignalsPage />)).toContain(KEY);
  });

  it("a failed background refetch keeps the tag that already loaded on screen", () => {
    h.siteTag = { ...h.siteTag, isError: true };
    const html = renderToStaticMarkup(<SignalsPage />);
    expect(html).toContain(KEY);
    expect(html).not.toContain("couldn&#x27;t build your site tag");
    expect(html).toContain("Check again");
    // and the failed check says so, rather than passing the old evidence off as new
    expect(html).toContain("couldn&#x27;t check just now");
  });

  it("the page source no longer tells a LinkedIn removal that the site tag stops", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(src).not.toMatch(/site tag uses the same key/i);
  });
});
