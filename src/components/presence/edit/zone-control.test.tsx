import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The holiday card's time zone control, as static markup: no zone known is a picker (not a dead end); a zone from the address says where it
 * came from and offers Change; a confirmed zone says nothing extra. WHAT THIS CANNOT PROVE: a click or a save (no effect runs here).
 */

vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/lib/api", () => ({ api: { get: async () => undefined, post: async () => undefined } }));

const { ZoneControl } = await import("@/components/presence/edit/zone-control");

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(ZoneControl as never, { listingId: "l1", canChange: true, ...props })));

describe("ZoneControl", () => {
  it("draws the picker, with its words, when no zone is known", () => {
    const html = render({ tz: null, address: { country: "IN" }, message: "We cannot suggest holiday hours yet, because we do not know your time zone. Choose it below." });
    expect(html).toContain("Choose your time zone");
    expect(html).toContain("Save time zone");
    expect(html).toContain("we do not know your time zone");
    expect(html).not.toContain(">Change<");
  });

  it("says the zone came from the address, in the place's words, with a Change button", () => {
    const html = render({ tz: { zone: "Asia/Kolkata", source: "address" }, address: { city: "Mumbai", country: "IN" } });
    expect(html).toContain("Holiday hours use India Standard Time (Asia/Kolkata), from your address in Mumbai.");
    expect(html).toContain(">Change<");
    expect(html).not.toContain("Save time zone");
  });

  it("says it came from the business settings", () => {
    expect(render({ tz: { zone: "Europe/London", source: "business" } })).toContain("from your business settings.");
  });

  it("says nothing extra for a confirmed zone, only Change", () => {
    const html = render({ tz: { zone: "Asia/Kolkata", source: "confirmed" }, address: { city: "Mumbai" } });
    expect(html).not.toContain("Holiday hours use");
    expect(html).toContain(">Change<");
  });
});

describe("ZoneControl without the right to change", () => {
  it("says the zone and draws no button", () => {
    const html = render({ tz: { zone: "Asia/Kolkata", source: "address" }, address: { city: "Mumbai" }, canChange: false });
    expect(html).toContain("from your address in Mumbai");
    expect(html).not.toContain("<button");
  });
  it("holiday card with no zone: the message, no picker, no button", () => {
    const html = render({ tz: null, canChange: false, message: "We do not know your time zone. Ask an admin or owner to choose it." });
    expect(html).toContain("Ask an admin or owner");
    expect(html).not.toContain("Choose your time zone");
    expect(html).not.toContain("<button");
  });
});

describe("nothing to say and nothing to press draws nothing", () => {
  it("a confirmed zone for a role that cannot change it", () => {
    expect(render({ tz: { zone: "Asia/Kolkata", source: "confirmed" }, canChange: false })).toBe("");
  });
});
