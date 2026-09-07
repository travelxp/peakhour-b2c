/**
 * Mutation harness for the Outcomes VALUE block's presentation rules.
 *
 * ★★WHAT IT DEFENDS: a surface that renders a true figure inside a false
 * sentence. Every judgement — may an amount be shown, from which source, over
 * how many days — is already settled in the api (api#1261), so nothing here can
 * make a wrong DECISION. What it can do is print a 22-day total under a 30-day
 * heading, relabel a merchant's rupees as dollars, or turn a count nobody took
 * into "0 orders". All three render perfectly.
 *
 * Discipline, unchanged from mutate-search-visibility.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once before anything is
 *     mutated. A stale anchor silently mutates nothing and scores a survivor.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output.
 *   - SMOKE MUTANT: one that must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL.
 *
 * ★★AND IT RUNS WEST OF UTC, DELIBERATELY. One rule here is INVISIBLE on a
 * developer machine east of UTC or on UTC itself: the covered dates are read on
 * OUR calendar rather than the viewer's. See RUN_ENV — Asia/Kolkata cannot score
 * it, because a UTC-midnight instant lands on the same day there. The locale
 * rules are asserted on the CALL rather than the output, because ICU on Windows
 * ignores LANG and an output comparison would score nothing on the one machine
 * that matters.
 *
 * Run: node scripts/mutate-outcome-value.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const TARGET = "src/lib/outcome-value.ts";
const SPEC = "src/lib/outcome-value.test.ts";

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";

/**
 * See the header. ★★AND THE ZONE IS WEST OF UTC, WHICH IS THE POINT.
 *
 * Asia/Kolkata is +05:30, so a UTC-midnight instant formatted locally lands on
 * the SAME calendar day and the `timeZone: "UTC"` rule is invisible there — a
 * mutant dropping it survives, correctly, and tells us nothing. New York is
 * -04:00/-05:00, where the same instant renders as the day BEFORE. That is the
 * direction the bug actually shipped in, and the only zone class that can score
 * it.
 */
const RUN_ENV = {
  ...process.env,
  TZ: "America/New_York",
  LANG: "en_IN.UTF-8",
  LC_ALL: "en_IN.UTF-8",
};

