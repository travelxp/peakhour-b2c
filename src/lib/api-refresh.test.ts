import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

process.env.NEXT_PUBLIC_API_URL = "https://api.test";

const { api, ApiError } = await import("./api");
const { classifyMeFailure, fetchMe, ME_KEY, resetEarlyMe } = await import("./auth-session");

const ME = { user: { _id: "u1" }, org: null, orgs: [], business: null, businesses: [], entitlements: null };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const expired = () => json(401, { ok: false, error: { code: "UNAUTHORIZED", message: "expired" } });

type Route = (url: string) => Response | Promise<Response>;
let meCalls = 0;
let refreshCalls = 0;
function stub(refresh: Route, me: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.endsWith("/v1/auth/refresh")) {
        refreshCalls++;
        return refresh(input);
      }
      meCalls++;
      return me();
    })
  );
}

beforeEach(() => {
  meCalls = 0;
  refreshCalls = 0;
  resetEarlyMe();
  vi.unstubAllGlobals();
});

describe("expired access token, then refresh", () => {
  it("refresh ok -> the original request is retried once and succeeds", async () => {
    stub(() => json(200, { ok: true, data: {} }), () => (meCalls === 1 ? expired() : json(200, { ok: true, data: ME })));
    expect(await api.get("/v1/auth/me")).toEqual(ME);
    expect(meCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it("refresh answers 401 -> the original 401 surfaces: signed out, no retry", async () => {
    stub(() => expired(), expired);
    const err = await api.get("/v1/auth/me").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(classifyMeFailure(err)).toBe("signed-out");
    expect(meCalls).toBe(1);
  });

  it("refresh answers 403 -> signed out", async () => {
    stub(() => json(403, { ok: false, error: { code: "FORBIDDEN", message: "no" } }), expired);
    expect(classifyMeFailure(await api.get("/v1/auth/me").catch((e) => e))).toBe("signed-out");
  });

  it.each([
    ["network failure", () => { throw new TypeError("Failed to fetch"); }],
    ["502", () => json(502, { ok: false })],
    ["503 non-JSON", () => new Response("<html>down</html>", { status: 503 })],
    ["429", () => json(429, { ok: false })],
  ])("refresh %s -> unreachable, not signed out", async (_n, refresh) => {
    stub(refresh as Route, expired);
    const err = await api.get("/v1/auth/me").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(classifyMeFailure(err)).toBe("unreachable");
    expect(meCalls).toBe(1);
  });

  it("the other client paths (getWithMeta) behave the same", async () => {
    stub(() => { throw new TypeError("Failed to fetch"); }, expired);
    const err = await api.getWithMeta("/v1/things").catch((e) => e);
    expect(classifyMeFailure(err)).toBe("unreachable");
  });

  it("a refresh failure leaves a signed-in user signed in (identity kept in the me query)", async () => {
    const qc = new QueryClient();
    stub(() => json(200, { ok: true, data: {} }), () => json(200, { ok: true, data: ME }));
    await qc.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe });
    stub(() => { throw new TypeError("Failed to fetch"); }, expired);
    await qc.refetchQueries({ queryKey: ME_KEY });
    const s = qc.getQueryState(ME_KEY)!;
    expect(s.status).toBe("error");
    expect(s.data).toEqual(ME);
  });

  it("a refresh failure is not cached: the next request tries the refresh again", async () => {
    stub(() => { throw new TypeError("Failed to fetch"); }, expired);
    await api.get("/v1/auth/me").catch(() => {});
    await api.get("/v1/auth/me").catch(() => {});
    expect(refreshCalls).toBe(2);
  });
});
