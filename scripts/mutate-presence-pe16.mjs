#!/usr/bin/env node
/**
 * Mutation harness for PE-16 (b2c): the Presence page draws a panel only for a network that declares it, and reads the network it judged.
 *
 * Each case breaks one rule and names the spec that must go red. A spec that never ran is not a kill, so the runner reads vitest's JSON and
 * requires at least one failed test; it prints which tests failed so a kill by the wrong guard is visible. PASS cases run the untouched
 * source first, and a case whose anchor is missing or not unique stops the run. Never kill this run mid-case: the restore is in a finally,
 * which a kill skips. Check `git status` after.
 *
 * Run: node scripts/mutate-presence-pe16.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOME = "src/components/presence/presence-home.tsx";
const PANELS = "src/lib/presence-panels.ts";
const KIT_LIB = "src/lib/review-kit.ts";
const INSIGHTS = "src/components/presence/insights-panel.tsx";
const CONNECT = "src/components/presence/network-connect-card.tsx";
const RENDER = "src/components/presence/presence-adapter-test.test.tsx";
const WIRING = "src/components/presence/presence-wiring.test.ts";

const CASES = [
  ["the panels read the api's default, not the network judged", HOME, RENDER, "const panelNetwork = aboutNetwork?.network;", "const panelNetwork = netSwitcher?.value;"],
  ["the listing panels draw for every network", HOME, RENDER, "const listingOn = drawsListing(aboutNetwork);", "const listingOn = true;"],
  ["the review cards draw for every network", HOME, WIRING, "const reviewsOn = drawsReviews(aboutNetwork);", "const reviewsOn = true;"],
  ["the edit card draws for a network that cannot be written", HOME, RENDER, "const editOn = listingOn && aboutNetwork?.capabilities.edit !== false;", "const editOn = listingOn;"],
  ["the kit draws for a network with no listing", HOME, RENDER, "{reviewsOn && listingOn ? <ReviewKitCard", "{reviewsOn ? <ReviewKitCard"],
  ["changing the network keeps the pending form request", HOME, WIRING, "                    setEditRequest(null);\n", ""],
  ["a failed status read is dropped without a word", PANELS, RENDER, "return networks.filter((_, i) => reads[i]?.isError === true);", "return [];"],
  ["the poster link forgets the network", KIT_LIB, RENDER, "if (network) q.set(\"network\", network);", ""],
  ["the insights panel with no entry draws all six tiles", INSIGHTS, RENDER, "declaredMetrics(entry?.capabilities ?? capsFallback)", "declaredMetrics(entry?.capabilities)"],
  ["the insights panel with no entry always draws", INSIGHTS, RENDER, "if (!drawsInsights(entry ?? { capabilities: capsFallback })) return null;", ""],
  ["a reviews-only network is asked to connect a listing", CONNECT, RENDER, "network.capabilities.listing === false ? (", "false ? ("],
  ["drawsReviews ignores the declaration", PANELS, RENDER, "return entry?.capabilities?.reviews !== false;", "return true;"],
  ["drawsListing ignores the declaration", PANELS, RENDER, "return entry?.capabilities?.listing !== false;", "return true;"],
];

const dir = mkdtempSync(join(tmpdir(), "mut-pe16-b2c-"));
const out = join(dir, "r.json");

function runSpec(spec) {
  rmSync(out, { force: true });
  const r = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", spec, "--reporter=json", `--outputFile=${out}`], { stdio: "ignore", timeout: 180_000 });
  if (r.error) throw r.error;
  const j = JSON.parse(readFileSync(out, "utf-8"));
  const failedNames = j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => a.title));
  return { total: j.numTotalTests, failed: j.numFailedTests, failedNames };
}

for (const spec of new Set(CASES.map((c) => c[2]))) {
  const { total, failed } = runSpec(spec);
  if (total === 0 || failed !== 0) {
    console.error(`PASS case failed: ${spec} (${failed}/${total})`);
    process.exit(2);
  }
  console.log(`pass  ${spec} (${total} tests)`);
}

let survived = 0;
for (const [name, file, spec, from, to] of CASES) {
  const original = readFileSync(file, "utf-8");
  const text = original.replaceAll("\r\n", "\n");
  const count = text.split(from).length - 1;
  if (count !== 1) {
    console.error(`anchor not unique or missing for "${name}" (${count})`);
    process.exit(2);
  }
  let result;
  try {
    writeFileSync(file, text.replace(from, () => to));
    result = runSpec(spec);
  } finally {
    writeFileSync(file, original);
  }
  const killed = result.total > 0 && result.failed > 0;
  if (!killed) survived++;
  console.log(`${killed ? "killed  " : "SURVIVED"}  ${name} (${result.failed}/${result.total})${killed ? `  by: ${result.failedNames.slice(0, 2).join(" | ").slice(0, 140)}` : ""}`);
}
rmSync(dir, { recursive: true, force: true });
console.log(survived === 0 ? `all ${CASES.length} mutants killed` : `${survived} SURVIVED`);
process.exit(survived === 0 ? 0 : 1);
