// @vitest-environment jsdom
/**
 * Ask Peakhour Summit (SUM-5), rendered in jsdom against a mocked api client: the price shows before Ask, Ask sends the quote the merchant was shown,
 * a declined answer shows the seats, and an answer the api could not give says the merchant was not charged and offers a retry.
 * The hooks, the dialog and the decision card's seats are the real ones; only `api` is a double.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SummitAskResponse, SummitCouncil } from "@/lib/api/growth-v2";

const h = vi.hoisted(() => ({
  get: vi.fn<(path: string) => Promise<unknown>>(),
  post: vi.fn<(path: string, body?: unknown, headers?: Record<string, string>) => Promise<unknown>>(),
}));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: { get: h.get, post: h.post } }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz-1", name: "Acme Tea" }, org: { _id: "org-1" }, isAuthenticated: true }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ApiError } = await import("@/lib/api");
const { AskSummit, summitErrorLine } = await import("./ask-summit");
const { SUMMIT_QUESTION_MAX, SUMMIT_QUESTION_MIN } = await import("@/lib/api/growth-v2");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const QUESTION = "Should we start Google search ads this month?";
const quote = (over: Record<string, unknown> = {}) => ({
  action: "growth.summit_review",
  useCase: "growth.summit_review",
  label: "Ask Peakhour Summit",
  description: null,
  peaks: 605,
  breakdown: [{ useCase: "growth.summit_review", label: "Ask Peakhour Summit", peaks: 605, free: false }],
  free: false,
  source: "code",
  token: "tok-605",
  expiresAt: Date.now() + 15 * 60_000,
  ...over,
});

const council: SummitCouncil = {
  strategist: { model: "anthropic/claude-sonnet-5.5", text: "Search ads reach people already looking for what you sell." },
  critic: { model: "google/gemini-4-argon", text: "You have no tracked search conversions yet, so a month is a thin test." },
  chair: { text: "Start with a small test and review it in two weeks." },
  risk: {
    checks: [
      { key: "ceiling", pass: true, detail: "Inside your monthly ceiling." },
      { key: "learning", pass: false, detail: "Meta is still learning." },
    ],
  },
};
const RECORDED: SummitAskResponse = { status: "recorded", charged: true, experimentId: "e1", decisionId: "d1", council, recommendation: "Start with a small test." };
const DECLINED: SummitAskResponse = { status: "declined", charged: true, reason: "The final call was not to act on this now.", council };

let root: Root;
let host: HTMLElement;
let qc: QueryClient;

async function flush() {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
}
async function mount() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <AskSummit />
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
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, value);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function openDialog() {
  await click(/Ask Peakhour Summit/);
  await flush();
}
const councilPosts = () => h.post.mock.calls.filter((c) => c[0] === "/v1/growth/v2/council");

beforeEach(() => {
  h.get.mockReset().mockImplementation(async (path: string) => {
    if (path.includes("/v1/peaks/quote")) return quote();
    throw new Error(`unplanned GET ${path}`);
  });
  h.post.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

describe("the price comes before Ask", () => {
  it("opens with the price read from the quote for growth.summit_review, in Peaks only, and sends nothing yet", async () => {
    await mount();
    expect(h.get).not.toHaveBeenCalled(); // not quoted until the dialog opens
    await openDialog();
    expect(h.get).toHaveBeenCalledWith("/v1/peaks/quote?action=growth.summit_review");
    expect(text()).toContain("This costs 605 Peaks");
    expect(text()).not.toMatch(/[₹£$]/);
    expect(h.post).not.toHaveBeenCalled();
  });

  it("Ask stays off until the question is long enough AND a price is in hand", async () => {
    await mount();
    await openDialog();
    expect(button("Ask")!.disabled).toBe(true);
    await type("too short");
    expect(button("Ask")!.disabled).toBe(true);
    await type(QUESTION);
    expect(button("Ask")!.disabled).toBe(false);
  });

  it("with no price to show (not priced), Ask stays off and nothing claims a number", async () => {
    h.get.mockImplementation(async () => {
      throw new ApiError("ACTION_NOT_PRICED", "no price", 502);
    });
    await mount();
    await openDialog();
    await type(QUESTION);
    expect(text()).not.toContain("This costs");
    expect(button("Ask")!.disabled).toBe(true);
  });

  it("a free quote says so, and Ask is on (never 0 Peaks)", async () => {
    h.get.mockImplementation(async () => quote({ free: true, peaks: 0 }));
    await mount();
    await openDialog();
    await type(QUESTION);
    expect(text()).toContain("Free");
    expect(text()).not.toContain("0 Peaks");
    expect(button("Ask")!.disabled).toBe(false);
  });

  it("the question box is held to the api's QUESTION_MAX", async () => {
    await mount();
    await openDialog();
    expect((document.querySelector("textarea") as HTMLTextAreaElement).maxLength).toBe(SUMMIT_QUESTION_MAX);
    expect(SUMMIT_QUESTION_MIN).toBe(10);
    const apiSource = resolve(process.cwd(), "../peakhour-api/src/v1/services/growth/growth-council.ts");
    if (existsSync(apiSource)) expect(readFileSync(apiSource, "utf8")).toMatch(new RegExp(`export const QUESTION_MAX = ${SUMMIT_QUESTION_MAX};`));
  });
});

describe("asking", () => {
  it("Ask sends the question with the quote that was shown and a fresh key for this click", async () => {
    h.post.mockResolvedValue(RECORDED);
    await mount();
    await openDialog();
    await type(`  ${QUESTION}  `);
    await click("Ask");
    expect(councilPosts()).toHaveLength(1);
    const [, body, headers] = councilPosts()[0]!;
    expect(body).toEqual({ question: QUESTION });
    expect(headers).toMatchObject({ "x-peaks-quote": "tok-605" });
    expect(headers?.["Idempotency-Key"]).toMatch(/^click-/);
  });

  it("a review that committed shows the four seats and a link to the suggested action", async () => {
    h.post.mockResolvedValue(RECORDED);
    await mount();
    await openDialog();
    await type(QUESTION);
    await click("Ask");
    for (const seat of ["The case for", "The case against", "Safety checks", "Final call"]) expect(text()).toContain(seat);
    expect(text()).toContain("Start with a small test and review it in two weeks.");
    const link = [...document.body.querySelectorAll("a")].find((a) => /Suggested actions/.test(a.textContent ?? ""));
    expect(link?.getAttribute("href")).toBe("/dashboard/growth/decisions");
    expect(text()).not.toContain("You were not charged");
    // the price is not repeated beside an answer
    expect(text()).not.toContain("This costs");
    expect(text()).not.toMatch(/[₹£$]/);
  });

  it("a declined review still shows its seats and the reason, with no link to an action", async () => {
    h.post.mockResolvedValue(DECLINED);
    await mount();
    await openDialog();
    await type(QUESTION);
    await click("Ask");
    for (const seat of ["The case for", "The case against", "Safety checks", "Final call"]) expect(text()).toContain(seat);
    expect(text()).toContain("The final call was not to act on this now.");
    expect([...document.body.querySelectorAll("a")].some((a) => /Suggested actions/.test(a.textContent ?? ""))).toBe(false);
  });

  it("a decline before any seat ran says there was no charge", async () => {
    h.post.mockResolvedValue({ status: "declined", charged: false, reason: "Autopilot is off." } satisfies SummitAskResponse);
    await mount();
    await openDialog();
    await type(QUESTION);
    await click("Ask");
    expect(text()).toContain("Autopilot is off.");
    expect(text()).toContain("You were not charged.");
    expect(text()).not.toContain("The case for");
  });

  it("an unavailable answer says Peakhour Summit could not meet, that the merchant was not charged, and offers a retry with a new key", async () => {
    h.post.mockRejectedValueOnce(new ApiError("COUNCIL_UNAVAILABLE", "x", 503));
    h.post.mockResolvedValueOnce(RECORDED);
    await mount();
    await openDialog();
    await type(QUESTION);
    await click("Ask");
    expect(text()).toContain("Peakhour Summit could not meet just now. You were not charged.");
    expect(button("Try again")).toBeDefined();
    await click("Try again");
    expect(councilPosts()).toHaveLength(2);
    expect(councilPosts()[1]![2]?.["Idempotency-Key"]).not.toBe(councilPosts()[0]![2]?.["Idempotency-Key"]);
    expect(text()).toContain("The case for");
  });

  it("a short balance shows the top-up path, not an alarm", async () => {
    h.post.mockRejectedValue(new ApiError("CREDITS_EXHAUSTED", "This takes 605 AI credits and you have 100 left.", 429));
    await mount();
    await openDialog();
    await type(QUESTION);
    await click("Ask");
    expect(text()).toContain("You don't have enough Peaks for this review.");
    expect(text()).toContain("nothing was charged");
    const buy = [...document.body.querySelectorAll("a")].find((a) => a.textContent === "Buy Peaks");
    expect(buy?.getAttribute("href")).toBe("/dashboard/peaks");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(text()).not.toContain("AI credits"); // Peaks, not the api's wording
  });

  it("a refused receipt is thrown away so the next press carries a fresh one", async () => {
    let quotes = 0;
    h.get.mockImplementation(async () => quote({ token: `tok-${++quotes}` }));
    h.post.mockRejectedValueOnce(new ApiError("QUOTE_NOT_HONOURED", "expired", 409));
    h.post.mockResolvedValueOnce(RECORDED);
    await mount();
    await openDialog();
    await type(QUESTION);
    await click("Ask");
    expect(text()).toContain("The price changed while you were looking.");
    await flush();
    await click("Try again");
    expect(councilPosts()[0]![2]).toMatchObject({ "x-peaks-quote": "tok-1" });
    expect(councilPosts()[1]![2]).toMatchObject({ "x-peaks-quote": "tok-2" });
  });
});

describe("the words", () => {
  it("every failure names the merchant's position in plain words, never an internal seat", () => {
    const codes = ["CREDITS_EXHAUSTED", "COUNCIL_UNAVAILABLE", "COUNCIL_FAILED", "COUNCIL_NOT_RELEASED", "PRICE_UNAVAILABLE", "QUOTE_NOT_HONOURED", "ACT_ALREADY_RUNNING", "VALIDATION_ERROR", "SOMETHING_ELSE"];
    for (const code of codes) {
      const line = summitErrorLine(new ApiError(code, "m", 500));
      expect(line.text, code).not.toMatch(/council|strategist|critic|chair|mandate|intent|[₹£$]|AI credits/i);
    }
    expect(summitErrorLine(new Error("network")).retry).toBe(true);
  });
});

describe("the page", () => {
  it("the Suggested actions screen carries the button in its header, beside the page title", async () => {
    h.get.mockImplementation(async (path: string) => {
      if (path.includes("/rules")) throw new ApiError("NOT_FOUND", "no rules", 404);
      if (path.includes("/v1/peaks/quote")) return quote();
      return { queue: "open", decisions: [], blocks: [], waiting: [], counts: { open: 0, done: 0, blocked: 0 } };
    });
    const { DecisionsScreen } = await import("./decisions-screen");
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
    const header = document.querySelector('[data-slot="page-header"]')!;
    expect(header.textContent).toContain("What needs you?");
    expect(header.textContent).toContain("Ask Peakhour Summit");
    // not quoted until the dialog opens
    expect(h.get.mock.calls.some((c) => String(c[0]).includes("/v1/peaks/quote"))).toBe(false);
  });
});
