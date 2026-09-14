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

  it.each([["x-csrf-token"], ["X-Csrf-Token"], ["X-CSRF-TOKEN"]])(
    "★★…in ANY casing, including %s (round 1)",
    async (key) => {
      // ⚠️THE MERGE IS CASE-SENSITIVE AND `headers` IS A PLAIN OBJECT, so a
      // caller using a different spelling left a SECOND key — and `fetch`
      // joins duplicate header names with a comma, producing
      // `x-csrf-token: forged, real`. The built-in CSRF retry rewrites only
      // the canonical spelling, so it could not clear it either.
      //
      // ★LATENT (no caller does this today) AND IT IS THE GUARANTEE THAT
      // JUSTIFIED THE PARAMETER, so it is made true rather than documented as
      // holding for one spelling. The first version of this file tested that
      // one spelling and would have passed throughout.
      await api.post("/v1/x", { a: 1 }, { [key]: "forged" });
      const sent = headersOf();
      expect(sent["x-csrf-token"]).toBe("csrf-abc");
      // ★AND EXACTLY ONE KEY SURVIVES. Asserting the value alone passes on a
      // comma-joined pair whose first half happens to be right.
      const csrfKeys = Object.keys(h.calls[0]!.init.headers as Record<string, string>).filter(
        (k) => k.toLowerCase() === "x-csrf-token",
      );
      expect(csrfKeys).toHaveLength(1);
    },
  );
});
