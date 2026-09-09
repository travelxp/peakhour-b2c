/**
 * Mutation harness for the PRESENCE REVIEW SUMMARY CARD (plan S0·5).
 *
 * ★★★WHAT THIS DEFENDS IS A CARD THAT IS ENTIRELY EMPTY TODAY. No
 * `google_review` row exists for anybody until the Pub/Sub notification topic
 * is provisioned (S0·1), so the first merchant to open Presence sees the absent
 * state and nothing else — and the api is careful to answer `null` for every
 * figure it cannot compute. The whole risk on this side is throwing that away:
 *
 *   "0.0 ★" says this business's customers rate it at nothing.
 *   "responds in 0h" says they answer instantly.
 *   "No reviews" says something about the merchant that we do not know.
 *
 * Each is one `?? 0` away, and each looks like a number rather than a bug.
 *
 * ⚠️AND THE TWO EMPTY STATES ARE DIFFERENT CLAIMS. `awaiting_reviews` is about
 * OUR pipeline; `quiet_window` is about the merchant's quarter, and carries the
 * all-time total so a business with two hundred reviews and a slow month is
 * never told they have none. A version that answers the same thing for both
 * passes any test that merely asks whether SOME empty state was returned.
 *
 * Discipline, unchanged from mutate-review-reply.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once in its own file.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output.
 *   - SMOKE MUTANT: one per (FILE, SPEC) PAIR, and it must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL.
 *   - SIGNALS RESTORE, because try/finally does not survive one.
 *
 * Run: node scripts/mutate-review-summary-card.mjs
 */
