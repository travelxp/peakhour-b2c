/**
 * Mutation harness for the MEASUREMENT HEALTH panel's client-side rules.
 *
 * Discipline, unchanged from mutate-content-ledger-copy.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once before anything is
 *     mutated. A stale anchor silently mutates nothing and scores a survivor.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output.
 *   - SMOKE MUTANT: one that must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL.
 *
 * ★★WHAT THIS DEFENDS IS A CORRECT SERVER ANSWER SURVIVING THE CLIENT. Every
 * verdict on this panel was decided in the api, where it is mutation-tested
 * already; there are exactly two ways this side can ruin one, and both are a
 * single line.
 *
 * ★THE FIRST IS OFFERING A REPAIR WHERE THERE IS NOTHING TO REPAIR — steps
 * under a green row, or a link to Google's admin under "we couldn't read your
 * analytics", where the thing to fix is the Reconnect button on the page the
 * panel is standing on.
 *
 * ★★AND THE SECOND IS THE EXPENSIVE ONE: DROPPING A FINDING THIS BUILD DOES NOT
 * RECOGNISE. The api's check set and state set grow independently of this
 * deploy. A lookup that filters, throws, or falls back to the green style turns
 * a real fault into a screen that says everything is fine — and nobody goes
 * looking for a check that was silently dropped.
 *
 * Run: node scripts/mutate-measurement-health-fix.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const TARGET = "src/lib/measurement-health.ts";
const SPEC = "src/lib/measurement-health.test.ts";

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";

/** ⏸NO TZ PIN HERE, and its sibling's is not cargo-culted across. This file
 *  formats no dates; the only number it touches is a day COUNT the api already
 *  computed. A zone that changes nothing cannot score anything. */
const RUN_ENV = { ...process.env };

const MUTANTS = [
  // ── A fix only where there is something to fix ───────────────────────────
  {
    name: "★★★offer repair steps under a check that PASSED",
    anchor: '  if (check.state !== "attention") return null;',
    mutated: '  if (check.state === "nothing_is_this") return null;',
    killer: "★★★offers nothing for a check that PASSED",
  },
  {
    name: "★★★send a merchant to Google's admin for a read WE could not make",
    anchor: '  if (check.state !== "attention") return null;',
    mutated: '  if (check.state === "ok") return null;',
    killer: "★★★offers nothing for a check we could not RUN",
  },
  {
    name: "★★★hand back SOME fix for a check this build has never heard of",
    anchor: "  return FIXES[check.id] ?? null;",
    mutated: "  return FIXES[check.id] ?? FIXES.unassigned_traffic;",
    killer: "★★★shows a finding it has never heard of, with no fix beside it",
  },

  // ── The order the findings are read in ───────────────────────────────────
  {
    name: "★★★sort “we couldn't check” below the green rows, burying it",
    anchor: 'const STATE_RANK: Record<string, number> = { attention: 0, unmeasurable: 1, ok: 2 };',
    mutated: 'const STATE_RANK: Record<string, number> = { attention: 0, ok: 1, unmeasurable: 2 };',
    killer: "★★★puts what we could not check ABOVE what passed",
  },
  {
    name: "★★★treat a state this build has never heard of as a PASS",
    anchor: "    (a, b) => (STATE_RANK[a.state] ?? 1) - (STATE_RANK[b.state] ?? 1),",
    mutated: "    (a, b) => (STATE_RANK[a.state] ?? 9) - (STATE_RANK[b.state] ?? 9),",
    killer: "★★sorts a state it has never heard of as uncertain, not as a pass",
  },
  {
    name: "★★★sort the cached response in place, reordering it under every other reader",
    anchor: "  return [...checks].sort(",
    mutated: "  return checks.sort(",
    killer: "★★★does not reorder the response object it was handed",
  },

  // ── Whether to speak at all ──────────────────────────────────────────────
  {
    name: "★★★alarm a business with nothing connected about the state this page exists to fix",
    anchor: "  return data.summary.checked > 0;",
    mutated: "  return data.checks.length > 0;",
    killer: "★★★stays quiet for a business with nothing connected",
  },
  {
    name: "★★go silent for a business we CAN check",
    anchor: "  return data.summary.checked > 0;",
    mutated: "  return data.summary.attention > 0;",
    killer: "speaks as soon as one check could be run",
  },

  // ── The counts ───────────────────────────────────────────────────────────
  {
    name: "★★★count out of what EXISTS rather than out of what we could check",
    anchor: "  const base = `${passed} of ${checked} ${checked === 1 ? \"check\" : \"checks\"} passed`;",
    mutated:
      "  const total = checked + unmeasurable;\n" +
      "  const base = `${passed} of ${total} ${total === 1 ? \"check\" : \"checks\"} passed`;",
    killer: "★★★counts out of what we could CHECK, not out of what exists",
  },
  {
    name: "★★say nothing about the checks we could not make",
    anchor: "  return unmeasurable > 0",
    mutated: "  return false",
    killer: "★★★counts out of what we could CHECK, not out of what exists",
  },
  {
    name: "★print “0 of 0 passed”, a sentence about nothing",
    anchor: "  if (checked === 0) return null;",
    mutated: "  if (false) return null;",
    killer: "★offers no ratio when nothing could be checked",
  },
  {
    name: "★count one check in the plural",
    anchor: '  return `Checked over the last ${days} ${days === 1 ? "day" : "days"}.`;',
    mutated: "  return `Checked over the last ${days} days.`;",
    killer: "counts one day in the singular",
  },
];

