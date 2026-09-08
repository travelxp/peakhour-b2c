/**
 * Mutation harness for the funnel navigation's partition.
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
 * ★★WHAT THIS DEFENDS IS A DESTINATION THAT STOPS APPEARING. The navigation
 * collapse's instruction is "the tool screens KEPT and demoted rather than
 * removed", and the way that breaks is not a crash: a pillar simply is not in
 * the list any more, in a navigation nobody has switched on, so nothing fails
 * and nobody notices until somebody switches it on and a screen is gone. No
 * type and no render can catch that; a mutant can.
 *
 * ★AND THE FLAG ITSELF IS THE OTHER HALF. `NEXT_PUBLIC_OUTCOMES_HOME` is
 * compared against the string "true" — the convention every other flag in
 * lib/flags.ts uses — rather than coerced, because "0" and "false" are both
 * truthy strings and are the two spellings somebody switching a flag OFF
 * reaches for. That mutant ships a navigation reorganisation to every merchant
 * because a variable said "false".
 *
 * Run: node scripts/mutate-nav-home.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const TARGET = "src/lib/nav-home.ts";
/**
 * ★A SECOND TARGET, BECAUSE THE FLAG MOVED. Review round 3 put
 * `OUTCOMES_HOME` in lib/flags.ts with every other client flag — a mutant that
 * cannot reach it would score its comparison rule as covered when nothing
 * touches it. Each mutant names its own target, defaulting to the partition's.
 */
const FLAGS = "src/lib/flags.ts";
const SPEC = "src/lib/nav-home.test.ts";

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";

/** No zone and no locale: nothing here reads a date or formats a number. */
const RUN_ENV = { ...process.env };

