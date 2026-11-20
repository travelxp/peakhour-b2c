import { describe, expect, it } from "vitest";
import {
  ackPromptFor,
  ackPromptForRedirect,
  integrationsAckHref,
  isAckRequiredRedirect,
  overseasAckCopy,
  withOverseasAck,
  withoutAckRedirectParams,
} from "./overseas-ack";
import { setQueryParam } from "./url-query";
import { withMetaLoginPurpose } from "./integrations-meta";

const p = (q: string) => new URLSearchParams(q);
const rows = [
  { provider: "tiktok_ads", requiresAck: { version: "tiktok_india_v1" } },
  { provider: "tiktok_content", requiresAck: { version: "tiktok_india_v9" } },
  { provider: "x_ads" },
];

describe("ackPromptFor", () => {
  it("asks only when the api flagged the provider and wording exists", () => {
    expect(ackPromptFor(rows, "tiktok_ads")).toEqual({ kind: "ask", version: "tiktok_india_v1" });
    expect(ackPromptFor(rows, "x_ads")).toEqual({ kind: "none" });
    expect(ackPromptFor(rows, "missing")).toEqual({ kind: "none" });
  });
  it("is unavailable, never silent, when the version has no copy", () => {
    expect(ackPromptFor(rows, "tiktok_content")).toEqual({ kind: "unavailable" });
  });
});

describe("ackPromptForRedirect", () => {
  it("takes the provider from the param and the version from its row", () => {
    expect(ackPromptForRedirect(p("error=tiktok_india_ack_required&provider=tiktok_ads"), rows)).toEqual({
      kind: "ask",
      version: "tiktok_india_v1",
      provider: "tiktok_ads",
    });
  });
  it("does not guess v1 when the provider, row or version is missing", () => {
    expect(ackPromptForRedirect(p("error=tiktok_india_ack_required"), rows).kind).toBe("unavailable");
    expect(ackPromptForRedirect(p("provider=tiktok_ads"), [{ provider: "tiktok_ads" }]).kind).toBe("unavailable");
    expect(ackPromptForRedirect(p("provider=nope"), rows).kind).toBe("unavailable");
    expect(ackPromptForRedirect(p("provider=tiktok_content"), rows).kind).toBe("unavailable");
  });
});

describe("redirect params", () => {
  it("recognises the redirect on either param", () => {
    expect(isAckRequiredRedirect(p("error=tiktok_india_ack_required"))).toBe(true);
    expect(isAckRequiredRedirect(p("integration=error&msg=tiktok_india_ack_required"))).toBe(true);
    expect(isAckRequiredRedirect(p("error=other"))).toBe(false);
    expect(isAckRequiredRedirect(null)).toBe(false);
  });
  it("strips the redirect's own params and keeps returnTo/returnFor", () => {
    expect(
      withoutAckRedirectParams(p("error=tiktok_india_ack_required&provider=tiktok_ads&returnTo=%2Fdashboard%2Fads&returnFor=tiktok_ads")),
    ).toBe("returnTo=%2Fdashboard%2Fads&returnFor=tiktok_ads");
    expect(withoutAckRedirectParams(p("integration=error&msg=tiktok_india_ack_required&provider=tiktok_ads"))).toBe("");
  });
  it("keeps provider, returnTo and returnFor when settings hands over", () => {
    const href = integrationsAckHref(
      p("integration=error&msg=tiktok_india_ack_required&provider=tiktok_ads&returnTo=%2Fdashboard%2Fads&returnFor=tiktok_ads"),
    );
    const u = new URL(href, "https://x.test");
    expect(u.pathname).toBe("/dashboard/integrations");
    expect(u.searchParams.get("error")).toBe("tiktok_india_ack_required");
    expect(u.searchParams.get("provider")).toBe("tiktok_ads");
    expect(u.searchParams.get("returnTo")).toBe("/dashboard/ads");
    expect(u.searchParams.get("returnFor")).toBe("tiktok_ads");
  });
});

describe("url building", () => {
  it("puts the version on the authorize url, keeping query and hash, without duplicating", () => {
    const url = "https://api.example/v1/integrations/tiktok_ads/authorize?returnTo=%2Fdashboard%2Fintegrations#frag";
    const once = withOverseasAck(url, "tiktok_india_v1");
    expect(once).toBe(
      "https://api.example/v1/integrations/tiktok_ads/authorize?returnTo=%2Fdashboard%2Fintegrations&ackOverseas=tiktok_india_v1#frag",
    );
    expect(withOverseasAck(once, "tiktok_india_v2").match(/ackOverseas/g)).toHaveLength(1);
    expect(withOverseasAck("https://a.test/x", "v").endsWith("?ackOverseas=v")).toBe(true);
  });
  it("shares one helper with the Meta purpose builder", () => {
    expect(setQueryParam("/a?b=1#h", "c", "2")).toBe("/a?b=1&c=2#h");
    expect(withMetaLoginPurpose("/a?b=1", "content")).toBe("/a?b=1&purpose=content");
  });
});

it("holds the approved wording", () => {
  const c = overseasAckCopy("tiktok_india_v1")!;
  expect(c.title).toBe("TikTok is banned in India");
  expect(c.confirm).toBe("Connect TikTok");
  expect(overseasAckCopy("nope")).toBeNull();
});
