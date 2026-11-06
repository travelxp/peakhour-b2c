// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { StorefrontThread } from "@/hooks/use-wa-conversations";
import { createComposerStore } from "@/lib/wa-inbox-reply";

/**
 * Inbox polish (SA-12), driven as a person drives it: Resume the assistant with a reply written and not sent, and the saved-views
 * control when the read failed and when Delete is pressed.
 */

const h = vi.hoisted(() => ({
  refetch: vi.fn(),
  views: { isError: false, isSuccess: false, data: undefined as undefined | { views: unknown[] } },
  resume: vi.fn(),
  mutation: { isPending: false, mutate: () => {}, mutateAsync: async () => ({}) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-wa-conversations", () => ({
  useInboxPrices: () => ({ data: { customerSummary: 10, suggestReply: 5 }, isSuccess: true }),
  useRefreshSummary: () => h.mutation,
  useSuggestReply: () => h.mutation,
  useWaReply: () => h.mutation,
  useWaHandoff: () => h.mutation,
  useWaResume: () => ({ isPending: false, mutate: h.resume }),
}));

vi.mock("@/hooks/use-inbox-desk", () => ({
  useSavedViews: () => ({ ...h.views, refetch: h.refetch }),
  useDeskTags: () => ({ data: { tags: [] } }),
  useViewAdmin: () => ({ save: { isPending: false, mutateAsync: async () => ({}) }, remove: { isPending: false, mutateAsync: async () => ({}) } }),
}));

const { StorefrontFooter } = await import("./storefront-live");
const { SavedViewsView, SavedViews } = await import("./saved-views");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = "";
  h.resume.mockReset();
  h.refetch.mockReset();
});
function mount(el: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(el));
}
const press = (label: RegExp | string) => {
  const b = Array.from(document.body.querySelectorAll("button")).find((x) => (typeof label === "string" ? x.textContent === label : label.test(x.textContent ?? "")));
  if (!b) throw new Error(`no button ${String(label)}; have: ${Array.from(document.body.querySelectorAll("button")).map((x) => x.textContent).join(" | ")}`);
  act(() => b.click());
};
const has = (text: string) => (document.body.textContent ?? "").includes(text);

const thread: StorefrontThread = {
  threadId: "storefront:abc",
  channel: "storefront",
  contactName: "Storefront visitor",
  status: "escalated",
  readOnly: false,
  statusVersion: 3,
  delivery: "visitor_away",
  messages: [],
  handover: null,
  summary: undefined,
  contactEmail: null,
  hasContactEmail: false,
} as unknown as StorefrontThread;

describe("Resume the assistant with a reply written and not sent", () => {
  it("asks first, and hands back only when the person says so", () => {
    const store = createComposerStore();
    store.update(thread.threadId, { text: "Hi, I am looking into it" });
    mount(<StorefrontFooter thread={thread} role="editor" store={store} />);
    press("Resume the assistant");
    expect(has("Hand back with a reply unsent?")).toBe(true);
    expect(h.resume).not.toHaveBeenCalled();
    press("Hand back anyway");
    expect(h.resume).toHaveBeenCalledTimes(1);
  });
  it("Keep writing leaves the chat with the team and the draft where it was", () => {
    const store = createComposerStore();
    store.update(thread.threadId, { text: "Hi" });
    mount(<StorefrontFooter thread={thread} role="editor" store={store} />);
    press("Resume the assistant");
    press("Keep writing");
    expect(h.resume).not.toHaveBeenCalled();
    expect(store.get(thread.threadId).text).toBe("Hi");
    expect(has("Hand back with a reply unsent?")).toBe(false);
  });
  it("an empty or whitespace box hands back at once, with nothing to ask", () => {
    const store = createComposerStore();
    store.update(thread.threadId, { text: "   " });
    mount(<StorefrontFooter thread={thread} role="editor" store={store} />);
    press("Resume the assistant");
    expect(has("Hand back with a reply unsent?")).toBe(false);
    expect(h.resume).toHaveBeenCalledTimes(1);
  });
});