/**
 * ★THE SMOKE MUTANT: it must die, or nothing else here counts.
 *
 * ⚠️A FIRST VERSION DELETED ONE STEP FROM THE SELF-REFERRAL FIX AND SURVIVED,
 * WHICH IS THE HARNESS WORKING. Its killer asserted only that the step list was
 * non-empty, and two steps is still non-empty — a mutant scored against an
 * assertion that agrees with both versions is not a test, and `survived` is the
 * correct answer to a badly written mutant rather than a fault in the code.
 * Blanking a field the spec asserts is truthy is unambiguous.
 */
const SMOKE = {
  name: "SMOKE — a fix that does not say where it happens",
  anchor: '    where: "your campaign links",',
  mutated: '    where: "",',
  killer: "★every fix names where it happens and links somewhere real",
};

const ALL = [...MUTANTS, SMOKE];

function toCrlf(s) {
  return s.replace(/\r?\n/g, "\r\n");
}

/**
 * The anchor as it appears in the file, and how often.
 *
 * ★TRANSLATED, NEVER NORMALISED. The working tree may be CRLF; rewriting the
 * file with LF endings would show as a whole-file diff and could not be
 * restored byte-for-byte.
 */
function resolveAnchor(src, anchor) {
  const lf = src.split(anchor).length - 1;
  const crlf = anchor.includes("\n") ? src.split(toCrlf(anchor)).length - 1 : 0;
  if (lf > 0 && crlf > 0) return { text: anchor, count: lf + crlf };
  return crlf > 0 ? { text: toCrlf(anchor), count: crlf } : { text: anchor, count: lf };
}

/** The line ending in force WHERE THE ANCHOR MATCHED — read from the file, not
 *  inferred from the anchor, which a single-line anchor cannot carry. */
function eolAt(src, anchorText) {
  if (anchorText.includes("\r\n")) return "\r\n";
  if (anchorText.includes("\n")) return "\n";
  const i = src.indexOf(anchorText);
  if (i < 0) return "\n";
  const nl = src.indexOf("\n", i + anchorText.length);
  return nl > 0 && src[nl - 1] === "\r" ? "\r\n" : "\n";
}

function matchMutated(src, anchorText, mutated) {
  return eolAt(src, anchorText) === "\r\n" ? toCrlf(mutated) : mutated;
}

const original = readFileSync(TARGET, "utf8");

// ── Anchor pre-flight ──────────────────────────────────────────────────────
let preflightFailed = false;
for (const m of ALL) {
  const count = resolveAnchor(original, m.anchor).count;
  if (count !== 1) {
    console.error(`ANCHOR PRE-FLIGHT FAILED: "${m.name}" matched ${count} time(s), expected 1`);
    preflightFailed = true;
  }
}
if (preflightFailed) process.exit(1);
console.log(`anchor pre-flight: ${ALL.length} anchors, each exactly once`);

// ── Killer pre-flight ──────────────────────────────────────────────────────
function report() {
  return spawnSync(execPath, [VITEST, "run", SPEC, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: RUN_ENV,
  });
}

function assertionsOf(r) {
  const parsed = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return parsed.testResults.flatMap((f) => f.assertionResults);
}

