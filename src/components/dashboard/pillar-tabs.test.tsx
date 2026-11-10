import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const { PillarTabs } = await import("./pillar-tabs");

const tabs = [
  { href: "/dashboard/commerce", label: "Overview", description: "Your store at a glance." },
  { href: "/dashboard/commerce/pricing", label: "Pricing", description: "Price changes waiting for you." },
];

describe("PillarTabs", () => {
  it("keeps descriptions as tooltips and prints no description line under the strip", () => {
    const html = renderToStaticMarkup(<PillarTabs tabs={tabs} pathname="/dashboard/commerce" label="Commerce" />);
    expect(html).toContain('title="Your store at a glance."');
    expect(html).toContain('title="Price changes waiting for you."');
    // The only text nodes are the tab labels: no <p> carrying the description.
    expect(html).not.toContain("<p");
  });
});
