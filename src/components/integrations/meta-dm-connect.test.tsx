import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DmStatus } from "@/lib/meta-dm";

// The view is pure; the api client is replaced so nothing here reaches the network.
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() }, API_BASE_URL: "https://api.example" }));

const { MetaDmConnectView, MetaDmPointerView, metaMessagingAuthorizeUrl } = await import("./meta-dm-connect");
const { needsMetaStep, dmErrorMessage, dmPointer, dmWhyNot, DM_COPY } = await import("@/lib/meta-dm");

const page = (over: Record<string, unknown> = {}) => ({
  pageId: "1055550001",
  pageName: "Acme Store",
  instagramUsername: "acme",
  connectionId: "c1",
  messenger: { available: true, enabled: false },
  instagram: { available: true, enabled: false },
  ...over,
});
const status = (over: Partial<DmStatus> = {}): DmStatus => ({
  channels: { messenger: true, instagram: true },
  connected: true,
  needsReauth: false,
  savedPageId: "1055550001",
  missingPermissions: {},
  pages: [page()],
  ...over,
});
const html = (s: DmStatus, over: { busy?: string | null; error?: string | null } = {}) =>
  renderToStaticMarkup(<MetaDmConnectView status={s} busy={over.busy ?? null} error={over.error ?? null} onMeta={() => {}} onSwitch={() => {}} />);

describe("the Meta step", () => {
  it("not connected: Connect Meta", () => {
    expect(needsMetaStep(status({ connected: false, pages: [] }))).toBe("connect");
    expect(html(status({ connected: false, pages: [] }))).toContain(DM_COPY.connectMeta);
  });
  it("needs reconnecting: Reconnect Meta", () => {
    expect(needsMetaStep(status({ connected: false, needsReauth: true, pages: [] }))).toBe("reconnect");
  });
  it("a released channel with missing permissions: Grant messaging access, in words", () => {
    const s = status({ missingPermissions: { messenger: ["pages_messaging"] } });
    expect(needsMetaStep(s)).toBe("grant");
    const out = html(s);
    expect(out).toContain("Grant messaging access");
    expect(out).toContain("Peakhour needs messaging access to your Page before it can answer messages.");
  });
  it("missing permissions of a channel that is NOT released are not asked for", () => {
    expect(needsMetaStep(status({ channels: { messenger: true, instagram: false }, missingPermissions: { instagram: ["instagram_manage_messages"] } }))).toBeNull();
  });
  it("the connect link carries the messaging flag and a same-site return path", () => {
    const url = metaMessagingAuthorizeUrl();
    expect(url).toBe("https://api.example/v1/integrations/facebook/authorize?messaging=1&returnTo=%2Fdashboard%2Fintegrations");
  });
});

