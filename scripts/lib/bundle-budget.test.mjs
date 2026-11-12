import { describe, it, expect } from "vitest";
import { evaluate, floors, sharedFloorBytes, toRouteMap } from "./bundle-budget.mjs";

const K = 1024;
const row = (route, kb, chunks = ["a.js"]) => ({
  route,
  firstLoadUncompressedJsBytes: kb * K,
  firstLoadChunkPaths: chunks,
});
const F = (kb) => ({ dashboardFloorBytes: kb * K, allRoutesFloorBytes: kb * K });
const budgets = {
  dashboardFloorKB: 950,
  allRoutesFloorKB: 950,
  dashboardRouteKB: 1600,
  growthPercent: 10,
  dashboardAllowlist: { "/dashboard/big": "known" },
};

describe("sharedFloorBytes", () => {
  it("sums only chunks present in every route, normalising backslashes", () => {
    const stats = [row("/a", 1, [".next\\s\\x.js", ".next\\s\\y.js"]), row("/b", 1, [".next/s/x.js", ".next/s/z.js"])];
    const sizes = { ".next/s/x.js": 100, ".next/s/y.js": 7, ".next/s/z.js": 9 };
    expect(sharedFloorBytes(stats, (p) => sizes[p])).toBe(100);
  });
});

describe("evaluate", () => {
  const ok = [row("/", 600), row("/dashboard/x", 1500)];
  it("passes within budget", () => {
    expect(evaluate({ stats: ok, floors: F(500), budgets, baseline: null }).violations).toEqual([]);
  });
  it("flags the floor", () => {
    const v = evaluate({ stats: ok, floors: F(951), budgets, baseline: null }).violations;
    expect(v.map((x) => x.kind)).toEqual(["floor", "floor"]);
  });
  it("flags a dashboard route over the cap but not an allowlisted or non-dashboard one", () => {
    const stats = [row("/dashboard/y", 1601), row("/dashboard/big", 2200), row("/pricing", 1700)];
    const v = evaluate({ stats, floors: F(1), budgets, baseline: null }).violations;
    expect(v.map((x) => x.route)).toEqual(["/dashboard/y"]);
  });
  it("flags growth over 10% but not exactly 10%", () => {
    const baseline = { floors: F(500), routes: { "/a": 1000 * K, "/b": 1000 * K } };
    const stats = [row("/a", 1100), row("/b", 1101)];
    const v = evaluate({ stats, floors: F(500), budgets, baseline }).violations;
    expect(v.map((x) => x.route)).toEqual(["/b"]);
  });
  it("still applies growth to allowlisted routes and the floor", () => {
    const baseline = { dashboardFloorBytes: 400 * K, routes: { "/dashboard/big": 2000 * K } };
    const v = evaluate({ stats: [row("/dashboard/big", 2300)], floors: F(500), budgets, baseline }).violations;
    expect(v.map((x) => x.route).sort()).toEqual(["(dashboard floor)", "/dashboard/big"]);
  });
  it("ignores routes absent from the baseline (new routes)", () => {
    const baseline = { floors: F(1), routes: {} };
    expect(evaluate({ stats: [row("/new", 900)], floors: F(1), budgets, baseline }).violations).toEqual([]);
  });
  it("sorts rows largest first", () => {
    expect(evaluate({ stats: ok, floors: F(1), budgets, baseline: null }).rows[0].route).toBe("/dashboard/x");
  });
});

describe("toRouteMap", () => {
  it("maps route to bytes sorted by route", () => {
    expect(Object.keys(toRouteMap([row("/b", 1), row("/a", 2)]))).toEqual(["/a", "/b"]);
  });
});

describe("floors", () => {
  const sizes = { "m.js": 100, "big.js": 1000 * K, "x.js": 5 };
  const mk = (route, chunks) => row(route, 1, chunks);
  const stats = [
    mk("/", ["m.js"]),
    mk("/pricing", ["m.js"]),
    ...Array.from({ length: 10 }, (_, i) => mk(`/dashboard/r${i}`, ["m.js", "big.js"])),
  ];
  it("dashboard floor ignores small marketing routes; all-routes floor does not", () => {
    const f = floors(stats, (p) => sizes[p]);
    expect(f.dashboardFloorBytes).toBe(1000 * K + 100);
    expect(f.allRoutesFloorBytes).toBe(100);
  });
  it("fails when marketing is small but the dashboard floor is over budget", () => {
    const f = floors(stats, (p) => sizes[p]);
    const v = evaluate({ stats, floors: f, budgets, baseline: null }).violations;
    expect(v.map((x) => x.route)).toEqual(["(dashboard floor)"]);
  });
  it("counts a chunk present in 90% of dashboard routes but not 80%", () => {
    const d = (n) => Array.from({ length: 10 }, (_, i) => mk(`/dashboard/r${i}`, i < n ? ["x.js"] : []));
    expect(sharedFloorBytes(d(9), (p) => sizes[p], { prefix: "/dashboard", minShare: 0.9 })).toBe(5);
    expect(sharedFloorBytes(d(8), (p) => sizes[p], { prefix: "/dashboard", minShare: 0.9 })).toBe(0);
  });
});
