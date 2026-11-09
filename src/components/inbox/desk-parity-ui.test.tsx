// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act, useEffect, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import type { Insight } from "@/lib/insights";

/**
 * Team desk parity (SA-10), driven as a person drives it: the Waiting pill, the priority flag, "Asha is viewing", the Mention picker, the
 * saved-views picker, the three new settings, the Restore on a dismissed insight, and the presence ping (cadence, hidden tab, leave).
 */

const api = vi.hoisted(() => ({ put: vi.fn(), delete: vi.fn(), get: vi.fn(), post: vi.fn() }));
const dismissal = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, isError: false, variables: undefined as { key: string; restore?: boolean } | undefined }));
vi.mock("@/lib/api", () => ({ api, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { _id: "me", name: "Ada", preferences: {} }, org: { _id: "o1" }, orgs: [], business: { _id: "b1" } }) }));
vi.mock("@/hooks/use-insights", () => ({ useInsights: () => ({ data: undefined }), useInsightDismissal: () => dismissal }));
vi.mock("@/hooks/use-knowledge-base", () => ({ useKbRequests: () => ({ isPending: false, isError: false, data: { requests: [] } }), useAnswerKbRequest: () => ({}), useDismissKbRequest: () => ({}) }));
vi.mock("@/hooks/use-commerce-stores", () => ({ useCommerceStores: () => ({ data: [] }) }));
vi.mock("@/components/inbox/support-results-panel", () => ({ SupportResultsPanel: () => null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({}), usePathname: () => "/dashboard/inbox" }));

const { StatusPill } = await import("./inbox-badges");
const { PriorityBadge, ViewersText } = await import("./desk-badges");
const { DeskControlsView } = await import("./desk-controls");
const { NotesPanelView } = await import("./notes-panel");
const { NoteCard } = await import("./note-card");
const { SavedViewsView } = await import("./saved-views");
const { TeamDeskFormView } = await import("./team-desk-card");
const { DismissedItems } = await import("./insights-pane");
const { usePresence } = await import("@/hooks/use-inbox-desk");
const { formFromSettings, viewersLine } = await import("@/lib/inbox-desk");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};
const team = [
  { userId: "me", name: "Ada Lovelace", role: "editor" },
  { userId: "u2", name: "Bo Diddley", role: "admin" },
];
const tags = [{ id: "t1", name: "VIP" }];

describe("the Waiting pill and the priority flag", () => {
  it("Waiting on customer is its own pill, ahead of the plain status, behind Done and Needs you", () => {
    expect(renderToStaticMarkup(<StatusPill status="escalated" state="waiting" />)).toContain("Waiting on customer");
    expect(renderToStaticMarkup(<StatusPill status="escalated" state="waiting" needsYou />)).toContain("Needs you");
    expect(renderToStaticMarkup(<StatusPill status="escalated" state="done" />)).toContain("Done");
    expect(renderToStaticMarkup(<StatusPill status="escalated" state="open" />)).toContain("With a human");
  });
  it("only a high priority conversation carries a badge", () => {
    expect(renderToStaticMarkup(<PriorityBadge priority="high" />)).toContain("High priority");
    expect(renderToStaticMarkup(<PriorityBadge priority="normal" />)).toBe("");
    expect(renderToStaticMarkup(<PriorityBadge priority={undefined} />)).toBe("");
  });
  it("the viewers line is drawn only when there is one", () => {
    expect(renderToStaticMarkup(<ViewersText line="Asha is viewing" />)).toContain("Asha is viewing");
    expect(renderToStaticMarkup(<ViewersText line={null} />)).toBe("");
  });
});