const MUTANTS = [
  // ── Nothing is removed ───────────────────────────────────────────────────
  {
    name: "★★drop the tail, losing every pillar the grouping does not name",
    anchor: "  const tail = all;",
    mutated: "  const tail = [];",
    killer: "★★keeps every pillar destination, exactly once",
  },
  {
    name: "★★sweep only the KNOWN pillars into the tail, so a new screen vanishes",
    anchor: "  const tail = all;",
    mutated:
      "  const tail = all.filter((i) => i.href.startsWith('/dashboard/o'));",
    killer:
      "★★sweeps a destination it has never heard of into the tail rather than losing it",
  },
  // ⚠★RETIRED WITH ITS TARGET, AND THE TARGET WAS DELETED RATHER THAN KEPT.
  //  This mutated an exclusion set filtered out of the tail. Review round 3
  //  added ONE dedupe at the end, which fixes every duplicate the set was
  //  preventing — so the set could not change any output, and both mutants
  //  against it SURVIVED. ★The set was removed rather than the mutants
  //  re-designated: a guard that cannot change a result reads as load-bearing
  //  to the next person. What it was protecting is now pinned by "drop the
  //  dedupe" below, which dies.

  // ── Where things land ────────────────────────────────────────────────────
  {
    name: "★promote an unassigned destination into a funnel heading it was never given",
    anchor:
      "      .filter(([, g]) => g === label)\n      .map(([h]) => byHref.get(h))",
    mutated:
      "      .filter(() => true)\n      .map(([h]) => byHref.get(h))",
    killer: "groups the pillars under the funnel questions",
  },
  {
    name: "★★drop the dedupe, so an item in two places renders in both",
    anchor: "      items: g.items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true))),",
    mutated: "      items: g.items,",
    killer: "★★never lists the promoted home twice, even once it is a pillar of its own",
  },
  // ⚠★RETIRED AS A DUPLICATE. Adding to `seen` while keeping every item is
  //  the same edit as dropping the dedupe entirely, which the entry above
  //  already scores.
  {
    name: "★★keep Overview at the top, so the whole change does nothing",
    anchor: '  const lead = LEAD_HREFS.map((h) => byHref.get(h)).filter((i): i is T => i !== undefined);',
    mutated:
      '  const lead = ["/dashboard/overview", ...LEAD_HREFS].map((h) => byHref.get(h)).filter((i): i is T => i !== undefined);',
    killer: "★demotes Overview into the tail rather than deleting it",
  },
  {
    name: "put the prerequisites below the funnel, so connecting comes after measuring",
    anchor: "    { label: \"\", items: [homeItem, ...lead] },",
    mutated: "    { label: \"\", items: [homeItem] },",
    killer: "leads with the home screen, then the two prerequisites",
  },
  {
    name: "drop the home screen from the lead, so the app opens on a list",
    anchor: "    { label: \"\", items: [homeItem, ...lead] },",
    mutated: "    { label: \"\", items: [...lead] },",
    killer: "leads with the home screen, then the two prerequisites",
  },
  {
    name: "★invent a BOUGHT heading over Commerce, which does not answer that question",
    anchor: "    { label: \"Convinced\", items: inGroup(\"Convinced\") },",
    // ⚠★AN EMPTY ONE NO LONGER COUNTS. Round 1 added the drop-empty-groups
    //  filter, which makes `items: []` a no-op — so the mutant has to put
    //  something UNDER the heading to be the defect it describes: a "Bought"
    //  label over Commerce, implying Commerce answers "what was it worth".
    mutated:
      "    { label: \"Bought\", items: inGroup(\"Convinced\") },",
    killer: "★has no BOUGHT heading, which is a finding rather than an omission",
  },
  {
    name: "rebuild each item instead of passing it through, dropping its subitems and gates",
    anchor: "      .map(([h]) => byHref.get(h))",
    mutated: "      .map(([h]) => (byHref.get(h) ? { ...byHref.get(h) } : undefined))",
    killer: "★passes items through BY REFERENCE, so icons, subitems and gates survive",
  },
  // ⚠★RETIRED WITH THE SAME SET, for the same reason — see the note above.
  {
    name: "★keep the promoted route in its parent's subitems as well",
    anchor: "      i.href !== home.href && i.subItems?.some((s) => s.href === home.href)",
    mutated: "      false",
    killer: "★removes the promoted route from whichever parent held it as a subitem",
  },
  {
    name: "★★MUTATE the shared pillar list in place, changing the un-flagged sidebar",
    anchor: "        ? { ...i, subItems: i.subItems.filter((s) => s.href !== home.href) }",
    mutated:
      "        ? ((i.subItems = i.subItems.filter((s) => s.href !== home.href)), i)",
    killer: "★removes the promoted route from whichever parent held it as a subitem",
  },
  {
    name: "★★render a heading with nothing under it",
    anchor: "    .filter((g) => g.items.length > 0);",
    mutated: "    ;",
    killer: "★★drops a heading with nothing under it rather than showing an empty section",
  },
  {
    name: "drop every group that is not labelled, losing the lead and the tail",
    anchor: "    .filter((g) => g.items.length > 0);",
    mutated: "    .filter((g) => g.label !== \"\");",
    killer: "★★keeps every pillar destination, exactly once",
  },
  {
    name: "throw when the grouping names a pillar that has been retired",
    anchor: "      .map(([h]) => byHref.get(h))\n      .filter((i): i is T => i !== undefined);",
    mutated:
      "      .map(([h]) => byHref.get(h))\n      .map((i) => { if (!i) throw new Error('missing'); return i; });",
    killer: "★★drops a heading with nothing under it rather than showing an empty section",
  },

  {
    name: "★★prefer the caller's STUB, deleting the real pillar's gate and subitems",
    anchor: "  const homeItem = byHref.get(home.href) ?? home;",
    mutated: "  const homeItem = home;",
    killer: "★★keeps the REAL pillar when the home href is also a top-level item",
  },

  // ── The flag ─────────────────────────────────────────────────────────────
  {
    name: "★★COERCE the flag, so `NEXT_PUBLIC_OUTCOMES_HOME=false` switches it ON",
    target: FLAGS,
    anchor: 'export const OUTCOMES_HOME = process.env.NEXT_PUBLIC_OUTCOMES_HOME === "true";',
    mutated: "export const OUTCOMES_HOME = Boolean(process.env.NEXT_PUBLIC_OUTCOMES_HOME);",
    killer: "★the flag is OFF for every spelling of off",
  },
  {
    name: "default the flag ON, shipping the reorganisation to everyone",
    target: FLAGS,
    anchor: 'export const OUTCOMES_HOME = process.env.NEXT_PUBLIC_OUTCOMES_HOME === "true";',
    mutated: 'export const OUTCOMES_HOME = process.env.NEXT_PUBLIC_OUTCOMES_HOME !== "0";',
    killer: "★the flag is OFF for every spelling of off",
  },
  {
    name: "★point the home route at Overview even with the flag on",
    anchor:
      'export const HOME_ROUTE = OUTCOMES_HOME ? "/dashboard/outcomes" : "/dashboard/overview";',
    mutated: 'export const HOME_ROUTE = "/dashboard/overview";',
    killer: "★the home route follows the flag, in one place",
  },
  {
    name: "★★take the server's landing route as given, so signing in lands on the demoted screen",
    anchor: '  return serverRoute === "/dashboard/overview" ? HOME_ROUTE : serverRoute;',
    mutated: "  return serverRoute;",
    killer: "★★rewrites the server's HOME literal, because the api cannot know the flag",
  },
  {
    name: "rewrite EVERY server route to home, overruling a deep link the server meant",
    anchor: '  return serverRoute === "/dashboard/overview" ? HOME_ROUTE : serverRoute;',
    mutated: "  return HOME_ROUTE;",
    killer: "★leaves a route the server MEANT exactly as it is",
  },
  {
    name: "match the home literal by PREFIX, so /dashboard/overview/setup is swallowed",
    anchor: '  return serverRoute === "/dashboard/overview" ? HOME_ROUTE : serverRoute;',
    mutated:
      '  return serverRoute.startsWith("/dashboard/overview") ? HOME_ROUTE : serverRoute;',
    killer: "★leaves a route the server MEANT exactly as it is",
  },
];