describe("the page rows", () => {
  it("shows the Page, each released channel with its state, and the 24-hour rule", () => {
    const out = html(status());
    expect(out).toContain("Acme Store");
    expect(out).toContain("Messenger");
    expect(out).toContain("Instagram messages");
    expect(out).toContain("@acme");
    expect(out).toContain(DM_COPY.window);
    expect(out).toContain(DM_COPY.turnOn);
  });
  it("shows only the channels that are released", () => {
    const out = html(status({ channels: { messenger: true, instagram: false } }));
    expect(out).toContain("dm-row-messenger");
    expect(out).not.toContain("dm-row-instagram");
  });
  it("an enabled channel reads On with Turn off", () => {
    const out = html(status({ pages: [page({ messenger: { available: true, enabled: true } })] }));
    expect(out).toContain(DM_COPY.onFor("Acme Store"));
    expect(out).toContain("On for Acme Store");
    expect(out).toContain(DM_COPY.turnOff);
    // the Turn on button of the OTHER channel is still there, and the enabled one has none
    expect(out.match(/>Turn on<\/button>/g) ?? []).toHaveLength(1);
  });
  it("a channel that is not available is a disabled Turn on, and a Page with no Instagram says how to fix it", () => {
    const out = html(status({ pages: [page({ instagramUsername: null, instagram: { available: false, enabled: false } })] }));
    expect(out).toContain(DM_COPY.noInstagram);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Turn on<\/button>/);
  });
  it("a switch in flight disables EVERY switch until the status is re-read (no click acts on state about to change)", () => {
    const out = html(status(), { busy: "1055550001:messenger" });
    const buttons = out.match(/<button[^>]*>Turn on<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b).toContain('disabled=""');
    const idle = html(status()).match(/<button[^>]*>Turn on<\/button>/g) ?? [];
    for (const b of idle) expect(b).not.toContain('disabled=""');
  });
  it("an unavailable channel says why instead of showing a dead button", () => {
    const out = html(status({ pages: [page({ messenger: { available: false, enabled: false } })] }));
    expect(out).toContain(DM_COPY.noAccess);
    expect(out).toContain("connect Meta again");
  });
  it("a Page another Peakhour account already uses says so, in words, with a dead Turn on", () => {
    const out = html(status({ pages: [page({ messenger: { available: true, enabled: false, otherBusiness: true } })] }));
    expect(out).toContain("Another Peakhour account already uses this Page for messages");
    const row = out.split('data-testid="dm-row-messenger"')[1]!.split('data-testid="dm-row-instagram"')[0]!;
    expect(row).toMatch(/<button[^>]*disabled=""[^>]*>Turn on<\/button>/);
  });
  it("the reason for a channel that is ON is never shown", () => {
    expect(dmWhyNot(page({ messenger: { available: false, enabled: true, otherBusiness: true } }), "messenger")).toBeNull();
  });
  it("Instagram without a linked account wins over every other reason", () => {
    expect(dmWhyNot(page({ instagramUsername: null, instagram: { available: false, enabled: false, otherBusiness: true } }), "instagram")).toBe(DM_COPY.noInstagram);
  });
  it("the intro says it is on by default and where the Page is chosen (the card above, not another page)", () => {
    expect(DM_COPY.intro).toContain("on by default");
    expect(DM_COPY.intro).toContain("Meta accounts above");
  });
  it("Turn on is dead whenever a reason is shown, so the button and the words cannot disagree", () => {
    const out = html(status({ pages: [page({ instagramUsername: null, instagram: { available: true, enabled: false } })] }));
    const row = out.split('data-testid="dm-row-instagram"')[1]!;
    expect(row).toContain(DM_COPY.noInstagram);
    expect(row).toMatch(/<button[^>]*disabled=""[^>]*>Turn on<\/button>/);
  });
  it("an api that omits missingPermissions does not crash the screen", () => {
    const s = { ...status(), missingPermissions: undefined } as unknown as DmStatus;
    expect(needsMetaStep(s)).toBeNull();
    expect(() => html(s)).not.toThrow();
  });
  it("connected with no Pages says so and what to do", () => {
    expect(html(status({ pages: [] }))).toContain(DM_COPY.noPages);
  });
  it("shows an error as a sentence with a next step, never a bare code", () => {
    expect(html(status(), { error: "This Page is already connected to another Peakhour account." })).toContain("already connected to another Peakhour account");
    expect(dmErrorMessage(new Error("boom"))).toBe("boom");
    expect(dmErrorMessage(null)).toMatch(/try again/);
  });
});

describe("the line on the Facebook Pages card", () => {
  it("on: names the Page Peakhour uses and links to the panel", () => {
    const s = status({ pages: [page({ messenger: { available: true, enabled: true } })] });
    expect(dmPointer(s)).toEqual({ on: true, text: "Messages: on for Acme Store" });
    const out = renderToStaticMarkup(<MetaDmPointerView status={s} />);
    expect(out).toContain("Messages: on for Acme Store");
    expect(out).toContain('href="#meta-dm-connect"');
  });
  it("off: says so (a turned-off channel, or nothing could be switched on)", () => {
    expect(dmPointer(status())).toEqual({ on: false, text: "Messages: off" });
    expect(renderToStaticMarkup(<MetaDmPointerView status={status()} />)).toContain("Messages: off");
  });
  it("reads the SAVED Page, not the first listed", () => {
    const s = status({
      savedPageId: "2",
      pages: [page({ messenger: { available: true, enabled: true } }), page({ pageId: "2", pageName: "Outlet", messenger: { available: true, enabled: false } })],
    });
    expect(dmPointer(s)).toEqual({ on: false, text: "Messages: off" });
  });
  it("a channel that is not released does not count as on, and nothing shows while messaging is not released or there is no Page", () => {
    const s = status({ channels: { messenger: false, instagram: true }, pages: [page({ messenger: { available: true, enabled: true } })] });
    expect(dmPointer(s)).toEqual({ on: false, text: "Messages: off" });
    expect(dmPointer(status({ channels: { messenger: false, instagram: false } }))).toBeNull();
    expect(dmPointer(status({ pages: [] }))).toBeNull();
    expect(renderToStaticMarkup(<MetaDmPointerView status={status({ pages: [] })} />)).toBe("");
  });
  it("never names a different Page: with no saved Page in the status there is no line", () => {
    expect(dmPointer({ ...status(), savedPageId: undefined } as DmStatus)).toBeNull();
    expect(dmPointer(status({ savedPageId: "999" }))).toBeNull();
  });
  it("the Page the card is showing wins over the api's, so the picker and the line cannot disagree", () => {
    const s = status({
      savedPageId: "1055550001",
      pages: [page({ messenger: { available: true, enabled: true } }), page({ pageId: "2", pageName: "Outlet" })],
    });
    expect(dmPointer(s)?.text).toBe("Messages: on for Acme Store");
    expect(dmPointer(s, "2")).toEqual({ on: false, text: "Messages: off" });
    expect(renderToStaticMarkup(<MetaDmPointerView status={s} pageId="2" />)).toContain("Messages: off");
  });
});
