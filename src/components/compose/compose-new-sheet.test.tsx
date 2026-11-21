// @vitest-environment jsdom
/**
 * <ComposeNewSheet/>: the picker, and a channel chosen for the merchant. The composers are stubbed to a marker (they have their own
 * tests); what is asserted is WHICH one opens, and that "Change channel" still returns to the picker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ integrations: [] as unknown[] }));

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(async () => ({ integrations: h.integrations })) },
  ApiError: class extends Error {},
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/brand/channel-icon", () => ({ ChannelIconCompact: () => null }));
vi.mock("@/app/(site)/dashboard/content/linkedin/_components/post-composer", () => ({ PostComposer: () => <div data-composer="linkedin" /> }));
vi.mock("@/app/(site)/dashboard/content/linkedin/_components/composer-identity", () => ({
  PostComposerSkeleton: () => <div data-composer="loading" />,
  useLinkedInIdentity: () => ({ isLoading: false, data: { id: "me" } }),
}));
vi.mock("@/app/(site)/dashboard/content/x/_components/tweet-composer", () => ({ TweetComposer: () => <div data-composer="x" /> }));
vi.mock("@/app/(site)/dashboard/calendar/_components/meta-composer", () => ({
  MetaComposer: ({ channel, postingTo }: { channel: string; postingTo: string | null }) => (
    <div data-composer={channel} data-posting-to={postingTo ?? ""} />
  ),
}));

const { ComposeNewSheet } = await import("./compose-new-sheet");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const THREADS_ROW = { provider: "threads", connected: true, account: { name: "Acme", extra: { username: "acme" } } };

let host: HTMLDivElement;
let root: Root;

let client: QueryClient;
async function mount(props: { channel?: Parameters<typeof ComposeNewSheet>[0]["channel"] }) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <ComposeNewSheet open onOpenChange={() => {}} {...props} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const composer = () => document.body.querySelector("[data-composer]")?.getAttribute("data-composer") ?? null;
const bodyText = () => document.body.textContent ?? "";

beforeEach(() => {
  h.integrations = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("ComposeNewSheet preselection", () => {
  it("with no channel it asks which one", async () => {
    await mount({});
    expect(composer()).toBeNull();
    expect(bodyText()).toContain("Pick a channel");
  });

  it("with channel=x it opens the X composer, not the picker", async () => {
    await mount({ channel: "x" });
    expect(composer()).toBe("x");
    expect(bodyText()).toContain("New post on X (Twitter)");
  });

  it("with channel=linkedin it opens the LinkedIn composer", async () => {
    await mount({ channel: "linkedin" });
    expect(composer()).toBe("linkedin");
  });

  it("a connected Meta channel opens once the connection list has loaded, naming where it posts", async () => {
    h.integrations = [THREADS_ROW];
    await mount({ channel: "threads" });
    expect(composer()).toBe("threads");
    expect(document.body.querySelector("[data-composer]")?.getAttribute("data-posting-to")).toBe("Posting to @acme");
  });

  it("a Meta channel that is not connected falls back to the picker with the way to connect", async () => {
    await mount({ channel: "facebook" });
    expect(composer()).toBeNull();
    expect(bodyText()).toContain("Pick a channel");
    expect(document.body.querySelector('a[href="/dashboard/integrations"]')).not.toBeNull();
  });

  it("an unconnected Instagram shows the picker; a later refetch that adds Instagram does NOT auto-open it", async () => {
    await mount({ channel: "instagram" });
    expect(composer()).toBeNull();
    h.integrations = [{ provider: "instagram", connected: true, account: { name: "Acme", extra: {} } }];
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["content-hub-integrations"] });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(composer()).toBeNull();
    expect(bodyText()).toContain("Instagram");
  });

  it("Change channel returns to the picker and the preselection does not reapply", async () => {
    await mount({ channel: "x" });
    const change = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes("Change channel"))!;
    await act(async () => change.click());
    expect(composer()).toBeNull();
    expect(bodyText()).toContain("Pick a channel");
  });
});
