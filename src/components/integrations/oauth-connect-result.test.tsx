// @vitest-environment jsdom
/**
 * The post-OAuth toast. ★A Meta connect that stored no Facebook Page, or no
 * Instagram-linked Page, must say what is missing instead of "Meta connected"
 * (dev, 2026-11-16: the Instagram card stayed on "Connect" beside a success).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => h.params,
  usePathname: () => "/dashboard/integrations",
  useRouter: () => ({ replace: h.replace }),
}));
vi.mock("sonner", () => ({ toast: { success: h.success, warning: h.warning } }));

const { OAuthConnectResult } = await import("./oauth-connect-result");
const { metaConnectNoticeMessage, parseMetaConnectNotice } = await import("@/lib/meta-connect-notice");
const { META_VIRTUAL_CARDS } = await import("@/lib/integrations-meta");

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  h.replace.mockReset();
  h.success.mockReset();
  h.warning.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(query: string) {
  h.params = new URLSearchParams(query);
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <OAuthConnectResult />
      </QueryClientProvider>,
    );
  });
}

describe("OAuthConnectResult", () => {
  it("a plain connect is a success", () => {
    mount("integration=connected&provider=facebook");
    expect(h.success).toHaveBeenCalledTimes(1);
    expect(h.warning).not.toHaveBeenCalled();
  });

  it("★no Page shared → the next step, not a success", () => {
    mount("integration=connected&provider=facebook&meta_notice=no_pages");
    expect(h.success).not.toHaveBeenCalled();
    expect(h.warning).toHaveBeenCalledTimes(1);
    expect(String(h.warning.mock.calls[0][0])).toMatch(/did not give Peakhour access to any Facebook Page/);
  });

  it("★a Page with no Instagram account → says to link one", () => {
    mount("integration=connected&provider=facebook&meta_notice=no_instagram");
    expect(String(h.warning.mock.calls[0][0])).toMatch(/no Instagram professional account linked/);
  });

  it("an unknown notice is ignored — a success, as before", () => {
    mount("integration=connected&provider=facebook&meta_notice=whatever");
    expect(h.success).toHaveBeenCalledTimes(1);
    expect(h.warning).not.toHaveBeenCalled();
  });

  it("strips meta_notice with its own params and keeps the surface's", () => {
    mount("channel=meta&integration=connected&provider=facebook&meta_notice=no_pages");
    expect(h.replace).toHaveBeenCalledWith("/dashboard/integrations?channel=meta", { scroll: false });
  });
});

describe("meta-connect-notice", () => {
  it("parses only the two codes", () => {
    expect(parseMetaConnectNotice("no_pages")).toBe("no_pages");
    expect(parseMetaConnectNotice("no_instagram")).toBe("no_instagram");
    expect(parseMetaConnectNotice(null)).toBeUndefined();
    expect(metaConnectNoticeMessage("")).toBeNull();
  });
});

describe("Instagram card summary", () => {
  const card = META_VIRTUAL_CARDS.find((c) => c.virtualProvider === "instagram")!;
  it("names the handle when the api read it", () => {
    expect(card.getResourceSummary({ pages: [{ pageName: "Shop", instagramAccountId: "1", instagramUsername: "shop" }] })).toBe("@shop");
  });
  it("★names the Page, never '@undefined', when the profile read failed", () => {
    expect(card.getResourceSummary({ pages: [{ pageName: "Shop", instagramAccountId: "1" }] })).toBe("Linked to Shop");
  });
});
