import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { ClaimDone } = await import("./claim-done");
const { doneCopy } = await import("./claim-copy");

/**
 * The hosted success state tells the merchant they can go back to Shopify, and keeps Go to dashboard.
 */
describe("the hosted claim's success state", () => {
  const done = doneCopy({ newBusiness: false, businessName: "Silk", adopted: false, separate: false }, "silk", "Silk Co");

  it("says the tab can be closed and keeps Go to dashboard", () => {
    const html = renderToStaticMarkup(<ClaimDone done={done} />);
    expect(html).toContain("You can close this tab and go back to Shopify.");
    expect(html).toContain(">Go to dashboard<");
    expect(html).toContain('href="/dashboard"');
  });

  it("PASS: the integrations button still follows the outcome", () => {
    expect(renderToStaticMarkup(<ClaimDone done={done} />)).toContain("See it in Integrations");
    const own = doneCopy({ newBusiness: false, businessName: null, adopted: false, separate: true }, "silk", "Silk Co");
    expect(renderToStaticMarkup(<ClaimDone done={own} />)).not.toContain("See it in Integrations");
  });
});
