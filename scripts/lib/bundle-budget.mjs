// Pure comparison logic for the bundle budget. No fs, no build needed.
// Stats rows: { route, firstLoadUncompressedJsBytes, firstLoadChunkPaths }.
const KB = 1024;

const normPath = (p) => String(p).split("\\").join("/");

/** Bytes shared by every route: the sum of chunk sizes in the intersection of all routes' first-load chunks. */
export function sharedFloorBytes(stats, chunkSize) {
  let inter = null;
  for (const r of stats) {
    const set = new Set((r.firstLoadChunkPaths ?? []).map(normPath));
    inter = inter ? new Set([...inter].filter((x) => set.has(x))) : set;
  }
  let total = 0;
  for (const p of inter ?? []) total += chunkSize(p);
  return total;
}

/** route -> bytes map, for the baseline file. */
export function toRouteMap(stats) {
  const out = {};
  for (const r of [...stats].sort((a, b) => a.route.localeCompare(b.route))) {
    out[r.route] = r.firstLoadUncompressedJsBytes;
  }
  return out;
}

export function fmt(bytes) {
  return `${(bytes / KB).toFixed(0)}KB`;
}

/**
 * budgets: { sharedFloorKB, dashboardRouteKB, growthPercent, dashboardAllowlist: {route: reason} }
 * baseline: { floorBytes, routes: {route: bytes} } | null
 */
export function evaluate({ stats, floorBytes, budgets, baseline }) {
  const violations = [];
  const allow = budgets.dashboardAllowlist ?? {};
  const floorLimit = budgets.sharedFloorKB * KB;
  if (floorBytes > floorLimit) {
    violations.push({
      kind: "floor",
      route: "(shared)",
      bytes: floorBytes,
      limit: floorLimit,
      msg: `shared floor ${fmt(floorBytes)} > ${budgets.sharedFloorKB}KB`,
    });
  }
  const growth = 1 + budgets.growthPercent / 100;
  const rows = [];
  for (const r of stats) {
    const bytes = r.firstLoadUncompressedJsBytes;
    const base = baseline?.routes?.[r.route];
    const delta = base ? (bytes - base) / base : null;
    rows.push({ route: r.route, bytes, base: base ?? null, delta });
    const cap = budgets.dashboardRouteKB * KB;
    if (r.route.startsWith("/dashboard") && bytes > cap && !(r.route in allow)) {
      violations.push({
        kind: "dashboard",
        route: r.route,
        bytes,
        limit: cap,
        msg: `${r.route} ${fmt(bytes)} > ${budgets.dashboardRouteKB}KB (add to dashboardAllowlist with a reason only if intentional)`,
      });
    }
    if (base && bytes > base * growth) {
      violations.push({
        kind: "growth",
        route: r.route,
        bytes,
        limit: Math.floor(base * growth),
        msg: `${r.route} grew ${(delta * 100).toFixed(1)}% (${fmt(base)} -> ${fmt(bytes)}), limit ${budgets.growthPercent}%`,
      });
    }
  }
  if (baseline?.floorBytes && floorBytes > baseline.floorBytes * growth) {
    violations.push({
      kind: "growth",
      route: "(shared)",
      bytes: floorBytes,
      limit: Math.floor(baseline.floorBytes * growth),
      msg: `shared floor grew ${fmt(baseline.floorBytes)} -> ${fmt(floorBytes)}, limit ${budgets.growthPercent}%`,
    });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  return { violations, rows };
}

export function renderTable(rows, n = 10) {
  const lines = ["route".padEnd(46) + "size".padStart(9) + "baseline".padStart(10) + "delta".padStart(8)];
  for (const r of rows.slice(0, n)) {
    lines.push(
      r.route.slice(0, 45).padEnd(46) +
        fmt(r.bytes).padStart(9) +
        (r.base ? fmt(r.base) : "-").padStart(10) +
        (r.delta === null ? "-" : `${(r.delta * 100).toFixed(1)}%`).padStart(8),
    );
  }
  return lines.join("\n");
}
