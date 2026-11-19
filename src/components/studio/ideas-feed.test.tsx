import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { IdeasFeedView } = await import("./ideas-feed");
const { ComingSoon } = await import("./coming-soon");
const { STUDIO_COPY } = await import("@/lib/studio-copy");

import type { PostIdea } from "@/lib/api/creative";

const idea = (over: Partial<PostIdea> = {}): PostIdea => ({
  id: "low_stock:1",
  kind: "low_stock",
  reason: "Silk saree is nearly sold out, with only 2 left.",
  productIds: ["p1"],
  products: [{ id: "p1", title: "Silk saree" }],
  format: "story",
  facts: {},
  expiresAt: "2026-11-22T00:00:00.000Z",
  ...over,
});

const render = (over: Partial<Parameters<typeof IdeasFeedView>[0]> = {}) =>
  renderToStaticMarkup(
    <IdeasFeedView
      status="ready"
      ideas={[idea()]}
      previewsComingSoon={false}
      onRetry={() => {}}
      onNotNow={() => {}}
      locale="en-GB"
      {...over}
    />,
  );

describe("ideas feed states", () => {
  it("loading draws skeletons and no cards, no empty state, no error", () => {
    const html = render({ status: "loading", ideas: [] });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<article");
    expect(html).not.toContain(STUDIO_COPY.ideas.empty.title);
    expect(html).not.toContain("couldn&#x27;t load");
  });

  it("an error is an error with Retry, never an empty list", () => {
    const html = render({ status: "error", ideas: [] });
    expect(html).toContain("couldn&#x27;t load your ideas");
    expect(html).toContain("Retry");
    expect(html).not.toContain(STUDIO_COPY.ideas.empty.title);
  });

  it("offline says so and offers no retry button", () => {
    const html = render({ status: "offline", ideas: [] });
    expect(html).toContain("offline");
    expect(html).not.toContain("Retry");
    expect(html).not.toContain(STUDIO_COPY.ideas.empty.title);
  });

  it("no ideas: the empty state, titled as the spec words it, with Start from scratch", () => {
    const html = render({ ideas: [] });
    expect(html).toContain("No ideas right now");
    expect(html).toContain("Check back soon, or start your own.");
    expect(html).toContain(`href="/dashboard/studio/new"`);
    expect(html).toContain("Start from scratch");
  });

  it("no ideas and no store connected: asks to connect the store", () => {
    const html = render({ ideas: [], storeConnected: false });
    expect(html).toContain("Connect your store to get ideas");
    expect(html).toContain("Ideas come from your products and sales.");
    expect(html).toContain('href="/dashboard/integrations"');
    expect(html).not.toContain("No ideas right now");
  });

  it("a card shows the kind, the format, the reason unedited, the product, and the two actions", () => {
    const html = render();
    expect(html).toContain("<article");
    expect(html).toContain("Low stock");
    expect(html).toContain("Story");
    expect(html).toContain("Silk saree is nearly sold out, with only 2 left.");
    expect(html).toContain("Make previews");
    expect(html).toContain("Not now");
    expect(html).toContain("Ideas are free. You only use Peaks when you ask for previews.");
  });

  it("'Make previews' is a link to the brief carrying the idea (free: no call)", () => {
    expect(render()).toContain('href="/dashboard/studio/new?idea=low_stock%3A1"');
  });

  it("the reason describes both buttons for a screen reader", () => {
    const html = render();
    const id = /id="(studio-idea-reason-0)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html.split(`aria-describedby="${id}"`).length - 1).toBe(2);
  });

  it("only a festival card says how long it is good for", () => {
    expect(render()).not.toContain("Good until");
    expect(render({ ideas: [idea({ kind: "festival", id: "f1" })] })).toContain("Good until 22 Nov 2026");
    expect(render({ ideas: [idea({ kind: "festival", id: "f1", facts: { date: "2026-11-21" } })] })).toContain("Good until 21 Nov 2026");
  });

  it("shows three products and counts the rest", () => {
    const products = ["a", "b", "c", "d", "e"].map((x) => ({ id: x, title: `Product ${x}` }));
    const html = render({ ideas: [idea({ products })] });
    expect(html).toContain("Product c");
    expect(html).not.toContain("Product d");
    expect(html).toContain("+2");
  });

  it("the previews-open-soon banner appears once, above the cards, and only when previews are not on", () => {
    const soon = render({ previewsComingSoon: true, ideas: [idea(), idea({ id: "x2" })] });
    expect(soon.split("Making previews opens soon. Your ideas are ready now.").length - 1).toBe(1);
    expect(soon.indexOf("opens soon")).toBeLessThan(soon.indexOf("<article"));
    expect(render({ previewsComingSoon: false })).not.toContain("opens soon");
  });

  it("the cards stay usable while previews are coming soon", () => {
    expect(render({ previewsComingSoon: true })).toContain("Make previews");
  });

  it("carries a polite live region for 'Idea hidden.'", () => {
    const html = render({ announcement: "Idea hidden." });
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Idea hidden.");
  });

  it("no price, no Peaks figure and no currency anywhere in the feed", () => {
    for (const html of [render(), render({ ideas: [] }), render({ previewsComingSoon: true })]) {
      expect(html).not.toMatch(/[₹£$€]/);
      expect(html).not.toMatch(/\d+\s+Peaks/);
    }
  });
});

describe("ComingSoon", () => {
  it("is a card with the chip, a heading and the words, and asks for no price", () => {
    const html = renderToStaticMarkup(
      <ComingSoon title={STUDIO_COPY.comingSoon.previews.title} description={STUDIO_COPY.comingSoon.previews.description} />,
    );
    expect(html).toContain("Coming soon");
    expect(html).toContain("<h2");
    expect(html).toContain("Previews are coming soon");
    expect(html).toContain("We&#x27;re getting the picture maker ready.");
    expect(html).not.toMatch(/\d+\s+Peaks/);
  });
});
