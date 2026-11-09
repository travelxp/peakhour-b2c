/**
 * Mutation harness for the search-visibility copy layer.
 *
 * ★★WHY THIS FILE GETS ONE. `lib/search-visibility.ts` is where four rounds of
 * api work become a sentence a merchant reads. Every rule it carries fails the
 * same way — the panel renders, the numbers look right, and the words claim
 * something about the merchant's business that we cannot support. No type, no
 * lint and no green suite can see that; a mutant can.
 *
 * ★AND ITS TWIN IN peakhour-shopify HAS THE SAME MUTANTS, because the two
 * surfaces must not drift. Neither file DECIDES anything — both phrase what the
 * api already settled — but "must not drift" is a claim worth scoring rather
 * than asserting.
 *
 * Discipline, unchanged from the programme's:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once before anything is
 *     mutated. A stale anchor silently mutates nothing and scores a survivor.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output.
 *   - SMOKE MUTANT: one that must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL — see `runKiller`.
 *
 * ★★AND IT RUNS IN A NON-UTC TIMEZONE, DELIBERATELY. One rule here — rendering
 * the window in UTC — is INVISIBLE when the machine already is UTC: dropping
 * `timeZone: "UTC"` changes nothing there, so the mutant would survive
 * correctly and tell us nothing.
 *
 * Run: node scripts/mutate-search-visibility.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const TARGET = "src/lib/search-visibility.ts";
const SPEC = "src/lib/search-visibility.test.ts";

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";

/** See the header: a UTC machine cannot score the UTC rule. */
const RUN_ENV = { ...process.env, TZ: "Asia/Kolkata" };

