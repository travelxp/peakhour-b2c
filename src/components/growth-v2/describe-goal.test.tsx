// @vitest-environment jsdom
/**
 * PL-9: "Describe it in your own words" inside the Add goal form, rendered in jsdom against a mocked api client. The price shows before the button
 * turns on, only an editor can press it, the draft only FILLS the form and is sent through the form's own button (the usual PATCH /rules add), and
 * a question back (422 GOAL_UNCLEAR) shows the question and that nothing was charged. Hooks, the Goals body and the dialogs are the real ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FIXTURE_RULES } from "@/lib/growth-v2-fixtures";
import type { DraftOffer, FirstRunDraftResponse } from "@/lib/api/growth-v2";

const h = vi.hoisted(() => ({
  get: vi.fn<(path: string) => Promise<unknown>>(),
  post: vi.fn<(path: string, body?: unknown, headers?: Record<string, string>) => Promise<unknown>>(),
  patch: vi.fn<(path: string, body?: unknown) => Promise<unknown>>(),
  role: "editor" as string | undefined,
}));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: { get: h.get, post: h.post, patch: h.patch } }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz-1", name: "Acme Tea" }, org: { _id: "org-1" }, orgs: [{ _id: "org-1", role: h.role }], isAuthenticated: true }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ApiError } = await import("@/lib/api");
const { GoalsBody } = await import("./goals-screen");
const { describeErrorLine, unclearQuestion, DESCRIBE_EDITOR_ONLY } = await import("./describe-goal");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SENTENCE = "more weekday bookings for our Goa hotels, 20% of the budget";
const quote = (over: Record<string, unknown> = {}) => ({
  action: "growth.goal_parse",
  useCase: "growth.goal_parse",
  label: "Describe a goal in your own words",
  description: null,
  peaks: 40,
  breakdown: [{ useCase: "growth.goal_parse", label: "Describe a goal in your own words", peaks: 40, free: false }],
  free: false,
  source: "code",
  token: "tok-40",
  expiresAt: Date.now() + 15 * 60_000,
  ...over,
});
const BOOKINGS: DraftOffer = { kind: "bookings", source: "orders", optimizeFor: "count", label: "Bookings", focusSuggestions: [], defaultTarget: { kind: "cost_per_outcome", value: 900, low: 300, high: 2000, currency: "INR" }, targetSource: "playbook" };
const line = (id: string, label: string) => ({ id, label, matched: true, score: 1, why: "x", offers: [BOOKINGS] });
const DRAFT: FirstRunDraftResponse = {
  alreadyActive: true,
  currency: "INR",
  timeZone: { value: "Asia/Kolkata" },
  offers: [BOOKINGS],
  askAboutStores: false,
  channels: [],
  ceilingBands: { absent: "x" },
  excludedByGuardrails: [],
  lines: [line("flights", "Flights"), line("hotels", "Hotels")],
};
const RESTATEMENT = "More weekday bookings for your Goa hotels: hotels line, bookings at ₹1,500 each, 20% of your budget, starting now.";
const PARSED = { goal: { lineId: "hotels", outcome: { kind: "bookings", source: "orders", optimizeFor: "count" }, target: { kind: "cost_per_outcome", value: 1500 }, targetSource: "merchant", share: 0.2, status: "active" }, restatement: RESTATEMENT, charged: true };

let root: Root;
let host: HTMLElement;

async function flush() {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
}
async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <GoalsBody rules={FIXTURE_RULES} preview={false} />
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
async function type(value: string) {
  const box = document.querySelector('textarea[aria-label="Describe the goal"]') as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, value);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
const parsePosts = () => h.post.mock.calls.filter((c) => c[0] === "/v1/growth/v2/goals/parse");
const openAdd = async () => click("Add goal");
const FILL = "Fill in the form";

beforeEach(() => {
  h.role = "editor";
  h.get.mockReset().mockImplementation(async (path: string) => {
    if (path.includes("/v1/peaks/quote")) return quote();
    throw new Error(`unplanned GET ${path}`);
  });
  h.post.mockReset().mockImplementation(async (path: string) => {
    if (path === "/v1/growth/v2/onboarding/draft") return DRAFT;
    throw new Error(`unplanned POST ${path}`);
  });
  h.patch.mockReset().mockResolvedValue({ ...FIXTURE_RULES, mandateChange: { decisionId: "d1", linkSent: true, via: "signed_link_otp" } });
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

describe("only an editor can describe a goal", () => {
  it.each([["viewer"], ["support"], [undefined]])("a %s sees the button off, the reason beside it, and no price is read", async (role) => {
    h.role = role;
    await mount();
    await openAdd();
    const b = button(FILL)!;
    expect(b.disabled).toBe(true);
    expect(document.getElementById(b.getAttribute("aria-describedby")!)!.textContent).toContain("editor role");
    expect(text()).toContain(DESCRIBE_EDITOR_ONLY);
    expect(h.get.mock.calls.filter((c) => String(c[0]).includes("/v1/peaks/quote"))).toEqual([]);
    expect((document.querySelector('textarea[aria-label="Describe the goal"]') as HTMLTextAreaElement).disabled).toBe(true);
    // the rest of the form still works for them
    expect(field("goal-new-share")).not.toBeNull();
  });
  it.each([["editor"], ["admin"], ["owner"]])("a %s can", async (role) => {
    h.role = role;
    await mount();
    await openAdd();
    await type(SENTENCE);
    expect(button(FILL)!.disabled).toBe(false);
  });
});

describe("the price comes before the button turns on", () => {
  it("the quote for growth.goal_parse is shown in Peaks, with nothing sent", async () => {
    await mount();
    await openAdd();
    expect(h.get).toHaveBeenCalledWith("/v1/peaks/quote?action=growth.goal_parse");
    expect(text()).toContain("This costs 40 Peaks, and only when a goal comes back.");
    expect(text()).not.toMatch(/[₹£$]\s?40/);
    expect(parsePosts()).toEqual([]);
  });
  it("the button stays off until the sentence is long enough AND a price is in hand", async () => {
    await mount();
    await openAdd();
    expect(button(FILL)!.disabled).toBe(true);
    await type("ab");
    expect(button(FILL)!.disabled).toBe(true);
    await type("abc");
    expect(button(FILL)!.disabled).toBe(false);
    await type("x".repeat(300));
    expect(button(FILL)!.disabled).toBe(false);
  });
  it("with no price to show (not priced), the button stays off and nothing claims a number", async () => {
    h.get.mockReset().mockRejectedValue(new ApiError("NOT_PRICED", "no price", 404));
    await mount();
    await openAdd();
    await type(SENTENCE);
    expect(button(FILL)!.disabled).toBe(true);
    expect(text()).not.toMatch(/This costs \d/);
  });
  it("a free quote says so and the button is on (never 0 Peaks)", async () => {
    h.get.mockReset().mockResolvedValue(quote({ free: true, peaks: 0, breakdown: [] }));
    await mount();
    await openAdd();
    await type(SENTENCE);
    expect(button(FILL)!.disabled).toBe(false);
    expect(text()).not.toContain("0 Peaks");
  });
  it("the button stays off while what the business can be measured on is still loading: a draft could not fill the form yet", async () => {
    h.post.mockImplementation(async (path: string) => (path === "/v1/growth/v2/onboarding/draft" ? new Promise(() => {}) : PARSED));
    await mount();
    await openAdd();
    await type(SENTENCE);
    expect(button(FILL)!.disabled).toBe(true);
  });
  it("the box is held to the api's 300 characters", async () => {
    await mount();
    await openAdd();
    expect((document.querySelector('textarea[aria-label="Describe the goal"]') as HTMLTextAreaElement).maxLength).toBe(300);
  });
});

describe("a goal comes back: it fills the form and is never sent on its own", () => {
  it("sends the sentence with the quote that was shown and a fresh key for this click", async () => {
    h.post.mockImplementation(async (path: string) => (path === "/v1/growth/v2/onboarding/draft" ? DRAFT : PARSED));
    await mount();
    await openAdd();
    await type(`  ${SENTENCE}  `);
    await click(FILL);
    expect(parsePosts()).toHaveLength(1);
    const [, body, headers] = parsePosts()[0]!;
    expect(body).toEqual({ text: SENTENCE });
    expect(headers).toMatchObject({ "x-peaks-quote": "tok-40" });
    expect(headers?.["Idempotency-Key"]).toMatch(/^click-/);
  });
  it("shows the restatement above the form and pre-fills the line, the outcome, the target and the share, all still editable", async () => {
    h.post.mockImplementation(async (path: string) => (path === "/v1/growth/v2/onboarding/draft" ? DRAFT : PARSED));
    await mount();
    await openAdd();
    await type(SENTENCE);
    await click(FILL);
    expect(text()).toContain(RESTATEMENT);
    // above the form fields
    const note = [...document.querySelectorAll("p")].find((p) => p.textContent === RESTATEMENT)!;
    expect(note.compareDocumentPosition(field("goal-line")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((field("goal-line") as HTMLSelectElement).value).toBe("hotels");
    expect((field("goal-outcome") as HTMLSelectElement).value).toBe("bookings:orders");
    expect(field("goal-new-target").value).toBe("1500");
    expect(field("goal-new-share").value).toBe("20");
    expect(field("goal-new-share").disabled).toBe(false);
    // nothing has been sent to the plan
    expect(h.patch).not.toHaveBeenCalled();
  });
  it("★saving goes through the form's own button: the usual PATCH /rules add, with the merchant's values, then the WhatsApp note", async () => {
    h.post.mockImplementation(async (path: string) => (path === "/v1/growth/v2/onboarding/draft" ? DRAFT : PARSED));
    await mount();
    await openAdd();
    await type(SENTENCE);
    await click(FILL);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field("goal-new-share"), "25");
      field("goal-new-share").dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(h.patch).not.toHaveBeenCalled();
    await click("Send for confirmation");
    expect(h.patch).toHaveBeenCalledTimes(1);
    const [path, body] = h.patch.mock.calls[0]!;
    expect(path).toBe("/v1/growth/v2/rules");
    expect((body as { mandate: { add: Record<string, unknown> } }).mandate.add).toMatchObject({ lineId: "hotels", share: 0.25, target: { kind: "cost_per_outcome", value: 1500 }, targetSource: "merchant" });
    expect(text()).toContain("WhatsApp");
  });
  it("a draft with dates carries them into the add", async () => {
    h.post.mockImplementation(async (path: string) =>
      path === "/v1/growth/v2/onboarding/draft" ? DRAFT : { ...PARSED, goal: { ...PARSED.goal, status: "scheduled", startsAt: "2026-11-30T18:30:00.000Z" } },
    );
    await mount();
    await openAdd();
    await type(SENTENCE);
    await click(FILL);
    await click("Send for confirmation");
    expect((h.patch.mock.calls[0]![1] as { mandate: { add: Record<string, unknown> } }).mandate.add).toMatchObject({ status: "scheduled", startsAt: "2026-11-30T18:30:00.000Z" });
  });
});

describe("review fixes", () => {
  it("an answer to the old sentence is not shown beside a new one, and the used receipt is read again", async () => {
    let n = 0;
    h.get.mockImplementation(async () => quote({ token: `tok-${++n}` }));
    h.post.mockImplementation(async (path: string) => (path === "/v1/growth/v2/onboarding/draft" ? DRAFT : PARSED));
    await mount();
    await openAdd();
    await type(SENTENCE);
    await click(FILL);
    expect(text()).toContain(RESTATEMENT);
    expect(n).toBeGreaterThan(1); // the quote was read again after the charge
    await type(`${SENTENCE} in December`);
    expect(text()).not.toContain(RESTATEMENT);
  });
  it("an error the client cannot judge does not claim the merchant was not charged", () => {
    const { text: t } = describeErrorLine(new ApiError("NETWORK", "x", 0));
    expect(t).not.toContain("You were not charged");
    expect(t).toContain("If you were charged, it shows on your Peaks page.");
  });
});

describe("a question back is not charged", () => {
  const UNCLEAR = new ApiError("GOAL_UNCLEAR", "Which hotels do you mean?", 422, undefined, { question: "Which hotels do you mean?", charged: false });
  it("shows the question and says nothing was charged and nothing was changed; the form is left as it was", async () => {
    h.post.mockImplementation(async (path: string) => {
      if (path === "/v1/growth/v2/onboarding/draft") return DRAFT;
      throw UNCLEAR;
    });
    await mount();
    await openAdd();
    await type("more of it");
    await click(FILL);
    expect(text()).toContain("Which hotels do you mean?");
    expect(text()).toContain("You were not charged.");
    expect(text()).toContain("Nothing was changed.");
    expect(text()).not.toContain(RESTATEMENT);
    expect(field("goal-new-share").value).toBe("");
    expect(h.patch).not.toHaveBeenCalled();
    // and they can try again: the button is on
    expect(button(FILL)!.disabled).toBe(false);
    // a question is not an error: no failure line beside it
    expect(text()).not.toContain("We could not turn that into a goal");
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
  it("unclearQuestion reads details.question, else the message, and only for GOAL_UNCLEAR", () => {
    expect(unclearQuestion(UNCLEAR)).toBe("Which hotels do you mean?");
    expect(unclearQuestion(new ApiError("GOAL_UNCLEAR", "Fallback message", 422))).toBe("Fallback message");
    expect(unclearQuestion(new ApiError("GOAL_UNCLEAR", "Fallback", 422, undefined, { question: "  " }))).toBe("Fallback");
    expect(unclearQuestion(new ApiError("GOAL_PARSE_FAILED", "x", 500))).toBeUndefined();
    expect(unclearQuestion(new Error("x"))).toBeUndefined();
  });
});

describe("failures say the merchant was not charged", () => {
  it.each([
    ["GOAL_PARSE_NOT_RELEASED", 409],
    ["PRICE_UNAVAILABLE", 503],
    ["QUOTE_NOT_HONOURED", 409],
    ["VALIDATION_ERROR", 400],
    ["NO_PLAN", 409],
  ])("%s", (code, status) => {
    const { text: t } = describeErrorLine(new ApiError(code, "x", status));
    expect(t).toContain("not charged");
    expect(t).not.toMatch(/[₹£$]/);
  });
  it("a short balance shows the top-up path, not an alarm", async () => {
    h.post.mockImplementation(async (path: string) => {
      if (path === "/v1/growth/v2/onboarding/draft") return DRAFT;
      throw new ApiError("CREDITS_EXHAUSTED", "x", 429);
    });
    await mount();
    await openAdd();
    await type(SENTENCE);
    await click(FILL);
    expect(text()).toContain("nothing was charged");
    expect(document.querySelector('a[href="/dashboard/peaks"]')).not.toBeNull();
  });
  it("a refused receipt is thrown away so the next press carries a fresh one", async () => {
    let n = 0;
    h.get.mockImplementation(async () => quote({ token: `tok-${++n}` }));
    h.post.mockImplementation(async (path: string) => {
      if (path === "/v1/growth/v2/onboarding/draft") return DRAFT;
      if (parsePosts().length === 1) throw new ApiError("QUOTE_NOT_HONOURED", "x", 409);
      return PARSED;
    });
    await mount();
    await openAdd();
    await type(SENTENCE);
    await click(FILL);
    await click(FILL);
    expect(parsePosts()).toHaveLength(2);
    expect(parsePosts()[0]![2]!["x-peaks-quote"]).not.toBe(parsePosts()[1]![2]!["x-peaks-quote"]);
  });
});