describe("the thread header controls", () => {
  function controls(over: Partial<ComponentProps<typeof DeskControlsView>> = {}) {
    return renderToStaticMarkup(
      <DeskControlsView canWork canCreateTag={false} assignee={null} me="me" team={team} tags={tags} tagIds={[]} busy={false} onAssign={noop} onToggleTag={noop} onCreateTag={async () => null} {...over} />,
    );
  }
  it("an editor gets a Flag button that says what it will do, and it reflects the state", () => {
    const normal = controls({ priority: "normal", onPriority: noop });
    expect(normal).toContain('aria-label="Flag as high priority"');
    expect(normal).toContain('aria-pressed="false"');
    const high = controls({ priority: "high", onPriority: noop });
    expect(high).toContain('aria-label="Remove high priority"');
    expect(high).toContain('aria-pressed="true"');
  });
  it("★a viewer sees the flag and who is there, and no control to change it", () => {
    const h = controls({ canWork: false, priority: "high", onPriority: noop, viewers: [{ userId: "u2", name: "Bo Diddley", replying: false }] });
    expect(h).toContain("High priority");
    expect(h).not.toContain("Flag as high priority");
    expect(h).not.toContain("Remove high priority");
    expect(h).toContain("Bo Diddley is viewing");
  });
  it("names the other people there and never the signed-in person", () => {
    const h = controls({ viewers: [{ userId: "me", name: "Ada Lovelace", replying: false }, { userId: "u2", name: "Bo Diddley", replying: true }] });
    expect(h).toContain("Bo Diddley is replying");
    expect(h).not.toContain("Ada Lovelace is");
  });
});

describe("notes with mentions", () => {
  const panel = (over: Partial<ComponentProps<typeof NotesPanelView>> = {}) =>
    renderToStaticMarkup(
      <NotesPanelView notes={[]} label="Note" me="me" role="editor" state="ready" body="" onBody={noop} saving={false} onAdd={noop} onDelete={noop} deletingId={null} error={null} {...over} />,
    );
  it("an editor gets a Mention picker once the team is known, and a viewer none", () => {
    expect(panel({ team, onMention: noop })).toContain('aria-label="Mention a teammate"');
    expect(panel()).not.toContain("Mention a teammate");
    expect(panel({ role: "viewer", team, onMention: noop })).not.toContain("Mention a teammate");
  });
  it("the Mention picker is disabled when the only teammate is you", () => {
    expect(panel({ team: [team[0]!], onMention: noop })).toMatch(/aria-label="Mention a teammate"[^>]*disabled|disabled[^>]*aria-label="Mention a teammate"/);
  });
  it("a saved note names the people it mentioned", () => {
    const notes = [{ id: "n1", body: "please look @Bo Diddley", authorUserId: "me", authorName: "Ada", createdAt: "2026-11-06T10:00:00Z", mentions: ["u2"] }];
    expect(panel({ notes, team })).toContain("Mentioned: Bo Diddley");
    expect(renderToStaticMarkup(<NoteCard body="x" author="Ada" time="10:00" mentions={[]} />)).not.toContain("Mentioned");
  });
});

describe("saved views", () => {
  const views = [
    { id: "v1", name: "Urgent delivery", filters: { status: "open" as const, priority: "high" as const, topic: "delivery_times" }, createdAt: "2026-11-06T00:00:00Z" },
    { id: "v2", name: "Waiting", filters: { status: "waiting" as const }, createdAt: "2026-11-06T00:00:00Z" },
  ];
  const page = { status: "open" as const, assignee: "all" as const, tag: null, topic: null, priority: "all" as const, channel: "all" };
  const view = (over: Partial<ComponentProps<typeof SavedViewsView>> = {}) =>
    renderToStaticMarkup(<SavedViewsView views={views} page={page} canEdit tags={tags} busy={false} error={null} onApply={noop} onSave={async () => null} onDelete={noop} {...over} />);

  it("lists the views and offers Save view to an editor", () => {
    const h = view();
    expect(h).toContain("Urgent delivery");
    expect(h).toContain("Waiting");
    expect(h).toContain("Save view");
  });
  it("★a viewer can open a view but not save or delete one; with no views and no right to save there is nothing at all", () => {
    const h = view({ canEdit: false });
    expect(h).toContain("Urgent delivery");
    expect(h).not.toContain("Save view");
    expect(h).not.toContain("Delete the view");
    expect(view({ canEdit: false, views: [] })).toBe("");
  });
  it("★a view for one named teammate is listed but disabled, so it is never opened as something broader", () => {
    const h = view({ views: [...views, { id: "v3", name: "One teammate", filters: { status: "open" as const, assignee: "a".repeat(24) }, createdAt: "2026-11-06T00:00:00Z" }] });
    expect(h).toMatch(/<option[^>]*value="v3"[^>]*disabled|<option[^>]*disabled[^>]*value="v3"/);
    expect(h).not.toMatch(/<option[^>]*value="v1"[^>]*disabled/);
  });
  it("marks the view the page is showing, and offers to delete exactly that one", () => {
    const h = view({ page: { ...page, priority: "high", topic: "delivery_times" } });
    expect(h).toMatch(/<option[^>]*value="v1"[^>]*>/);
    expect(h).toContain("Delete the view Urgent delivery");
    expect(view()).not.toContain("Delete the view");
  });
});

