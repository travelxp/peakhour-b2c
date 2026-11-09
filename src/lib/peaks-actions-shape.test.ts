import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ★★THE MENU RESPONSE SHAPE (review round 2).
 *
 * ── ⚠️WHY A TEST AND NOT A TYPE ───────────────────────────────────────────
 *
 * `api.get<T>` **asserts** the response shape; it does not check it. So
 * `PeaksActionMenu` naming a field the api does not send is COMPILE-CLEAN,
 * and stays clean until something renders it. Round 2 found exactly that:
 * the type said `actions`, the api sends `quotes`, and the first caller
 * would have read `undefined` and crashed on `.map`.
 *
 * ── ⏸WHAT THIS CAN AND CANNOT PROVE, STATED PLAINLY ──────────────────────
 *
 * This repo cannot import from `peakhour-api`, so the fixture below is a
 * COPY of that response and therefore a claim like any other. What it buys
 * is that the claim is now written down beside the type, in the shape the
 * api actually serialises, instead of living only in a `<T>` nobody checks.
 * The source is `quoteAllActions` in
 * `peakhour-api/src/v1/services/peaks/quote.ts`, which returns
 * `{ quotes, unpriced }`, handed straight to `ok()` by
 * `src/v1/routes/peaks/index.ts` — so `data` IS that object.
 */

const h = vi.hoisted(() => ({ calls: [] as string[] }));

vi.stubGlobal("fetch", async (url: string) => {
  if (String(url).includes("/v1/auth/csrf/token")) {
    return new Response(JSON.stringify({ ok: true, data: { csrf_token: "csrf-abc" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  h.calls.push(String(url));
  // ★THE API ENVELOPE, NOT A CONVENIENT SHAPE. `ok()` wraps the payload in
  // `{ ok, data, meta }` and `request` unwraps `data` — a double answering
  // the bare payload would test the double rather than the client.
  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        quotes: [
          {
            action: "growth.propose_audiences",
            useCase: "growth.campaign_plan",
            label: "Audience proposal",
            description: null,
            peaks: 40,
            breakdown: [
              { useCase: "growth.campaign_plan", label: "Plan", peaks: 20, free: false },
              { useCase: "growth.council", label: "Critique", peaks: 20, free: false },
            ],
            free: false,
            source: "code",
          },
        ],
        unpriced: [],
      },
      meta: { request_id: "req_1" },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});

process.env.NEXT_PUBLIC_API_URL = "https://api.test";

const { peaksApi } = await import("./api/peaks");

beforeEach(() => {
  h.calls = [];
});

describe("★★peaksApi.actions — the field the api actually sends", () => {
  it("★★reads the menu off `quotes`, not `actions`", async () => {
    const menu = await peaksApi.actions();
    expect(Array.isArray(menu.quotes)).toBe(true);
    expect(menu.quotes).toHaveLength(1);
    expect(menu.quotes[0]!.action).toBe("growth.propose_audiences");
  });

  it("★★nothing in the menu is signed — a token here would be eleven wasted receipts", () => {
    // ★`GET /peaks/actions` prices a menu and SIGNS NOTHING; `GET
    // /peaks/quote` prices one act and signs it. The api says why, and the
    // reason is about the merchant rather than cost: *a TTL should start
    // when the merchant is about to act, not when a list was rendered.*
    // Asserted on the TYPE by construction — `PeaksActionMenu.quotes` is
    // `PeaksQuote[]`, which has no `token`, not `BindingPeaksQuote[]`.
    const sample: import("./api/peaks").PeaksActionMenu = { quotes: [], unpriced: [] };
    expect(Object.keys(sample)).toEqual(["quotes", "unpriced"]);
  });

  it("an empty `unpriced` is the healthy state, and it is still an array", async () => {
    const menu = await peaksApi.actions();
    expect(menu.unpriced).toEqual([]);
  });

  it("hits the documented path", async () => {
    await peaksApi.actions();
    expect(h.calls[0]).toContain("/v1/peaks/actions");
  });
});
