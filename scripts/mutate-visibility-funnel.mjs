/**
 * Mutation harness for the visibility funnel's SENTENCES.
 *
 * Discipline, unchanged from mutate-outcome-value.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once before anything is
 *     mutated. A stale anchor silently mutates nothing and scores a survivor.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output.
 *   - SMOKE MUTANT: one that must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL.
 *
 * ★★WHAT THIS FILE DEFENDS IS A SENTENCE, NOT A NUMBER. Every judgement behind
 * this component — may a stage be totalled, has a source stopped, may an amount
 * be shown — is settled in the api, and this repo cannot get those wrong. What
 * it CAN get wrong is a true figure inside a false sentence: a stage the api
 * refused to total rendered as "0", a 28-day brand share stated as a percentage
 * of a 7-day figure, a lapsed grant told to "connect Google" when they already
 * did. None of those fails a type, a build, or a render.
 *
 * ★AND NEITHER THE ZONE NOR THE LOCALE IS PINNED HERE, WHICH IS A DIFFERENCE
 * FROM ITS SIBLING AND WORTH STATING RATHER THAN IMPLYING.
 * mutate-outcome-value.mjs runs west of UTC because the covered dates it
 * defends are read on a calendar, and it pins a locale because its formatters
 * take one. Nothing in this file reads a date — the api sends day COUNTS — and
 * its one formatter names `"en-US"` explicitly, so a `LANG` here would be
 * inert. ⚠️A first version set one anyway and said it mattered, which is worse
 * than not setting it: an environment variable nothing reads reads as a
 * precaution somebody took.
 *
 * Run: node scripts/mutate-visibility-funnel.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const TARGET = "src/lib/visibility-funnel.ts";
const SPEC = "src/lib/visibility-funnel.test.ts";

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";

const RUN_ENV = { ...process.env };

const MUTANTS = [
  // ── An absence that names the wrong fix ──────────────────────────────────
  {
    name: "★★say 'not connected' for a LAPSED grant, sending them to redo what they did",
    anchor: '  needs_reconnect: "reconnect Google",',
    mutated: '  needs_reconnect: "not connected",',
    killer: "★says RECONNECT for a lapsed grant, not CONNECT",
  },
  {
    name: "make OUR read failure sound like something the merchant must fix",
    anchor: "  unavailable: \"couldn't be read\",",
    mutated: '  unavailable: "needs finishing",',
    killer: "does not tell a merchant to fix something that is OUR failure",
  },
  {
    name: "collapse 'gathering data' into 'stopped updating', so a new connection reads as broken",
    anchor: '  pending: "gathering data",',
    mutated: '  pending: "stopped updating",',
    killer: "distinguishes a source that never reported from one that stopped",
  },

  // ── An untotalled stage rendered as a number ─────────────────────────────
  {
    name: "★★render an untotalled stage as a zero, the worst sentence this surface has",
    anchor: '  if (stage.incomplete === "nothing_connected") return "Nothing connected yet";',
    mutated: '  return "0";\n  if (false) return "x";',
    killer: "★never renders an untotalled stage as a zero",
  },
  {
    name: "give both incomplete states one sentence, hiding which of two fixes applies",
    anchor: '  if (stage.incomplete === "nothing_connected") return "Nothing connected yet";',
    mutated: '  if (false) return "Nothing connected yet";',
    killer: "gives the two states different sentences, because they have different fixes",
  },
  {
    name: "★★blame the merchant's connection for OUR read failure",
    anchor: "    return \"We couldn't read this\";",
    mutated: '    return "Waiting on a connection";',
    killer: "★★does not blame the merchant's connection for OUR read failure",
  },
  {
    name: "tell somebody to WAIT when there is a reconnect to do",
    anchor: '    return "Reconnect Google to see this";',
    mutated: '    return "Waiting on a connection";',
    killer: "★names the fix when there IS one, rather than telling somebody to wait",
  },
  {
    name: "★let a channel the merchant does not use decide the sentence",
    anchor:
      '  const blocking = stage.figures.filter((f) => !f.available && f.reason !== "not_connected");',
    mutated: "  const blocking = stage.figures.filter((f) => !f.available);",
    killer: "★ignores a NOT-CONNECTED source when choosing the sentence",
  },
  {
    name: "call it OUR failure when only SOME of the blockers are ours",
    anchor:
      '  if (blocking.every((f) => !f.available && f.reason === "unavailable")) {',
    mutated: '  if (blocking.some((f) => !f.available && f.reason === "unavailable")) {',
    // ★NOT the reconnect test, which this SURVIVED: its figures carry no
    //  `unavailable` at all, so `.some` and `.every` agree there. Only a MIXED
    //  set — one unreadable source beside one still gathering — can tell them
    //  apart, which is the case the sentence exists to get right.
    killer: "★★does not call it OUR failure when only SOME of the blockers are ours",
  },

  // ── The coverage note ────────────────────────────────────────────────────
  {
    name: "★report the BEST-covered source, understating the very gap the line discloses",
    anchor: "  return days.length > 0 ? Math.min(...days) : 0;",
    mutated: "  return days.length > 0 ? Math.max(...days) : 0;",
    killer: "★takes the WORST-covered source, not the best",
  },
  {
    name: "count sources that did NOT answer as covering zero days",
    anchor: "  const days = stage.figures.filter((f) => f.available).map((f) => f.days);",
    mutated: "  const days = stage.figures.map((f) => (f.available ? f.days : 0));",
    killer: "ignores sources that did not answer when working out the span",
  },
  {
    name: "★print a coverage note beside a stage with no number in it",
    anchor: '  if (typeof stage.total !== "number" || !stage.partial) return null;',
    mutated: "  if (!stage.partial) return null;",
    killer: "★says nothing beside a stage that has no number at all",
  },
  {
    name: "note partial coverage on every stage, so a complete answer never looks like one",
    anchor: '  if (typeof stage.total !== "number" || !stage.partial) return null;',
    mutated: '  if (typeof stage.total !== "number") return null;',
    killer: "says nothing when every source covered the whole window",
  },

  // ── The brand sentence ───────────────────────────────────────────────────
  {
    name: "★★state a PERCENTAGE, which can exceed 100 against a shorter window",
    anchor: "    `${NUM.format(split.brand.clicks)} of ${NUM.format(total)} search clicks came from ` +",
    mutated: "    `${Math.round((split.brand.clicks / total) * 100)}% of search clicks came from ` +",
    killer: "★★NAMES THE DAYS AND NEVER A PERCENTAGE",
  },
  {
    name: "★drop the split's own window, so it reads as the period on screen",
    anchor: "    `people searching for you by name, over the last ${windowDays} days${seeded}.`",
    mutated: "    `people searching for you by name.${seeded}`",
    killer: "★states the split's OWN window, not the page's",
  },
  // ⚠★MERGED INTO THE ENTRY BELOW. Round 2 moved the qualifier ABOVE the two
  //  zero branches (it was being stated as confirmed on the sentences most
  //  likely to be read as a verdict), so there is one line to mutate now rather
  //  than two, and its killer is the stronger of the two specs.
  {
    name: "★★drop the api's refusal, so 'we cannot name you' looks like 'not connected'",
    anchor: "  if (!split.assertable) return split.message;",
    mutated: "  if (!split.assertable) return null;",
    killer: "★renders the api's REFUSAL rather than dropping it",
  },
  {
    name: "★render a measured zero as '0 of 0', which says nothing about anything",
    anchor: "  if (total === 0) {",
    mutated: "  if (false) {",
    killer: "★turns a measured zero into a sentence rather than `0 of 0`",
  },
  {
    name: "drop the thousands separator, so a five-figure count is unreadable",
    anchor: 'const NUM = new Intl.NumberFormat("en-US");',
    mutated: "const NUM = { format: (n) => String(n) };",
    killer: "groups thousands, so a large figure is readable",
  },
  {
    name: "★★call a window with impressions and no clicks 'nobody searched'",
    anchor: "  if (total === 0 && impressions > 0) {",
    mutated: "  if (false) {",
    killer: "★★does not say NOBODY SEARCHED over a window with impressions in it",
  },
  {
    name: "count only brand impressions as the denominator, so the share is always all of it",
    anchor: "  const impressions = split.brand.impressions + split.nonBrand.impressions;",
    mutated: "  const impressions = split.brand.impressions;",
    killer: "★★does not say NOBODY SEARCHED over a window with impressions in it",
  },
  {
    name: "★★compute the seeded qualifier AFTER the zero branches, as the first version did",
    anchor:
      '  const seeded = split.termsSource === "seeded" ? " (using the name we worked out)" : "";',
    mutated: '  const seeded = "";',
    killer: "★★says the terms were guessed on the NO-CLICK sentence too",
  },
  {
    name: "narrow an EMPTY window's sentence to 'by name', implying demand that never happened",
    anchor:
      "    return `You did not appear in Google search at all in the last ${windowDays} days.`;",
    mutated:
      "    return `Nobody searched Google for you by name in the last ${windowDays} days.`;",
    killer: "★turns a measured zero into a sentence rather than `0 of 0`",
  },
  {
    name: "leave a new absence reason with no words beside its icon",
    anchor: '  return ABSENCE_TEXT[reason] ?? "not available";',
    mutated: "  return ABSENCE_TEXT[reason];",
    killer: "★names an absence this build has never heard of",
  },
  {
    name: "★hard-code the split's window, so a change to the sync ships a wrong number",
    anchor: "    `people searching for you by name, over the last ${windowDays} days${seeded}.`",
    mutated: "    `people searching for you by name, over the last 28 days${seeded}.`",
    killer: "★states the split's OWN window, not the page's",
  },
];

/** ★THE SMOKE MUTANT: it must die, or nothing else here counts. */
const SMOKE = {
  name: "SMOKE — every brand sentence is absent",
  anchor: "export function brandLine(brandSplit: VisibilityResponse[\"brandSplit\"]): string | null {",
  mutated:
    "export function brandLine(brandSplit: VisibilityResponse[\"brandSplit\"]): string | null {\n  return null;",
  killer: "★★NAMES THE DAYS AND NEVER A PERCENTAGE",
};

