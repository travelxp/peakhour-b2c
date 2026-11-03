import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DmStatus } from "@/lib/meta-dm";

// The view is pure; the api client is replaced so nothing here reaches the network.
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() }, API_BASE_URL: "https://api.example" }));

const { MetaDmConnectView, metaMessagingAuthorizeUrl } = await import("./meta-dm-connect");
const { needsMetaStep, dmErrorMessage, DM_COPY } = await import("@/lib/meta-dm");

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
    expect(out).toContain(DM_COPY.on);
    expect(out).toContain(DM_COPY.turnOff);
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
    expect(html(status({ pages: [page({ messenger: { available: false, enabled: false } })] }))).toContain(DM_COPY.needsAccess);
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
