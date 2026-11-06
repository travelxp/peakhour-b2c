import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StorefrontThread } from "@/hooks/use-wa-conversations";
import { createComposerStore } from "@/lib/wa-inbox-reply";

// Markup only: the hooks are replaced, so nothing here reaches the api, the router or the auth provider.
const h = vi.hoisted(() => ({
  prices: { data: { customerSummary: 10, suggestReply: 5 } as unknown, isSuccess: true },
  mutation: { isPending: false, mutate: () => {}, mutateAsync: async () => ({}) },
}));
vi.mock("@/hooks/use-wa-conversations", () => ({
  useInboxPrices: () => h.prices,
  useRefreshSummary: () => h.mutation,
  useSuggestReply: () => h.mutation,
  useWaReply: () => h.mutation,
  useWaHandoff: () => h.mutation,
  useWaResume: () => h.mutation,
}));

const { StorefrontFooter, HandoverCard } = await import("./storefront-live");

const thread = (over: Partial<StorefrontThread> = {}): StorefrontThread => ({
  threadId: "storefront:abc",
  channel: "storefront",
  contactName: "Storefront visitor",
  status: "escalated",
  readOnly: false,
  statusVersion: 3,
  delivery: "visitor_away",
  messages: [],
  handover: {
    reason: "refund",
    reasonLabel: "Asked for a refund",
    at: "2026-11-05T10:00:00Z",
    note: "Visitor wants their money back for the blue kurta.",
    kind: "refund",
    orderNumber: "#1001",
    adminUrl: "https://admin.shopify.com/store/demo/orders/1001",
    lastAsks: ["Where is my refund?", "Can I speak to someone?"],
  },
  summary: { text: "Wants a refund on #1001.", at: "2026-11-05T10:01:00Z" },
  contactEmail: "asha@example.com",
  hasContactEmail: true,
  ...over,
});
const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("the footer under a storefront thread", () => {
  it("shows the reply box only when the chat is with the team", () => {
    const html = render(<StorefrontFooter thread={thread({ readOnly: false })} role="editor" store={createComposerStore()} />);
    expect(html).toContain('data-testid="storefront-composer"');
    expect(html).toContain("The visitor is not in the chat right now. They see your reply if they come back to it.");
    expect(html).toContain("Resume");
    // text only: no attachment, template, product or checkout controls, no 24-hour banner
    expect(html).not.toMatch(/template|attach|checkout|product|24/i);
  });
  it("read-only keeps the note and offers Take over to an editor, not a viewer", () => {
    const ro = thread({ readOnly: true, status: "active" });
    const editor = render(<StorefrontFooter thread={ro} role="editor" store={createComposerStore()} />);
    expect(editor).not.toContain("storefront-composer");
    expect(editor).toContain("Take over");
    const viewer = render(<StorefrontFooter thread={ro} role="viewer" store={createComposerStore()} />);
    expect(viewer).not.toContain("Take over");
    expect(viewer).not.toContain("storefront-composer");
  });
  it("says each delivery state in its own words", () => {
    for (const [d, text] of [
      ["visitor_here", "sees your reply now"],
      ["visitor_away", "if they come back to it"],
      ["visitor_away_email", "follow up there as well"],
    ] as const) {
      expect(render(<StorefrontFooter thread={thread({ delivery: d })} role="owner" store={createComposerStore()} />)).toContain(text);
    }
  });
});

describe("the handover card", () => {
  it("shows the reason, the note, the asks and an admin link that opens safely in a new tab", () => {
    const html = render(<HandoverCard thread={thread()} store={createComposerStore()} />);
    expect(html).toContain("Asked for a refund");
    expect(html).toContain("Refund request for order #1001");
    expect(html).toContain("Visitor wants their money back");
    expect(html).toContain("Where is my refund?");
    const link = html.match(/<a [^>]*>/)?.[0] ?? "";
    expect(link).toContain('href="https://admin.shopify.com/store/demo/orders/1001"');
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Open the order in Shopify");
    expect(html).toContain("Wants a refund on #1001.");
    expect(html).toContain("Refresh summary · 10");
    expect(html).toContain("Suggest a reply · 5");
  });
  it("an editor sees the address; a viewer only that one was left", () => {
    expect(render(<HandoverCard thread={thread()} store={createComposerStore()} />)).toContain("asha@example.com");
    const viewer = render(<HandoverCard thread={thread({ contactEmail: null })} store={createComposerStore()} />);
    expect(viewer).toContain("The visitor left an email");
    expect(viewer).not.toContain("@");
  });
  it("draws nothing for a chat that was never handed over, and no link for a non-admin address", () => {
    expect(render(<HandoverCard thread={thread({ handover: null })} store={createComposerStore()} />)).toBe("");
    const odd = thread();
    odd.handover = { ...odd.handover!, adminUrl: "https://evil.example/x" };
    expect(render(<HandoverCard thread={odd} store={createComposerStore()} />)).not.toContain("Open the order in Shopify");
  });
});