describe("the three new settings in the form", () => {
  const form = formFromSettings(
    {
      aiPaused: false,
      aiPausedAt: null,
      autoAssign: { enabled: false, availableUserIds: [] },
      autoClose: { enabled: true, days: 10 },
      smartTags: { enabled: true, map: [{ topic: "returns", tagId: "t1" }] },
      channelRouting: { enabled: true, rules: [{ channel: "whatsapp", userIds: ["u2"] }] },
      firstResponseMinutes: 15,
      hours: null,
      awayMessage: null,
    },
    "UTC",
  );
  const render = (over: Partial<ComponentProps<typeof TeamDeskFormView>> = {}) =>
    renderToStaticMarkup(
      <TeamDeskFormView
        form={form}
        onChange={noop}
        canEdit
        team={team}
        defaults={{ awayMessage: "Away", opensToken: "{opens}" }}
        error={null}
        saving={false}
        onSave={noop}
        zones={["UTC"]}
        tags={tags}
        topics={[{ key: "returns", title: "Customers ask about returns" }]}
        {...over}
      />,
    );
  it("shows each section with its saved values", () => {
    const h = render();
    expect(h).toContain("Route by channel");
    expect(h).toContain("Close quiet conversations");
    expect(h).toContain("Tag conversations by topic");
    expect(h).toContain('value="10"');
    expect(h).toContain("Customers ask about returns");
    expect(h).toContain("VIP");
  });
  it("★is read-only for a teammate: the values are shown, no control to add or remove", () => {
    const h = render({ canEdit: false });
    expect(h).toContain("Close quiet conversations");
    expect(h).not.toContain("Add an automatic tag");
    expect(h).not.toContain("Remove WhatsApp");
    expect(h).not.toContain("Add a channel");
  });
  it("the sections say they are off by default and what they do to the customer", () => {
    const h = render();
    expect(h).toContain("The customer is told nothing");
    expect(h.match(/Off by default/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("a rule never shows blank when Insights no longer lists its topic", () => {
    expect(render({ topics: [] })).toContain("returns");
  });
});

describe("Restore on a dismissed insight", () => {
  let root: Root | null = null;
  let host: HTMLElement;
  const item = (key: string): Insight =>
    ({ key, type: "missing_store_info", title: `Title ${key}`, count: 3, shopperDays: 3, trend: "flat", why: "", nextStep: { label: "", kind: "none" }, status: "dismissed", evidence: { available: 1, expired: 0 }, surfaces: [], lastAskedAt: "" }) as Insight;
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    host?.remove();
    dismissal.mutate.mockReset();
  });
  async function mount(node: React.ReactNode) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(node));
  }
  it("is closed until opened, then a Restore per item calls the api's restore for that key", async () => {
    await mount(<DismissedItems items={[item("delivery_times"), item("returns")]} />);
    expect(host.textContent).toContain("Dismissed");
    expect(host.textContent).not.toContain("Restore");
    await act(async () => host.querySelector("button")!.click());
    const buttons = [...host.querySelectorAll("button")].filter((b) => b.textContent === "Restore");
    expect(buttons).toHaveLength(2);
    await act(async () => buttons[1]!.click());
    expect(dismissal.mutate).toHaveBeenCalledTimes(1);
    expect(dismissal.mutate).toHaveBeenCalledWith({ key: "returns", restore: true });
  });
});

