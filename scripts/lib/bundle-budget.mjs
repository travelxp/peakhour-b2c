// Pure comparison logic for the bundle budget. No fs, no build needed.
// Stats rows: { route, firstLoadUncompressedJsBytes, firstLoadChunkPaths }.
const KB = 1024;

const normPath = (p) => String(p).split("\\").join("/");

/**
 * Bytes shared by routes: sum of sizes of chunks present in at least `minShare`
 * of the (optionally filtered) routes. minShare 1 = intersection of all.
 */
export function sharedFloorBytes(stats, chunkSize, { prefix = "", minShare = 1 } = {}) {
  const routes = stats.filter((r) => r.route.startsWith(prefix));
  if (!routes.length) return 0;
  const counts = new Map();
  for (const r of routes) {
    for (const p of new Set((r.firstLoadChunkPaths ?? []).map(normPath))) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let total = 0;
  for (const [p, n] of counts) if (n >= routes.length * minShare) total += chunkSize(p);
  return total;
}

/** Both floors the budget uses. */
export function floors(stats, chunkSize) {
  return {
    dashboardFloorBytes: sharedFloorBytes(stats, chunkSize, { prefix: "/dashboard", minShare: 0.9 }),
    allRoutesFloorBytes: sharedFloorBytes(stats, chunkSize),
  };
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
export function evaluate({ stats, floors: fl, budgets, baseline }) {
  const violations = [];
  const allow = budgets.dashboardAllowlist ?? {};
  const floorChecks = [
    ["dashboardFloorBytes", "dashboard floor", budgets.dashboardFloorKB],
    ["allRoutesFloorBytes", "all-routes floor", budgets.allRoutesFloorKB],
  ];
  for (const [key, label, kb] of floorChecks) {
    if (fl[key] > kb * KB) {
      violations.push({ kind: "floor", route: `(${label})`, bytes: fl[key], limit: kb * KB,
        msg: `${label} ${fmt(fl[key])} > ${kb}KB` });
    }
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
  for (const [key, label] of floorChecks) {
    const base = baseline?.[key];
    if (base && fl[key] > base * growth) {
      violations.push({ kind: "growth", route: `(${label})`, bytes: fl[key], limit: Math.floor(base * growth),
        msg: `${label} grew ${fmt(base)} -> ${fmt(fl[key])}, limit ${budgets.growthPercent}%` });
    }
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