/**
 * ★ANCHORS ARE WRITTEN WITH LF; A FILE ON DISK MAY USE CRLF.
 *
 * ★★AND IN THIS REPO IT CANNOT, WHICH IS WORTH SAYING RATHER THAN IMPLYING
 * OTHERWISE. `.gitattributes` pins `*.ts text eol=lf`, so `core.autocrlf=true`
 * is overridden and no checkout here produces a CRLF target — `git check-attr
 * eol` confirms it. An earlier version of this comment asserted the opposite as
 * this repo's motivating fact, which was simply wrong.
 *
 * ★THE REPO THAT ACTUALLY HIT IT IS peakhour-shopify, which has no
 * `.gitattributes` at all: a file WRITTEN by an editor has LF and the same file
 * after a merge and re-checkout has CRLF, so every multi-line anchor matched
 * zero times and the pre-flight reported it as "your anchor is stale" rather
 * than "your newlines are". ⏸The durable fix there is the attribute file, not
 * more harness machinery; this stays because the two harnesses are twins and
 * because it costs nothing.
 *
 * ★RESOLVED PER ANCHOR RATHER THAN PER FILE, so a file that is mixed — which a
 * scripted edit writing LF lines into a CRLF file produces — still matches. ⚠️A
 * multi-line anchor STRADDLING an LF/CRLF boundary matches neither form and
 * fails the pre-flight loudly; it does not corrupt, and no harness run has ever
 * met one.
 *
 * ★TRANSLATED, NEVER NORMALISED. The file is rewritten byte-for-byte in its own
 * conventions — a test tool must not rewrite the line endings of a tracked file
 * as a side effect of running.
 */
