/**
 * Mutation harness for the content ledger's SENTENCES.
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
 * ★★WHAT THIS FILE DEFENDS IS THE SENTENCE "WE PUBLISHED FOUR ARTICLES AND THEY
 * BROUGHT 0 VISITORS" NEVER BEING PRODUCED. It is one missing analytics row
 * away at all times: the provider stores the TOP 25 PAGES per sync and nothing
 * else, so most published pages have no row and their absence is a fact about
 * our storage budget. The api answers `no_page_rows` rather than a zero exactly
 * so this repo cannot render one — and a `?? 0` anywhere below puts it back
 * without failing a type, a build or a render.
 *
 * ★AND EVERY OTHER RULE HERE IS A TRUE FIGURE INSIDE A FALSE SENTENCE: a
 * 28-day window labelled "since you published", a total summed across pages
 * whose windows cover different months, a page count taken from our page size
 * and read as the merchant's output.
 *
 * ★★IT RUNS WEST OF UTC, DELIBERATELY, for the reason mutate-outcome-value
 * records. Every date on this response is a UTC-midnight instant; on
 * Asia/Kolkata (+05:30) it lands on the same calendar day, so a mutant dropping
 * `timeZone: "UTC"` survives there and tells us nothing. New York renders it as
 * the day BEFORE — the direction the bug actually ships in, and the only zone
 * class that can score it. The locale is set for the same reason its sibling
 * sets one, and asserted on the CALL rather than the output because ICU on
 * Windows ignores LANG.
 *
 * Run: node scripts/mutate-content-ledger-copy.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const TARGET = "src/lib/content-ledger.ts";
const SPEC = "src/lib/content-ledger.test.ts";

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";

/** See the header — the zone is west of UTC and that is the point. */
const RUN_ENV = {
  ...process.env,
  TZ: "America/New_York",
  LANG: "en_IN.UTF-8",
  LC_ALL: "en_IN.UTF-8",
};