const baseRun = report();
// ⚠️🚫★★A DEAD RUNNER IS NOT A BASELINE, and the spawn is checked BEFORE
//  `stdout` is touched: a process that never starts returns `stdout: undefined`
//  and `.indexOf` throws a TypeError — an opaque crash in the branch written to
//  replace one.
if (baseRun.error || typeof baseRun.status !== "number") {
  console.error(
    `BASELINE FAILED: the runner did not run (${baseRun.error?.message ?? "no exit code"}). ` +
      "Nothing below this point means anything.",
  );
  process.exit(1);
}
if ((baseRun.stdout ?? "").indexOf("{") < 0) {
  console.error(
    `BASELINE FAILED: the runner produced no JSON (exit ${baseRun.status}). Every killer ` +
      "would be scored against an empty list of results.",
  );
  if (baseRun.stderr) console.error(baseRun.stderr.slice(0, 2000));
  process.exit(1);
}
const base = assertionsOf(baseRun);
let killerFailed = false;
for (const m of ALL) {
  const matches = base.filter((a) => a.title === m.killer);
  if (matches.length !== 1) {
    console.error(
      `KILLER PRE-FLIGHT FAILED: "${m.killer}" appears ${matches.length} time(s), expected 1`,
    );
    killerFailed = true;
  } else if (matches[0].status !== "passed") {
    console.error(
      `KILLER PRE-FLIGHT FAILED: "${m.killer}" is "${matches[0].status}" at BASELINE — an ` +
        "already-red spec scores every mutant it owns as killed.",
    );
    killerFailed = true;
  }
}
if (killerFailed) {
  console.error(base.map((a) => `  [${a.status}] ${a.title}`).join("\n"));
  process.exit(1);
}
console.log(`killer pre-flight: ${ALL.length} killers, each green at baseline\n`);

function runKiller(title) {
  const r = report();
  // ⚠️🚫★★A DEAD RUNNER IS NOT A KILL.
  if (r.error || typeof r.status !== "number") {
    return { killed: false, how: `the runner did not run (${r.error?.message ?? "no exit code"})` };
  }
  let all;
  try {
    all = assertionsOf(r);
  } catch {
    // ★A MUTANT THAT DOES NOT COMPILE WAS NEVER TESTED — the honest score is
    //  `survived`, not `killed`.
    return { killed: false, how: "vitest produced no JSON report" };
  }
  const mine = all.filter((a) => a.title === title);
  if (mine.length !== 1) return { killed: false, how: `designated spec vanished (${mine.length})` };
  return {
    killed: mine[0].status === "failed",
    how: mine[0].status,
    others: all.filter((a) => a.title !== title && a.status === "failed").length,
  };
}

const results = [];
for (const m of [SMOKE, ...MUTANTS]) {
  // ⚠️🚫★★TRY/FINALLY, BECAUSE A THROW BETWEEN MUTATE AND RESTORE LEAVES A
  //  MUTANT IN A TRACKED SOURCE FILE. A harness that leaves a mutant behind is
  //  worse than one that never ran.
  let r;
  try {
    const { text } = resolveAnchor(original, m.anchor);
    writeFileSync(
      TARGET,
      original.split(text).join(matchMutated(original, text, m.mutated)),
      "utf8",
    );
    r = runKiller(m.killer);
  } finally {
    writeFileSync(TARGET, original, "utf8"); // ★IN-MEMORY RESTORE, every time.
  }
  results.push({ ...m, ...r });
  const mark = r.killed ? "KILLED  " : "SURVIVED";
  const collateral = r.others ? `  (+${r.others} other spec(s) also failed)` : "";
  console.log(`${mark}  ${m.name}${collateral}`);
}

if (readFileSync(TARGET, "utf8") !== original) {
  console.error(`\nRESTORE FAILED — ${TARGET} does not match its original bytes.`);
  process.exit(1);
}

const survivors = results.filter((r) => !r.killed);
console.log(`\n${results.length - survivors.length}/${results.length} killed; restore verified.`);
if (!results[0].killed) {
  console.error("SMOKE MUTANT SURVIVED — the harness cannot detect a death. Nothing else counts.");
  process.exit(1);
}
if (survivors.length > 0) {
  console.error("\nSURVIVORS (classify before fixing):");
  for (const s of survivors) console.error(`  - ${s.name}  [${s.how}]`);
  process.exit(1);
}