function toCrlf(s) {
  return s.split("\n").join("\r\n");
}

/**
 * The form of `anchor` that actually occurs in `src`, with its count.
 *
 * ★AMBIGUITY IS A FAILURE, NOT A CHOICE. If both forms occur the anchor is not
 * unique in any meaningful sense, and the pre-flight must say so rather than
 * pick one.
 */
function resolveAnchor(src, anchor) {
  const lf = src.split(anchor).length - 1;
  const crlf = anchor.includes("\n") ? src.split(toCrlf(anchor)).length - 1 : 0;
  if (lf > 0 && crlf > 0) return { text: anchor, count: lf + crlf };
  return crlf > 0 ? { text: toCrlf(anchor), count: crlf } : { text: anchor, count: lf };
}

/**
 * The line ending in force WHERE THE ANCHOR MATCHED.
 *
 * ★★READ FROM THE FILE, NOT FROM THE ANCHOR. A first version inferred it from
 * the anchor text — which works for a multi-line anchor, whose own form IS the
 * local truth, and silently fails for a SINGLE-LINE one, because a single-line
 * anchor never contains a newline to inspect. A multi-line `mutated` (the SMOKE
 * mutant, and "go silent instead of changing the lead") was then written with
 * bare LFs into a CRLF file: harmless to parse, and a direct violation of the
 * "translated, never normalised" rule three lines above it.
 *
 * ★SO A SINGLE-LINE ANCHOR TAKES THE ENDING OF THE LINE IT MATCHED ON, which is
 * the only answer that stays right on a mixed file.
 */
