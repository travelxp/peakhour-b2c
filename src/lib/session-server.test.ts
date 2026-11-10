import { describe, expect, it, vi } from "vitest";
import {
  accessTokenExpired,
  apiOriginOf,
  fetchMeServer,
  meDehydratedState,
  pickMe,
  refreshSessionServer,
} from "./session-server";

const API = "https://api.example.test/some/base";
const ME = {
  user: { _id: "u1", email: "a@b.c", name: "A" },
  org: { _id: "o1", name: "Org" },
  orgs: [],
  business: null,
  businesses: [],
  entitlements: null,
};
const envelope = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

function jwt(expSeconds: number) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256" })}.${b64({ exp: expSeconds })}.sig`;
}

describe("apiOriginOf", () => {
  it("keeps only the origin", () => expect(apiOriginOf(API)).toBe("https://api.example.test"));
  it.each([undefined, "", "not a url", "ftp://x.test", "javascript:alert(1)"])("rejects %s", (v) => {
    expect(apiOriginOf(v as string | undefined)).toBeNull();
  });
});

describe("accessTokenExpired", () => {
  const now = 1_700_000_000_000;
  it("missing, malformed and exp-less tokens count as expired", () => {
    expect(accessTokenExpired(undefined, now)).toBe(true);
    expect(accessTokenExpired("garbage", now)).toBe(true);
    expect(accessTokenExpired("a.!!!.c", now)).toBe(true);
    const noExp = `x.${btoa(JSON.stringify({}))}.z`;
    expect(accessTokenExpired(noExp, now)).toBe(true);
  });
  it("a token with time left is not expired; one inside the 30s skew is", () => {
    expect(accessTokenExpired(jwt(now / 1000 + 600), now)).toBe(false);
    expect(accessTokenExpired(jwt(now / 1000 + 10), now)).toBe(true);
    expect(accessTokenExpired(jwt(now / 1000 - 5), now)).toBe(true);
  });
});

describe("pickMe", () => {
  it("returns only the known /me keys, dropping anything else", () => {
    const got = pickMe({ ok: true, data: { ...ME, access_token: "SECRET", refreshToken: "SECRET2" } });
    expect(got).toEqual(ME);
    expect(JSON.stringify(got)).not.toContain("SECRET");
  });
  it("rejects errors and payloads without a user", () => {
    expect(pickMe({ ok: false, error: {} })).toBeNull();
    expect(pickMe({ ok: true, data: { org: null } })).toBeNull();
    expect(pickMe(null)).toBeNull();
    expect(pickMe("x")).toBeNull();
  });
});

describe("fetchMeServer", () => {
  const base = { apiUrl: API, accessCookieName: "access_token", accessToken: "tok" };

  it("200 -> the payload, sending only the access cookie to the api origin, no-store, no redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(envelope({ ...ME, leak: "x" }));
    expect(await fetchMeServer({ ...base, fetchImpl })).toEqual(ME);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/auth/me");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("manual");
    expect(init.headers.cookie).toBe("access_token=tok");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it("401 -> null (no seed)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await fetchMeServer({ ...base, fetchImpl })).toBeNull();
  });
  it("a redirect, 5xx and non-JSON bodies -> null", async () => {
    for (const res of [
      new Response(null, { status: 302 }),
      new Response("{}", { status: 503 }),
      new Response("<html>", { status: 200 }),
    ]) {
      expect(await fetchMeServer({ ...base, fetchImpl: vi.fn().mockResolvedValue(res) })).toBeNull();
    }
  });
  it("network error -> null", async () => {
    expect(await fetchMeServer({ ...base, fetchImpl: vi.fn().mockRejectedValue(new TypeError("fail")) })).toBeNull();
  });
  it("timeout -> null, without waiting for the api", async () => {
    const fetchImpl = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init.signal!.addEventListener("abort", () => rej(init.signal!.reason));
        }),
    );
    const t0 = Date.now();
    expect(await fetchMeServer({ ...base, timeoutMs: 30, fetchImpl })).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it("no token or no usable api url -> no request at all", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchMeServer({ ...base, accessToken: undefined, fetchImpl })).toBeNull();
    expect(await fetchMeServer({ ...base, apiUrl: undefined, fetchImpl })).toBeNull();
    expect(await fetchMeServer({ ...base, apiUrl: "nope", fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("meDehydratedState", () => {
  it("is one query, ['me'], holding only the me payload", () => {
    const state = meDehydratedState(ME as never);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].queryKey).toEqual(["me"]);
    expect(state.queries[0].state.data).toEqual(ME);
    expect(state.mutations).toEqual([]);
    const text = JSON.stringify(state);
    expect(text).not.toMatch(/token/i);
    expect(text).not.toMatch(/cookie/i);
  });
  it("carries no token even when the api sends one (pickMe runs first)", () => {
    const me = pickMe({ ok: true, data: { ...ME, access_token: "SECRET" } })!;
    expect(JSON.stringify(meDehydratedState(me))).not.toContain("SECRET");
  });
});

describe("refreshSessionServer", () => {
  const base = {
    apiUrl: API,
    refreshCookieName: "refresh_token",
    refreshToken: "r1",
    requestCookieHeader: "theme=dark; access_token=old; refresh_token=r1",
  };
  const NEW_ACCESS = "access_token=NEWA; Max-Age=900; Domain=.example.test; Path=/; HttpOnly; Secure; SameSite=Lax";
  const NEW_REFRESH = "refresh_token=NEWR; Max-Age=2592000; Domain=.example.test; Path=/; HttpOnly; Secure; SameSite=Lax";

  function refreshed(lines: string[]) {
    const h = new Headers();
    for (const l of lines) h.append("set-cookie", l);
    return new Response("{}", { status: 200, headers: h });
  }

  it("ok -> Set-Cookie lines verbatim, Cookie header updated, only the refresh cookie sent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      refreshed(["cms_access_token=; Max-Age=0; Path=/", NEW_ACCESS, NEW_REFRESH]),
    );
    const out = await refreshSessionServer({ ...base, fetchImpl });
    expect(out!.setCookies).toEqual(["cms_access_token=; Max-Age=0; Path=/", NEW_ACCESS, NEW_REFRESH]);
    expect(out!.cookieHeader).toBe("theme=dark; access_token=NEWA; refresh_token=NEWR");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/auth/refresh");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.headers.cookie).toBe("refresh_token=r1");
  });
  it("401 -> null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await refreshSessionServer({ ...base, fetchImpl })).toBeNull();
  });
  it("network error and timeout -> null", async () => {
    expect(await refreshSessionServer({ ...base, fetchImpl: vi.fn().mockRejectedValue(new Error("x")) })).toBeNull();
    const hang = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_r, rej) => init.signal!.addEventListener("abort", () => rej(init.signal!.reason))),
    );
    expect(await refreshSessionServer({ ...base, timeoutMs: 30, fetchImpl: hang })).toBeNull();
  });
  it("200 with no Set-Cookie -> null (nothing was renewed)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await refreshSessionServer({ ...base, fetchImpl })).toBeNull();
  });
  it("no refresh token or api url -> no request", async () => {
    const fetchImpl = vi.fn();
    expect(await refreshSessionServer({ ...base, refreshToken: undefined, fetchImpl })).toBeNull();
    expect(await refreshSessionServer({ ...base, apiUrl: "", fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
