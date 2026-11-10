// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();
let path = "/dashboard";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => path }));
vi.mock("@/lib/auth", () => ({
  getMe: vi.fn(() => new Promise(() => {})), // module-eval primeMe() calls it once; never settles
  logout: vi.fn(),
  switchOrg: vi.fn(),
  switchBusiness: vi.fn(),
}));

// Same behaviour, millisecond delays: the real 1s/2s/5s+ waits are covered in auth-session.test.ts.
vi.mock("@/lib/auth-session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth-session")>()),
  meRetryDelay: () => 1,
}));

import { getMe, switchBusiness } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { resetEarlyMe } from "@/lib/auth-session";
import { AuthProvider, useAuth } from "./auth-provider";

const getMeMock = vi.mocked(getMe);
const switchMock = vi.mocked(switchBusiness);

const BIZ = { _id: "b1", name: "Shop", slug: "shop" };
const meOf = (business: typeof BIZ | null, businesses = [BIZ]) =>
  ({
    user: { _id: "u1", email: "a@b.c", name: "A" },
    org: { _id: "o1", name: "Org", slug: "org" },
    orgs: [{ _id: "o1", name: "Org", slug: "org", role: "owner" }],
    business,
    businesses,
    entitlements: null,
  }) as never;

type Auth = ReturnType<typeof useAuth>;
const latest: { current: Auth | null } = { current: null };
// Reads the most recent useAuth() value the Probe saw.
const seen = new Proxy({} as Auth, { get: (_t, key) => latest.current![key as keyof Auth] });
function Probe() {
  const auth = useAuth();
  useEffect(() => {
    latest.current = auth;
  });
  return <span data-testid="probe">{auth.isLoading ? "loading" : auth.isAuthenticated ? "in" : "out"}</span>;
}

let root: Root;
let host: HTMLElement;
let qc: QueryClient;

function tree() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

async function mount(seed?: (qc: QueryClient) => void) {
  qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } });
  seed?.(qc); // before the first render, so seeded data cannot land after the provider has already acted
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(tree());
  });
}
// Settle on the state transition, never on a fixed sleep. This used to be a 30ms real-timer sleep, which
// is a race against the retry chain (3 fetches for the 500 case): under CPU load the chain outlasted it
// and the assertion ran mid-retry. react-query keeps a query non-idle ("fetching", or "paused" while it waits out a retry
// delay) for the whole retry chain, so "every query idle" is the real settled state; the ticks around it let the mocked promises and the
// provider's effects (auto-resolve a lone business, refreshUser) run to completion.
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const flush = () =>
  act(async () => {
    await tick();
    const deadline = Date.now() + 10_000;
    while (!qc.getQueryCache().getAll().every((q) => q.state.fetchStatus === "idle")) {
      if (Date.now() > deadline) throw new Error("flush: queries still fetching after 10s");
      await tick();
    }
    await tick();
  });

