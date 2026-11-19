import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const { BatchGridView } = await import("./batch-grid");
const { ApprovalPageView } = await import("./approval-page");
const { VersionHistoryView } = await import("./version-history");
const { ApprovalSendView } = await import("./approval-send");
import type { BatchPreview, BatchView } from "@/lib/api/creative-studio";

const noop = () => {};
const tile = (id: string, over: Partial<BatchPreview> = {}): BatchPreview => ({
  id,
  creativeId: `c-${id}`,
  state: "ready",
  liked: false,
  index: 0,
  thumbUrl: `https://cdn.example/${id}.jpg`,
  productTitle: `Product ${id}`,
  headline: `Headline ${id}`,
  lapsed: false,
  ...over,
});
const batch = (previews: BatchPreview[], over: Partial<BatchView> = {}): BatchView => ({
  id: "b1",
  status: "ready",
  quote: null,
  products: previews.length,
  done: previews.length,
  failedProducts: 0,
  creatives: [],
  previews,
  ...over,
});

describe("the batch grid (S16)", () => {
  const grid = (b: BatchView, over: Partial<Parameters<typeof BatchGridView>[0]> = {}) =>
    renderToStaticMarkup(
      <BatchGridView
        batch={b}
        canMake
        final="on"
        finalQuote={{ state: "quote", peaks: 880 }}
        left={5000}
        pending={false}
        lastBulk={null}
        onAction={noop}
        onSkip={noop}
        onMakeFinal={noop}
        onRetryQuote={noop}
        onUndo={noop}
        {...over}
      />,
    );

  it("one tile per product with a heart, a skip and a select box named for the product", () => {
    const html = grid(batch([tile("a"), tile("b")]));
    expect(html).toContain('aria-label="Approve Product a"');
    expect(html).toContain('aria-label="Select Product b"');
    expect(html).toContain('aria-label="Not for me: Product a"');
    expect(html).toContain("Showing 2 of 2");
  });

  it("quotes the approved ones once, in Peaks, from the api's number, with the help", () => {
    const html = grid(batch([tile("a", { liked: true, state: "shortlisted" }), tile("b", { liked: true, state: "shortlisted" })]));
    expect(html).toContain("880 Peaks for 2 finals");
    expect(html).toContain("Make final for 2 approved");
    expect(html).toContain("Why these sizes?");
    expect(html).not.toMatch(/[₹£$€]/);
  });

  it("with nothing approved it says so and Make final is off", () => {
    const html = grid(batch([tile("a")]));
    expect(html).toContain("Approve a preview to make it final");
    expect(html).not.toContain("Peaks for");
  });

  it("while Make final is not switched on it shows no price and says it opens soon", () => {
    const html = grid(batch([tile("a", { liked: true, state: "shortlisted" })]), { final: "coming_soon" });
    expect(html).toContain("Making a final opens soon");
    expect(html).not.toContain("880");
  });

  it("a viewer cannot spend: the buttons are off and the reason is said", () => {
    const html = grid(batch([tile("a")]), { canMake: false });
    expect(html).toContain("Ask an editor to make this.");
    expect(html).toMatch(/aria-label="Approve Product a"[^>]*disabled|disabled[^>]*aria-label="Approve Product a"/);
  });

  it("a changed preview says so, and a batch still being made shows its progress", () => {
    const html = grid(batch([tile("a", { lapsed: true })], { status: "making", products: 5, done: 1 }));
    expect(html).toContain("Changed. Tap the heart again.");
    expect(html).toContain("1 of 5 products made");
  });

  it("failed products are named once, not charged", () => {
    expect(grid(batch([tile("a")], { failedProducts: 3 }))).toContain("3 products didn&#x27;t work. Not charged.");
  });

  it("when every product failed it says so and that nothing was charged, not to wait", () => {
    const html = grid(batch([], { status: "failed", failedProducts: 2, products: 2, done: 2 }));
    expect(html).toContain("2 products didn&#x27;t work. Not charged.");
    expect(html).not.toContain("No previews yet");
  });

  it("24 to a page, then Show more", () => {
    const many = Array.from({ length: 30 }, (_, i) => tile(`t${i}`, { index: i }));
    const html = grid(batch(many));
    expect(html).toContain("Showing 24 of 30");
    expect(html).toContain("Show 6 more");
  });
});