describe("the presence ping", () => {
  let root: Root | null = null;
  let host: HTMLElement;
  const out: { seen: ReturnType<typeof usePresence> } = { seen: null };
  function Probe({ threadId, replying }: { threadId: string | null; replying: boolean }) {
    const viewers = usePresence(threadId, replying);
    // read back by the test after the render has committed
    useEffect(() => {
      out.seen = viewers;
    });
    return null;
  }
  const mount = async (threadId: string | null, replying = false) => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient();
    await act(async () => root!.render(<QueryClientProvider client={qc}><Probe threadId={threadId} replying={replying} /></QueryClientProvider>));
  };
  const rerender = async (threadId: string | null, replying = false) => {
    const qc = new QueryClient();
    await act(async () => root!.render(<QueryClientProvider client={qc}><Probe threadId={threadId} replying={replying} /></QueryClientProvider>));
  };
  beforeEach(() => {
    vi.useFakeTimers();
    out.seen = null;
    api.put.mockReset().mockResolvedValue({ viewers: [{ userId: "u2", name: "Bo", replying: false }] });
    api.delete.mockReset().mockResolvedValue({ cleared: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    host?.remove();
    vi.useRealTimers();
  });

  it("pings at once, then every 20 seconds, and returns the people the api names", async () => {
    await mount("whatsapp:1:abc");
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith("/v1/inbox-desk/threads/whatsapp%3A1%3Aabc/presence", { replying: false });
    expect(viewersLine(out.seen, "me")).toBe("Bo is viewing");
    await act(async () => void (await vi.advanceTimersByTimeAsync(20_000)));
    expect(api.put).toHaveBeenCalledTimes(2);
    await act(async () => void (await vi.advanceTimersByTimeAsync(40_000)));
    expect(api.put).toHaveBeenCalledTimes(4);
  });
  it("★a hidden tab does not ping, and pings again the moment it is visible", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await mount("whatsapp:1:abc");
    await act(async () => void (await vi.advanceTimersByTimeAsync(60_000)));
    expect(api.put).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    await act(async () => void document.dispatchEvent(new Event("visibilitychange")));
    expect(api.put).toHaveBeenCalledTimes(1);
  });
  it("says whether the person is typing at the next ping", async () => {
    await mount("whatsapp:1:abc", false);
    await rerender("whatsapp:1:abc", true);
    await act(async () => void (await vi.advanceTimersByTimeAsync(20_000)));
    expect(api.put).toHaveBeenLastCalledWith(expect.any(String), { replying: true });
    // the effect did not restart for a typing change: one immediate ping plus one on the clock
    expect(api.put).toHaveBeenCalledTimes(2);
  });
  it("★closing the conversation stops the pings and sends a best-effort leave; opening another pings that one and never shows the first one's people", async () => {
    await mount("whatsapp:1:aaa");
    expect(out.seen).not.toBeNull();
    api.put.mockResolvedValue({ viewers: [] });
    await rerender("whatsapp:1:bbb");
    expect(api.delete).toHaveBeenCalledWith("/v1/inbox-desk/threads/whatsapp%3A1%3Aaaa/presence");
    expect(api.put).toHaveBeenLastCalledWith("/v1/inbox-desk/threads/whatsapp%3A1%3Abbb/presence", { replying: false });
    await rerender(null);
    expect(api.delete).toHaveBeenLastCalledWith("/v1/inbox-desk/threads/whatsapp%3A1%3Abbb/presence");
    const calls = api.put.mock.calls.length;
    await act(async () => void (await vi.advanceTimersByTimeAsync(60_000)));
    expect(api.put.mock.calls.length).toBe(calls);
    expect(out.seen).toBeNull();
  });
  it("a failed ping keeps the last answer and is not an error", async () => {
    await mount("whatsapp:1:abc");
    api.put.mockRejectedValue(new Error("offline"));
    await act(async () => void (await vi.advanceTimersByTimeAsync(20_000)));
    expect(viewersLine(out.seen, "me")).toBe("Bo is viewing");
  });
  it("a state hook in the probe's parent does not restart the ping", async () => {
    function Parent() {
      const [n, setN] = useState(0);
      return (
        <>
          <button onClick={() => setN(n + 1)}>{n}</button>
          <Probe threadId="whatsapp:1:abc" replying={false} />
        </>
      );
    }
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<QueryClientProvider client={new QueryClient()}><Parent /></QueryClientProvider>));
    await act(async () => host.querySelector("button")!.click());
    await act(async () => host.querySelector("button")!.click());
    expect(api.put).toHaveBeenCalledTimes(1);
  });
});
