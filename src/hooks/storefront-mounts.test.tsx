import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The hooks run for real against a recording api, so the paths and bodies are what is asserted.
const calls = vi.hoisted(() => [] as Array<{ verb: string; path: string; body?: unknown }>);
vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  const rec = (verb: string) => async (path: string, body?: unknown) => {
    calls.push({ verb, path, body });
    return {};
  };
  return { ...real, api: { get: rec("get"), post: rec("post"), delete: rec("delete") } };
});
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz1" } }) }));

const hooks = await import("./use-wa-conversations");

function grab<T>(use: () => T): T {
  let out: T | undefined;
  const qc = new QueryClient();
  function Probe() {
    out = use();
    return null;
  }
  renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  );
  return out as T;
}
const last = () => calls[calls.length - 1]!;
const SF = "storefront:abc";
const WA = "whatsapp:1:2";

describe("a storefront thread is sent to its own mount", () => {
  it("Take over", async () => {
    await grab(() => hooks.useWaHandoff()).mutateAsync(SF);
    expect(last()).toMatchObject({ verb: "post", path: "/v1/storefront-chats/storefront%3Aabc/handoff" });
  });
  it("Resume sends the statusVersion the view rendered", async () => {
    await grab(() => hooks.useWaResume()).mutateAsync({ threadId: SF, thread: { statusVersion: 7 } as never });
    expect(last()).toMatchObject({ path: "/v1/storefront-chats/storefront%3Aabc/resume", body: { statusVersion: 7 } });
  });
  it("Reply is text, trimmed, under the idempotency key", async () => {
    await grab(() => hooks.useWaReply(SF)).mutateAsync({ payload: { kind: "text", text: " hello " }, idempotencyKey: "key-1" });
    expect(last()).toMatchObject({ path: "/v1/storefront-chats/storefront%3Aabc/reply", body: { text: "hello", idempotencyKey: "key-1" } });
  });
  it("a non-text reply for a storefront chat is refused before any request (never the WhatsApp mount)", async () => {
    const before = calls.length;
    await expect(grab(() => hooks.useWaReply(SF)).mutateAsync({ payload: { kind: "checkout", items: [] } as never, idempotencyKey: "k" })).rejects.toThrow(/text replies only/);
    expect(calls.length).toBe(before);
  });
  it("Suggest a reply, Refresh summary and Delete data", async () => {
    await grab(() => hooks.useSuggestReply(SF)).mutateAsync();
    expect(last().path).toBe("/v1/storefront-chats/storefront%3Aabc/suggest-reply");
    await grab(() => hooks.useRefreshSummary(SF)).mutateAsync();
    expect(last().path).toBe("/v1/storefront-chats/storefront%3Aabc/summary");
    await grab(() => hooks.useDeleteContactData()).mutateAsync(SF);
    expect(last()).toMatchObject({ verb: "delete", path: "/v1/storefront-chats/storefront%3Aabc/contact-data" });
  });
});

describe("a WhatsApp thread keeps its mount", () => {
  it("handoff, resume, suggest, summary, delete", async () => {
    await grab(() => hooks.useWaHandoff()).mutateAsync(WA);
    expect(last().path).toBe("/v1/meta/whatsapp/conversations/whatsapp%3A1%3A2/handoff");
    await grab(() => hooks.useWaResume()).mutateAsync({ threadId: WA, thread: { statusVersion: 2 } as never });
    expect(last()).toMatchObject({ path: "/v1/meta/whatsapp/conversations/whatsapp%3A1%3A2/resume", body: { statusVersion: 2 } });
    await grab(() => hooks.useSuggestReply(WA)).mutateAsync();
    expect(last().path).toBe("/v1/meta/whatsapp/conversations/whatsapp%3A1%3A2/suggest-reply");
    await grab(() => hooks.useRefreshSummary(WA)).mutateAsync();
    expect(last().path).toBe("/v1/meta/whatsapp/conversations/whatsapp%3A1%3A2/customer/summary");
    await grab(() => hooks.useDeleteContactData()).mutateAsync(WA);
    expect(last().path).toBe("/v1/meta/whatsapp/conversations/whatsapp%3A1%3A2/contact-data");
  });
});