describe("the public approval page (S18)", () => {
  const view = (over: Partial<Parameters<typeof ApprovalPageView>[0]> = {}) =>
    renderToStaticMarkup(
      <ApprovalPageView
        view={{ step: "ready", picture: { business: "Sari House", imageUrl: "https://cdn.example/p.png", width: 768, height: 960, answered: null, expiresAt: "2026-11-26T00:00:00.000Z" } }}
        name=""
        comment=""
        busy={false}
        onName={noop}
        onComment={noop}
        onAnswer={noop}
        onRetry={noop}
        {...over}
      />,
    );

  it("shows one picture, whose it is, a name field and the two answers", () => {
    const html = view();
    expect(html).toContain("Does this look right?");
    expect(html).toContain("From Sari House");
    expect(html).toContain('src="https://cdn.example/p.png"');
    expect(html).toContain("Your name, so Sari House knows who answered");
    expect(html).toContain("Approve");
    expect(html).toContain("Not yet");
  });

  it("the answers wait for a name", () => {
    expect(view()).toMatch(/<button[^>]*disabled[^>]*>Approve<|disabled=""[^>]*>Approve/);
    expect(view({ name: "Asha" })).not.toMatch(/disabled=""[^>]*>Approve/);
  });

  it("a picture address that is not http or https is never put in the page", () => {
    const html = view({ view: { step: "ready", picture: { business: "Sari House", imageUrl: "javascript:alert(1)", width: null, height: null, answered: null, expiresAt: "" } } });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });

  it("with no picture to see there are no answers to give", () => {
    const html = view({ view: { step: "ready", picture: { business: "Sari House", imageUrl: "javascript:alert(1)", width: null, height: null, answered: null, expiresAt: "" } } });
    expect(html).not.toContain("Not yet");
    expect(html).not.toContain("Your name, so");
  });

  it("an already answered link offers no buttons", () => {
    const html = view({ view: { step: "ready", picture: { business: "Sari House", imageUrl: "https://cdn.example/p.png", width: 768, height: 960, answered: "approved", expiresAt: "" } } });
    expect(html).toContain("This link was already answered.");
    expect(html).not.toContain("Not yet");
  });

  it("stopped, answered and thanks are plain, and say whose it was", () => {
    expect(view({ view: { step: "stopped", business: "Sari House" } })).toContain("This link has stopped working. Ask Sari House for a new one.");
    expect(view({ view: { step: "stopped" } })).toContain("Ask the business for a new one.");
    expect(view({ view: { step: "answered", business: "Sari House" } })).toContain("You already answered this.");
    expect(view({ view: { step: "thanks", business: "Sari House", message: "" } })).toContain("Thanks. Sari House has your answer.");
  });

  it("shows nothing of the dashboard", () => {
    const html = view();
    expect(html).not.toContain("/dashboard");
    expect(html).not.toContain("Peaks");
  });
});

describe("version history (S17)", () => {
  const groups = [
    {
      previewId: "p1",
      number: 1,
      headline: "Flat 20% off",
      items: [
        { previewId: "p1", version: 2, summary: "Current look", at: "2026-11-19T10:00:00.000Z", current: true, restorable: false },
        { previewId: "p1", version: 1, summary: "Changed headline", at: "2026-11-19T09:00:00.000Z", current: false, restorable: true },
      ],
    },
  ];

  it("lists each look with what changed, and Go back only on an earlier one", () => {
    const html = renderToStaticMarkup(<VersionHistoryView groups={groups} canMake busy={null} onRestore={noop} />);
    expect(html).toContain("Preview 1");
    expect(html).toContain("Changed headline");
    expect(html.match(/Go back to this/g)).toHaveLength(1);
    expect(html).toContain("Now");
  });

  it("says the heart lapsed after going back, and a viewer cannot go back", () => {
    const ok = renderToStaticMarkup(<VersionHistoryView groups={groups} canMake busy={null} message={{ tone: "ok", text: "Restored. Tap the heart to approve it again." }} onRestore={noop} />);
    expect(ok).toContain("Restored. Tap the heart to approve it again.");
    const viewer = renderToStaticMarkup(<VersionHistoryView groups={groups} canMake={false} busy={null} onRestore={noop} />);
    expect(viewer).toContain("Ask an editor to go back to an earlier look.");
  });

  it("with no history it says so", () => {
    expect(renderToStaticMarkup(<VersionHistoryView groups={[]} canMake busy={null} onRestore={noop} />)).toContain("No history yet");
  });
});

describe("send for approval (S18, sender)", () => {
  const previews = [{ id: "p1", number: 1, headline: "Flat 20% off" }];
  const link = { id: "l1", previewId: "p1", state: "waiting" as const, expiresAt: "2026-11-26T00:00:00.000Z", answeredName: null, answeredAt: null };

  it("a new link's address is shown once with the copy button and the warning", () => {
    const html = renderToStaticMarkup(
      <ApprovalSendView previews={previews} links={[link]} fresh={{ p1: "https://peakhour.ai/share/studio/abc" }} canMake pendingPreview={null} revokingId={null} onCreate={noop} onCopy={noop} onRevoke={noop} />,
    );
    expect(html).toContain("https://peakhour.ai/share/studio/abc");
    expect(html).toContain("Copy link");
    expect(html).toContain("This link is shown only now.");
    expect(html).toContain("Stop this link");
  });

  it("two links made in a row both keep their address until the sheet closes", () => {
    const two = [...previews, { id: "p2", number: 2, headline: null }];
    const html = renderToStaticMarkup(
      <ApprovalSendView previews={two} links={[]} fresh={{ p1: "https://peakhour.ai/share/studio/one", p2: "https://peakhour.ai/share/studio/two" }} canMake pendingPreview={null} revokingId={null} onCreate={noop} onCopy={noop} onRevoke={noop} />,
    );
    expect(html).toContain("/share/studio/one");
    expect(html).toContain("/share/studio/two");
  });

  it("an older link is listed with its state and who answered, with no address", () => {
    const html = renderToStaticMarkup(
      <ApprovalSendView
        previews={previews}
        links={[{ ...link, state: "approved", answeredName: "Asha" }]}
        fresh={{}}
        canMake
        pendingPreview={null}
        revokingId={null}
        onCreate={noop}
        onCopy={noop}
        onRevoke={noop}
      />,
    );
    expect(html).toContain("Approved by Asha");
    expect(html).not.toContain("/share/studio/");
    expect(html).not.toContain("Stop this link");
  });

  it("a viewer cannot make a link, and with no previews it says to make some first", () => {
    const viewer = renderToStaticMarkup(<ApprovalSendView previews={previews} links={[]} fresh={{}} canMake={false} pendingPreview={null} revokingId={null} onCreate={noop} onCopy={noop} onRevoke={noop} />);
    expect(viewer).toContain("Ask an editor to send this for approval.");
    const none = renderToStaticMarkup(<ApprovalSendView previews={[]} links={[]} fresh={{}} canMake pendingPreview={null} revokingId={null} onCreate={noop} onCopy={noop} onRevoke={noop} />);
    expect(none).toContain("Make previews first");
  });
});