beforeEach(() => {
  getMeMock.mockReset();
  switchMock.mockReset();
  push.mockReset();
  resetEarlyMe();
  path = "/dashboard";
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("AuthProvider", () => {
  it("keeps the useAuth() shape consumers rely on", async () => {
    getMeMock.mockResolvedValue(meOf(BIZ));
    await mount();
    await flush();
    expect(Object.keys(latest.current!).sort()).toEqual(
      [
        "user", "org", "orgs", "business", "businesses", "entitlements",
        "isLoading", "isAuthenticated", "isUnreachable", "retry",
        "logout", "refreshUser", "switchOrg", "switchBusiness",
      ].sort()
    );
    expect(seen.isAuthenticated).toBe(true);
    expect(seen.isLoading).toBe(false);
    expect(seen.user?._id).toBe("u1");
    expect(seen.business?._id).toBe("b1");
  });

  it("a 401 means signed out, with no unreachable state and no retry", async () => {
    getMeMock.mockRejectedValue(new ApiError("UNAUTHORIZED", "no", 401));
    await mount();
    await flush();
    expect(seen.isAuthenticated).toBe(false);
    expect(seen.isUnreachable).toBe(false);
    expect(getMeMock).toHaveBeenCalledTimes(1);
  });

  it("a 500 is retryable: not signed out, retried, and recovers", async () => {
    getMeMock
      .mockRejectedValueOnce(new ApiError("INTERNAL", "boom", 500))
      .mockRejectedValueOnce(new ApiError("INTERNAL", "boom", 500))
      .mockResolvedValue(meOf(BIZ));
    await mount();
    await flush();
    expect(getMeMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(seen.isAuthenticated).toBe(true);
    expect(seen.isUnreachable).toBe(false);
  });

  it("a persistent outage on a dashboard route shows the retry screen, and Retry recovers", async () => {
    getMeMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await mount();
    await flush();
    await flush();
    expect(host.textContent).toContain("We could not reach Peakhour");
    expect(host.querySelector("[data-testid=probe]")).toBeNull();

    getMeMock.mockResolvedValue(meOf(BIZ));
    await act(async () => {
      host.querySelector("button")!.click();
    });
    await flush();
    expect(host.textContent).not.toContain("We could not reach Peakhour");
    expect(seen.isAuthenticated).toBe(true);
  });

  it("an outage on a public route does not block the page", async () => {
    path = "/pricing";
    getMeMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await mount();
    await flush();
    await flush();
    expect(seen.isUnreachable).toBe(true);
    expect(host.querySelector("[data-testid=probe]")).not.toBeNull();
  });

  it("keeps the last identity when a refresh fails", async () => {
    getMeMock.mockResolvedValue(meOf(BIZ));
    await mount();
    await flush();
    getMeMock.mockRejectedValue(new ApiError("INTERNAL", "boom", 503));
    await act(async () => {
      await seen.refreshUser();
    });
    await flush();
    expect(seen.isUnreachable).toBe(true);
    expect(seen.isAuthenticated).toBe(true);
    expect(seen.user?._id).toBe("u1");
    expect(host.querySelector("[data-testid=probe]")).not.toBeNull();
    expect(host.textContent).toContain("Reconnecting to Peakhour");
  });

  it("a remount reuses the cached me instead of refetching", async () => {
    getMeMock.mockResolvedValue(meOf(BIZ));
    await mount();
    await flush();
    expect(getMeMock).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => {
      root.render(tree());
    });
    await flush();
    expect(seen.isAuthenticated).toBe(true);
    expect(getMeMock).toHaveBeenCalledTimes(1);
  });

  describe("single-business auto-resolve", () => {
    it("pins the lone business, drops scoped caches, and refetches me", async () => {
      getMeMock.mockResolvedValueOnce(meOf(null)).mockResolvedValue(meOf(BIZ));
      switchMock.mockResolvedValue(undefined as never);
      // Seeded BEFORE the first render. It used to be set after mount() returned, but mount()'s act can run
      // the whole pin-and-drop chain first (under CPU load it did), so the "stale" entry was written after
      // the drop and survived: the test raced its own subject.
      await mount((c) => c.setQueryData(["jobs"], ["stale-empty"]));
      await flush();
      await flush();
      expect(switchMock).toHaveBeenCalledWith("b1");
      expect(switchMock).toHaveBeenCalledTimes(1);
      expect(getMeMock).toHaveBeenCalledTimes(2);
      expect(qc.getQueryData(["jobs"])).toBeUndefined();
      expect(seen.business?._id).toBe("b1");
    });

    it("does not fire for a multi-business org", async () => {
      getMeMock.mockResolvedValue(meOf(null, [BIZ, { ...BIZ, _id: "b2" }]));
      await mount();
      await flush();
      expect(switchMock).not.toHaveBeenCalled();
    });

    it("latches after a failed attempt instead of storming the api", async () => {
      getMeMock.mockResolvedValue(meOf(null));
      switchMock.mockRejectedValue(new ApiError("GONE", "deleted", 404));
      await mount();
      await flush();
      await flush();
      expect(switchMock).toHaveBeenCalledTimes(1);
    });
  });
});
