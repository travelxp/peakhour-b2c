// @vitest-environment jsdom
/**
 * W2-D: the form and the rule card for a recurring rule that writes a new post each time. The form shows the price in Peaks from the api and what to switch on first (with the
 * link to the card), offers only connected channels, and creates nothing until it is complete. The rule card says it writes a new post each time and shows a missed post as a note.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AutoWriteStatus } from "@/lib/auto-write";
import type { RecurringRuleDto } from "@/lib/scheduler/types";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), list: vi.fn(), create: vi.fn(), editorFreqs: [] as unknown[] }));
vi.mock("@/lib/api", () => ({ api: { get: h.get, post: h.post }, API_BASE_URL: "https://api.example", ApiError: class ApiError extends Error {} }));
vi.mock("@/lib/scheduler/client", () => ({
  scheduler: { listRecurringRules: h.list, createRecurringRule: h.create, pauseRecurringRule: vi.fn(), resumeRecurringRule: vi.fn() },
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: unknown }) => <a href={href} {...r}>{children as never}</a> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The editor's cadence list sits in a closed dropdown, so the form's choice of cadences is read from what it passes down.
vi.mock("@/components/scheduler/recurring-schedule-editor", () => ({
  RecurringScheduleEditor: ({ freqs }: { freqs?: readonly string[] }) => {
    h.editorFreqs.push(freqs);
    return <div data-testid="editor" />;
  },
}));
vi.mock("@/components/brand/channel-icon", () => ({ ChannelIconCompact: ({ channel }: { channel: string }) => <span data-icon={channel} /> }));

const { FreshRecurringFormView } = await import("./fresh-recurring-form");
const { RecurringPanel } = await import("./recurring-panel");
const { freshSetup } = await import("@/lib/fresh-recurring");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// the first render pulls in the time zone picker and the editor: slow on a cold start
vi.setConfig({ testTimeout: 30_000 });

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  for (const m of [h.get, h.post, h.list, h.create]) m.mockReset();
  h.editorFreqs.length = 0;
});

const status = (over: Partial<AutoWriteStatus> = {}, jobOver: Record<string, unknown> = {}): AutoWriteStatus => ({
  monthlyCapPeaks: 5000,
  usedPeaks: 0,
  remainingPeaks: 5000,
  month: "2026-11",
  weeklyPlan: { weekday: 1, count: 3 },
  runs: true,
  jobs: [{ job: "fresh_recurring", label: "Fresh recurring posts", what: "w", enabled: true, pricePerDraftPeaks: 225, acceptedPricePeaks: 225, needsReaccept: false, ...jobOver } as never],
  ...over,
});
const draft = (over: Record<string, unknown> = {}) => ({
  name: "Tuesday tip",
  topic: "A cooking tip",
  channels: ["linkedin" as const],
  rule: { freq: "weekly" as const, interval: 1, weekdays: [2], localTime: "09:00", timezone: "Asia/Kolkata", effectiveFrom: "2026-11-24T00:00:00.000Z" },
  ...over,
});

let client: QueryClient;
function mount(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
}
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

const view = (over: Record<string, unknown> = {}) => {
  const props = { draft: draft(), onDraft: vi.fn(), channels: [{ value: "linkedin" as const, label: "LinkedIn" }, { value: "x" as const, label: "X" }], setup: freshSetup(status()), busy: false, error: null, onSubmit: vi.fn(), onCancel: vi.fn(), ...over };
  mount(<FreshRecurringFormView {...(props as unknown as React.ComponentProps<typeof FreshRecurringFormView>)} />);
  return props;
};

describe("the form", () => {
  it("shows the price per post in Peaks, and no money", () => {
    view();
    expect(q("fresh-price")!.textContent).toBe("Each post costs 225 Peaks, charged only when it is written.");
    expect(host.textContent).not.toMatch(/[$£₹€]/);
  });

  it("when Automatic writing is off it says so, with the link to the card", () => {
    view({ setup: freshSetup(status({}, { enabled: false })) });
    const note = q("fresh-setup-note")!;
    expect(note.textContent).toMatch(/Switch on Fresh recurring posts in Automatic writing/);
    expect(note.querySelector("a")!.getAttribute("href")).toBe("/dashboard/content/create");
  });

  it("with no monthly limit it says to set one", () => {
    view({ setup: freshSetup(status({ monthlyCapPeaks: null, remainingPeaks: null })) });
    expect(q("fresh-setup-note")!.textContent).toMatch(/Set a monthly limit/);
  });

  it("ready: no warning, and it says nothing is posted until approved", () => {
    view();
    expect(q("fresh-setup-note")).toBeNull();
    expect(q("fresh-setup")!.textContent).toMatch(/Nothing is posted until you approve it/);
  });

  it("offers only the channels it is given, and says what to do with none", () => {
    view();
    expect(host.querySelectorAll('button[role="checkbox"]')).toHaveLength(2);
    act(() => root.unmount());
    host.remove();
    view({ channels: [] });
    expect(q("fresh-no-channels")!.textContent).toMatch(/Connect LinkedIn, X, Facebook or Threads/);
  });

  it("offers daily, weekly and monthly and no custom cron rhythm (the api does not take one yet)", () => {
    view();
    expect(h.editorFreqs.at(-1)).toEqual(["daily", "weekly", "monthly"]);
  });

  it("cannot be submitted while something is missing, and says what", () => {
    view({ draft: draft({ topic: "" , name: "x" }) });
    expect((q("fresh-submit") as HTMLButtonElement).disabled).toBe(true);
    expect(q("fresh-problems")!.textContent).toMatch(/Say what each post should be about/);
  });

  it("a complete form submits, and a refusal is shown in the api's words", () => {
    const p = view({ error: "Instagram needs a picture or video." });
    expect((q("fresh-submit") as HTMLButtonElement).disabled).toBe(false);
    act(() => q("fresh-submit")!.click());
    expect(p.onSubmit).toHaveBeenCalledTimes(1);
    expect(q("fresh-error")!.textContent).toBe("Instagram needs a picture or video.");
  });
});

describe("the rule card", () => {
  const rule = (over: Partial<RecurringRuleDto> = {}): RecurringRuleDto => ({
    _id: "r1",
    name: "Tuesday tip",
    freq: "weekly",
    interval: 1,
    weekdays: [2],
    localTime: "09:00",
    timezone: "Asia/Kolkata",
    runsSpawned: 3,
    runsCompleted: 0,
    nextSpawnAt: "2026-11-24T03:30:00.000Z",
    status: "active",
    planTemplate: { sourceType: "ai_generated", channels: [{ channel: "linkedin" }], meta: { topic: "a cooking tip" } },
    ...over,
  });
  const panel = async (rules: RecurringRuleDto[]) => {
    h.list.mockResolvedValue({ rules });
    h.get.mockImplementation(async (url: string) => (url === "/v1/content/auto-write" ? status() : { integrations: [] }));
    mount(<RecurringPanel />);
    await flush();
    await flush();
  };

  it("says it writes a new post each time, about the topic, waiting in Needs your OK", async () => {
    await panel([rule()]);
    const line = q("fresh-rule-line")!;
    expect(line.textContent).toMatch(/A new post each time, about a cooking tip/);
    expect(line.querySelector("a")!.getAttribute("href")).toBe("/dashboard/content/needs-ok");
    expect(host.textContent).toMatch(/3 planned/);
  });

  it("a draft rule is unchanged: no new-post line, and 'spawned'", async () => {
    await panel([rule({ planTemplate: { sourceType: "draft", channels: [{ channel: "linkedin" }] } })]);
    expect(q("fresh-rule-line")).toBeNull();
    expect(host.textContent).toMatch(/3 spawned/);
  });

  it("a missed post is a note with the api's sentence, not 'Last spawn failed'", async () => {
    await panel([rule({ lastSpawnError: { at: "2026-11-24T04:00:00Z", code: "NO_APPROVED_DRAFT", message: "Nothing was posted for 2026-11-24: the new post was written but not approved in time." } })]);
    expect(q("fresh-missed")!.textContent).toBe("Nothing was posted for 2026-11-24: the new post was written but not approved in time.");
    expect(host.textContent).not.toMatch(/Last spawn failed/);
  });

  it("a real spawn error still reads as a failure, with its message (an object, never rendered raw)", async () => {
    await panel([rule({ lastSpawnError: { at: "2026-11-24T04:00:00Z", code: "RECURRING_DRAFT_NOT_FOUND", message: "Draft not found" } })]);
    expect(host.textContent).toMatch(/Last spawn failed: Draft not found/);
  });

  it("has a New recurring post button that opens the form", async () => {
    await panel([]);
    expect(q("fresh-recurring-form")).toBeNull();
    await act(async () => q("fresh-new")!.click());
    await flush();
    expect(q("fresh-recurring-form")).not.toBeNull();
    expect(q("fresh-new")).toBeNull();
  });
});

describe("the form as a whole (reads the connections, creates the rule)", () => {
  const typeInto = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    act(() => void el.dispatchEvent(new Event("input", { bubbles: true })));
  };
  const open = async (integrations: Array<Record<string, unknown>>) => {
    const mod = await import("./fresh-recurring-form");
    h.get.mockImplementation(async (url: string) => (url === "/v1/content/auto-write" ? status() : { integrations }));
    mount(<mod.FreshRecurringForm onDone={vi.fn()} />);
    await flush();
    await flush();
  };
  const fill = () => {
    typeInto(host.querySelector("#fresh-name") as HTMLInputElement, "Tuesday tip");
    typeInto(host.querySelector("#fresh-topic") as HTMLTextAreaElement, "A cooking tip");
  };
  const tick = (label: string) => act(() => (host.querySelector(`button[role="checkbox"][aria-label="${label}"]`) as HTMLElement).click());

  it("creates the rule with the ticked connected channel, the topic, and the rhythm", async () => {
    await open([{ provider: "linkedin_content", connected: true }]);
    fill();
    tick("LinkedIn");
    h.create.mockResolvedValue({});
    await act(async () => q("fresh-submit")!.click());
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0]![0]).toMatchObject({ name: "Tuesday tip", planTemplate: { sourceType: "ai_generated", topic: "A cooking tip", channels: [{ channel: "linkedin" }] }, freq: "weekly", weekdays: [2] });
  });

  it("a ticked channel that is no longer connected is not sent, and the form says to choose one", async () => {
    await open([{ provider: "linkedin_content", connected: true }]);
    fill();
    tick("LinkedIn");
    expect((q("fresh-submit") as HTMLButtonElement).disabled).toBe(false);
    // the connection list refetches and LinkedIn is gone
    await act(async () => void client.setQueryData(["content-hub-integrations"], { integrations: [] }));
    await flush();
    expect((q("fresh-submit") as HTMLButtonElement).disabled).toBe(true);
    expect(q("fresh-problems")!.textContent).toMatch(/Choose at least one channel/);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("of two ticked channels, the one that is no longer connected is left out of what is sent", async () => {
    await open([{ provider: "linkedin_content", connected: true }, { provider: "x", connected: true }]);
    fill();
    tick("LinkedIn");
    tick("X");
    await act(async () => void client.setQueryData(["content-hub-integrations"], { integrations: [{ provider: "linkedin_content", connected: true }] }));
    await flush();
    h.create.mockResolvedValue({});
    await act(async () => q("fresh-submit")!.click());
    expect(h.create.mock.calls[0]![0].planTemplate.channels).toEqual([{ channel: "linkedin" }]);
  });

  it("a refusal is shown in the api's words, and editing the form clears it", async () => {
    await open([{ provider: "linkedin_content", connected: true }]);
    fill();
    tick("LinkedIn");
    const { ApiError } = await import("@/lib/api");
    h.create.mockRejectedValue(new (ApiError as unknown as new (m: string) => Error)("The end date is before the start."));
    await act(async () => q("fresh-submit")!.click());
    await flush();
    expect(q("fresh-error")!.textContent).toBe("The end date is before the start.");
    typeInto(host.querySelector("#fresh-name") as HTMLInputElement, "Tuesday tip 2");
    await flush();
    expect(q("fresh-error")).toBeNull();
  });
});
