// @vitest-environment jsdom
/**
 * The Decisions screen against mocked routes (lane H2): what a person clicks, what is sent, what they are told.
 *
 * The api client is the only double. The hooks, the screen and the card are the real ones, rendered in jsdom, so
 * "Approve sends POST .../approve" and "NEEDS_REAUTH renders a Reconnect link" are read off the page, not assumed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DecisionAskResponse, DecisionQueue, DecisionsResponse, DecisionView, GuardrailBlockView } from "@/lib/api/growth-v2";
import { NOT_BUILT } from "@/lib/api/growth-v2";

const h = vi.hoisted(() => ({
  get: vi.fn<(path: string) => Promise<unknown>>(),
  post: vi.fn<(path: string, body?: unknown) => Promise<unknown>>(),
  toast: vi.fn<(msg: string) => void>(),
}));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: { get: h.get, post: h.post } }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz-1", name: "Acme Tea" } }) }));
vi.mock("sonner", () => ({ toast: { success: h.toast, error: h.toast } }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/growth/decisions", useRouter: () => ({ push: vi.fn() }) }));

const { ApiError } = await import("@/lib/api");
const { DecisionsScreen } = await import("./decisions-screen");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOUR = 3_600_000;
const ago = (hrs: number) => new Date(Date.now() - hrs * HOUR).toISOString();
const ahead = (hrs: number) => new Date(Date.now() + hrs * HOUR).toISOString();

const op = (campaignRef: string, to: number, from = 10) => ({
  platform: "meta" as const,
  campaignRef,
  op: "set_daily_budget" as const,
  from,
  to,
  description: `Daily budget on ${campaignRef} (Meta Ads): ${from} to ${to}`,
});

const decision = (over: Partial<DecisionView> = {}): DecisionView => ({
  id: `d-${Math.random().toString(36).slice(2, 8)}`,
  kind: "budget_move",
  source: { engine: "optimizer" },
  title: "Move budget to Spring sale",
  summary: "Cost per outcome is lower there.",
  ops: [op("Spring sale", 12)],
  needsPerson: true,
  status: "proposed",
  expiresAt: ahead(48),
  delivery: {},
  createdAt: ago(3),
  ...over,
});

const page = (queue: DecisionQueue, decisions: DecisionView[], over: Partial<DecisionsResponse> = {}): DecisionsResponse => ({
  queue,
  decisions,
  blocks: [],
  counts: { open: 2, done: 1, blocked: 1 },
  ...over,
});

let routes: Partial<Record<DecisionQueue, DecisionsResponse | Error>>;
function serve() {
  h.get.mockImplementation(async (path: string) => {
    if (path.includes("/rules")) throw new ApiError("NOT_FOUND", "no rules", 404);
    const q = (/status=(\w+)/.exec(path)?.[1] ?? "open") as DecisionQueue;
    const r = routes[q];
    if (r instanceof Error) throw r;
    if (!r) throw new Error(`unplanned GET ${path}`);
    return r;
  });
}

let root: Root;
let host: HTMLElement;

async function flush() {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <DecisionsScreen />
      </QueryClientProvider>,
    );
  });
  await flush();
}

const text = () => document.body.textContent ?? "";
const button = (label: string | RegExp) =>
  [...document.body.querySelectorAll("button")].find((b) => (typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? ""))) as HTMLButtonElement | undefined;
async function click(label: string | RegExp) {
  const b = button(label);
  expect(b, `a button "${String(label)}"`).toBeDefined();
  await act(async () => {
    b!.click();
  });
  await flush();
}
const posts = () => h.post.mock.calls.map((c) => c[0]);

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  h.toast.mockReset();
  routes = {};
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("live data", () => {
  it("★shows the api's queue, with no preview banner, and tab counts from the api", async () => {
    routes.open = page("open", [decision({ title: "Move budget to Spring sale" })]);
    serve();
    await mount();
    expect(text()).toContain("Move budget to Spring sale");
    expect(text()).not.toContain("Preview data");
    expect(text()).toContain("Needs you · 2");
    expect(text()).toContain("Done · 1");
    expect(text()).toContain("Blocked · 1");
    expect(h.get.mock.calls.some((c) => c[0].includes("status=open"))).toBe(true);
  });

  it("★a preview is shown only on 501 NOT_BUILT: a 500 and a 403 are errors, not sample data", async () => {
    for (const err of [new ApiError("INTERNAL", "boom", 500), new ApiError("FORBIDDEN", "no", 403)]) {
      routes = { open: err };
      serve();
      await mount();
      expect(text()).not.toContain("Preview data");
      expect(text()).not.toContain("Himalayan");
      expect(text()).toContain("Couldn't load this screen");
      act(() => root.unmount());
      host.remove();
    }
    routes = { open: new ApiError(NOT_BUILT, "not built", 501, undefined, { row: "H2" }) };
    serve();
    await mount();
    expect(text()).toContain("Preview data");
    expect(text()).toContain("Himalayan Trails");
  });

  it("★a preview's buttons are off and nothing is sent", async () => {
    routes = { open: new ApiError(NOT_BUILT, "not built", 501, undefined, { row: "H2" }) };
    serve();
    await mount();
    expect(button("Approve")!.disabled).toBe(true);
    expect(text()).toContain("Preview data: nothing is sent.");
    await click("Approve");
    expect(h.post).not.toHaveBeenCalled();
  });

  it("pages: Show older asks for the cursor and appends", async () => {
    const first = decision({ id: "d-new", title: "Newest decision" });
    const older = decision({ id: "d-old", title: "Older decision", createdAt: ago(30) });
    h.get.mockImplementation(async (path: string) => {
      if (path.includes("/rules")) throw new ApiError("NOT_FOUND", "no rules", 404);
      if (path.includes("cursor=c1")) return page("open", [older]);
      return page("open", [first], { nextCursor: "c1" });
    });
    await mount();
    expect(text()).toContain("Newest decision");
    expect(text()).not.toContain("Older decision");
    await click("Show older");
    expect(h.get.mock.calls.some((c) => c[0].includes("status=open") && c[0].includes("cursor=c1"))).toBe(true);
    expect(text()).toContain("Newest decision");
    expect(text()).toContain("Older decision");
    expect(button("Show older")).toBeUndefined();
  });
});

describe("answering", () => {
  it("★Hold and Reject send their routes and say what happened", async () => {
    const d = decision({ id: "d1" });
    routes.open = page("open", [d]);
    serve();
    h.post.mockResolvedValue({ status: "held" });
    await mount();
    await click("Hold");
    expect(posts()).toEqual(["/v1/growth/v2/decisions/d1/hold"]);
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining("Held"));
    await click("Reject");
    expect(posts()).toEqual(["/v1/growth/v2/decisions/d1/hold", "/v1/growth/v2/decisions/d1/reject"]);
  });

  it("★a decision that spends asks to be confirmed first: Approve opens the dialog, and only Confirm sends", async () => {
    const d = decision({ id: "d2", kind: "budget_raise", ops: [op("Spring sale", 12), op("Autumn", 20, 15)] });
    routes.open = page("open", [d]);
    serve();
    h.post.mockResolvedValue({ status: "applied" });
    await mount();
    await click("Approve");
    expect(h.post).not.toHaveBeenCalled();
    expect(text()).toContain("Approve and apply this now?");
    // The dialog lists what will change, in the api's words.
    expect(document.body.querySelector("[role=alertdialog]")!.textContent).toContain("Daily budget on Autumn (Meta Ads): 15 to 20");
    await click("Not yet");
    expect(h.post).not.toHaveBeenCalled();
    await click("Approve");
    await click("Confirm and approve");
    expect(posts()).toEqual(["/v1/growth/v2/decisions/d2/approve"]);
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining("Approved"));
  });

  it("★anything that touches a platform asks first, whatever its kind", async () => {
    const d = decision({ id: "d2b", kind: "campaign_pause", ops: [{ ...op("Spring sale", 0), op: "set_status" as const, description: "Pause Spring sale (Meta Ads)" }] });
    routes.open = page("open", [d]);
    serve();
    await mount();
    await click("Approve");
    expect(h.post).not.toHaveBeenCalled();
    expect(document.body.querySelector("[role=alertdialog]")!.textContent).toContain("Pause Spring sale (Meta Ads)");
  });

  it("the toast says what the api said happened: scheduled steps are not 'applied'", async () => {
    const d = decision({ id: "d2c", kind: "content_adjustment", ops: [] });
    routes.open = page("open", [d]);
    serve();
    h.post.mockResolvedValue({ status: "applied", scheduled: [{}, {}] });
    await mount();
    await click("Approve");
    expect(h.toast).toHaveBeenCalledWith("Approved. The first step is applied and the rest are scheduled.");
  });

  it("a decision that spends nothing is approved at once, with no dialog", async () => {
    const d = decision({ id: "d3", kind: "content_adjustment", ops: [] });
    routes.open = page("open", [d]);
    serve();
    h.post.mockResolvedValue({ status: "applied" });
    await mount();
    await click("Approve");
    expect(posts()).toEqual(["/v1/growth/v2/decisions/d3/approve"]);
    expect(text()).not.toContain("Approve and apply this now?");
  });

  it.each([
    ["NEEDS_REAUTH", "needs to be reconnected", "/dashboard/integrations", "Reconnect"],
    ["ADS_HALTED", "Ads are paused for this business", "/dashboard/growth/rules", "Review your rules"],
    ["QUIET_HOURS", "Will apply after quiet hours", undefined, undefined],
    ["GOVERNOR_HOLD", "Waiting for the platform to finish learning", undefined, undefined],
  ])("★a 409 %s renders its action", async (code, sentence, href, linkText) => {
    const d = decision({ id: "d4", kind: "content_adjustment", ops: [] });
    routes.open = page("open", [d]);
    serve();
    h.post.mockRejectedValue(new ApiError(code, "the api's own sentence", 409, "req-1", { status: "held" }));
    await mount();
    await click("Approve");
    const alert = document.body.querySelector("[role=alert]");
    expect(alert, "a notice on the card").not.toBeNull();
    expect(alert!.textContent).toContain(sentence);
    expect(alert!.textContent).not.toContain("the api's own sentence");
    const link = alert!.querySelector("a");
    if (href) {
      expect(link!.getAttribute("href")).toBe(href);
      expect(link!.textContent).toBe(linkText);
    } else {
      expect(link).toBeNull();
    }
    // Said as a toast too: the card may be gone by the time the queues are read again.
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining(sentence));
    // The queues are read again: a refused approve can have sent the decision back to held.
    const opens = h.get.mock.calls.filter((c) => c[0].includes("status=open")).length;
    expect(opens).toBeGreaterThanOrEqual(2);
  });

  it("★a refusal's notice goes once the refetch shows the decision has moved on", async () => {
    const d = decision({ id: "d4b", kind: "content_adjustment", ops: [] });
    routes.open = page("open", [d]);
    serve();
    h.post.mockRejectedValue(new ApiError("ALREADY_DECIDED", "x", 409));
    await mount();
    // After the answer is refused the queue is read again, and the decision is no longer waiting on anyone.
    routes.open = page("open", [{ ...d, status: "applied" }]);
    await click("Approve");
    expect(document.body.querySelector("[role=alert]")).toBeNull();
    expect(h.toast).toHaveBeenCalledWith("This was already answered. The list has been refreshed.");
  });

  it("a held decision can be approved again, and offers no Hold", async () => {
    const d = decision({ id: "d5", status: "held", kind: "content_adjustment", ops: [] });
    routes.open = page("open", [d]);
    serve();
    h.post.mockResolvedValue({ status: "applied" });
    await mount();
    expect(text()).toContain("On hold");
    expect(button("Hold")).toBeUndefined();
    expect(button("Approve")!.disabled).toBe(false);
    await click("Approve");
    expect(posts()).toEqual(["/v1/growth/v2/decisions/d5/approve"]);
  });

  it("★an expired decision cannot be approved, held or rejected", async () => {
    const d = decision({ id: "d6", expiresAt: ago(2) });
    routes.open = page("open", [d]);
    serve();
    await mount();
    expect(text()).toContain("This expired and nothing changed.");
    for (const label of ["Approve", "Hold", "Reject"]) expect(button(label)!.disabled, label).toBe(true);
    await click("Approve");
    expect(h.post).not.toHaveBeenCalled();
  });
});

describe("undo", () => {
  it("★is offered while the window is open, sends undo, and says how long is left", async () => {
    const d = decision({ id: "d7", status: "applied", undoUntil: ahead(5.5), decidedBy: { via: "inapp", at: ago(18) } });
    routes.done = page("done", [d]);
    routes.open = page("open", []);
    serve();
    h.post.mockResolvedValue({ status: "reverted", reverted: 1 });
    await mount();
    await click(/^Done/);
    expect(text()).toContain("You can undo this for another 5 hours.");
    await click(/Undo/);
    expect(posts()).toEqual(["/v1/growth/v2/decisions/d7/undo"]);
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining("Undone"));
  });

  it("★is gone once the window ends, and the card says so", async () => {
    const d = decision({ id: "d8", status: "applied", undoUntil: ago(1) });
    const none = decision({ id: "d9", status: "applied", title: "Protective pause" });
    routes.done = page("done", [d, none]);
    routes.open = page("open", []);
    serve();
    await mount();
    await click(/^Done/);
    expect(button(/Undo/)).toBeUndefined();
    expect(text()).toContain("The 24-hour undo window has passed.");
  });

  it("an undo the api refuses names its reason on the card", async () => {
    const d = decision({ id: "d10", status: "applied", undoUntil: ahead(3) });
    routes.done = page("done", [d]);
    routes.open = page("open", []);
    serve();
    h.post.mockRejectedValue(new ApiError("CAMPAIGN_CHANGED_SINCE", "Another decision changed Spring sale since.", 409, "r", { blockingDecisionId: "x" }));
    await mount();
    await click(/^Done/);
    await click(/Undo/);
    expect(document.body.querySelector("[role=alert]")!.textContent).toContain("Another decision changed Spring sale since.");
  });
});

describe("what a card shows", () => {
  it("★all four seats, 'Also sent to WhatsApp', and the steps timeline", async () => {
    const d = decision({
      id: "d11",
      status: "applied",
      undoUntil: ahead(10),
      council: {
        strategist: { model: "anthropic/claude-sonnet-4.5", text: "The case for." },
        critic: { model: "google/gemini-2.5-pro", text: "The case against." },
        chair: { text: "Do the smaller one." },
        risk: { checks: [{ key: "ceiling", pass: true, detail: "Under the ceiling" }] },
      },
      delivery: { inAppAt: ago(20), whatsapp: { template: "growth_decision", sentAt: "2026-10-26T09:05:00Z" } },
      steps: [
        { op: op("Spring sale", 14), dueAt: ago(10), status: "applied", appliedAt: "2026-10-26T10:00:00Z" },
        { op: op("Spring sale", 16), dueAt: ahead(60), status: "scheduled" },
        { op: op("Spring sale", 18), dueAt: ahead(130), status: "cancelled" },
      ],
    });
    routes.done = page("done", [d]);
    routes.open = page("open", []);
    serve();
    await mount();
    await click(/^Done/);
    for (const who of ["Strategist", "Critic", "Chair's decision", "Risk check"]) {
      expect(document.body.querySelector(`[aria-label="${who}"]`), who).not.toBeNull();
    }
    expect(text()).toContain("anthropic/claude-sonnet-4.5");
    expect(text()).toContain("google/gemini-2.5-pro");
    expect(text()).toContain("Also sent to WhatsApp on 26 Oct");
    const steps = document.body.querySelector('[aria-label="Steps of this move"]')!;
    expect(steps.textContent).toContain("Applied 26 Oct");
    expect(steps.textContent).toContain("Daily budget on Spring sale (Meta Ads): 10 to 14");
    expect(steps.textContent).toMatch(/Due \d+ \w+/);
    expect(steps.textContent).toContain("Cancelled");
  });

  it("a decision never sent to WhatsApp does not claim it was", async () => {
    routes.open = page("open", [decision()]);
    serve();
    await mount();
    expect(text()).not.toContain("Also sent to WhatsApp");
  });
});

describe("the blocked tab", () => {
  it("★reads the blocked queue and lists the guardrail blocks, CEILING_EXCEEDED included", async () => {
    const block: GuardrailBlockView = {
      id: "CEILING_EXCEEDED:meta",
      code: "CEILING_EXCEEDED",
      platform: "meta",
      title: "A budget increase on Meta Ads was refused: it would take you over your monthly ceiling",
      message: "A raise would take October over 3000.",
      count: 2,
      lastAt: "2026-10-25T14:00:00Z",
    };
    routes.open = page("open", [decision()]);
    routes.blocked = page("blocked", [], { blocks: [block] });
    serve();
    await mount();
    await click(/^Blocked/);
    expect(h.get.mock.calls.some((c) => c[0].includes("status=blocked"))).toBe(true);
    expect(text()).toContain("would take you over your monthly ceiling");
    expect(text()).toContain("A raise would take October over 3000.");
    expect(text()).toContain("2 times");
    // A block is not a decision: nothing to approve, and no WhatsApp mock-up.
    expect(button("Approve")).toBeUndefined();
    expect(document.body.querySelector('[aria-label="Same decision on WhatsApp"]')).toBeNull();
  });
});

describe("ask about this decision", () => {
  const ready = async () => {
    routes.open = page("open", [decision({ id: "d12" })]);
    serve();
    await mount();
  };
  const type = async (value: string) => {
    const input = document.body.querySelector('input[aria-label="Ask about this decision"]') as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("★sends the question to the decision's ask route and shows the answer", async () => {
    await ready();
    h.post.mockResolvedValue({ answer: "It moves 2 a day." } satisfies DecisionAskResponse);
    expect(button("Ask")!.disabled).toBe(true);
    await type("Why this one?");
    expect(button("Ask")!.disabled).toBe(false);
    await act(async () => {
      (document.body.querySelector('form[aria-label="Ask about this decision"]') as HTMLFormElement).requestSubmit();
    });
    await flush();
    expect(h.post).toHaveBeenCalledWith("/v1/growth/v2/decisions/d12/ask", { question: "Why this one?" });
    expect(document.body.querySelector("[role=status]")!.textContent).toBe("It moves 2 a day.");
  });

  it("★shows the api's sentence, and no answer, when it refuses one", async () => {
    await ready();
    h.post.mockRejectedValue(new ApiError("ANSWER_REFUSED", "I can't answer that from the numbers on this decision.", 422));
    await type("How much will it earn?");
    await click("Ask");
    expect(document.body.querySelector("[role=alert]")!.textContent).toContain("I can't answer that from the numbers on this decision.");
    expect(document.body.querySelector("[role=status]")).toBeNull();
  });

  it("★the answer goes when the question is edited, so it never reads as the answer to the new one", async () => {
    await ready();
    h.post.mockResolvedValue({ answer: "It moves 2 a day." } satisfies DecisionAskResponse);
    await type("Why this one?");
    await click("Ask");
    expect(document.body.querySelector("[role=status]")).not.toBeNull();
    await type("What about Google?");
    expect(document.body.querySelector("[role=status]")).toBeNull();
  });

  it("will not send a question that is too short", async () => {
    await ready();
    await type("why");
    expect(button("Ask")!.disabled).toBe(true);
  });
});
