#!/usr/bin/env node
/**
 * Mutation harness for PE-R (b2c): reviews on any network, all locations.
 *
 * The rules it holds: a reply control is drawn only where the api says the row's network declares replies, a network's words and cap come
 * from the api (never this module), a place with no rating has none (never 0.0), a cut list says it is cut, the places view is the default
 * for several places until one is picked, and a network's figures are its own (never a sum).
 *
 * Each case breaks one rule and names the spec AND the test title that must go red: a spec that never ran is not a kill, and a kill by a
 * different guard is not either. PASS cases run the untouched source first. Never kill this run mid-case: the restore is in a finally, which
 * a kill skips. Check `git status` after. Anchors are matched on the LF form (the working copy may be CRLF) and written back in the EOL the
 * file had.
 *
 * Run: node scripts/mutate-presence-reviews-r.mjs   (--check validates the anchors only)
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPLY = "src/lib/review-reply.ts";
const PLACES = "src/lib/review-places.ts";
const SUMMARY = "src/lib/review-summary.ts";
const HOME = "src/components/presence/presence-home.tsx";
const KIT = "src/components/presence/review-kit-card.tsx";

const REPLY_SPEC = "src/lib/review-reply.test.ts";
const PLACES_SPEC = "src/lib/review-places.test.ts";
const WIRING_SPEC = "src/components/presence/presence-wiring.test.ts";
const PAGE_SPEC = "src/components/presence/presence-adapter-test.test.tsx";

// [name, file, spec, killer title substring, from, to]
const CASES = [
  // ── a reply control only where the network declares replies ──
  ["a network that cannot take a reply gets a composer", REPLY, REPLY_SPEC, "refuses a row whose network does not declare replies", "if (item.replyChannel?.canReply !== true) return false;", "if (false) return false;"],
  ["a row with no reference gets a composer", REPLY, REPLY_SPEC, "refuses a row with no network reference to reply to", "return Boolean(item.review?.externalReviewId?.trim());", "return true;"],
  ["the reason does not name the network", REPLY, REPLY_SPEC, "a network that cannot take a reply is named by its own label in the reason", "`Peakhour can't send replies to ${channel.label} reviews — answer this one on ${channel.label}.`", "\"Peakhour can't send replies to these reviews.\""],
  ["the cap is not enforced", REPLY, REPLY_SPEC, "the cap is the network's own", "if (limit?.max != null && comment.length > limit.max) {", "if (false) {"],
  ["a network with no cap is given one", REPLY, REPLY_SPEC, "declared no cap counts nothing down", "return max === null ? null : max - raw.trim().length;", "return (max ?? 4096) - raw.trim().length;"],
  ["the outcome names a fixed network", REPLY, REPLY_SPEC, "the outcome is said under the network's own label", ": `Your reply is live on ${label}.`;", ": \"Your reply is live on Google.\";"],
  ["a refusal names a fixed network", REPLY, REPLY_SPEC, "a refusal names the network the api named", "REAUTH_REQUIRED: `Reconnect ${n} to reply.`,", "REAUTH_REQUIRED: \"Reconnect Google Business Profile to reply.\","],
  ["the label is read from a fixed place", REPLY, REPLY_SPEC, "the network's words reach the card", "return item.replyChannel?.label?.trim() || NO_LABEL;", "return \"Google\";"],
  // ── places ──
  ["a place with no rating reads 0.0", PLACES, PLACES_SPEC, "a place with no rating has none", "return p.rating === null ? null : p.rating.toFixed(1);", "return (p.rating ?? 0).toFixed(1);"],
  ["a cut list does not say so", PLACES, PLACES_SPEC, "a cut list says it is cut", "  if (!a.limited) return null;\n  return `Showing", "  return null;\n  return `Showing"],
  ["the rest is offered beyond what the api returns", PLACES, PLACES_SPEC, "offers the rest only when there is a rest", "return a.limited ? Math.min(a.total, PLACES_MAX) : null;", "return a.limited ? a.total : null;"],
  ["the places view is not the default", PLACES, PLACES_SPEC, "the places view is the default for several places", "return args.hasSwitcher && !args.narrowed;", "return false;"],
  ["picking a place does not narrow", PLACES, PLACES_SPEC, "picking a place narrows it", "return args.hasSwitcher && !args.narrowed;", "return args.hasSwitcher;"],
  ["one place gets the places view", PLACES, PLACES_SPEC, "one place has no choice", "return args.hasSwitcher && !args.narrowed;", "return !args.narrowed;"],
  ["reviews with no place are not said", PLACES, PLACES_SPEC, "reviews that name no place are said", "if (unplaced <= 0) return null;", "if (unplaced < 0) return null;"],
  ["a place is listed by its blank title", PLACES, PLACES_SPEC, "the name is the title the merchant picked", "return p.title?.trim() || p.locationName;", "return p.title ?? p.locationName;"],
  ["a missing last-review state reads as a quiet one", PLACES, PLACES_SPEC, "why there is no rating is said in the place's own terms", "if (p.totalEver === 0) return \"No reviews yet\";", "if (false) return \"No reviews yet\";"],
  // ── per network ──
  ["the window is not carried to each network", SUMMARY, PLACES_SPEC, "each network keeps its own rating and label, carrying the window", "return res.networks.map((n) => ({ ...n, days: res.days, windowStart: res.windowStart }));", "return res.networks.map((n) => ({ ...n } as never));"],
  // ── the page ──
  ["choosing a listing does not narrow the reviews", HOME, WIRING_SPEC, "picking one narrows the whole page", "                    // choosing a listing narrows the reviews to it too\n                    setNarrowed(true);", "                    // choosing a listing narrows the reviews to it too"],
  ["a network change keeps the narrowing", HOME, WIRING_SPEC, "clears a pending form request when the network changes", "                    setChosen(undefined);\n                    setNarrowed(false);", "                    setChosen(undefined);"],
  ["the kit is always drawn", HOME, WIRING_SPEC, "draws the review cards only for a network that declares reviews", "hideUnlessReady={!listingOn}", "hideUnlessReady={false}"],
  ["the kit shows its empty state for a network with no listing", KIT, PAGE_SPEC, "with no link on the connection the kit stays hidden", "    if (hideUnlessReady) return null;\n", "\n"],
];

const lf = (text) => text.replace(/\r\n/g, "\n");
const withEol = (text, original) => (original.includes("\r\n") ? text.replace(/\n/g, "\r\n") : text);

for (const [name, file, , , from] of CASES) {
  const count = lf(readFileSync(file, "utf-8")).split(from).length - 1;
  if (count !== 1) {
    console.error(`anchor not unique or missing for "${name}" (${count})`);
    process.exit(2);
  }
}
if (process.argv.includes("--check")) {
  console.log(`all ${CASES.length} anchors found once`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "mut-pe-r-b2c-"));
const out = join(dir, "r.json");

function runSpec(spec) {
  rmSync(out, { force: true });
  const r = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", spec, "--reporter=json", `--outputFile=${out}`], { stdio: "ignore", timeout: 240_000 });
  if (r.error) throw r.error;
  const j = JSON.parse(readFileSync(out, "utf-8"));
  const tests = j.testResults.flatMap((f) => f.assertionResults);
  return { total: j.numTotalTests, failed: j.numFailedTests, failedNames: tests.filter((t) => t.status === "failed").map((t) => t.fullName), names: tests.map((t) => t.fullName) };
}

const bySpec = new Map();
for (const c of CASES) bySpec.set(c[2], [...(bySpec.get(c[2]) ?? []), c[3]]);
for (const [spec, killers] of bySpec) {
  const base = runSpec(spec);
  if (base.total === 0 || base.failed !== 0) {
    console.error(`PASS case failed: ${spec} (${base.failed}/${base.total})`);
    process.exit(2);
  }
  for (const k of new Set(killers)) {
    if (!base.names.some((n) => n.includes(k))) {
      console.error(`killer title "${k}" names no test in ${spec}`);
      process.exit(2);
    }
  }
  console.log(`pass  ${spec} (${base.total} tests)`);
}

let survived = 0;
for (const [name, file, spec, killer, from, to] of CASES) {
  const original = readFileSync(file, "utf-8");
  const text = lf(original);
  let result;
  try {
    writeFileSync(file, withEol(text.replace(from, () => to), original));
    result = runSpec(spec);
  } finally {
    writeFileSync(file, original);
  }
  const killed = result.failedNames.some((n) => n.includes(killer));
  if (!killed) survived++;
  console.log(`${killed ? "killed  " : "SURVIVED"}  ${name} (${result.failed}/${result.total})${!killed && result.failed > 0 ? ` [failed, but not in "${killer}"]` : ""}`);
}
rmSync(dir, { recursive: true, force: true });
console.log(survived === 0 ? `all ${CASES.length} mutants killed` : `${survived} SURVIVED`);
process.exit(survived === 0 ? 0 : 1);
