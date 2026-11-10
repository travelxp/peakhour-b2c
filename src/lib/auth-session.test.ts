import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("./auth", () => ({ getMe: vi.fn() }));

import { getMe } from "./auth";
import { ApiError } from "./api";
import {
  ME_KEY,
  classifyMeFailure,
  fetchMe,
  meRefetchInterval,
  meRetryDelay,
  meShouldRetry,
  primeMe,
  reconnectDelay,
  removeScopedQueries,
  resetEarlyMe,
} from "./auth-session";

const getMeMock = vi.mocked(getMe);
const ME = { user: { _id: "u1" }, org: null, orgs: [], business: null, businesses: [], entitlements: null };

beforeEach(() => {
  getMeMock.mockReset();
  resetEarlyMe();
  vi.unstubAllGlobals();
});

describe("classifyMeFailure", () => {
  it.each([401, 403])("%i is signed out", (status) => {
    expect(classifyMeFailure(new ApiError("UNAUTHORIZED", "no", status))).toBe("signed-out");
  });
  it.each([500, 502, 503, 504, 429, 404, 0])("HTTP %i is unreachable, not a logout", (status) => {
    expect(classifyMeFailure(new ApiError("X", "x", status))).toBe("unreachable");
  });
  it("a network failure (bare TypeError) is unreachable", () => {
    expect(classifyMeFailure(new TypeError("Failed to fetch"))).toBe("unreachable");
  });
  it("anything unknown is unreachable", () => {
    expect(classifyMeFailure("boom")).toBe("unreachable");
    expect(classifyMeFailure(undefined)).toBe("unreachable");
  });
});

describe("fetchMe", () => {
  it("returns the payload", async () => {
    getMeMock.mockResolvedValue(ME as never);
    expect(await fetchMe()).toBe(ME);
  });
  it("answers null for a 401 (signed out is an answer)", async () => {
    getMeMock.mockRejectedValue(new ApiError("UNAUTHORIZED", "no", 401));
    expect(await fetchMe()).toBeNull();
  });
  it("throws for a 500 so the query keeps its last identity", async () => {
    const err = new ApiError("INTERNAL", "boom", 500);
    getMeMock.mockRejectedValue(err);
    await expect(fetchMe()).rejects.toBe(err);
  });
  it("throws for a network failure", async () => {
    getMeMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchMe()).rejects.toThrow("Failed to fetch");
  });
});

describe("retry and backoff", () => {
  it("retries unreachable twice in-query, never a signed-out", () => {
    const e = new ApiError("X", "x", 500);
    expect(meShouldRetry(0, e)).toBe(true);
    expect(meShouldRetry(1, e)).toBe(true);
    expect(meShouldRetry(2, e)).toBe(false);
    expect(meShouldRetry(0, new ApiError("U", "u", 401))).toBe(false);
  });
  it("in-query delay is 1s, 2s, then capped at 4s", () => {
    expect([0, 1, 2, 3, 9].map(meRetryDelay)).toEqual([1000, 2000, 4000, 4000, 4000]);
  });
  it("reconnect delay doubles from 5s and caps at 60s", () => {
    expect([1, 2, 3, 4, 5, 6, 50].map(reconnectDelay)).toEqual([5000, 10000, 20000, 40000, 60000, 60000, 60000]);
    expect(reconnectDelay(0)).toBe(5000);
  });
  it("the refetch interval ticks only while the query is in error", () => {
    const q = (status: string, errorUpdateCount: number) => ({ state: { status, errorUpdateCount } }) as never;
    expect(meRefetchInterval(q("success", 0))).toBe(false);
    expect(meRefetchInterval(q("pending", 0))).toBe(false);
    expect(meRefetchInterval(q("error", 1))).toBe(5000);
    expect(meRefetchInterval(q("error", 3))).toBe(20000);
  });
});

describe("a real query using the same function", () => {
  it("keeps the last identity when a later refetch fails with a 500", async () => {
    const qc = new QueryClient();
    getMeMock.mockResolvedValueOnce(ME as never);
    await qc.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe });
    getMeMock.mockRejectedValue(new ApiError("INTERNAL", "boom", 500));
    await qc.refetchQueries({ queryKey: ME_KEY });
    const s = qc.getQueryState(ME_KEY)!;
    expect(s.status).toBe("error");
    expect(s.data).toBe(ME);
  });
  it("a 401 on refetch replaces the identity with null", async () => {
    const qc = new QueryClient();
    getMeMock.mockResolvedValueOnce(ME as never);
    await qc.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe });
    getMeMock.mockRejectedValue(new ApiError("UNAUTHORIZED", "no", 401));
    await qc.refetchQueries({ queryKey: ME_KEY });
    expect(qc.getQueryData(ME_KEY)).toBeNull();
    expect(qc.getQueryState(ME_KEY)!.status).toBe("success");
  });
});

describe("removeScopedQueries", () => {
  it("drops everything except the me query", () => {
    const qc = new QueryClient();
    qc.setQueryData(ME_KEY, ME);
    qc.setQueryData(["jobs"], [1]);
    qc.setQueryData(["content", "stats"], 2);
    removeScopedQueries(qc);
    expect(qc.getQueryData(ME_KEY)).toBe(ME);
    expect(qc.getQueryData(["jobs"])).toBeUndefined();
    expect(qc.getQueryData(["content", "stats"])).toBeUndefined();
  });
});

describe("primeMe (early start)", () => {
  it("does nothing on the server", () => {
    primeMe();
    expect(getMeMock).not.toHaveBeenCalled();
  });
  it("in a browser, starts one request that fetchMe reuses once", async () => {
    vi.stubGlobal("window", {});
    getMeMock.mockResolvedValue(ME as never);
    primeMe();
    primeMe();
    expect(getMeMock).toHaveBeenCalledTimes(1);
    expect(await fetchMe()).toBe(ME);
    expect(getMeMock).toHaveBeenCalledTimes(1);
    await fetchMe(); // the second call (a retry) is a real request
    expect(getMeMock).toHaveBeenCalledTimes(2);
  });
  it("does not start a request when the server already seeded the me query", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { documentElement: { dataset: { meSeeded: "1" } } });
    primeMe();
    expect(getMeMock).not.toHaveBeenCalled();
  });
  it("starts one when the page was not seeded", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    getMeMock.mockResolvedValue(ME as never);
    primeMe();
    expect(getMeMock).toHaveBeenCalledTimes(1);
  });
  it("a failed early request surfaces through fetchMe, classified", async () => {
    vi.stubGlobal("window", {});
    getMeMock.mockRejectedValueOnce(new ApiError("UNAUTHORIZED", "no", 401));
    primeMe();
    expect(await fetchMe()).toBeNull();
  });
});
