import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ★★THE QUOTE RECEIPT REACHES `fetch` (P-10).
 *
 * ── ⚠️WHY THIS FILE EXISTS RATHER THAN A NOTE ─────────────────────────────
 *
 * `audiences.test.ts` mocks `api.post`, so it pins what the CLIENT passes and
 * **cannot see what `request` does with it**. The mutation run said so out
 * loud: deleting the header spread from `post` left every one of those tests
 * green. That is the shape this programme calls *a guard credited to a checker
 * that does not look* — and the answer is a checker that looks, not a comment
 * saying it does not.
 *
 * ★WHAT IT PINS is narrow and load-bearing: the header survives the merge in
 * `request`, and the CSRF token survives it too. Sending `x-peaks-quote` and
 * losing `X-CSRF-Token` would trade a pricing bug for a 403 on every write.
 *
 * ── ⚠️★AND THE FIRST CUT OF THIS FILE PASSED FOR THE WRONG REASON ─────────
 *
 * Its CSRF double answered `{ data: { token } }` on any URL containing "csrf".
 * The real reader wants `{ ok: true, data: { csrf_token } }` from
 * `/v1/auth/csrf/token`, so it got **null** — and the "a caller cannot override
 * the CSRF token" case then failed against a forged value that had simply never
 * been overwritten. A double shaped to what the code ASKS FOR rather than to
 * what the test wants back is the difference between proving the ordering and
 * proving nothing.
 */

const h = vi.hoisted(() => ({
  calls: [] as Array<{ url: string; init: RequestInit }>,
}));

vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
  // The client fetches this on its own before any write; answer it in the shape
  // `getCsrfToken` actually reads, and record nothing so `calls` holds only the
  // request under test.
  if (String(url).includes("/v1/auth/csrf/token")) {
    return new Response(JSON.stringify({ ok: true, data: { csrf_token: "csrf-abc" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  h.calls.push({ url: String(url), init });
  return new Response(JSON.stringify({ ok: true, data: { fine: true } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

// ⚠️SET BEFORE THE MODULE LOADS. `API_URL` is read at import time from
// `process.env`, so stubbing it after the import leaves the client with an
// empty base URL and every call throwing CONFIG_ERROR — which is exactly what
// the first run of this file did.
process.env.NEXT_PUBLIC_API_URL = "https://api.test";

const { api } = await import("./api");

function headersOf(index = 0): Record<string, string> {
  const raw = h.calls[index]!.init.headers as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k.toLowerCase()] = v;
  return out;
}

beforeEach(() => {
  h.calls = [];
});

describe("★★api.post — a caller header reaches the request", () => {
  it("★★sends `x-peaks-quote` when the caller supplies one", async () => {
    await api.post("/v1/audiences/plan", { objective: "lead_generation" }, {
      "x-peaks-quote": "signed.receipt",
    });
    expect(h.calls).toHaveLength(1);
    expect(headersOf()["x-peaks-quote"]).toBe("signed.receipt");
    // ★AND THE CSRF TOKEN IS STILL THERE. Asserted in the same case rather than
    // the next one: a separate test relied on state `beforeEach` had already
    // cleared, which is its own way of proving nothing.
    expect(headersOf()["x-csrf-token"]).toBe("csrf-abc");
  });

  it("sends no such header when the caller supplies none", async () => {
    await api.post("/v1/audiences/plan", { objective: "lead_generation" });
    expect(headersOf()).not.toHaveProperty("x-peaks-quote");
    // The ordinary headers are untouched.
    expect(headersOf()["content-type"]).toBe("application/json");
    expect(headersOf()["x-csrf-token"]).toBe("csrf-abc");
  });

  it("★★a caller cannot override the CSRF token", async () => {
    // ⚠️`request` applies caller headers and THEN sets CSRF, so CSRF wins.
    // Worth pinning because the ordering is the only thing that makes the
    // header parameter safe to have added at all.
    await api.post("/v1/x", { a: 1 }, { "X-CSRF-Token": "forged" });
    expect(headersOf()["x-csrf-token"]).toBe("csrf-abc");
  });
});