const MUTANTS = [
  // ── Dates: whose calendar, and whose locale ──────────────────────────────
  {
    name: "★★★read every date on the viewer's calendar, so a page published on the 1st says the 31st",
    anchor: '    timeZone: "UTC",',
    mutated: "",
    killer: "★★formats in UTC, not the viewer's zone",
  },
  {
    name: "★let the locale float, so the same assertion is green locally and red on CI",
    anchor: '  return d.toLocaleDateString("en-US", {',
    mutated: "  return d.toLocaleDateString(undefined, {",
    killer: "★pins the locale, so an assertion is not green locally and red on CI",
  },
  {
    name: "render an unparseable date as the epoch",
    anchor: '  if (Number.isNaN(d.getTime())) return "—";',
    mutated: "  if (false) return \"—\";",
    killer: "does not render an unparseable date as an epoch",
  },

  // ── Absences: words where a number would fit ─────────────────────────────
  {
    name: "★★★call a gap in OUR data no clicks",
    anchor: '  awaiting_sync: "No search data yet",',
    mutated: '  awaiting_sync: "No clicks",',
    killer: "★★★says there is no DATA, never that there were no clicks",
  },
  {
    name: "★★★call a page outside our top-25 storage a page nobody visited",
    anchor: '  no_page_rows: "Not in the top pages we store",',
    mutated: '  no_page_rows: "No visitors",',
    killer: "★★★says the page is not in what we STORE, never that nobody visited",
  },
  {
    name: "★★collapse the connect case into the storage one, sending them after a problem they cannot see",
    anchor: '  not_connected: "Connect Google Analytics",',
    mutated: '  not_connected: "Not in the top pages we store",',
    killer: "★★gives the connect case its own instruction",
  },
  {
    name: "★★give an unknown SEARCH reason no words at all",
    anchor: '  return SEARCH_ABSENCE[reason] ?? "Not available";',
    mutated: "  return SEARCH_ABSENCE[reason];",
    killer: "★a reason this build has never heard of still gets words",
    /** ⚠️TWO MUTANTS, NOT ONE, BECAUSE THERE ARE TWO LOOKUPS. A single mutant
     *  covering both would leave whichever table it did not touch untested
     *  while reading as covered — the same forward-compat hole, twice.
     *
     *  ★AND THE TWO KILLERS HAVE DIFFERENT TITLES, which cost a rename in the
     *  spec. The two cases sat in different `describe` blocks under one name,
     *  and vitest's JSON reporter flattens to leaf titles — so the killer
     *  pre-flight's "exactly once" saw two and refused, correctly. */
  },
  {
    name: "★★give an unknown ANALYTICS reason no words at all",
    anchor: '  return ANALYTICS_ABSENCE[reason] ?? "Not available";',
    mutated: "  return ANALYTICS_ABSENCE[reason];",
    killer: "★an ANALYTICS reason this build has never heard of still gets words",
  },

  // ── A row's own dates ────────────────────────────────────────────────────
  {
    name: "★★★read the flag as lifetime coverage, contradicting the “live N days” beside it",
    anchor: "    ? range",
    mutated: "    ? `${range} — the whole time this page has been live`",
    killer: "★★★claims nothing beyond the dates when the window starts after publication",
  },
  {
    name: "★★say nothing about a window that reaches back past the page's existence",
    anchor: "    : `${range} — includes days before this page went live`;",
    mutated: "    : range;",
    killer: "★★marks a window that reaches back past the page's own existence",
  },
  {
    name: "★★report a page with ONE reading as unchanged",
    anchor: "  if (!search.trend) return null;",
    mutated: "  if (!search.trend) return \"No change in clicks\";",
    killer: "★★offers nothing when there is no second reading",
  },
  {
    name: "★print a fall as a negative number rather than as a fall",
    anchor: '  const dir = clicksChange > 0 ? "up" : "down";',
    mutated: '  const dir = "up";',
    killer: "phrases a fall as a fall, not as a negative number",
  },
  {
    name: "★★★report days SPANNED as days measured, hiding that the total is a floor",
    anchor: "  const days = analytics.daysCovered;",
    mutated:
      "  const days = Math.round((new Date(analytics.coveredUntil).getTime() - new Date(analytics.coveredSince).getTime()) / 86400000) + 1;",
    killer: "★★★reports days PRESENT, and says so, because the total is a floor",
  },

  // ── The suggestion, and the comparison that must not be invited ──────────
  {
    name: "★★★drop the search term, inviting the estimate to be read against the PAGE's clicks",
    anchor:
      "  return (\n    `Written for “${suggestion.query}” — we estimated about ${est} ` +\n    `${est === \"1\" ? \"click\" : \"clicks\"} a month from that search`\n  );",
    mutated:
      "  return `We estimated about ${est} ${est === \"1\" ? \"click\" : \"clicks\"} a month`;",
    killer: "★★★names the SEARCH TERM the estimate was about",
  },

  // ── The totals above the table ───────────────────────────────────────────
  {
    name: "★★★read the page SIZE as the merchant's output",
    anchor: "  return truncated",
    mutated: "  return false",
    killer: "★★★names the page size rather than claiming a business total",
  },
  {
    name: "★★★drop the window, so 40 pages over a year reads as 4",
    anchor: '    : `${count(n, "page")} published in ${period}`;',
    mutated: '    : `${count(n, "page")} published through Peakhour`;',
    killer: "★★★names the WINDOW too, so 40 pages over a year is not read as 4",
  },
  {
    name: "★turn every window into months, inventing a fraction of one",
    anchor: '  if (days % 30 === 0) return `the last ${count(days / 30, "month")}`;',
    mutated: '  return `the last ${count(days / 30, "month")}`;',
    killer: "★falls back to days rather than inventing a fraction of a month",
  },
  {
    name: "★★print “1 clicks” under a summary that pluralises correctly",
    anchor: "  return `${NUM.format(n)} ${n === 1 ? one : many}`;",
    mutated: "  return `${NUM.format(n)} ${many}`;",
    killer: "★★pluralises, because a first version built these in the component",
  },
  {
    name: "★★★sum clicks across pages whose windows cover different months",
    anchor: '  if (s.reason === "mixed_windows") {',
    mutated: "  if (false) {",
    killer: "★★★states the refusal when the pages carry DIFFERENT windows",
  },
  {
    name: "★★★report an unmeasured search total as zero clicks",
    anchor: '  if (s.pagesMeasured === 0) return "No search data for these pages yet";',
    mutated: "  if (s.pagesMeasured === 0) return `${NUM.format(0)} search clicks`;",
    killer: "says there is no data rather than reporting zero clicks",
  },
  {
    name: "★★★deny search data over pages we just measured",
    anchor: '  if (s.pagesMeasured === 0) return "No search data for these pages yet";',
    mutated: '  if (s.state === "unavailable") return "No search data for these pages yet";',
    killer: "★★★never denies search data over pages it just measured",
  },
  {
    name: "★★★report unmeasured analytics as zero views",
    anchor: '  if (a.pagesMeasured === 0) return "No analytics for these pages yet";',
    mutated: "  if (a.pagesMeasured === 0) return `${NUM.format(0)} views and ${NUM.format(0)} conversions`;",
    killer: "says there is no data rather than reporting zero views",
  },
  {
    name: "★★drop “each since it was published”, so a sum over different lifetimes reads as one period",
    anchor: "across ${count(a.pagesMeasured, \"page\")}, each since it was published`",
    mutated: "across ${count(a.pagesMeasured, \"page\")}`",
    killer: "★says the total is each page over its OWN life",
  },

  // ── The plurals the module exists to hold in one place ───────────────────
  {
    name: "★★★hard-code the total's plurals again, so “1 impressions” sits above “1 impression”",
    anchor: '      `${count(s.clicks, "search click")} and ${count(s.impressions, "impression")} ` +',
    mutated:
      '      `${NUM.format(s.clicks)} search ${s.clicks === 1 ? "click" : "clicks"} and ` +\n' +
      "      `${NUM.format(s.impressions)} impressions ` +",
    killer: "★★★pluralises the TOTAL the same way the rows under it do",
  },

  // ── The window a phrase names ────────────────────────────────────────────
  {
    name: "★★★re-derive the period phrase, so no button says what its own label says",
    anchor: "  const offered = LEDGER_WINDOWS.find((w) => w.days === days);\n  if (offered) return `the last ${offered.label}`;\n",
    mutated: "",
    killer: "★★★says exactly what the button the merchant pressed says",
  },
  {
    name: "★★★drop the window from the truncated headline, so both buttons read alike",
    anchor: '    ? `Your ${NUM.format(n)} most recent ${n === 1 ? "page" : "pages"} in ${period}`',
    mutated: '    ? `Your ${NUM.format(n)} most recent ${n === 1 ? "page" : "pages"}`',
    killer: "★★★names the window in the TRUNCATED branch too",
  },
  {
    name: "★★★ask for a longer period at the longest period there is",
    anchor: "  return days >= MAX_LEDGER_DAYS",
    mutated: "  return false",
    killer: "★★★does NOT ask for a longer period at the longest period",
  },

  // ── The link ─────────────────────────────────────────────────────────────
  {
    name: "★★★hand a scheme-less url to an href, opening our own 404 in a new tab",
    anchor: '    const url = new URL(row.url);\n    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;',
    mutated: "    return new URL(row.url, \"https://x.invalid\").toString();",
    killer: "★★★refuses a stored url with no scheme, which is a RELATIVE href",
  },
  {
    name: "★★accept any scheme `new URL` parses, javascript: included",
    anchor: '    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;',
    mutated: "    return url.toString();",
    killer: "★★refuses a scheme that is not the web",
  },

  // ── Where the record begins ──────────────────────────────────────────────
  {
    name: "★★★claim the PRODUCT started recording when a business first published",
    anchor:
      "  return `Your earliest recorded page was published on ${ledgerDate(ledger.stampedFrom)}.`;",
    mutated:
      "  return `Peakhour began recording published pages on ${ledgerDate(ledger.stampedFrom)}.`;",
    killer: "★★★says when the record begins, so a short list is not read as a short year",
  },
  {
    name: "★★★stop saying when the record begins, so a short list reads as a short year",
    anchor: "  if (began <= since) return null;",
    mutated: "  return null;",
    killer: "★★★says when the record begins, so a short list is not read as a short year",
  },
  {
    name: "★explain a gap that is not there",
    anchor: "  if (began <= since) return null;",
    mutated: "  if (false) return null;",
    killer: "★says nothing when the record already begins before the window",
  },

  // ── Row identity ─────────────────────────────────────────────────────────
  {
    name: "★leave a title-less row blank, so a merchant cannot identify it",
    anchor: "  const t = row.title?.trim();",
    mutated: "  return row.title ?? \"\";\n  const t = row.title?.trim();",
    killer: "★falls back to the PATH, not to a bare empty string",
  },
  {
    name: "★★drop the query, so two different pages render as the same row",
    anchor: "    const path = `${url.pathname}${url.search}`;",
    mutated: "    const path = url.pathname;",
    killer: "★★keeps the QUERY, which is part of which page a row is",
  },
  {
    name: "★★label a title-less site-root row “/”",
    anchor: '    return path && path !== "/" ? path : row.url;',
    mutated: "    return path || row.url;",
    killer: "★★does not label a title-less ROOT row “/”",
  },
  {
    name: "★render a page published this morning as “live 0 days”",
    anchor: '  if (row.daysLive === 0) return "Published today";',
    mutated: "  if (false) return \"Published today\";",
    killer: "★says “today” rather than “live 0 days”",
  },
];

/**
 * ★THE SMOKE MUTANT: it must die, or nothing else here counts.
 *
 * ⚠️A FIRST VERSION WAS A NO-OP AND SURVIVED, WHICH IS THE HARNESS WORKING. It
 * inserted an unused second function beside `searchAbsenceText` and left the
 * real one untouched — a mutant that changes nothing cannot fail, and scoring
 * it as a survivor is the correct answer to a badly written mutant rather than
 * a fault in the code. Blanking a sentence is unambiguous.
 */
const SMOKE = {
  name: "SMOKE — the first search absence says nothing at all",
  anchor: '  awaiting_sync: "No search data yet",',
  mutated: '  awaiting_sync: "",',
  killer: "★★★says there is no DATA, never that there were no clicks",
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
// ⚠️🚫★★A DEAD RUNNER IS NOT A BASELINE EITHER, and the spawn is checked BEFORE
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
console.log(
  `killer pre-flight: ${ALL.length} killers, each green at baseline (TZ=${RUN_ENV.TZ})\n`,
);

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