const MUTANTS = [
  // ── The money ────────────────────────────────────────────────────────────
  {
    name: "hard-code the currency, relabelling a merchant's rupees as dollars",
    anchor: '    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(amount);',
    mutated: '    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD" }).format(amount);',
    killer: "uses the currency the api sent, not one derived from the locale",
  },
  {
    name: "let the money and the count group their digits differently",
    anchor: '    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(amount);',
    mutated: '    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);',
    killer: "★is the page's, and the currency is still the merchant's",
  },
  {
    name: "let the COUNT drift off the card's locale",
    anchor: "  const count = new Intl.NumberFormat(LOCALE).format(value.transactions);",
    mutated: "  const count = new Intl.NumberFormat(undefined).format(value.transactions);",
    killer: "★is the page's, and the currency is still the merchant's",
  },
  {
    name: "drop the sign, reporting a period of refunds as a period of sales",
    anchor: "export function formatMoney(amount: number, currency: string): string {",
    mutated:
      "export function formatMoney(amount: number, currency: string): string {\n  amount = Math.abs(amount);",
    killer: "renders a refund-negative amount as negative",
  },
  {
    name: "let a currency Intl refuses take the page down",
    anchor: "  } catch {",
    mutated: "  } catch (e) {\n    throw e;",
    killer: "survives a currency code Intl refuses, rather than blanking the page",
  },

  // ── The calendar the dates are read on ───────────────────────────────────
  {
    name: "format the covered dates in the viewer's zone, shifting the span a day west",
    anchor: '    timeZone: "UTC",',
    mutated: "",
    killer: "★formats the UTC calendar day, whatever the viewer's timezone",
  },

  // ── The sentence under it ────────────────────────────────────────────────
  {
    name: "never say a partial figure is short",
    anchor: "  if (!value.partial) return base;",
    mutated: "  return base;",
    killer: "★says which days a partial COMMERCE figure covers",
  },
  {
    name: "claim a short revenue coverage when only the COUNT is short",
    anchor: "    if (value.daysMeasured >= value.daysInWindow) return base;",
    mutated: "    void value;",
    killer: "does not claim a short revenue coverage when only the COUNT is short",
  },
  {
    name: "date a partial MEASUREMENT, contradicting its own full-window dates",
    anchor: '  if (value.source === "analytics") {',
    mutated: "  if (false) {",
    killer: "★describes a partial MEASUREMENT by its day count, not by dates",
  },
  {
    name: "count-phrase a partial COMMERCE figure, dropping the span it really narrowed to",
    anchor: '  if (value.source === "analytics") {',
    mutated: "  if (true) {",
    killer: "★says which days a partial COMMERCE figure covers",
  },
  {
    name: "always say it, discrediting a figure that covers the whole period",
    anchor: "  if (!value.partial) return base;",
    mutated: "  if (false) return base;",
    killer: "names the source on a complete period, and says nothing about dates",
  },
  {
    name: "recompute partial from the day counts, dropping the purchase-count case",
    anchor: "  if (!value.partial) return base;",
    mutated: "  if (value.daysMeasured >= value.daysInWindow) return base;",
    killer: "reads `partial` rather than recomputing it from the day counts",
  },
  {
    name: "date the span from its own end, so it opens where it closes",
    anchor: "  return `${base} · covers ${shortDate(value.coveredSince)} to ${shortDate(",
    mutated: "  return `${base} · covers ${shortDate(value.coveredUntil)} to ${shortDate(",
    killer: "★says which days a partial COMMERCE figure covers",
  },
  {
    name: "give both sources the same label, so a figure cannot be argued with",
    anchor: '  return source === "commerce" ? "From your store\'s own orders" : "Measured by Google Analytics";',
    mutated: '  return "Measured by Google Analytics";',
    killer: "distinguishes the books from a measurement",
  },

  // ── The count ────────────────────────────────────────────────────────────
  {
    name: "print a count nobody took as zero orders, the false zero at the last step",
    anchor: "  if (value.transactions === undefined) return null;",
    mutated: "  if (false) return null;",
    killer: "★★returns nothing at all when the api sent no count",
  },
  {
    name: "hide a REAL zero count, suppressing the books' own statement",
    anchor: "  if (value.transactions === undefined) return null;",
    mutated: "  if (!value.transactions) return null;",
    killer: "prints a real zero count rather than hiding it",
  },
  {
    name: "drop the count from a refusal, losing the one figure a mixed window keeps",
    anchor: "  if (value.available) return `from ${count} ${noun}${on}`;",
    mutated: "  if (!value.available) return null;\n  return `from ${count} ${noun}${on}`;",
    killer: "★survives a refusal, because a count needs no currency",
  },
  {
    name: "never qualify a short count, claiming the period for twelve days of it",
    anchor: "  const on = short ?",
    mutated: '  const on = false ?',
    killer: "★dates the count on a refusal when it covers less than the period",
  },
  {
    name: "always qualify it, so a complete count reads as a partial one",
    anchor: "  const on = short ?",
    mutated: "  const on = true ?",
    killer: "does not date a refusal's count when it covers the whole period",
  },
  {
    name: "qualify only the refusal, leaving a diverging count bare on an available figure",
    anchor: "  if (value.available) return `from ${count} ${noun}${on}`;",
    mutated: "  if (value.available) return `from ${count} ${noun}`;",
    killer: "★dates a short count on the AVAILABLE branch when it DIVERGES from the revenue's",
  },
  {
    name: "qualify a commerce count the span has already qualified, saying it twice",
    anchor: "    (!value.available || value.transactionDays !== value.daysMeasured);",
    mutated: "    true;",
    killer: "does not qualify a commerce count the span has already qualified",
  },
  {
    name: "pluralise on nothing, so one order reads as orders",
    anchor: '  const noun = value.transactions === 1 ? "order" : "orders";',
    mutated: '  const noun = "orders";',
    killer: "says `order` for one",
  },
];

/** ★THE SMOKE MUTANT: it must die, or nothing else here counts. */
const SMOKE = {
  name: "SMOKE — every count line is absent",
  anchor: "export function orderCountLine(value: OutcomeValue): string | null {",
  mutated: "export function orderCountLine(value: OutcomeValue): string | null {\n  return null;",
  killer: "reads as a phrase beside the amount when the figure is available",
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
