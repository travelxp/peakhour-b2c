import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { DASHBOARD_REQUEST_HEADER } from "./lib/session-server";

/**
 * /dashboard document requests renew an expired access token in the middleware
 * (the only place that can set cookies) so the server can render with identity.
 * Every failure must fall through to the old behaviour.
 */
const NEW_ACCESS = "access_token=NEWA; Max-Age=900; Domain=.peakhour.ai; Path=/; HttpOnly; Secure; SameSite=Lax";
const NEW_REFRESH = "refresh_token=NEWR; Max-Age=2592000; Domain=.peakhour.ai; Path=/; HttpOnly; Secure; SameSite=Lax";

const saved = { api: process.env.NEXT_PUBLIC_API_URL, cs: process.env.COMING_SOON, ns: process.env.AUTH_COOKIE_NS };
const fetchMock = vi.fn();

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.peakhour.test";
  delete process.env.COMING_SOON;
  delete process.env.AUTH_COOKIE_NS;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  const restore: Record<string, string | undefined> = {
    NEXT_PUBLIC_API_URL: saved.api,
    COMING_SOON: saved.cs,
    AUTH_COOKIE_NS: saved.ns,
  };
  for (const [k, v] of Object.entries(restore)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function req(path: string, cookie: string, init: { headers?: Record<string, string>; method?: string } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method,
    headers: { ...(cookie ? { cookie } : {}), ...init.headers },
  });
}
function refreshOk() {
  const h = new Headers();
  h.append("set-cookie", NEW_ACCESS);
  h.append("set-cookie", NEW_REFRESH);
  return new Response("{}", { status: 200, headers: h });
}
/** Request headers the render sees, as Next encodes them on the middleware response. */
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}
function jwtWithExp(exp: number) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${b64({ alg: "x" })}.${b64({ exp })}.s`;
}

describe("middleware refresh on /dashboard", () => {
  it("refresh ok: copies Set-Cookie exactly and hands the new cookies to the render", async () => {
    fetchMock.mockResolvedValue(refreshOk());
    const res = await middleware(req("/dashboard/overview", "refresh_token=OLDR; theme=dark"));
    expect(res.headers.getSetCookie()).toEqual([NEW_ACCESS, NEW_REFRESH]);
    expect(forwarded(res, "cookie")).toBe("theme=dark; access_token=NEWA; refresh_token=NEWR");
    expect(forwarded(res, DASHBOARD_REQUEST_HEADER)).toBe("1");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.peakhour.test/v1/auth/refresh");
    expect(init.method).toBe("POST");
    expect(init.headers.cookie).toBe("refresh_token=OLDR");
  });

  it("an expired access cookie is not forwarded to the refresh call and is renewed too", async () => {
    fetchMock.mockResolvedValue(refreshOk());
    const stale = jwtWithExp(Math.floor(Date.now() / 1000) - 60);
    const res = await middleware(req("/dashboard", `access_token=${stale}; refresh_token=OLDR`));
    expect(fetchMock.mock.calls[0][1].headers.cookie).toBe("refresh_token=OLDR");
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });

  it("a live access cookie: no refresh call", async () => {
    const live = jwtWithExp(Math.floor(Date.now() / 1000) + 600);
    const res = await middleware(req("/dashboard", `access_token=${live}; refresh_token=R`));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(forwarded(res, DASHBOARD_REQUEST_HEADER)).toBe("1");
  });

  it("refresh 401: continues, no cookies set, request not rewritten", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", { status: 401, headers: { "set-cookie": "refresh_token=; Max-Age=0; Path=/" } }),
    );
    const res = await middleware(req("/dashboard/overview", "refresh_token=BAD"));
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(forwarded(res, "cookie")).toBe("refresh_token=BAD");
    expect(res.headers.get("content-security-policy")).toBeTruthy();
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("network error: continues", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await middleware(req("/dashboard/overview", "refresh_token=R"));
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });

  it("no refresh cookie: no call", async () => {
    await middleware(req("/dashboard/overview", "theme=dark"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("non-dashboard paths are untouched", async () => {
    for (const p of ["/", "/pricing", "/dashboardx", "/cms/overview", "/auth"]) {
      const res = await middleware(req(p, "refresh_token=R"));
      expect(res.headers.getSetCookie()).toEqual([]);
      expect(forwarded(res, DASHBOARD_REQUEST_HEADER)).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefetch / RSC / server-action / POST requests do not refresh", async () => {
    await middleware(req("/dashboard", "refresh_token=R", { headers: { "next-router-prefetch": "1" } }));
    await middleware(req("/dashboard", "refresh_token=R", { headers: { rsc: "1" } }));
    await middleware(req("/dashboard", "refresh_token=R", { headers: { "next-action": "x" } }));
    await middleware(req("/dashboard", "refresh_token=R", { method: "POST" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a client-supplied seed header is never believed", async () => {
    const res = await middleware(req("/pricing", "", { headers: { [DASHBOARD_REQUEST_HEADER]: "1" } }));
    expect(forwarded(res, DASHBOARD_REQUEST_HEADER)).toBeNull();
  });

  it("honours AUTH_COOKIE_NS", async () => {
    process.env.AUTH_COOKIE_NS = "dev";
    fetchMock.mockResolvedValue(refreshOk());
    await middleware(req("/dashboard", "refresh_token=plain; dev_refresh_token=NS"));
    expect(fetchMock.mock.calls[0][1].headers.cookie).toBe("dev_refresh_token=NS");
  });

  it("with the coming-soon gate on: a session still refreshes, a gated request never does", async () => {
    process.env.COMING_SOON = "true";
    fetchMock.mockResolvedValue(refreshOk());
    await middleware(req("/dashboard", "refresh_token=R"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    const res = await middleware(req("/dashboard", ""));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/coming-soon");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