/** ★THE SMOKE MUTANT: it must die, or nothing else here counts. */
const SMOKE = {
  name: "SMOKE — the funnel navigation is always empty",
  anchor: "  const all = pillars\n    .flatMap((g) => g.items)",
  mutated: "  const all = []\n    .flatMap((g) => g.items)",
  killer: "★★keeps every pillar destination, exactly once",
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

/** ★READ EACH TARGET ONCE, AND RESTORE FROM THIS COPY — never `git checkout`. */
const ALL = [SMOKE, ...MUTANTS].map((m) => ({ ...m, target: m.target ?? TARGET }));
const originals = new Map(
  [...new Set(ALL.map((m) => m.target))].map((t) => [t, readFileSync(t, "utf8")]),
);

// ── Anchor pre-flight ──────────────────────────────────────────────────────
let preflightFailed = false;
for (const m of ALL) {
  const count = resolveAnchor(originals.get(m.target), m.anchor).count;
  if (count !== 1) {
    console.error(
      `ANCHOR PRE-FLIGHT FAILED: "${m.name}" matched ${count} time(s) in ${m.target}, expected 1`,
    );
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
for (const m of ALL) {
  // ⚠️🚫★★TRY/FINALLY, BECAUSE A THROW BETWEEN MUTATE AND RESTORE LEAVES A
  //  MUTANT IN A TRACKED SOURCE FILE. A harness that leaves a mutant behind is
  //  worse than one that never ran.
  let r;
  try {
    const pristine = originals.get(m.target);
    const { text } = resolveAnchor(pristine, m.anchor);
    writeFileSync(
      m.target,
      pristine.split(text).join(matchMutated(pristine, text, m.mutated)),
      "utf8",
    );
    r = runKiller(m.killer);
  } finally {
    // ★IN-MEMORY RESTORE, every time.
    writeFileSync(m.target, originals.get(m.target), "utf8");
  }
  results.push({ ...m, ...r });
  const mark = r.killed ? "KILLED  " : "SURVIVED";
  const collateral = r.others ? `  (+${r.others} other spec(s) also failed)` : "";
  console.log(`${mark}  ${m.name}${collateral}`);
}

for (const [target, pristine] of originals) {
  if (readFileSync(target, "utf8") !== pristine) {
    console.error(`\nRESTORE FAILED — ${target} does not match its original bytes.`);
    process.exit(1);
  }
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
