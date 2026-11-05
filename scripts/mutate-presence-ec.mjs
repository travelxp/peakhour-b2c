#!/usr/bin/env node
/**
 * Mutation harness for PE-EC (the Presence screens are built from networks[] and the adapters' declarations), b2c side.
 *
 * The rules it holds: the page follows the connection's own network and never `networks[0]` blindly, the label on every sentence is the
 * one it was given, a panel for something a network does not declare does not draw (insights, control, changes, search terms), the
 * network switcher appears only when there is a choice, a network with no picker never asks to choose a listing, and the chosen network
 * travels in the query and the cache key. The api side (the resolver, the neutral metric read, the connect list, the lint) has its own
 * harness in peakhour-api.
 *
 * Each case breaks one rule and names the spec that must go red. A spec that never ran is not a kill, so the runner reads vitest's JSON
 * and requires at least one failed test. PASS cases run the untouched source first. Never kill this run mid-case: the restore is in a
 * finally, which a kill skips. Check `git status` after.
 *
 * Run: node scripts/mutate-presence-ec.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = "src/lib/presence-panels.ts";
const API = "src/lib/api/presence.ts";
const STATE = "src/components/presence/network-card-state.ts";
const PANELS = "src/lib/presence-panels.test.ts";
const TERMS = "src/lib/presence-control-terms.test.ts";
const STATE_SPEC = "src/components/presence/network-card-state.test.ts";
const REVIEW_LIB = "src/lib/review-summary.ts";
const REVIEW_SPEC = "src/lib/review-summary.test.ts";
const NEUTRAL_SPEC = "src/lib/presence-network-neutral.test.ts";
const WIRING_SPEC = "src/components/presence/presence-wiring.test.ts";
const HOME = "src/components/presence/presence-home.tsx";
const INSIGHTS = "src/components/presence/insights-panel.tsx";
const CARD = "src/components/presence/network-connect-card.tsx";
const EDIT_HOOKS = "src/hooks/use-presence-edit.ts";
const KIT_HOOK = "src/hooks/use-review-kit.ts";
const EDIT_LIB = "src/lib/presence-edit.ts";
const EDIT_SPEC = "src/lib/presence-edit.test.ts";

const CASES = [
  ["the page reads the first network, not the connection's", LIB, PANELS, "if (want) return list.find((n) => n.network === want) ?? null;", "if (want) return list[0] ?? null;"],
  ["a connection naming no network gets no fallback entry", LIB, PANELS, "return list[0] ?? null;", "return null;"],
  ["a connection's network with no entry shows another's", LIB, PANELS, "if (want) return list.find((n) => n.network === want) ?? null;", "if (want) return list.find((n) => n.network === want) ?? list[0] ?? null;"],
  ["the label ignores the connection's own", LIB, PANELS, "return primaryEntry(r)?.label ?? r?.connection?.label ?? fallback ?? null;", "return primaryEntry(r)?.label ?? fallback ?? null;"],
  ["the network switcher shows for one network", LIB, PANELS, "if (!connected || connected.length < 2) return null;", "if (!connected || connected.length < 1) return null;"],
  ["a stale network choice is kept", LIB, PANELS, "const value = has(chosen) ? (chosen as string) : has(apiDefault) ? (apiDefault as string) : connected[0]!.network;", "const value = (chosen as string) ?? connected[0]!.network;"],
  ["the default is the head of the list, not the api's connection", LIB, PANELS, "has(apiDefault) ? (apiDefault as string) : connected[0]!.network;", "connected[0]!.network;"],
  ["an unconnected network is an option", LIB, PANELS, "return (networks ?? []).filter((n) => isConnectedStatus(statusOf(n.network)));", "return [...(networks ?? [])];"],
  ["a lapsed connection is not connected", LIB, PANELS, "return status === \"active\" || status === \"error\" || status === \"needs_reauth\" || status === \"expired\";", "return status === \"active\";"],
  ["the old figures stay across a switch of network", LIB, PANELS, "return !!prevKey && prevKey[3] === nextKey[3] && prevKey[4] === nextKey[4];", "return !!prevKey;"],
  ["the label has no chosen-network fallback", LIB, PANELS, "return primaryEntry(r)?.label ?? r?.connection?.label ?? fallback ?? null;", "return primaryEntry(r)?.label ?? r?.connection?.label ?? null;"],
  ["the empty review state names a typed network", REVIEW_LIB, REVIEW_SPEC, "`Once your listing is connected and ${label ?? \"the network\"} starts sending us review ` +", "\"Once your listing is connected and Google starts sending us review \" +"],
  ["the connect card sends to a typed path", CARD, WIRING_SPEC, "<Link href={network.connectHref}>", "<Link href=\"/dashboard/integrations\">"],
  ["the figures gate sits after the setup message", INSIGHTS, WIRING_SPEC, "if (!drawsInsights(entry)) return null;\n\n  const message =", "const message ="],
  ["panels are read before the capabilities settle", HOME, WIRING_SPEC, "const baseReady = !capsQ.isPending && statusQs.every((q) => !q.isPending);", "const baseReady = true;"],
  ["review cards draw for every network", HOME, WIRING_SPEC, "{reviewsOn ? <ReviewKitCard", "{true ? <ReviewKitCard"],
  ["the default network is the head of the list", HOME, WIRING_SPEC, "networkSwitcher(connected, chosenNetwork, defaultQ.data?.connection?.network)", "networkSwitcher(connected, chosenNetwork, networks[0]?.network)"],
  ["the review kit ignores the network", KIT_HOOK, WIRING_SPEC, "presenceApi.reviewKit(location, network)", "presenceApi.reviewKit(location)"],
  ["offers share a key across networks", EDIT_LIB, EDIT_SPEC, "offers: (listingId: string, network: string) => [\"presence\", \"edit\", \"offers\", listingId, network] as const,", "offers: (listingId: string, _network: string) => [\"presence\", \"edit\", \"offers\", listingId] as const,"],
  ["categories share a key across networks", EDIT_LIB, EDIT_SPEC, "[\"presence\", \"edit\", \"categories\", listingId, network, q.trim().toLowerCase()] as const,", "[\"presence\", \"edit\", \"categories\", listingId, q.trim().toLowerCase()] as const,"],
  ["a network name is typed into the home page", HOME, NEUTRAL_SPEC, "Your listing and reviews, in one place", "Your Google listing and reviews, in one place"],
  ["insights draw for a network that declares no figures", LIB, PANELS, "return !Array.isArray(keys) || keys.length > 0;", "return true;"],
  ["insights are hidden when nothing is declared yet", LIB, PANELS, "return !Array.isArray(keys) || keys.length > 0;", "return Array.isArray(keys) && keys.length > 0;"],
  ["not connected names a typed network", LIB, PANELS, "headline: label ? `${label} isn't connected yet` : \"Nothing is connected yet\",", "headline: \"Google isn't connected yet\","],
  ["reconnect names the wrong network", LIB, PANELS, "headline: `${n} needs you to reconnect`,", "headline: `The network needs you to reconnect`,"],
  ["a drift badge ignores the label", LIB, PANELS, "return `Same on ${n}`;", "return `Same on the network`;"],
  ["a listing never compared claims it matches", LIB, PANELS, "if (!entry || !entry.lastSyncedAt) return \"not_checked\";", "if (!entry) return \"not_checked\";"],
  ["the coverage note drops the label", LIB, PANELS, "return `${label ?? \"The network\"} has sent figures", "return `The network has sent figures"],
  ["control draws where the network declares none", LIB, TERMS, "if (!entry || !entry.capabilities?.control || !entry.control) return null;", "if (!entry || !entry.control) return null;"],
  ["network changes draw where the network declares none", LIB, TERMS, "if (!entry || !entry.capabilities?.networkChanges || !entry.changes) return null;", "if (!entry || !entry.changes) return null;"],
  ["search terms draw where the network declares none", LIB, TERMS, "if (!entry || !entry.capabilities?.searchTerms || !entry.searchTerms) return null;", "if (!entry || !entry.searchTerms) return null;"],
  ["a network with no picker is asked to choose a listing", STATE, STATE_SPEC, "if (!hasPicker) {", "if (false) {"],
  ["a network is assumed to have no picker", STATE, STATE_SPEC, "hasPicker = true,", "hasPicker = false,"],
  ["the chosen network is not sent", API, PANELS, "if (p.network) q.set(\"network\", p.network);", ""],
  ["two networks share a listing cache key", LIB, PANELS, "[\"presence\", \"listing\", location ?? \"default\", network ?? \"default\"] as const;", "[\"presence\", \"listing\", location ?? \"default\"] as const;"],
  ["two networks share an insights cache key", LIB, PANELS, "[\"presence\", \"insights\", days, location ?? \"default\", network ?? \"default\"] as const;", "[\"presence\", \"insights\", days, location ?? \"default\"] as const;"],
];

const dir = mkdtempSync(join(tmpdir(), "mut-pe-ec-b2c-"));
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
