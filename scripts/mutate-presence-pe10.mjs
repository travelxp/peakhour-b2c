#!/usr/bin/env node
/**
 * Mutation harness for PE-10 (the listing score), b2c side.
 *
 * The rules it holds: no edit control for a fix the api sent without an edit, no number when the api sent none, the order is said
 * truthfully, a card can be decided only while it waits, nothing says "live" before a read proves it, and a proposal never carries a source.
 * The api side (each rule, unknown versus missing, the ordering, control) has its own harness in peakhour-api.
 *
 * Each case breaks one rule and names the spec that must go red. A spec that never ran is not a kill, so the runner reads vitest's JSON and
 * requires at least one failed test. PASS cases run the untouched source first. Never kill this run mid-case: the restore is in a finally,
 * which a kill skips. Check `git status` after.
 *
 * Run: node scripts/mutate-presence-pe10.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = "src/lib/presence-score.ts";
const CARD = "src/components/presence/listing-score-card.tsx";
const SPEC = "src/lib/presence-score.test.ts";

const CASES = [
  ["a fix with no edit becomes a button", LIB, SPEC, "if (action.kind === \"none\") return { kind: \"note\", message: action.message };", "if (action.kind === \"none\") return { kind: \"propose\", label: \"Prepare this change\" };"],
  ["a form opens where the page cannot open one", LIB, SPEC, "return canOpenForm ? { kind: \"form\", label: \"Add it\", risky: action.risky } : null;", "return { kind: \"form\", label: \"Add it\", risky: action.risky };"],
  ["a card is sent as a form", LIB, SPEC, "if (action.kind === \"card\") return { kind: \"propose\", label: \"Prepare this change\" };", "if (action.kind === \"card\") return canOpenForm ? { kind: \"form\", label: \"Add it\", risky: false } : null;"],
  ["a missing score reads as zero", LIB, SPEC, "return score === null ? \"Not enough to score yet\" : `${score} out of 100`;", "return `${score ?? 0} out of 100`;"],
  ["a missing score has a tone", LIB, SPEC, "if (score === null) return \"none\";", ""],
  ["the good band starts too low", LIB, SPEC, "return score >= 85 ? \"good\"", "return score >= 50 ? \"good\""],
  ["the order is always said to be the merchant's figures", LIB, SPEC, "if (o.reason === \"figures_not_read\") return \"Ordered by what usually matters for a business like yours. We have not read your figures yet.\";", "if (o.reason === \"figures_not_read\") return `Ordered by what your customers did in the last 28 days.`;"],
  ["incomplete figures read as too few days", LIB, SPEC, "Your call and direction figures are not all in yet.", "We have too few days of your figures to go by."],
  ["the order omits why the figures were not used", LIB, SPEC, "We have too few days of your figures to go by.", ""],
  ["a decided card can be decided again", LIB, SPEC, "return c.status === \"proposed\" || c.status === \"validated\";", "return true;"],
  ["a submitted change is called live", LIB, SPEC, "return \"Sent. It shows as submitted until a later check confirms it is live.\";", "return \"Live.\";"],
  ["an approved change is called live", LIB, SPEC, "return \"Approved. It is being sent.\";", "return \"Approved. It is live.\";"],
  ["the proposal names its own source", LIB, SPEC, "return { listingId: action.listingId, network: action.network, changes: [{ field: action.field, value: action.value }] };", "return { listingId: action.listingId, network: action.network, source: \"form\", changes: [{ field: action.field, value: action.value }] };"],
  ["the proposal sends the wrong field", LIB, SPEC, "changes: [{ field: action.field, value: action.value }] };", "changes: [{ field: action.listingId, value: action.value }] };"],
  ["the fix list is not short", LIB, SPEC, "export const FIXES_SHOWN = 4;", "export const FIXES_SHOWN = 400;"],
  ["unknown checks sort last", LIB, SPEC, "const rank: Record<CheckState, number> = { gap: 0, unknown: 1, ok: 2, not_applicable: 3 };", "const rank: Record<CheckState, number> = { gap: 0, unknown: 3, ok: 2, not_applicable: 1 };"],
  ["a health item that needs a look sorts last", LIB, SPEC, "const rank = { attention: 0, unknown: 1, ok: 2 } as const;", "const rank = { attention: 2, unknown: 1, ok: 0 } as const;"],
  ["the card names a network", CARD, SPEC, "We couldn&apos;t work out your listing score just now.", "Google could not work out your listing score just now."],
  ["the card claims a ranking", CARD, SPEC, "<h3 className=\"text-sm font-semibold\">What to fix next</h3>", "<h3 className=\"text-sm font-semibold\">What to fix to rank higher</h3>"],
  ["an empty state blames the listing", LIB, SPEC, "It usually arrives within the hour. Nothing is wrong with your listing.", "It usually arrives within the hour."],
];

const dir = mkdtempSync(join(tmpdir(), "mut-pe10-b2c-"));
const out = join(dir, "r.json");

function runSpec(spec) {
  rmSync(out, { force: true });
  const r = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", spec, "--reporter=json", `--outputFile=${out}`], { stdio: "ignore", timeout: 180_000 });
  if (r.error) throw r.error;
  const j = JSON.parse(readFileSync(out, "utf-8"));
  return { total: j.numTotalTests, failed: j.numFailedTests };
}

for (const spec of new Set(CASES.map((c) => c[2]))) {
  const { total, failed } = runSpec(spec);
  if (total === 0 || failed !== 0) {
    console.error(`PASS case failed: ${spec} (${failed}/${total})`);
    process.exit(2);
  }
  console.log(`pass  ${spec} (${total} tests)`);
}

let survived = 0;
for (const [name, file, spec, from, to] of CASES) {
  const original = readFileSync(file, "utf-8");
  // Anchors use LF; a file checked out with CRLF is matched on its LF form and restored byte for byte.
  const text = original.replaceAll("\r\n", "\n");
  const count = text.split(from).length - 1;
  if (count !== 1) {
    console.error(`anchor not unique or missing for "${name}" (${count})`);
    process.exit(2);
  }
  let result;
  try {
    writeFileSync(file, text.replace(from, () => to));
    result = runSpec(spec);
  } finally {
    writeFileSync(file, original);
  }
  const killed = result.total > 0 && result.failed > 0;
  if (!killed) survived++;
  console.log(`${killed ? "killed  " : "SURVIVED"}  ${name} (${result.failed}/${result.total})`);
}
rmSync(dir, { recursive: true, force: true });
console.log(survived === 0 ? `all ${CASES.length} mutants killed` : `${survived} SURVIVED`);
process.exit(survived === 0 ? 0 : 1);
