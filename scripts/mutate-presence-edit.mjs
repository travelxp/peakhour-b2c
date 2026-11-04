#!/usr/bin/env node
/**
 * Mutation harness for PE-07 on the screen side: the form drawn from declared capabilities, the role rule, the state words (never "live"
 * before the engine says so), the switch note, one-field submits, whole lists, and the holiday offer's gates. Markup is not mutated here;
 * every sentence and every can-they-press-it decision is in lib/presence-edit.ts, which is.
 *
 * Each case breaks one rule and names the spec that must go red. A spec that never ran is not a kill, so the runner reads vitest's JSON and
 * requires at least one failed test. The untouched source runs first (PASS cases beside the refusals live in the spec). Every anchor must
 * appear EXACTLY once. Never kill this run mid-case: the restore is in a finally, which a kill skips. Check `git status` after.
 *
 * Run: node scripts/mutate-presence-edit.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = "src/lib/presence-edit.ts";
const SPEC = "src/lib/presence-edit.test.ts";

const CASES = [
  // ── drawn from capabilities ──
  ["a field the network cannot write still gets a section", "SECTIONS.filter((s) => cap.writableFields.includes(s.field))", "SECTIONS.filter(() => true)"],
  ["a risky field is not flagged", "risky: cap.riskyFields.includes(s.field) }", "risky: false }"],
  ["a listing is drawn for the first network, not its own", "caps.items.find((c) => c.network === network)", "caps.items[0]"],
  // ── roles ──
  ["a viewer is offered the forms", "if (can?.propose) return { mode: \"edit\" };", "if (true) return { mode: \"edit\" };"],
  ["an editor is offered Approve", "approve: !!can?.approve && decidable,", "approve: !!can?.propose && decidable,"],
  ["a viewer is offered Decline", "reject: !!can?.propose && decidable,", "reject: true && decidable,"],
  ["Decline is an admin's", "reject: !!can?.propose && decidable,", "reject: !!can?.approve && decidable,"],
  ["Undo is offered twice", "(c.status === \"submitted\" || c.status === \"live\") && !c.undone,", "(c.status === \"submitted\" || c.status === \"live\"),"],
  ["Undo is offered on a change that was never sent", "(c.status === \"submitted\" || c.status === \"live\") && !c.undone,", "true && !c.undone,"],
  ["Approve is offered on a decided change", "const decidable = c.status === \"proposed\" || c.status === \"validated\";", "const decidable = c.status !== \"rejected\";"],
  ["an unchecked change cannot be approved", "const decidable = c.status === \"proposed\" || c.status === \"validated\";", "const decidable = c.status === \"validated\";"],
  // ── the words ──
  ["a submitted change is called live", "headline: `Sent to ${label}, not live yet`,", "headline: `Live on ${label}`,"],
  ["a held approval does not say it was not sent", "? { headline: \"Approved, but not sent\"", "? { headline: \"Approved\""],
  ["a held approval hides the reason", "detail: `${c.held.reason} Nothing has been sent to ${label}.`", "detail: `Nothing has been sent to ${label}.`"],
  ["a failed change hides its reason", "return { headline: \"Could not be sent\", detail: reasonOf(c), tone: \"bad\" };", "return { headline: \"Could not be sent\", detail: null, tone: \"bad\" };"],
  ["a blocked change hides its reason", "return { headline: \"Not sent\", detail: reasonOf(c), tone: \"bad\" };", "return { headline: \"Not sent\", detail: null, tone: \"bad\" };"],
  ["a live change is not called live", "return { headline: `Live on ${label}`, detail: null, tone: \"good\" };", "return { headline: `Sent to ${label}`, detail: null, tone: \"good\" };"],
  ["a waiting change does not say nothing was sent", "detail: `Nothing has been sent to ${label}. ${can?.approve", "detail: `${can?.approve"],
  ["the network's name is typed into a sentence", "headline: `Sent to ${label}, not live yet`,", "headline: `Sent to Google, not live yet`,"],
  ["a change the network stopped reviewing is not warned about", "tone: outcome === \"not_shown\" ? \"warn\" : \"neutral\",", "tone: \"neutral\","],
  // ── the switch ──
  ["a held network says nothing", "if (!cap || cap.writes.released) return null;", "if (!cap) return null;"],
  ["a held network says the change is saved", "You can prepare a change and have it approved, but nothing is sent to ${cap.label} until Peakhour switches it on.", "Your change is saved."],
  ["the hold's reason is dropped", "${cap.writes.reason ? ` ${cap.writes.reason}` : \"\"}", ""],
  // ── building values ──
  ["equal opening and closing times are accepted", "if (p.open === p.close) return", "if (false) return"],
  ["a time that is not HH:MM is accepted", "if (!HHMM.test(p.open) || !HHMM.test(p.close)) return", "if (false) return"],
  ["a description over the limit is accepted", "if (limit !== undefined && v.length > limit) return", "if (false) return"],
  ["a web address of any scheme is accepted", "if (u.protocol !== \"https:\" && u.protocol !== \"http:\") return", "if (false) return"],
  ["a phone list is trimmed of numbers, not blanks", "const additional = d.additional.map((n) => n.trim()).filter(Boolean);", "const additional = d.additional.map((n) => n.trim()).filter(Boolean).slice(0, 1);"],
  ["numbers are sent without the main one", "if (additional.length > 0 && !primary) return", "if (false) return"],
  ["a repeated number is accepted", "if (new Set(all).size !== all.length) return", "if (false) return"],
  ["too many extra numbers are accepted", "if (limits.maxAdditionalPhones !== undefined && additional.length > limits.maxAdditionalPhones) {", "if (false) {"],
  ["a category is listed twice", "return list.some((c) => c.id === add.id) ? [...list] : [...list, add];", "return [...list, add];"],
  ["too many categories are accepted", "if (limits.maxAdditionalCategories !== undefined && list.length > limits.maxAdditionalCategories) {", "if (false) {"],
  ["a holiday date is listed twice", "if (seen.has(d.date)) return", "if (false) return"],
  ["an open holiday needs no times", "if (!d.closed && (!HHMM.test(d.open) || !HHMM.test(d.close) || d.open === d.close)) return", "if (false) return"],
  ["holiday days go out unsorted", "for (const d of [...draft].sort((a, b) => a.date.localeCompare(b.date))) {", "for (const d of draft) {"],
  ["the category list is asked for after one letter", "export const MIN_CATEGORY_QUERY = 2;", "export const MIN_CATEGORY_QUERY = 1;"],
  // ── not wiping or losing what is there ──
  ["a category left out is not named", "return existingLabels.filter((l) => l.trim() && !keep.has(l.trim().toLowerCase()));", "return [];"],
  ["category names are compared with case", "const keep = new Set(picked.map((c) => c.label.trim().toLowerCase()));", "const keep = new Set(picked.map((c) => c.label.trim()));"],
  ["an empty week is not called a wipe", "if (field === \"regularHours\" && Array.isArray(value) && value.length === 0) return", "if (false) return"],
  ["removing every number is not called a wipe", "if (field === \"phone\" && !(value as { primary?: string; additional?: string[] }).primary", "if (false && !(value as { primary?: string; additional?: string[] }).primary"],
  ["a number kept is called a wipe", "&& !(value as { additional?: string[] }).additional?.length) return", "&& true) return"],
  ["removing the website is not called a wipe", "if (field === \"website\" && value === \"\") return", "if (false) return"],
  ["no calendar is not explained", "return { show: true, message: \"We cannot suggest holiday hours yet, because we do not know your time zone.\", canAccept: false };", "return { show: false, message: null, canAccept: false };"],
  ["a plain-text category reads as nothing", "return [typeof value === \"string\" ? value : ((value as { label?: string }).label ?? \"\")].filter(Boolean);", "return [((value as { label?: string }).label ?? \"\")].filter(Boolean);"],
  // ── submitting ──
  ["a submit carries a second field", "return { listingId, network, changes: [{ field, value }] };", "return { listingId, network, changes: [{ field, value }, { field: \"description\", value: \"\" }] };"],
  ["a risky warning states a rule", "Changing this may mean ${label} asks you to verify", "Changing this means ${label} asks you to verify"],
  ["the postcard warning is lost", "if (field === \"name\" || field === \"address\") {", "if (false) {"],
  // ── the holiday offer ──
  ["an offer is accepted without regular hours", "if (r.needsRegularHours) {", "if (false) {"],
  ["an offer is accepted while a holiday change waits", "if (r.openChange) {", "if (false) {"],
  ["an offer shows with no calendar", "if (r.noTimeZone) {", "if (false) {"],
  ["an empty offer shows", "if (r.offers.length === 0) return", "if (false) return"],
];

const dir = mkdtempSync(join(tmpdir(), "mut-pe07-b2c-"));
const out = join(dir, "r.json");

function runSpec() {
  rmSync(out, { force: true });
  const r = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", SPEC, "--reporter=json", `--outputFile=${out}`], { stdio: "ignore", timeout: 180_000 });
  if (r.error) throw r.error;
  const j = JSON.parse(readFileSync(out, "utf-8"));
  return { total: j.numTotalTests, failed: j.numFailedTests };
}

const base = runSpec();
if (base.total === 0 || base.failed !== 0) {
  console.error(`PASS case failed: ${SPEC} (${base.failed}/${base.total})`);
  process.exit(2);
}
console.log(`pass  ${SPEC} (${base.total} tests)`);

const original = readFileSync(LIB, "utf-8");
let survived = 0;
for (const [name, from, to] of CASES) {
  const count = original.split(from).length - 1;
  if (count !== 1) {
    console.error(`anchor not unique or missing for "${name}" (${count})`);
    process.exit(2);
  }
  let result;
  try {
    writeFileSync(LIB, original.replace(from, () => to));
    result = runSpec();
  } finally {
    writeFileSync(LIB, original);
  }
  const killed = result.total > 0 && result.failed > 0;
  if (!killed) survived++;
  console.log(`${killed ? "killed  " : "SURVIVED"}  ${name} (${result.failed}/${result.total})`);
}
if (readFileSync(LIB, "utf-8") !== original) {
  console.error("RESTORE FAILED");
  process.exit(3);
}
rmSync(dir, { recursive: true, force: true });
console.log(survived === 0 ? `all ${CASES.length} mutants killed` : `${survived} SURVIVED`);
process.exit(survived === 0 ? 0 : 1);