function eolAt(src, anchorText) {
  if (anchorText.includes("\r\n")) return "\r\n";
  if (anchorText.includes("\n")) return "\n";
  const i = src.indexOf(anchorText);
  if (i < 0) return "\n";
  const nl = src.indexOf("\n", i + anchorText.length);
  return nl > 0 && src[nl - 1] === "\r" ? "\r\n" : "\n";
}

/** The mutated text in the convention in force where the anchor matched. */
function matchMutated(src, anchorText, mutated) {
  return eolAt(src, anchorText) === "\r\n" ? toCrlf(mutated) : mutated;
}

const original = readFileSync(TARGET, "utf8");

// ── Anchor pre-flight ──────────────────────────────────────────────────────
let preflightFailed = false;
for (const m of [...MUTANTS, SMOKE]) {
  const count = resolveAnchor(original, m.anchor).count;
  if (count !== 1) {
    console.error(`ANCHOR PRE-FLIGHT FAILED: "${m.name}" matched ${count} time(s), expected 1`);
    preflightFailed = true;
  }
}
if (preflightFailed) process.exit(1);
console.log(`anchor pre-flight: ${MUTANTS.length + 1} anchors, each exactly once`);

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

const base = assertionsOf(report());
let killerFailed = false;
for (const m of [...MUTANTS, SMOKE]) {
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
// ★NO ZONE IN THE BANNER, BECAUSE THERE IS NO ZONE. Its sibling prints one
// because it pins one; here the line always read `TZ=undefined`, which says a
// precaution FAILED rather than that none was needed.
console.log(
  `killer pre-flight: ${MUTANTS.length + 1} killers, each green at baseline\n`,
);

function runKiller(title) {
  const r = report();
  // ⚠️🚫★★A DEAD RUNNER IS NOT A KILL. Scoring an unparseable run as a kill
  //  means a runner that fails to spawn marks every mutant — SMOKE included —
  //  as killed, and the script exits 0 claiming a clean sweep.
  if (r.error || typeof r.status !== "number") {
    return { killed: false, how: `the runner did not run (${r.error?.message ?? "no exit code"})` };
  }
  let all;
  try {
    all = assertionsOf(r);
  } catch {
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
    writeFileSync(TARGET, original.split(text).join(matchMutated(original, text, m.mutated)), "utf8");
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
