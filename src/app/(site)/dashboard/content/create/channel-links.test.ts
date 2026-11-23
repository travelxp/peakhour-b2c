import { describe, expect, it } from "vitest";
import { CHANNELS } from "../channels.config";
import { channelLinks, connectionsByProvider } from "./channel-links";

const connected = (provider: string) => ({ provider, connected: true, status: "active" });

describe("channelLinks", () => {
  it("lists a connected channel with the page that opens it", () => {
    const x = CHANNELS.find((c) => c.slug === "x")!;
    const links = channelLinks([...CHANNELS], connectionsByProvider([connected(x.providerKey)]));
    expect(links.map((l) => l.href)).toEqual(["/dashboard/content/x"]);
  });

  it("lists nothing when nothing is connected", () => {
    expect(channelLinks([...CHANNELS], connectionsByProvider([]))).toEqual([]);
    expect(channelLinks([...CHANNELS], connectionsByProvider(undefined))).toEqual([]);
  });

  it("leaves out a channel whose connection is broken", () => {
    const x = CHANNELS.find((c) => c.slug === "x")!;
    const broken = { provider: x.providerKey, connected: false, status: "needs_reauth" };
    expect(channelLinks([x], connectionsByProvider([broken]))).toEqual([]);
  });

  it("skips any channel whose api row says it is not available for this org, and keeps one that says available or says nothing", () => {
    const tiktok = CHANNELS.find((c) => c.slug === "tiktok")!;
    const row = (availability?: string) => connectionsByProvider([{ ...connected(tiktok.providerKey), ...(availability ? { availability } : {}) }]);
    expect(channelLinks([tiktok], row("coming_soon"))).toEqual([]);
    expect(channelLinks([tiktok], row("beta"))).toEqual([]);
    expect(channelLinks([tiktok], row("available")).map((l) => l.href)).toEqual(["/dashboard/content/tiktok"]);
    expect(channelLinks([tiktok], row()).map((l) => l.href)).toEqual(["/dashboard/content/tiktok"]);
    const x = CHANNELS.find((c) => c.slug === "x")!;
    expect(channelLinks([x], connectionsByProvider([{ ...connected(x.providerKey), availability: "coming_soon" }]))).toEqual([]);
  });

  it("links only to pages under Content: no ad channel, no channel without a page of its own", () => {
    const ads = CHANNELS.filter((c) => c.dashboardPath?.startsWith("/dashboard/ads"));
    expect(ads.length).toBeGreaterThan(0);
    const all = connectionsByProvider(CHANNELS.map((c) => connected(c.providerKey)));
    const links = channelLinks([...CHANNELS], all);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.href.startsWith("/dashboard/content/"), l.slug).toBe(true);
    for (const a of ads) expect(links.map((l) => l.slug)).not.toContain(a.slug);
  });
});
