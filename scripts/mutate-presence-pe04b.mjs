/**
 * Mutation harness for PE-04b on the screen: unknown control is its own state, null changes are not [],
 * a threshold reads as fewer than N, and a missing figure is not zero. Markup is not mutated here; every
 * sentence and every is-there-a-number decision is in lib/presence-panels.ts, which is.
 *
 * Discipline, as in mutate-list-fetch-state.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once (single lines, so CRLF does not matter).
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is GREEN at baseline,
 *     compared for equality against the JSON reporter's own output (vitest -t is a regex).
 *   - PASS cases are in the spec beside the refusals, and the baseline must be green first.
 *   - SMOKE MUTANT first. RESTORE FROM AN IN-MEMORY COPY in a finally, verified after.
 *   - A dead runner is not a kill.
 *
 * Run: node scripts/mutate-presence-pe04b.mjs   (never kill it mid-case: a killed run leaves a mutant)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const VITEST = "node_modules/vitest/vitest.mjs";
const LIB = "src/lib/presence-panels.ts";
const SPEC = "src/lib/presence-control-terms.test.ts";
const S = "★";

const m = (name, anchor, mutated, killer) => ({ name, target: LIB, spec: SPEC, anchor, mutated, killer });

const MUTANTS = [
  // -- Unknown control is its own state --------------------------------------------------------
  m("unknown control looks like a warning (lost control)", '    tone: "unknown",', '    tone: "warn",', S + "unknown is neither 'lost control' nor 'all good'"),
  m(
    "unknown control says edits may not go live",
    "    headline: \"We can't tell yet whether your edits can go live\",",
    '    headline: "Your edits may not go live",',
    S + "unknown is neither 'lost control' nor 'all good'",
  ),
  m(
    "unknown control says all good",
    '    tone: "unknown",\n    headline',
    '    tone: "good",\n    headline',
    S + "unknown is neither 'lost control' nor 'all good'",
  ),
  m(
    "a not-controlled reason states a rule as fact",
    "  suspended: (n) => `${n} may have suspended this listing, so edits may not go live.`,",
    "  suspended: (n) => `${n} has suspended this listing, so edits do not go live.`,",
    "not controlled is a warning, and always says may",
  ),
  m(
    "a stale failure older than the answer is reported",
    "    !!c.lastReadFailedAt && (!c.checkedAt || new Date(c.lastReadFailedAt) > new Date(c.checkedAt));",
    "    !!c.lastReadFailedAt && (!c.checkedAt || new Date(c.lastReadFailedAt) < new Date(c.checkedAt));",
    "a failure OLDER than the answer is not mentioned",
  ),
  m(
    "control is drawn though the network does not report it",
    "  if (!google || !google.capabilities?.control || !google.control) return null;",
    "  if (!google || !google.control) return null;",
    "built from the declaration: no block where the network does not report control",
  ),

  // -- null changes are not [] -------------------------------------------------------------------
  m(
    "no answer on the changes reads as nothing changed",
    "  const { items, pendingFields } = google.changes;",
    "  const items = google.changes.items ?? [];\n  const pendingFields = google.changes.pendingFields;",
    S + "null items is 'no answer yet', which must not read as nothing changed",
  ),
  m(
    "an empty change list is shown as a change",
    "  if (items.length === 0) {",
    "  if (items.length === 0 && false) {",
    S + "an empty list is the network saying nothing changed",
  ),
  m(
    "changes are drawn though the network does not report them",
    "  if (!google || !google.capabilities?.networkChanges || !google.changes) return null;",
    "  if (!google || !google.changes) return null;",
    "no block where the network does not report changes",
  ),

  // -- The threshold display ---------------------------------------------------------------------
  m(
    "a threshold is shown as a bare count",
    "  if (t.threshold !== null) return `Fewer than ${formatNumber(t.threshold)} searches`;",
    "  if (t.threshold !== null) return `${formatNumber(t.threshold)} searches`;",
    S + "a threshold reads 'Fewer than N searches' and shows no bare number",
  ),
  m(
    "a term with neither is shown as a number",
    "  return NOT_AVAILABLE_YET.toLowerCase();",
    '  return "0 searches";',
    "a term with neither says not available, not 0",
  ),
  m(
    "a never-asked list reads as nobody searched",
    "  if (st.terms === null || st.month === null) {",
    "  if (st.terms === null && false) {",
    S + "never asked (terms null) is not 'nobody searched'",
  ),
  m(
    "an empty answered month claims nobody searched",
    "That doesn't mean nobody searched: ${label} leaves out terms searched only a few times.",
    "Nobody searched.",
    "an answered month with no terms is its own state and does not claim nobody searched",
  ),
  m(
    "search terms are drawn though the network does not report them",
    "  if (!google || !google.capabilities?.searchTerms || !google.searchTerms) return null;",
    "  if (!google || !google.searchTerms) return null;",
    "no block where the network does not report search terms",
  ),
  m(
    "a month that is not a month is accepted",
    "  const m = /^(\\d{4})-(0[1-9]|1[0-2])$/.exec(month);",
    "  const m = /^(\\d{4})-(\\d{2})$/.exec(month);",
    "monthStartIso is a calendar month's first instant in UTC, and only for a real month",
  ),

  // -- A missing figure is not zero --------------------------------------------------------------
  m(
    "a metric with no figure totals 0",
    "  return nums.length === 0 ? null : nums.reduce((sum, v) => sum + v, 0);",
    "  return nums.length === 0 ? 0 : nums.reduce((sum, v) => sum + v, 0);",
    S + "a metric with no figure on any day has no total",
  ),
  m(
    "a stored zero is treated as missing",
    "  const nums = series.map((d) => d[key]).filter((v): v is number => Number.isFinite(v));",
    "  const nums = series.map((d) => d[key]).filter((v): v is number => Number.isFinite(v) && v !== 0);",
    "a stored zero stays a zero, beside a missing metric",
  ),
  m(
    "a day with no figure is drawn as zero",
    '    out.push({ date, value: typeof v === "number" && Number.isFinite(v) ? v : null });',
    '    out.push({ date, value: typeof v === "number" && Number.isFinite(v) ? v : 0 });',
    "a day with a row but no figure is a gap in the chart, not a point at zero",
  ),
  m(
    "a window of only gaps still draws a chart",
    "  return points.some((p) => p.value !== null);",
    "  return points.length > 0;",
    S + "a window of only gaps has no chart",
  ),
  m(
    "every tile is shown whatever the network declares",
    "  return INSIGHT_METRICS.filter((m) => declared.has(m.neutral));",
    "  return INSIGHT_METRICS;",
    "shows only the declared metrics, through the neutral names",
  ),
];

const SMOKE = {
  name: "SMOKE - a threshold is always a bare count",
  target: LIB,
  spec: SPEC,
  anchor: "  if (t.threshold !== null) return `Fewer than ${formatNumber(t.threshold)} searches`;",
  mutated: "  if (t.threshold !== null) return `${formatNumber(t.threshold)}`;",
  killer: S + "a threshold reads 'Fewer than N searches' and shows no bare number",
};

const ALL = [...MUTANTS, SMOKE];
const originals = new Map([...new Set(ALL.map((x) => x.target))].map((t) => [t, readFileSync(t, "utf8")]));
// Anchors may span lines; the working copy may be CRLF.
const crlf = (text, s) => (text.includes("\r\n") ? s.replace(/\n/g, "\r\n") : s);
const anchorOf = (x) => crlf(originals.get(x.target), x.anchor);
const mutatedOf = (x) => crlf(originals.get(x.target), x.mutated);

let bad = false;
for (const x of ALL) {
  const count = originals.get(x.target).split(anchorOf(x)).length - 1;
  if (count !== 1) {
    console.error(`ANCHOR PRE-FLIGHT FAILED: "${x.name}" matched ${count} time(s) in ${x.target}, expected 1`);
    bad = true;
  }
}
if (bad) process.exit(1);
console.log(`anchor pre-flight: ${ALL.length} anchors, each exactly once`);

function run(spec) {
  const r = spawnSync(execPath, [VITEST, "run", spec, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || typeof r.status !== "number") return { error: r.error?.message ?? "no exit code" };
  try {
    const parsed = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    return { results: parsed.testResults.flatMap((f) => f.assertionResults.map((a) => ({ title: a.title, status: a.status }))) };
  } catch {
    return { error: "vitest produced no JSON report" };
  }
}

const base = run(SPEC);
if (base.error) {
  console.error(`BASELINE FAILED to run ${SPEC}: ${base.error}`);
  process.exit(1);
}
const red = base.results.filter((a) => a.status !== "passed");
if (red.length) {
  console.error(`BASELINE IS RED:\n${red.map((a) => `  [${a.status}] ${a.title}`).join("\n")}`);
  process.exit(1);
}
for (const x of ALL) {
  const hits = base.results.filter((a) => a.title === x.killer);
  if (hits.length !== 1) {
    console.error(`KILLER PRE-FLIGHT FAILED: "${x.killer}" appears ${hits.length} time(s) in ${x.spec}, expected 1`);
    bad = true;
  }
}
if (bad) process.exit(1);
console.log(`killer pre-flight: ${ALL.length} killers, each exactly one spec, baseline green\n`);

const results = [];
for (const x of [SMOKE, ...MUTANTS]) {
  const pristine = originals.get(x.target);
  let outcome;
  try {
    writeFileSync(x.target, pristine.split(anchorOf(x)).join(mutatedOf(x)), "utf8");
    const r = run(x.spec);
    if (r.error) outcome = { killed: false, how: `the runner did not run (${r.error})` };
    else {
      const mine = r.results.filter((a) => a.title === x.killer);
      outcome =
        mine.length !== 1
          ? { killed: false, how: `designated spec vanished (${mine.length})` }
          : { killed: mine[0].status === "failed", how: mine[0].status };
    }
  } finally {
    writeFileSync(x.target, pristine, "utf8");
  }
  results.push({ ...x, ...outcome });
  console.log(`${outcome.killed ? "KILLED  " : "SURVIVED"}  ${x.name}`);
}

for (const [target, pristine] of originals) {
  if (readFileSync(target, "utf8") !== pristine) {
    console.error(`\nRESTORE FAILED - ${target} does not match its original bytes.`);
    process.exit(1);
  }
}
const survivors = results.filter((r) => !r.killed);
console.log(`\n${results.length - survivors.length}/${results.length} killed; restore verified.`);
if (!results[0].killed) {
  console.error("SMOKE MUTANT SURVIVED - the harness cannot detect a death. Nothing else counts.");
  process.exit(1);
}
if (survivors.length) {
  console.error("\nSURVIVORS (classify before fixing):");
  for (const s of survivors) console.error(`  - ${s.name}  [${s.how}]`);
  process.exit(1);
}
