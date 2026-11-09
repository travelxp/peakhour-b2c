/**
 * Mutation harness for LIST FETCH STATE.
 *
 * ★★★WHAT THIS DEFENDS IS AN EMPTY STATE THAT IS A CLAIM. "No leads yet", "No
 * conversations yet", "No reviews have reached us" are statements about a
 * merchant's business, and only a query that COMPLETED AND RETURNED NOTHING has
 * earned one. Three Inbox lanes reached that copy through a query that had not
 * completed at all, because react-query v5 derives `isLoading` as
 * `isPending && isFetching`.
 *
 * ⚠️AND THE TWO FAILURES PULL IN OPPOSITE DIRECTIONS, which is the reason this
 * is a module rather than three inline checks:
 *   - a PAUSED query (offline) is pending and not fetching, so `isLoading` is
 *     false and the lane renders "you have none";
 *   - a DISABLED query (`enabled: false`) is pending with an IDLE fetch, so the
 *     obvious repair — gate on `isPending` — spins a skeleton for ever.
 * Fixing either one alone re-introduces the other.
 *
 * Discipline, unchanged from mutate-review-summary-card.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once in its own file.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline.
 *   - SMOKE MUTANT: one per (FILE, SPEC) PAIR, and it must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL.
 *   - SIGNALS RESTORE, because try/finally does not survive one.
 *
 * Run: node scripts/mutate-list-fetch-state.mjs
 */
import { readFileSync, writeFileSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const SPEC = "src/lib/list-fetch-state.test.ts";

const FILES = {
  rules: { target: "src/lib/list-fetch-state.ts", spec: SPEC },
};

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";
const RUN_ENV = { ...process.env };
const MUTANTS = [
  {
    where: "rules",
    name: "★★★report a paused query as an empty list",
    anchor: "    if (query.fetchStatus === \"paused\") return \"paused\";",
    mutated: "    if (false) return \"paused\";",
    killer: "★★★never reports a paused query as an empty list",
  },
  {
    where: "rules",
    name: "★★★spin a skeleton for ever on a query nobody enabled",
    anchor: "    if (query.fetchStatus === \"idle\") return \"waiting\";",
    mutated: "    if (false) return \"waiting\";",
    killer: "★★★never reports a DISABLED query as loading",
  },
  {
    where: "rules",
    name: "★★★report a failed request as an empty inbox",
    anchor: "  if (query.isError) return \"error\";",
    mutated: "  if (false) return \"error\";",
    killer: "★★★never reports a failed query as an empty list",
  },
  {
    where: "rules",
    name: "★★★let a pending flag hide the failure underneath it",
    anchor: "  if (query.isError) return \"error\";\n  if (query.isPending) {",
    mutated: "  if (query.isPending) {",
    killer: "★★★prefers the failure even when the query also looks pending",
  },
  {
    where: "rules",
    name: "★★call everything pending 'loading', whatever it is doing",
    anchor: "  if (query.isPending) {",
    mutated: "  if (query.isPending) {\n    return \"loading\";",
    killer: "★★★never reports a paused query as an empty list",
  },
  {
    where: "rules",
    name: "★★★call a completed empty list 'ready', so the empty copy never shows",
    anchor: "  return count === 0 ? \"empty\" : \"ready\";",
    mutated: "  return \"ready\";",
    killer: "★★★calls it empty only once a query has completed with nothing",
  },
  {
    where: "rules",
    name: "★★blank a list the merchant is reading, on every background refetch",
    anchor: "  return count === 0 ? \"empty\" : \"ready\";",
    mutated: "  return query.fetchStatus === \"fetching\" ? \"loading\" : count === 0 ? \"empty\" : \"ready\";",
    killer: "★a refetch over rows we already have is not a loading state",
  },
  {
    where: "rules",
    name: "★★show placeholders in every state but the one they belong to",
    anchor: "  return state === \"loading\";",
    mutated: "  return state !== \"ready\";",
    killer: "★★★shows placeholders while loading and in no other state",
  },
];

/** ★THE SMOKE MUTANT: one per (file, spec) pair. */
const SMOKES = [
  {
    where: "rules",
    name: "SMOKE (rules) — every query is ready",
    anchor: "  if (query.isError) return \"error\";",
    mutated: "  return \"ready\";\n  if (query.isError) return \"error\";",
    killer: "★★★never reports a failed query as an empty list",
  },
];

const fileOf = (m) => FILES[m.where];
const ALL = [...MUTANTS, ...SMOKES];

const originals = new Map(
  [...new Set(Object.values(FILES).map((f) => f.target))].map((t) => [t, readFileSync(t, "utf8")]),
);

/**
 * ⚠️🚫★★TRY/FINALLY DOES NOT SURVIVE A SIGNAL, and this script is synchronous
 * end to end inside a blocking `spawnSync` — so a handler that restored and
 * exited would be queued behind the whole run and never fire, while merely
 * registering it suppresses Node's default terminate-on-signal. The handler
 * sets a flag, read at the macrotask the loop awaits after each mutant, by
 * which point that iteration's `finally` has already restored its own file.
 *
 * ⏸SIGKILL STILL CANNOT BE CAUGHT. `git status` after an interrupted run
 * remains the rule.
 */
let interrupted = null;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(signal, () => {
    interrupted = signal;
  });
}

function restoreAll() {
  const failed = [];
  for (const [target, original] of originals) {
    try {
      writeFileSync(target, original, "utf8");
    } catch (err) {
      failed.push(`${target} (${err?.message ?? "write failed"})`);
    }
  }
  return failed;
}

