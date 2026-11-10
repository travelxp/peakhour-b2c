import { describe, it, expect } from "vitest";
import { evaluate, sharedFloorBytes, toRouteMap } from "./bundle-budget.mjs";

const K = 1024;
const row = (route, kb, chunks = ["a.js"]) => ({
  route,
  firstLoadUncompressedJsBytes: kb * K,
  firstLoadChunkPaths: chunks,
});
const budgets = {
  sharedFloorKB: 950,
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
    expect(evaluate({ stats: ok, floorBytes: 500 * K, budgets, baseline: null }).violations).toEqual([]);
  });
  it("flags the floor", () => {
    const v = evaluate({ stats: ok, floorBytes: 951 * K, budgets, baseline: null }).violations;
    expect(v.map((x) => x.kind)).toEqual(["floor"]);
  });
  it("flags a dashboard route over the cap but not an allowlisted or non-dashboard one", () => {
    const stats = [row("/dashboard/y", 1601), row("/dashboard/big", 2200), row("/pricing", 1700)];
    const v = evaluate({ stats, floorBytes: 1, budgets, baseline: null }).violations;
    expect(v.map((x) => x.route)).toEqual(["/dashboard/y"]);
  });
  it("flags growth over 10% but not exactly 10%", () => {
    const baseline = { floorBytes: 500 * K, routes: { "/a": 1000 * K, "/b": 1000 * K } };
    const stats = [row("/a", 1100), row("/b", 1101)];
    const v = evaluate({ stats, floorBytes: 500 * K, budgets, baseline }).violations;
    expect(v.map((x) => x.route)).toEqual(["/b"]);
  });
  it("still applies growth to allowlisted routes and the floor", () => {
    const baseline = { floorBytes: 400 * K, routes: { "/dashboard/big": 2000 * K } };
    const v = evaluate({ stats: [row("/dashboard/big", 2300)], floorBytes: 500 * K, budgets, baseline }).violations;
    expect(v.map((x) => x.route).sort()).toEqual(["(shared)", "/dashboard/big"]);
  });
  it("ignores routes absent from the baseline (new routes)", () => {
    const baseline = { floorBytes: 1, routes: {} };
    expect(evaluate({ stats: [row("/new", 900)], floorBytes: 1, budgets, baseline }).violations).toEqual([]);
  });
  it("sorts rows largest first", () => {
    expect(evaluate({ stats: ok, floorBytes: 1, budgets, baseline: null }).rows[0].route).toBe("/dashboard/x");
  });
});

describe("toRouteMap", () => {
  it("maps route to bytes sorted by route", () => {
    expect(Object.keys(toRouteMap([row("/b", 1), row("/a", 2)]))).toEqual(["/a", "/b"]);
  });
});
