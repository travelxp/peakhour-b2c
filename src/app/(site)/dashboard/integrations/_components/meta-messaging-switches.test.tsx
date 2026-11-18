// @vitest-environment jsdom
/** The Messenger and Instagram switches on the Facebook Pages card. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DmStatus } from "@/lib/meta-dm";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get: h.get, post: h.post }, API_BASE_URL: "https://api.example" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: h.error } }));

const { MetaMessagingSwitches } = await import("./meta-messaging-switches");

const page = (over: Record<string, unknown> = {}) => ({
  pageId: "1001",
  pageName: "Acme",
  instagramUsername: "acme",
  connectionId: "c1",
  messenger: { available: true, enabled: true },
  instagram: { available: true, enabled: false },
  ...over,
});
const status = (over: Partial<DmStatus> = {}): DmStatus => ({
  channels: { messenger: true, instagram: true },
  connected: true,
  needsReauth: false,
  savedPageId: "1001",
  missingPermissions: {},
  pages: [page(), page({ pageId: "1002", pageName: "Other", instagramUsername: null, connectionId: "c2", messenger: { available: true, enabled: false } })],
  ...over,
});

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient();
  h.get.mockReset();
  h.post.mockReset();
  h.error.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(s: DmStatus | null, pageId: string | null = "1001") {
  if (s) h.get.mockResolvedValue(s);
  else h.get.mockRejectedValue(new Error("404"));
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MetaMessagingSwitches pageId={pageId} />
      </QueryClientProvider>,
    );
  });
  // let the status query settle and the view render it
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
async function remount(s: DmStatus | null, pageId: string | null = "1001") {
  act(() => root.unmount());
  root = createRoot(container);
  client = new QueryClient();
  await mount(s, pageId);
}
const sw = (name: "messenger" | "instagram") => container.querySelector(`[data-testid="dm-row-${name}"] [role="switch"]`) as HTMLButtonElement | null;
const why = (name: "messenger" | "instagram") => container.querySelector(`[data-testid="dm-why-${name}"]`)?.textContent ?? null;

describe("MetaMessagingSwitches", () => {
  it("shows a labelled switch per channel, on and off as the api says, with the one-line note", async () => {
    await mount(status());
    expect(sw("messenger")!.getAttribute("aria-checked")).toBe("true");
    expect(sw("instagram")!.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("Messenger messages");
    expect(container.textContent).toContain("Instagram messages (@acme)");
    expect(container.textContent).toContain("Turning this off stops new messages reaching your Inbox. Past conversations stay.");
    expect(container.querySelector('label[for="dm-switch-1001-messenger"]')).not.toBeNull();
  });

  it("renders nothing without a status answer, without the Page, or when no channel is released", async () => {
    await mount(null);
    expect(container.innerHTML).toBe("");
    await remount(status(), "9999");
    expect(container.innerHTML).toBe("");
    await remount(status({ channels: { messenger: false, instagram: false } }));
    expect(container.innerHTML).toBe("");
  });

  it("a channel that is not released has no switch", async () => {
    await mount(status({ channels: { messenger: true, instagram: false } }));
    expect(sw("messenger")).not.toBeNull();
    expect(sw("instagram")).toBeNull();
  });

  it("no Instagram linked: disabled, with the plain line", async () => {
    await mount(status(), "1002");
    expect(sw("instagram")!.disabled).toBe(true);
    expect(why("instagram")).toBe("No Instagram account is linked to this Page.");
    expect(container.textContent).toContain("Instagram messages");
    expect(container.textContent).not.toContain("(@");
  });

  it("no messaging access: disabled, says why, and Reconnect Meta points at the messaging login", async () => {
    await mount(status({ pages: [page({ messenger: { available: false, enabled: false } })] }));
    expect(sw("messenger")!.disabled).toBe(true);
    expect(why("messenger")).toContain("Meta did not give Peakhour messaging access.");
    const link = container.querySelector('[data-testid="dm-why-messenger"] a') as HTMLAnchorElement;
    expect(link.textContent).toBe("Reconnect Meta");
    expect(link.getAttribute("href")).toBe("https://api.example/v1/integrations/facebook/authorize?messaging=1&returnTo=%2Fdashboard%2Fintegrations");
  });

  it("another Peakhour business uses the Page: disabled with that line and no Reconnect", async () => {
    await mount(status({ pages: [page({ messenger: { available: true, enabled: false, otherBusiness: true } })] }));
    expect(sw("messenger")!.disabled).toBe(true);
    expect(why("messenger")).toContain("Another Peakhour business");
    expect(container.querySelector('[data-testid="dm-why-messenger"] a')).toBeNull();
  });

  it("an enabled channel can always be switched off, and shows no reason", async () => {
    await mount(status({ pages: [page({ messenger: { available: false, enabled: true } })] }));
    expect(sw("messenger")!.disabled).toBe(false);
    expect(why("messenger")).toBeNull();
  });

  it("turning on posts connect for the saved Page and re-reads the status", async () => {
    await mount(status());
    h.post.mockResolvedValue({});
    const before = h.get.mock.calls.length;
    await act(async () => sw("instagram")!.click());
    expect(h.post).toHaveBeenCalledWith("/v1/meta/dm/connect", { pageId: "1001", channel: "instagram", connectionId: "c1" });
    expect(h.get.mock.calls.length).toBeGreaterThan(before);
  });

  it("turning off posts disconnect", async () => {
    await mount(status());
    h.post.mockResolvedValue({});
    await act(async () => sw("messenger")!.click());
    expect(h.post).toHaveBeenCalledWith("/v1/meta/dm/disconnect", { pageId: "1001", channel: "messenger", connectionId: "c1" });
  });

  it("moves at once, disables both switches while saving, and rolls back with a plain toast on failure", async () => {
    await mount(status());
    let reject!: (e: unknown) => void;
    h.post.mockReturnValue(new Promise((_, r) => (reject = r)));
    await act(async () => sw("messenger")!.click());
    expect(sw("messenger")!.getAttribute("aria-checked")).toBe("false");
    expect(sw("messenger")!.disabled).toBe(true);
    expect(sw("instagram")!.disabled).toBe(true);
    await act(async () => reject(new Error("Meta said no.")));
    expect(sw("messenger")!.getAttribute("aria-checked")).toBe("true");
    expect(sw("messenger")!.disabled).toBe(false);
    expect(h.error).toHaveBeenCalledWith("Meta said no.");
  });

  it("an error with no message falls back to a plain sentence", async () => {
    await mount(status());
    h.post.mockRejectedValue({});
    await act(async () => sw("messenger")!.click());
    expect(h.error).toHaveBeenCalledWith("Couldn't change messages. Try again in a moment.");
  });

  it("follows a Page change", async () => {
    await mount(status(), "1001");
    expect(sw("messenger")!.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MetaMessagingSwitches pageId="1002" />
        </QueryClientProvider>,
      );
    });
    expect(sw("messenger")!.getAttribute("aria-checked")).toBe("false");
    h.post.mockResolvedValue({});
    await act(async () => sw("messenger")!.click());
    expect(h.post).toHaveBeenCalledWith("/v1/meta/dm/connect", expect.objectContaining({ pageId: "1002", connectionId: "c2" }));
  });
});