import { readFileSync, writeFileSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const SPEC = "src/lib/review-summary.test.ts";

/** One (file, spec) pair — every rule the card rests on is in the one module. */
const FILES = {
  rules: { target: "src/lib/review-summary.ts", spec: SPEC },
};

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";
const RUN_ENV = { ...process.env };
const MUTANTS = [
  {
    where: "rules",
    name: "★★★tell a merchant they have no reviews when nothing has reached us",
    anchor: "      headline: \"No reviews have reached us yet\",",
    mutated: "      headline: \"You have no reviews yet\",",
    killer: "★★★says nothing has reached us, not that the merchant has no reviews",
  },
  {
    where: "rules",
    name: "★★★answer the same thing for both absences",
    anchor: "  if (summary.state === \"awaiting_reviews\") {",
    mutated: "  if (true) {",
    killer: "★★★the two empty states do not share their words",
  },
  {
    where: "rules",
    name: "★★★drop the all-time total, so a quiet month reads as an empty listing",
    anchor: "      `We have ${summary.totalEver} on file for you in total. Nothing new has come in over ` +",
    mutated: "      `Nothing new has come in over ` +",
    killer: "★★★tells a merchant with 200 reviews about the quiet spell, not that they have none",
  },
  {
    where: "rules",
    name: "★★show an empty state over a card that has figures",
    anchor: "  if (summary.state === \"ready\") return null;",
    mutated: "  if (false) return null;",
    killer: "★★says nothing at all when there is something to show",
  },
  {
    where: "rules",
    name: "★★★render an unknown rating as zero stars",
    anchor: "  if (summary.rating === null) return null;\n  // ★ONE DECIMAL ALWAYS",
    mutated: "  if (summary.rating === null) return \"0.0\";\n  // ★ONE DECIMAL ALWAYS",
    killer: "★★★never renders an unknown rating as zero stars",
  },
  {
    where: "rules",
    name: "★★★caption a rating that does not exist",
    anchor: "  if (summary.rating === null) return null;\n  return `from ${summary.ratedCount}",
    mutated: "  if (false) return null;\n  return `from ${summary.ratedCount}",
    killer: "★★★never renders an unknown rating as zero stars",
  },
  {
    where: "rules",
    name: "★★drop the decimal, so a column of ratings does not line up",
    anchor: "  return summary.rating.toFixed(1);",
    mutated: "  return String(summary.rating);",
    killer: "★★shows one decimal, so a column of ratings lines up",
  },
  {
    where: "rules",
    name: "★say '1 rated reviews'",
    anchor: "  return `from ${summary.ratedCount} rated review${summary.ratedCount === 1 ? \"\" : \"s\"}`;",
    mutated: "  return `from ${summary.ratedCount} rated reviews`;",
    killer: "★★says how many reviews the average is over",
  },
  {
    where: "rules",
    name: "★★★report an unmeasured response time as instant",
    anchor: "  if (ms === null) return null;",
    mutated: "  if (ms === null) return \"0 minutes\";",
    killer: "★★★keeps an unmeasured response time unmeasured",
  },
  {
    where: "rules",
    name: "★★★say zero minutes for a reply inside the first minute",
    anchor: "  if (ms < 60_000) return \"under a minute\";",
    mutated: "  if (false) return \"under a minute\";",
    killer: "★★★never says zero minutes for a reply inside the first minute",
  },
  {
    where: "rules",
    name: "★★report everything in minutes, however long it took",
    anchor: "  if (minutes < 60) return `${minutes} minute${minutes === 1 ? \"\" : \"s\"}`;",
    mutated: "  if (true) return `${minutes} minute${minutes === 1 ? \"\" : \"s\"}`;",
    killer: "★★counts in minutes, then hours, then days",
  },
  {
    where: "rules",
    name: "★★flip to days as soon as a day has passed",
    anchor: "  if (hours < 48) return `${hours} hour${hours === 1 ? \"\" : \"s\"}`;",
    mutated: "  if (hours < 24) return `${hours} hour${hours === 1 ? \"\" : \"s\"}`;",
    killer: "★★keeps two days' worth in hours, where the number is easier to judge",
  },
  {
    where: "rules",
    name: "★say '1 hours'",
    anchor: "  if (hours < 48) return `${hours} hour${hours === 1 ? \"\" : \"s\"}`;",
    mutated: "  if (hours < 48) return `${hours} hours`;",
    killer: "★singular and plural, so nothing reads as '1 hours'",
  },
  {
    where: "rules",
    name: "★★★format the duration through Intl, so CI reads a different string",
    anchor: "  const days = Math.round(ms / 86_400_000);",
    mutated: "  const days = Math.round(ms / 86_400_000);\n  if (days) return new Intl.RelativeTimeFormat(undefined, { numeric: \"auto\" }).format(-days, \"day\");",
    killer: "★★counts in minutes, then hours, then days",
  },
  {
    where: "rules",
    name: "★★★show a median over some replies as though it covered them all",
    anchor: "  if (summary.timedCount === summary.respondedCount) return null;",
    mutated: "  if (true) return null;",
    killer: "★★★explains a median over fewer replies than were published",
  },
  {
    where: "rules",
    name: "★★★say nothing when NONE of the replies could be timed",
    anchor: "  if (summary.timedCount === 0) {",
    mutated: "  if (false) {",
    killer: "★★★says so when NONE of them could be timed",
  },
  {
    where: "rules",
    name: "★★★present a capped average as though it were over everything",
    anchor: "  if (summary.sampled >= summary.volume) return null;",
    mutated: "  if (true) return null;",
    killer: "★★★says so when the api capped the sample",
  },
  {
    where: "rules",
    name: "★★caveat every average, capped or not",
    anchor: "  if (summary.sampled >= summary.volume) return null;",
    mutated: "  if (summary.sampled > summary.volume) return null;",
    killer: "★★says nothing when the sample IS everything",
  },
  {
    where: "rules",
    name: "★★★offer to answer zero waiting reviews",
    anchor: "  if (summary.unanswered === 0) return null;",
    mutated: "  if (false) return null;",
    killer: "★★★offers nothing at zero",
  },
  {
    where: "rules",
    name: "★★★count only the window's waiting reviews, hiding the oldest",
    anchor: "    label: `Answer ${summary.unanswered} waiting review",
    mutated: "    label: `Answer ${summary.unansweredInWindow} waiting review",
    killer: "★★★counts the ALL-TIME waiting reviews, not the window's",
  },
  {
    where: "rules",
    name: "★★drop somebody on whichever lane opens first",
    anchor: "export const INBOX_REVIEWS_HREF = \"/dashboard/inbox?tab=reviews\";",
    mutated: "export const INBOX_REVIEWS_HREF = \"/dashboard/inbox\";",
    killer: "★★lands on the reviews lane, not on whichever tab opens first",
  },
  {
    where: "rules",
    name: "★say 'Answer 1 waiting reviews'",
    anchor: "    label: `Answer ${summary.unanswered} waiting review${summary.unanswered === 1 ? \"\" : \"s\"}`,",
    mutated: "    label: `Answer ${summary.unanswered} waiting reviews`,",
    killer: "★says 'review' when there is one",
  },
  {
    where: "rules",
    name: "★★★ignore the lane the link asked for",
    anchor: "  if (value === \"reviews\" || value === \"leads\") return value;",
    mutated: "  if (false) return value as InboxTab;",
    killer: "★★★opens the reviews lane when that is what was asked for",
  },
  {
    where: "rules",
    name: "★★★show no tab at all for a hash nobody recognises",
    anchor: "  return \"conversations\";",
    mutated: "  return value as InboxTab;",
    killer: "★★opens the default lane for anything it does not recognise",
  },
  {
    where: "rules",
    name: "★forget the other lane",
    anchor: "  if (value === \"reviews\" || value === \"leads\") return value;",
    mutated: "  if (value === \"reviews\") return value;",
    killer: "★knows the other lane too",
  },

  // ── Round 1: the sample sentence, and one key spelled twice ──────────────
  {
    where: "rules",
    name: "★★★describe the average rather than the sample, so two numbers disagree",
    anchor: "  return `Based on the ${summary.sampled} most recent of ${summary.volume} reviews.`;",
    mutated: "  return `Rating averaged over the ${summary.sampled} most recent of ${summary.volume} reviews.`;",
    killer: "★★★describes the SAMPLE, not the average",
  },
  {
    where: "rules",
    name: "★★★spell the summary query key differently from the invalidation",
    anchor: "export const REVIEW_SUMMARY_QUERY_KEY = [\"presence-review-summary\"] as const;",
    mutated: "export const REVIEW_SUMMARY_QUERY_KEY = [\"presence-reviews\"] as const;",
    killer: "★★★is a single exported key, so an invalidation cannot miss it",
  },
];

/** ★THE SMOKE MUTANT: one per (file, spec) pair. */
const SMOKES = [
  {
    where: "rules",
    name: "SMOKE (rules) — every figure is absent",
    anchor: "export function ratingLabel(summary: ReviewSummary): string | null {",
    mutated: "export function ratingLabel(summary: ReviewSummary): string | null {\n  return null;",
    killer: "★★shows one decimal, so a column of ratings lines up",
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
