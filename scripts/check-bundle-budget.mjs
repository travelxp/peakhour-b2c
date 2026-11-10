// Usage: next build && node scripts/check-bundle-budget.mjs [--update]
// Reads .next/diagnostics/route-bundle-stats.json (uncompressed first-load JS per route).
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, renderTable, sharedFloorBytes, toRouteMap } from "./lib/bundle-budget.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statsPath = resolve(root, ".next/diagnostics/route-bundle-stats.json");
const budgetsPath = resolve(root, "docs/ci/bundle-budget.json");
const baselinePath = resolve(root, "docs/ci/bundle-baseline.json");

if (!existsSync(statsPath)) {
  console.error("Missing .next/diagnostics/route-bundle-stats.json - run `next build` first.");
  process.exit(2);
}
const stats = JSON.parse(readFileSync(statsPath, "utf8"));
const budgets = JSON.parse(readFileSync(budgetsPath, "utf8"));
const floorBytes = sharedFloorBytes(stats, (p) => statSync(resolve(root, p.split("\\").join("/"))).size);

if (process.argv.includes("--update")) {
  writeFileSync(baselinePath, JSON.stringify({ floorBytes, routes: toRouteMap(stats) }, null, 2) + "\n");
  console.log(`Wrote ${baselinePath} (${stats.length} routes, floor ${floorBytes} bytes)`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
if (!baseline) console.warn("No baseline committed; growth check skipped. Run `npm run budget:update`.");
const { violations, rows } = evaluate({ stats, floorBytes, budgets, baseline });
console.log(`Shared floor: ${(floorBytes / 1024).toFixed(0)}KB (budget ${budgets.sharedFloorKB}KB)\n`);
console.log("Largest routes:\n" + renderTable(rows));
if (violations.length) {
  console.error(`\n${violations.length} budget violation(s):`);
  for (const v of violations) console.error("  - " + v.msg);
  process.exit(1);
}
console.log("\nBundle budget OK");