function bailOut(signal) {
  const failed = restoreAll();
  // ⚠️`writeSync`, NOT `console.error`. `process.exit` does not flush a
  // redirected stream, and this is the line a person most needs to read.
  const message =
    failed.length === 0
      ? `\n${signal} — every target restored from memory. Verify with \`git status\`.\n`
      : `\n${signal} — RESTORE FAILED for ${failed.length} file(s):\n  ${failed.join(
          "\n  ",
        )}\n⚠️A MUTANT IS STILL IN TRACKED SOURCE. Restore it by hand before anything else.\n`;
  try {
    writeSync(2, message);
  } catch {
    /* the restore is what matters */
  }
  process.exit(failed.length === 0 ? 130 : 1);
}

// ── Anchor pre-flight ──────────────────────────────────────────────────────
let preflightFailed = false;
for (const m of ALL) {
  const { target } = fileOf(m);
  const count = originals.get(target).split(m.anchor).length - 1;
  if (count !== 1) {
    console.error(
      `ANCHOR PRE-FLIGHT FAILED: "${m.name}" matched ${count} time(s) in ${target}, expected 1` +
        `\n  anchor: ${JSON.stringify(m.anchor.slice(0, 140))}`,
    );
    preflightFailed = true;
  }
}
if (preflightFailed) process.exit(1);
console.log(`anchor pre-flight: ${ALL.length} anchors, each exactly once in its own file`);

// ── Killer pre-flight ──────────────────────────────────────────────────────
function report(spec) {
  return spawnSync(execPath, [VITEST, "run", spec, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: RUN_ENV,
  });
}

function assertionsOf(r) {
  const parsed = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return parsed.testResults.flatMap((f) => f.assertionResults);
}

const baselines = new Map();
for (const spec of [...new Set(Object.values(FILES).map((f) => f.spec))]) {
  const baseRun = report(spec);
  // ⚠️🚫★★A DEAD RUNNER IS NOT A BASELINE, and the spawn is checked BEFORE
  //  `stdout` is touched: a process that never starts returns `stdout: undefined`
  //  and `.indexOf` throws a TypeError.
  if (baseRun.error || typeof baseRun.status !== "number") {
    console.error(
      `BASELINE FAILED (${spec}): the runner did not run (${baseRun.error?.message ?? "no exit code"}).`,
    );
    process.exit(1);
  }
  if ((baseRun.stdout ?? "").indexOf("{") < 0) {
    console.error(
      `BASELINE FAILED (${spec}): the runner produced no JSON (exit ${baseRun.status}). Every ` +
        "killer would be scored against an empty list of results.",
    );
    if (baseRun.stderr) console.error(baseRun.stderr.slice(0, 2000));
    process.exit(1);
  }
  baselines.set(spec, assertionsOf(baseRun));
}

let killerFailed = false;
for (const m of ALL) {
  const { spec } = fileOf(m);
  const matches = baselines.get(spec).filter((a) => a.title === m.killer);
  if (matches.length !== 1) {
    console.error(
      `KILLER PRE-FLIGHT FAILED: "${m.killer}" appears ${matches.length} time(s) in ${spec}, expected 1`,
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
  for (const [spec, base] of baselines) {
    console.error(`\n${spec}:`);
    console.error(base.map((a) => `  [${a.status}] ${a.title}`).join("\n"));
  }
  process.exit(1);
}
console.log(`killer pre-flight: ${ALL.length} killers, each green at baseline\n`);

function runKiller(title, spec) {
  const r = report(spec);
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
for (const m of [...SMOKES, ...MUTANTS]) {
  const { target, spec } = fileOf(m);
  const original = originals.get(target);
  let r;
  try {
    writeFileSync(target, original.split(m.anchor).join(m.mutated), "utf8");
    r = runKiller(m.killer, spec);
  } finally {
    writeFileSync(target, original, "utf8"); // ★IN-MEMORY RESTORE, every time.
  }
  results.push({ ...m, ...r });
  const mark = r.killed ? "KILLED  " : "SURVIVED";
  const collateral = r.others ? `  (+${r.others} other spec(s) also failed)` : "";
  console.log(`${mark}  ${m.name}${collateral}`);
  await new Promise((resolve) => setImmediate(resolve));
  if (interrupted) bailOut(interrupted);
}

let restoreFailed = false;
for (const [target, original] of originals) {
  if (readFileSync(target, "utf8") !== original) {
    console.error(`\nRESTORE FAILED — ${target} does not match its original bytes.`);
    restoreFailed = true;
  }
}
if (restoreFailed) process.exit(1);

const survivors = results.filter((r) => !r.killed);
console.log(`\n${results.length - survivors.length}/${results.length} killed; restore verified.`);

const deadSmoke = results.filter((r) => r.name.startsWith("SMOKE") && !r.killed);
if (deadSmoke.length > 0) {
  console.error(
    "\n⚠️A SMOKE MUTANT SURVIVED. The runner is not detecting failures for that " +
      "(file, spec) pair, so every other score against it is meaningless:",
  );
  for (const s of deadSmoke) console.error(`  ${s.name} — ${s.how}`);
  process.exit(1);
}

if (survivors.length > 0) {
  console.error("\nSURVIVORS — classify each before fixing anything:");
  for (const s of survivors) console.error(`  ${s.name} (${s.how})`);
  process.exit(1);
}
console.log("every mutant killed, every smoke died.");
