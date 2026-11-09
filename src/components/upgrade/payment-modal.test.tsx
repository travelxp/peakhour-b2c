import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The Stripe shell (Dialog vs Drawer) is read from the media query with
 * useSyncExternalStore, so the iframe mounts ONCE, in the right shell, on the
 * first client render. On the server the snapshot is null and nothing renders:
 * no iframe is ever server-rendered, and `window` is never touched (this file
 * runs in vitest's node environment, which has no window).
 */
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) => <div data-provider>{children}</div>,
  EmbeddedCheckout: () => <div data-embedded-checkout />,
}));

const { PaymentModal } = await import("./payment-modal");

describe("Stripe embedded checkout on the server", () => {
  it("renders nothing and never reads window (the shell is chosen on the client)", () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
    const html = renderToStaticMarkup(
      <PaymentModal
        checkout={{ gateway: "stripe", embed: { kind: "stripe", clientSecret: "cs_x", publishableKey: "pk_x" } }}
        onOpenChange={() => {}}
      />,
    );
    expect(html).toBe("");
  });
});
