import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RailItem } from "@/hooks/use-home-summary";
import { NeedsOkBlock } from "./needs-ok-block";

const row = (over: Partial<RailItem> = {}): RailItem => ({
  type: "approve",
  channel: "linkedin",
  refId: "r1",
  title: "Spring sale post",
  ctaHref: "/dashboard/calendar",
  pillar: "content",
  ...over,
});

describe("NeedsOkBlock", () => {
  it("lists each item with its verb and links to the full list", () => {
    const html = renderToStaticMarkup(<NeedsOkBlock items={[row(), row({ refId: "r2", type: "failed", title: "Bad post" })]} count={2} mayBeMore={false} />);
    expect(html).toContain("Needs your OK");
    expect(html).toContain("Spring sale post");
    expect(html).toContain("Review");
    expect(html).toContain("Fix");
    expect(html).toContain('href="/dashboard/content/needs-ok"');
    expect(html).not.toContain("2+");
  });

  it("says all caught up only when nothing is waiting", () => {
    const html = renderToStaticMarkup(<NeedsOkBlock items={[]} count={0} mayBeMore={false} />);
    expect(html).toContain("all caught up");
  });

  it("does not say all clear when the list it read was capped", () => {
    const html = renderToStaticMarkup(<NeedsOkBlock items={[]} count={0} mayBeMore />);
    expect(html).not.toContain("all caught up");
    expect(html).toContain("See everything");
  });

  it("shows the count as a floor when it may be more", () => {
    const html = renderToStaticMarkup(<NeedsOkBlock items={[row()]} count={1} mayBeMore />);
    expect(html).toContain("1+");
  });
});