describe("the saved-views control", () => {
  const views = [{ id: "v1", name: "Urgent delivery", filters: { status: "open" as const, priority: "high" as const }, createdAt: "2026-11-06T00:00:00Z" }];
  const open = { status: "open" as const, assignee: "all" as const, tag: null, topic: null, priority: "high" as const, channel: "all" };
  const base = { views, page: open, canEdit: true, tags: [], busy: false, error: null, onApply: () => {}, onSave: async () => null };

  it("Delete asks first and removes nothing until it is confirmed", () => {
    const onDelete = vi.fn();
    mount(<SavedViewsView {...base} onDelete={onDelete} />);
    press(/^$/); // the trash icon button has no text; it is the first one
    expect(has("for your whole team?")).toBe(true);
    expect(onDelete).not.toHaveBeenCalled();
    press("Keep it");
    expect(onDelete).not.toHaveBeenCalled();
    expect(has("for your whole team?")).toBe(false);
    press(/^$/);
    press("Delete");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0]![0]).toMatchObject({ id: "v1" });
  });
  it("the question is withdrawn when the filters move off the view it asked about", () => {
    mount(<SavedViewsView {...base} onDelete={() => {}} />);
    press(/^$/);
    expect(has("for your whole team?")).toBe(true);
    act(() => root!.render(<SavedViewsView {...base} page={{ ...open, priority: "all" }} onDelete={() => {}} />));
    expect(has("for your whole team?")).toBe(false);
    // and does not come back when the filters return to that view
    act(() => root!.render(<SavedViewsView {...base} onDelete={() => {}} />));
    expect(has("for your whole team?")).toBe(false);
  });
  it("a failed read says so and offers Try again, instead of drawing nothing", () => {
    const onRetry = vi.fn();
    mount(<SavedViewsView {...base} views={[]} canEdit={false} loadFailed onRetry={onRetry} onDelete={() => {}} />);
    expect(has("Saved views could not be loaded.")).toBe(true);
    press("Try again");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("with no failure and nothing to show, a viewer sees nothing at all", () => {
    mount(<SavedViewsView {...base} views={[]} canEdit={false} onDelete={() => {}} />);
    expect(host!.textContent).toBe("");
  });
});

describe("the wired saved-views control", () => {
  const page = { status: "open" as const, assignee: "all" as const, tag: null, topic: null, priority: "all" as const, channel: "all" };
  it("a failed read is said, and Try again asks the query again", () => {
    h.views.isError = true;
    h.views.isSuccess = false;
    h.views.data = undefined;
    mount(<SavedViews role="viewer" page={page} onApply={() => {}} />);
    expect(has("Saved views could not be loaded.")).toBe(true);
    press("Try again");
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });
  it("views already read stay on screen when a later refresh fails", () => {
    h.views.isError = true;
    h.views.isSuccess = false;
    h.views.data = { views: [{ id: "v1", name: "Urgent", filters: { status: "open" }, createdAt: "2026-11-06T00:00:00Z" }] };
    mount(<SavedViews role="editor" page={page} onApply={() => {}} />);
    expect(has("Urgent")).toBe(true);
    expect(has("Saved views could not be loaded.")).toBe(false);
  });
  it("a good read says nothing about failure", () => {
    h.views.isError = false;
    h.views.isSuccess = true;
    h.views.data = { views: [] };
    mount(<SavedViews role="editor" page={page} onApply={() => {}} />);
    expect(has("could not be loaded")).toBe(false);
  });
  it("Try again does not make the message vanish while the retry is in flight, and a success clears it", () => {
    h.views.isError = true;
    h.views.isSuccess = false;
    h.views.data = undefined;
    mount(<SavedViews role="viewer" page={page} onApply={() => {}} />);
    expect(has("Saved views could not be loaded.")).toBe(true);
    // react-query v5: a refetch with no data resets the error while it runs
    h.views.isError = false;
    act(() => root!.render(<SavedViews role="viewer" page={page} onApply={() => {}} />));
    expect(has("Saved views could not be loaded.")).toBe(true);
    // the retry succeeds
    h.views.isSuccess = true;
    h.views.data = { views: [{ id: "v1", name: "Urgent", filters: { status: "open" }, createdAt: "2026-11-06T00:00:00Z" }] };
    act(() => root!.render(<SavedViews role="viewer" page={page} onApply={() => {}} />));
    expect(has("Saved views could not be loaded.")).toBe(false);
    expect(has("Urgent")).toBe(true);
  });
});