const MUTANTS = [
  {
    name: "ignore the api's gate, asserting absence off the numbers alone",
    anchor: "  if (r.absenceAssertable && covered > 0) {",
    mutated: "  if (covered > 0) {",
    killer: "softens to a statement about our data when absence cannot be asserted",
  },
  {
    name: "count every `unknown`, including the ones we may not speak about",
    anchor: "  const covered = r.summary.unknownWindowCovered;",
    mutated: "  const covered = r.summary.unknown;",
    killer: "counts only the products the window covers",
  },
  {
    name: "assert over zero products, so the claim has no subject",
    anchor: "  if (r.absenceAssertable && covered > 0) {",
    mutated: "  if (r.absenceAssertable && covered >= 0) {",
    killer: "does not assert over zero covered products, even with the gate open",
  },
  {
    name: "report the gate on the all-clear, colouring good news as a failure",
    anchor:
      '    text: "Every product we can measure is showing up in Google search.",\n    asserted: false,',
    mutated:
      '    text: "Every product we can measure is showing up in Google search.",\n    asserted: r.absenceAssertable,',
    killer: "says the good news as good news rather than as a zero",
  },
  {
    name: "render the window in the viewer's timezone, moving a dated claim by a day",
    anchor: '      timeZone: "UTC",\n',
    mutated: "",
    killer: "makes the strong claim only when the gate is open, and dates it",
  },
  {
    name: "print a half-parsed range rather than dropping the dates",
    anchor: '  if (!start || !end) return "";',
    mutated: '  if (false) return "";',
    killer: "says nothing when either end will not parse",
  },
  {
    name: "join the dates with a dash in a sentence that already said between",
    anchor: '  return range ? range.replace(" – ", " and ") : "";',
    mutated: "  return range;",
    killer: "joins the dates with a word, not a dash, inside the sentence",
  },
  {
    name: "look states up with `??`, so a name colliding with Object.prototype renders a function",
    anchor: "  if (Object.hasOwn(STATE_LABEL, state)) return STATE_LABEL[state];",
    mutated: "  if (STATE_LABEL[state]) return STATE_LABEL[state];",
    killer: "survives a state name that collides with Object.prototype",
  },
  {
    name: "look blockers up with `??`, so a name colliding with Object.prototype prints a function",
    anchor:
      "      Object.hasOwn(BLOCKER_NOTE, b) ? BLOCKER_NOTE[b] : `we hit a limit we cannot describe yet (${b})`,",
    mutated: "      BLOCKER_NOTE[b] ?? `we hit a limit we cannot describe yet (${b})`,",
    killer: "survives a blocker name that collides with Object.prototype",
  },
  {
    name: "swallow a blocker this map has not learned, leaving softened copy uncaveated",
    anchor:
      "    .map((b) =>\n      Object.hasOwn(BLOCKER_NOTE, b) ? BLOCKER_NOTE[b] : `we hit a limit we cannot describe yet (${b})`,\n    );",
    mutated:
      "    .map((b) => (Object.hasOwn(BLOCKER_NOTE, b) ? BLOCKER_NOTE[b] : \"\"))\n    .filter(Boolean);",
    killer: "still says something for a reason it does not recognise",
  },
  {
    name: "always use the subject lead from caveatFor, dangling the pronoun",
    anchor: "  return blockerNote(r.absenceBlockers, { subject: headline(r).count > 0 });",
    mutated: "  return blockerNote(r.absenceBlockers);",
    killer: "drops to the subjectless lead under the all-clear",
  },
  {
    name: "always use the subjectless lead, so a named list reads as if unnamed",
    anchor: "  return blockerNote(r.absenceBlockers, { subject: headline(r).count > 0 });",
    mutated: "  return blockerNote(r.absenceBlockers, { subject: false });",
    killer: "uses the subject lead when the headline named products",
  },
  {
    name: "drop the full stop, leaving one surface unpunctuated against its twin",
    anchor: "    ? `This doesn't cover everything — ${why}.`",
    mutated: "    ? `This doesn't cover everything — ${why}`",
    killer: "ends both leads as sentences",
  },
  {
    name: "go silent instead of changing the lead, hiding every blocker on the all-clear",
    anchor: "  return opts.subject === false",
    mutated: '  if (opts.subject === false) return "";\n  return false',
    killer: "changes its lead rather than going silent when the headline has no subject",
  },
  {
    name: "use the subject lead everywhere, leaving the pronoun with no antecedent",
    anchor: "  return opts.subject === false",
    mutated: "  return false",
    killer: "changes its lead rather than going silent when the headline has no subject",
  },
  {
    name: "accept a half-written body, letting NaN reach the headline",
    anchor: "    Number.isFinite(v.summary.total) &&",
    mutated: "    true &&",
    killer: "rejects a half-written body rather than letting it reach the headline",
  },
  {
    name: "stop checking `matching`, which drives every count of rows",
    anchor: "    Number.isFinite(v.matching) &&",
    mutated: "    true &&",
    killer: "rejects a body with no `matching`, which drives every count of rows",
  },
  {
    name: "trust the products array without its entries",
    anchor: '    v.products.every((p) => !!p && typeof p === "object") &&',
    mutated: "    true &&",
    killer: "rejects a products array containing a non-object entry",
  },
  {
    name: "collapse the tones, painting the actionable row like the do-nothing one",
    anchor: '  if (tone === "critical") return "destructive";',
    mutated: '  if (tone === "critical") return "secondary";',
    killer: "keeps the actionable state visually distinct from the do-nothing one",
  },
  {
    name: "give two tones the same variant",
    anchor: '  if (tone === "warning") return "outline";',
    mutated: '  if (tone === "warning") return "secondary";',
    killer: "gives each of the four tones its own variant",
  },
  {
    name: "repeat a state in the legend, explaining the same badge twice",
    anchor: "    if (!state || seen.has(state)) continue;",
    mutated: "    if (!state) continue;",
    killer: "explains only the states actually present, once each",
  },
  {
    name: "print an empty legend line for a state we cannot explain",
    anchor: "    if (!s.blurb) continue;",
    mutated: "    if (false) continue;",
    killer: "skips a state it cannot explain rather than printing a blank row",
  },
  {
    name: "describe `unknown` as a verdict on the product rather than a gap in our data",
    anchor: '    blurb: "We hold no search data for this product in the reported window.",',
    mutated: '    blurb: "Google has never shown this product.",',
    killer: "describes `unknown` as our gap rather than the product's failure",
  },
];

/** ★THE SMOKE MUTANT: it must die, or nothing else here counts. */
const SMOKE = {
  name: "SMOKE — every answer is the strong claim",
  anchor: "  const covered = r.summary.unknownWindowCovered;",
  mutated:
    '  return { text: "SMOKE", asserted: true, count: 1 };\n  const covered = r.summary.unknownWindowCovered;',
  killer: "softens to a statement about our data when absence cannot be asserted",
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
console.log(
  `killer pre-flight: ${MUTANTS.length + 1} killers, each green at baseline (TZ=${RUN_ENV.TZ})\n`,
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
