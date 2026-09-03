/**
 * Mutation harness for PR-3.5 — the Studio's language variants.
 *
 * Discipline, unchanged from the programme's:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once before anything is
 *     mutated. A stale anchor silently mutates nothing and scores a survivor.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output; and a killer already red
 *     would score every mutant it owns as killed.
 *   - SMOKE MUTANT: one that must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - EACH MUTANT SCORED AGAINST ONLY THE SPEC THAT MUST KILL IT.
 *
 * Run: node scripts/mutate-template-groups.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const TARGET =
  "src/app/(site)/dashboard/content/whatsapp/templates/_components/template-groups.ts";
const SPEC =
  "src/app/(site)/dashboard/content/whatsapp/templates/_components/template-groups.test.ts";

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";

const MUTANTS = [
  {
    name: "compare languages raw, so `en-US` and `en_US` are two locales",
    anchor: '  return String(language || "en").toLowerCase().replace(/-/g, "_");',
    mutated: '  return String(language || "en").toLowerCase();',
    killer: "★★`en-US` and `en_US` are ONE locale, because the api says so",
  },
  {
    name: "fold an absent language to something the api does not (the round-1 finding)",
    anchor: '  return String(language || "en").toLowerCase()',
    mutated: '  return String(language ?? "").toLowerCase()',
    killer: "⚠️★★★an absent language folds to `en`, BECAUSE THAT IS WHAT THE API DOES",
  },
  {
    name: "fold the NAME the way the language is folded",
    anchor: "    const list = byName.get(t.name);",
    mutated: "    const list = byName.get(normaliseLanguage(t.name));",
    killer: "★★names are matched EXACTLY, because Meta keys by them",
  },
  {
    name: "sort a group with no date FIRST",
    anchor: "    return Number.isNaN(ms) ? -Infinity : ms;",
    mutated: "    return Number.isNaN(ms) ? Infinity : ms;",
    killer: "⚠️★a group with NO date sorts last — an absent date is not a recent one",
  },
  {
    name: "leave two undated groups in an engine-defined order",
    anchor:
      "      return Number.isNaN(diff) || diff === 0 ? a.name.localeCompare(b.name) : diff;",
    mutated: "      return diff;",
    killer: "⚠️★★two undated groups keep a STABLE order rather than an engine-defined one",
  },
  {
    name: "leave the variants in insertion order, so a refetch reshuffles them",
    anchor:
      "      variants: [...variants].sort((a, b) =>\n        normaliseLanguage(a.language).localeCompare(normaliseLanguage(b.language)),\n      ),",
    mutated: "      variants,",
    killer: "★variants inside a group are ordered by language, so refetches do not reshuffle",
  },
  {
    name: "report only the FIRST category, hiding the more expensive half",
    anchor:
      '        ...new Set(variants.map((v) => v.category).filter((c): c is string => typeof c === "string" && c !== "")),\n      ].sort(),',
    mutated:
      '        ...new Set(variants.slice(0, 1).map((v) => v.category).filter((c): c is string => typeof c === "string" && c !== "")),\n      ].sort(),',
    killer: "⚠️★★a group whose languages differ in CATEGORY reports BOTH",
  },
  {
    name: "let a row with no usable name into the map",
    anchor: '    if (!t || typeof t.name !== "string") continue;',
    mutated: "    if (!t) continue;",
    killer: "★a row with no usable name is skipped rather than crashing the list",
  },
  {
    name: "compare the added language raw, so a duplicate spelling slips through",
    anchor: "  const wanted = normaliseLanguage(typed);",
    mutated: "  const wanted = typed;",
    killer: "★★a language the group already holds is refused, folded",
  },
  {
    name: "give an empty language the duplicate message",
    anchor: '  if (typed === "") {\n    return {\n      code: "EMPTY",',
    mutated: '  if (false) {\n    return {\n      code: "EMPTY",',
    killer: "★an empty language is a DIFFERENT refusal from a duplicate",
  },
  {
    name: "ask the FOLD whether the box is empty (the round-1 trap)",
    // ⚠️★Once an absent language folds to `en`, an empty box folds to `en` too
    //  — so asking the fold reads a blank field as "add English".
    anchor: "  const typed = language.trim();",
    mutated: '  const typed = normaliseLanguage(language);',
    killer: "★an empty language is a DIFFERENT refusal from a duplicate",
  },
  {
    name: "refuse every language, so `Add a language` can only fail",
    anchor: "  if (heldLanguages(group).has(wanted)) {",
    mutated: "  if (true) {",
    killer: "★★and a language it does not hold is allowed",
  },
  {
    name: "summarise a DISAGREEING group with one status",
    anchor: "  return statuses.size === 1 ? [...statuses][0]! : null;",
    mutated: "  return [...statuses][0] ?? null;",
    killer: "⚠️★★★APPROVED in English and REJECTED in Hindi summarises to NOTHING",
  },
  {
    name: "never summarise, so the badge is useless where it is honest",
    anchor: "  const statuses = new Set(group.variants.map((v) => v.status));\n  return statuses.size === 1",
    mutated: "  const statuses = new Set(group.variants.map((v) => v.status));\n  return false",
    killer: "★but a group whose languages agree may say so",
  },
];

/** ★THE SMOKE MUTANT: it must die, or nothing else here counts. */
const SMOKE = {
  name: "SMOKE — every list is one empty group",
  anchor: "  const byName = new Map<string, T[]>();",
  mutated: "  const byName = new Map<string, T[]>();\n  if (true) return [];",
  killer: "★★two languages of one template are ONE group, not two rows",
};

const original = readFileSync(TARGET, "utf8");

// ── Anchor pre-flight ──────────────────────────────────────────────────────
let preflightFailed = false;
for (const m of [...MUTANTS, SMOKE]) {
  const count = original.split(m.anchor).length - 1;
  if (count !== 1) {
    console.error(`ANCHOR PRE-FLIGHT FAILED: "${m.name}" matched ${count} time(s), expected 1`);
    preflightFailed = true;
  }
}
if (preflightFailed) process.exit(1);
console.log(`anchor pre-flight: ${MUTANTS.length + 1} anchors, each exactly once`);

// ── Killer pre-flight ──────────────────────────────────────────────────────
function baseline() {
  const r = spawnSync(execPath, [VITEST, "run", SPEC, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return parsed.testResults.flatMap((f) =>
    f.assertionResults.map((a) => ({ title: a.title, status: a.status })),
  );
}
const base = baseline();
let killerFailed = false;
for (const m of [...MUTANTS, SMOKE]) {
  const matches = base.filter((a) => a.title === m.killer);
  if (matches.length !== 1) {
    console.error(`KILLER PRE-FLIGHT FAILED: "${m.killer}" appears ${matches.length} time(s), expected 1`);
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
  `killer pre-flight: ${MUTANTS.length + 1} killers, each exactly one spec, each green at baseline\n`,
);

function runKiller(title) {
  const r = spawnSync(execPath, [VITEST, "run", SPEC, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  let parsed;
  try {
    parsed = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  } catch {
    return { killed: true, how: "the file did not load" };
  }
  const all = parsed.testResults.flatMap((f) => f.assertionResults);
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
  writeFileSync(TARGET, original.split(m.anchor).join(m.mutated), "utf8");
  const r = runKiller(m.killer);
  writeFileSync(TARGET, original, "utf8"); // ★IN-MEMORY RESTORE, every time.
  results.push({ ...m, ...r });
  const mark = r.killed ? "KILLED " : "SURVIVED";
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
