/**
 * Mutation harness for COMPOSE-TO-LISTING (plan S5·4).
 *
 * ★★★WHAT THIS DEFENDS IS A POST ON SOMEBODY'S SHOPFRONT THAT THEY DID NOT
 * WRITE, DID NOT ASK FOR, OR CANNOT FIX. Every other channel this composer
 * touches puts a post in a feed; this one lands on the merchant's Google Maps
 * and Search listing — the page their CUSTOMERS read, and for many local
 * businesses the most-seen thing they own. The ways that goes wrong are all
 * quiet:
 *
 *   - the panel offered to a business the server will refuse, so the button
 *     works exactly until it is used;
 *   - the toggle defaulting on, so somebody's first scheduled tweet also went
 *     to their storefront;
 *   - the SOCIAL post's body sent to the listing, hashtags and all;
 *   - a draft the api refuses TERMINALLY sent anyway — the item ends at
 *     `failed` tomorrow, on a row the merchant cannot correct in place. Every
 *     rule in `local-post.ts` exists to move that moment to the compose screen,
 *     so a rule that stops firing does not break anything visible today.
 *
 * ⚠️AND THE SECOND FILE IS HERE BECAUSE THE FIRST CANNOT SEE IT. Whether the
 * listing's own body is sent, whether hashtags are appended, whether a
 * connection id is named — those live in a CALL, and nothing about the
 * validation rules would notice them changing. This repo runs vitest without
 * jsdom, which is exactly why both decisions live in pure modules rather than
 * inside the component.
 *
 * Discipline, unchanged from mutate-content-ledger-copy.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once in its own file.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output.
 *   - SMOKE MUTANT: one per (FILE, SPEC) PAIR, and each must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL.
 *   - SIGNALS RESTORE, because try/finally does not survive one.
 *
 * Run: node scripts/mutate-compose-to-listing.mjs
 */
import { readFileSync, writeFileSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const RULES_SPEC = "src/lib/local-post.test.ts";
const TARGET_SPEC = "src/lib/listing-target.test.ts";

const FILES = {
  rules: { target: "src/lib/local-post.ts", spec: RULES_SPEC },
  target: { target: "src/lib/listing-target.ts", spec: TARGET_SPEC },
  /**
   * ★THE RULES FILE AGAIN, AGAINST THE OTHER SPEC THAT EXERCISES IT. The
   * listing-target spec drives `buildListingChannelOptions` through a CALL
   * draft that carries a real URL — a pairing the rules spec has no reason to
   * build, because its own rules refuse it. One entry per (file, spec) pair, so
   * each gets its own smoke.
   */
  rulesViaTarget: { target: "src/lib/local-post.ts", spec: TARGET_SPEC },
};

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";
const RUN_ENV = { ...process.env };

const MUTANTS = [
  // ── What may be published at all ─────────────────────────────────────────
  {
    where: "rules",
    name: "★★★let an empty post through to a public listing",
    anchor: "  if (!summary) {",
    mutated: "  if (false) {",
    killer: "★★★will not schedule an empty post to a public listing",
  },
  {
    where: "rules",
    name: "★★★let an over-long body through, for the api to refuse TERMINALLY tomorrow",
    anchor: "  } else if (summary.length > LISTING_SUMMARY_MAX) {",
    mutated: "  } else if (false) {",
    killer: "★★★catches an over-long body HERE, where it can still be shortened",
  },
  {
    where: "rules",
    name: "★★refuse a body of exactly the limit",
    anchor: "  } else if (summary.length > LISTING_SUMMARY_MAX) {",
    mutated: "  } else if (summary.length >= LISTING_SUMMARY_MAX) {",
    killer: "★★accepts a body of exactly the limit",
  },
  {
    where: "rules",
    name: "★★measure the cap against the untrimmed body",
    anchor: "  const summary = draft.summary.trim();",
    mutated: "  const summary = draft.summary;",
    killer: "★★measures the limit against the trimmed body",
  },

  // ── The window an event and an offer share ───────────────────────────────
  {
    where: "rules",
    name: "★★★let an OFFER through with no window, so Google shows it never",
    anchor: '  const needsWindow = draft.topicType === "EVENT" || draft.topicType === "OFFER";',
    mutated: '  const needsWindow = draft.topicType === "EVENT";',
    killer:
      "★★★asks an OFFER for a window too, because Google gives offers no dates of their own",
  },
  {
    where: "rules",
    name: "★★★stop asking for a title",
    anchor: "    if (!draft.eventTitle.trim()) {",
    mutated: "    if (false) {",
    killer: "★★★asks an EVENT for a title and a start date",
  },
  {
    where: "rules",
    name: "★★★ask a plain update for a window it does not have",
    anchor: "  if (needsWindow) {",
    mutated: "  if (true) {",
    killer: "★★★never asks a plain update for a window",
  },
  {
    where: "rules",
    name: "★★★let a backwards window through, so the post never appears",
    anchor: "      } else if (startKey !== undefined && endKey < startKey) {",
    mutated: "      } else if (false) {",
    killer: "★★★catches a window that ends before it starts",
  },
  {
    where: "rules",
    name: "★★refuse a one-day event",
    anchor: "      } else if (startKey !== undefined && endKey < startKey) {",
    mutated: "      } else if (startKey !== undefined && endKey <= startKey) {",
    killer: "★★accepts a window that starts and ends on the same day",
  },
  {
    where: "rules",
    name: "★★compare the window by day of the month, so December→November reads as forward",
    anchor: "  return year * 10000 + month * 100 + day;",
    mutated: "  return day;",
    killer: "★★compares the window by calendar date, not by day of the month",
  },
  {
    where: "rules",
    name: "★★accept 2026-02-30, because the regex says it is well shaped",
    anchor:
      "  const asUtc = new Date(Date.UTC(year, month - 1, day));\n  if (\n    asUtc.getUTCFullYear() !== year ||\n    asUtc.getUTCMonth() !== month - 1 ||\n    asUtc.getUTCDate() !== day\n  ) {\n    return undefined;\n  }",
    mutated: "",
    killer: "★★refuses a well-shaped but impossible date",
  },

  // ── The button ───────────────────────────────────────────────────────────
  {
    where: "rules",
    name: "★★★guess a button for a link that arrived without one",
    anchor: "  } else if (actionUrl) {",
    mutated: "  } else if (false) {",
    killer: "★★★refuses a link with no button rather than guessing one",
  },
  {
    where: "rules",
    name: "★★★publish a button with nowhere to go",
    anchor: "    if (!actionUrl) {",
    mutated: "    if (false) {",
    killer: "★★★refuses a button with nowhere to go, and says THAT rather than talking about https",
  },
  {
    where: "rules",
    name: "★★★accept a plain-http button link Google will not follow",
    anchor: '    return new URL(value).protocol === "https:";',
    mutated: '    return new URL(value).protocol !== "";',
    killer: "★★★refuses a button link Google cannot reach over https",
  },
  {
    where: "rules",
    name: "★★★silently drop a link typed alongside a Call button",
    anchor: "    if (actionUrl) {\n      out.push({\n        field: \"actionUrl\",",
    mutated: "    if (false) {\n      out.push({\n        field: \"actionUrl\",",
    killer: "★★★refuses a link typed alongside a Call button rather than dropping it",
  },

  // ── Media ────────────────────────────────────────────────────────────────
  {
    where: "rules",
    name: "★★★let more images through than a listing post carries",
    anchor: "  if (media.length > LISTING_MAX_MEDIA) {",
    mutated: "  if (false) {",
    killer: "★★★refuses more images than a listing post carries",
  },
  {
    where: "rules",
    name: "★★★publish the post without the image the merchant chose",
    anchor: "  } else if (media.some((u) => !isHttpsUrl(u))) {",
    mutated: "  } else if (false) {",
    killer: "★★★refuses an image Google's fetcher cannot reach",
  },
  {
    where: "rules",
    name: "★★count the media cap before blanks are dropped",
    anchor: "  const media = draft.mediaUrls.map((u) => u.trim()).filter(Boolean);",
    mutated: "  const media = draft.mediaUrls.map((u) => u.trim());",
    killer: "★★counts the cap after blanks are dropped",
  },

  // ── Reporting ────────────────────────────────────────────────────────────
  {
    // ⚠️A FORM THAT SURFACES ONE ERROR AT A TIME makes the merchant submit four
    // times to find four mistakes.
    where: "rules",
    name: "★★★report only the first problem, so four mistakes take four attempts",
    anchor: "  return out;\n}\n\n/** Convenience for the submit button. */",
    mutated: "  return out.slice(0, 1);\n}\n\n/** Convenience for the submit button. */",
    killer: "★★★reports EVERY problem at once, not just the first",
  },

  // ── What is actually sent ────────────────────────────────────────────────
  {
    where: "rules",
    name: "★★★send an empty actionType, which the api refuses",
    anchor: "  if (draft.actionType) {\n    opts.actionType = draft.actionType;",
    mutated: "  if (true) {\n    opts.actionType = draft.actionType;",
    killer: "★★★never sends an empty actionType, which the api refuses",
  },
  {
    // ⚠️THIS MUTANT SURVIVED ITS FIRST KILLER, and the code was not the
    // problem: the fixture used `actionUrl: ""`, which cannot reach the branch
    // — `draft.actionUrl.trim()` is falsy either way. Retargeted at a spec
    // whose CALL draft carries a real URL.
    where: "rulesViaTarget",
    name: "★★★send a URL alongside a Call button, which the api refuses",
    anchor:
      "    if (draft.actionType !== LISTING_ACTION_WITHOUT_URL && draft.actionUrl.trim()) {",
    mutated: "    if (draft.actionUrl.trim()) {",
    killer: "★★★drops a stale URL when the button is Call, even though the rules already refuse it",
  },
  {
    where: "rules",
    name: "★★★stamp a window onto a plain update the merchant switched back from",
    anchor: '  if (draft.topicType === "EVENT" || draft.topicType === "OFFER") {\n    const event',
    mutated: "  if (true) {\n    const event",
    killer: "★★★never attaches a window or an offer to a plain update",
  },
  {
    where: "rules",
    name: "★★★stamp an offer body onto a plain update",
    anchor: '  if (draft.topicType === "OFFER") {\n    const offer',
    mutated: "  if (true) {\n    const offer",
    killer: "★★★never attaches a window or an offer to a plain update",
  },
  {
    where: "rules",
    name: "★★send an empty end date rather than omitting it",
    anchor: "    if (draft.eventEndDate.trim()) event.endDate = draft.eventEndDate.trim();",
    mutated: "    event.endDate = draft.eventEndDate.trim();",
    killer: "★★omits an absent end date rather than sending an empty one",
  },
  {
    where: "rules",
    name: "★★send an empty offer object, which says there is an offer and names nothing",
    anchor: "    if (Object.keys(offer).length > 0) opts.offer = offer;",
    mutated: "    opts.offer = offer;",
    killer: "★★omits the offer object entirely when none of its fields were filled in",
  },

  // ── Where the panel belongs, and what it forwards ────────────────────────
  {
    // ⚠️THE MOST DANGEROUS THING S5·4 GOT WRONG. A commit override means the
    // plan does not go to POST /v1/scheduler/plans, and the News Desk approve
    // route is .strict() and derives the payload server-side — so the
    // merchant's listing body, offer window, coupon and button are dropped in
    // silence and the RAW IDEA TEXT is published to their public listing.
    where: "target",
    name: "★★★offer the panel on a surface whose endpoint drops the payload",
    anchor: "  return !args.hasCommitOverride && args.available;",
    mutated: "  return args.available;",
    killer: "★★★HIDES it on a surface with its own commit, whose endpoint may drop the payload",
  },
  {
    where: "target",
    name: "★★★never offer it on an ordinary surface either, so the feature is unreachable",
    anchor: "  return !args.hasCommitOverride && args.available;",
    mutated: "  return false;",
    killer: "★★★offers it on an ordinary compose surface",
  },
  {
    // ⚠️NOT HYPOTHETICAL: the repurpose sheet targets googlebusiness now that
    // the recommender offers it. Two entries for one channel share a
    // scheduledAtUtc, hence an idempotency key, and the unique index rejects
    // the insertMany AFTER the plan row is written.
    where: "target",
    name: "★★★append a second entry for a channel the caller is already scheduling",
    anchor: "  if (args.alreadyTargeted) return false;",
    mutated: "  if (false) return false;",
    killer: "★★★HIDES it when the caller is already scheduling to the listing",
  },
  {
    where: "target",
    name: "★★let an explicit hide be overridden by availability",
    anchor: "  if (args.hidden === true) return false;",
    mutated: "  if (false) return false;",
    killer: "★★an explicit hide beats everything",
  },
  {
    where: "target",
    name: "★★★ignore the opt-back-in, so a fixed endpoint can never regain the panel",
    anchor: "  if (args.hidden === false) return args.available;",
    mutated: "  if (false) return args.available;",
    killer: "★★★lets an override surface opt back in explicitly",
  },
  {
    where: "target",
    name: "★★★offer it to a business that may not publish there at all",
    anchor: "  if (args.hidden === false) return args.available;",
    mutated: "  if (args.hidden === false) return true;",
    killer: "★★★never offers it when the merchant may not publish there anyway",
  },
  {
    // ⚠️VALIDATED AND THEN DROPPED IS THE WORST OF BOTH. The rules check the
    // media cap and the https requirement, and the api reads payload.mediaUrls.
    where: "target",
    name: "★★★drop the images the rules validated, so a merchant's photo never leaves the browser",
    anchor: "      ...(media.length > 0 ? { mediaUrls: media } : {}),",
    mutated: "",
    killer: "★★★forwards the images the rules validated",
  },
  {
    where: "target",
    name: "★★send an empty mediaUrls array rather than omitting it",
    anchor: "      ...(media.length > 0 ? { mediaUrls: media } : {}),",
    mutated: "      mediaUrls: media,",
    killer: "★★omits mediaUrls entirely when there are none, rather than sending an empty array",
  },
  // ── May we offer it at all ───────────────────────────────────────────────
  {
    where: "target",
    name: "★★★offer the panel to a business the server will refuse with a 403",
    anchor: "  const enabled = gatedEnabled?.includes(LISTING_CHANNEL) ?? false;",
    mutated: "  const enabled = true;",
    killer: "★★★does NOT offer it to a business that is not allowlisted",
  },
  {
    // ⚠️THE OPTIMISTIC READING IS THE DANGEROUS ONE, and it is the one somebody
    // reaches for to stop the panel "flickering" while the request is in flight.
    where: "target",
    name: "★★★assume yes while the answer is unknown",
    anchor: "  const enabled = gatedEnabled?.includes(LISTING_CHANNEL) ?? false;",
    mutated: "  const enabled = gatedEnabled?.includes(LISTING_CHANNEL) ?? true;",
    killer: "★★★treats an api that cannot answer as NOT enabled, never as yes",
  },
  {
    where: "target",
    name: "★★★offer the panel with nothing connected",
    anchor: "  const connected = row?.connected === true;",
    mutated: "  const connected = true;",
    killer: "★★★does NOT offer it when nothing is connected",
  },
  {
    // ⚠️THE FIELD IS THREE-VALUED. `null` is connected-with-nothing-picked and
    // `undefined` is an api too old to say; a truthiness test reads both as
    // false today but a `!= null` or `!== undefined` reads one of them as
    // PICKED — and the publisher then refuses the post terminally.
    where: "target",
    name: "★★★read a null location as picked, so the post dies at dispatch",
    anchor: '  const locationPicked = typeof row?.account?.extra?.locationName === "string";',
    mutated: "  const locationPicked = row?.account?.extra?.locationName !== undefined;",
    killer: "★★★reads NULL as connected-but-unpicked, not as picked",
  },
  {
    where: "target",
    name: "★★★read an absent location as picked, so an old api looks finished",
    anchor: '  const locationPicked = typeof row?.account?.extra?.locationName === "string";',
    mutated: "  const locationPicked = true;",
    killer: "★★★reads an ABSENT locationName as unpicked too — an old api cannot say",
  },
  {
    where: "target",
    name: "★★take whichever integration row came first rather than the Business Profile one",
    anchor: "  const row = integrations?.find((i) => i.provider === LISTING_PROVIDER);",
    mutated: "  const row = integrations?.[0];",
    killer: "★★looks at the Business Profile row, not whichever row came first",
  },
  {
    where: "target",
    name: "★★★conflate the channel key with the provider name",
    anchor: 'export const LISTING_PROVIDER = "google_business_profile";',
    mutated: 'export const LISTING_PROVIDER = "googlebusiness";',
    killer: "★★the channel key and the provider name are different strings",
  },

  // ── What the listing contributes ─────────────────────────────────────────
  {
    // ⚠️THE DEFAULT-ON PANEL. Somebody's first scheduled tweet also going to
    // their storefront is the single worst outcome in this PR.
    where: "target",
    name: "★★★contribute the listing even though the merchant never turned it on",
    anchor: "  if (!args.offered || !args.locationPicked || !args.enabled) return null;",
    mutated: "  if (!args.offered || !args.locationPicked) return null;",
    killer: "★★★contributes NOTHING when the merchant did not turn it on",
  },
  {
    where: "target",
    name: "★★★contribute for a business that may not publish there",
    anchor: "  if (!args.offered || !args.locationPicked || !args.enabled) return null;",
    mutated: "  if (!args.locationPicked || !args.enabled) return null;",
    killer: "★★★contributes NOTHING when the business may not publish there",
  },
  {
    where: "target",
    name: "★★★contribute with no location picked, so the post dies at dispatch",
    anchor: "  if (!args.offered || !args.locationPicked || !args.enabled) return null;",
    mutated: "  if (!args.offered || !args.enabled) return null;",
    killer: "★★★contributes NOTHING when no location has been picked",
  },
  {
    where: "target",
    name: "★★★send a draft the api refuses TERMINALLY, so the row dies tomorrow",
    anchor: "  if (listingProblems(args.draft).length > 0) return null;",
    mutated: "  if (false) return null;",
    killer: "★★★contributes NOTHING while the draft still has problems",
  },
  {
    where: "target",
    name: "★★★send the SOCIAL post's body to the listing",
    anchor: "      text: args.draft.summary.trim(),",
    mutated: "      text: args.draft.summary,",
    killer: "★★★sends the listing's OWN body, not the social post's",
  },
  {
    where: "target",
    name: "★★★append hashtags to a listing post that has no use for them",
    anchor: "      hashtags: [],",
    mutated: '      hashtags: ["local"],',
    killer: "★★★never sends hashtags to a listing",
  },
  {
    // ⚠️NAMING A CONNECTION would mean this surface keeping its own idea of
    // which row is primary, and disagreeing with the server the day a merchant
    // holds two active Business Profile rows.
    where: "target",
    name: "★★★name a connection id, disagreeing with the server the day there are two",
    anchor: "  return {\n    channel: LISTING_CHANNEL,",
    mutated: '  return {\n    connectionId: "whichever",\n    channel: LISTING_CHANNEL,',
    killer: "★★★names no connection id, leaving the server to resolve it",
  },
  {
    where: "target",
    name: "★★★send no options at all, so an offer publishes as a plain update",
    anchor: "      channelOptions: buildListingChannelOptions(args.draft),",
    mutated: "      channelOptions: {},",
    killer: "★★★carries the composed options through",
  },
];

/** ★THE SMOKE MUTANTS: one per (file, spec) pair. */
const SMOKES = [
  {
    where: "rules",
    name: "SMOKE (rules) — nothing is ever a problem",
    anchor: "  return out;\n}\n\n/** Convenience for the submit button. */",
    mutated: "  return [];\n}\n\n/** Convenience for the submit button. */",
    killer: "★★★will not schedule an empty post to a public listing",
  },
  {
    where: "rulesViaTarget",
    name: "SMOKE (rules via target) — every button loses its URL",
    anchor:
      "    if (draft.actionType !== LISTING_ACTION_WITHOUT_URL && draft.actionUrl.trim()) {",
    mutated: "    if (false) {",
    killer: "★★still carries the URL for every OTHER button",
  },
  {
    where: "target",
    name: "SMOKE (target) — the listing never contributes anything",
    anchor: "  if (listingProblems(args.draft).length > 0) return null;",
    mutated: "  if (true) return null;",
    killer: "★★★contributes the listing channel when everything is in place",
  },
];

const fileOf = (m) => FILES[m.where];
const ALL = [...MUTANTS, ...SMOKES];

const originals = new Map(
  [...new Set(Object.values(FILES).map((f) => f.target))].map((t) => [t, readFileSync(t, "utf8")]),
);

/**
 * ⚠️🚫★★TRY/FINALLY DOES NOT SURVIVE A SIGNAL, and this script is synchronous
 * end to end inside a blocking `spawnSync` — so a handler that restored and
 * exited would be queued behind the whole run and never fire, while merely
 * registering it suppresses Node's default terminate-on-signal. The handler
 * sets a flag, read at the macrotask the loop awaits after each mutant, by
 * which point that iteration's `finally` has already restored its own file.
 *
 * ⏸SIGKILL STILL CANNOT BE CAUGHT. `git status` after an interrupted run
 * remains the rule.
 */
let interrupted = null;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(signal, () => {
    interrupted = signal;
  });
}

function restoreAll() {
  const failed = [];
  for (const [target, original] of originals) {
    try {
      writeFileSync(target, original, "utf8");
    } catch (err) {
      failed.push(`${target} (${err?.message ?? "write failed"})`);
    }
  }
  return failed;
}

function bailOut(signal) {
  const failed = restoreAll();
  // ⚠️`writeSync`, NOT `console.error`. `process.exit` does not flush a
  // redirected stream, and this is the line a person most needs to read.
  const message =
    failed.length === 0
      ? `\n${signal} — every target restored from memory. Verify with \`git status\`.\n`
      : `\n${signal} — RESTORE FAILED for ${failed.length} file(s):\n  ${failed.join(
          "\n  ",
        )}\n⚠️A MUTANT IS STILL IN TRACKED SOURCE. Restore it by hand before anything else.\n`;
  try {
    writeSync(2, message);
  } catch {
    /* the restore is what matters */
  }
  process.exit(failed.length === 0 ? 130 : 1);
}

// ── Anchor pre-flight ──────────────────────────────────────────────────────
let preflightFailed = false;
for (const m of ALL) {
  const { target } = fileOf(m);
  const count = originals.get(target).split(m.anchor).length - 1;
  if (count !== 1) {
    console.error(
      `ANCHOR PRE-FLIGHT FAILED: "${m.name}" matched ${count} time(s) in ${target}, expected 1` +
        `\n  anchor: ${JSON.stringify(m.anchor.slice(0, 140))}`,
    );
    preflightFailed = true;
  }
}
if (preflightFailed) process.exit(1);
console.log(`anchor pre-flight: ${ALL.length} anchors, each exactly once in its own file`);

// ── Killer pre-flight ──────────────────────────────────────────────────────
function report(spec) {
  return spawnSync(execPath, [VITEST, "run", spec, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: RUN_ENV,
  });
}

function assertionsOf(r) {
  const parsed = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return parsed.testResults.flatMap((f) => f.assertionResults);
}

const baselines = new Map();
for (const spec of [...new Set(Object.values(FILES).map((f) => f.spec))]) {
  const baseRun = report(spec);
  // ⚠️🚫★★A DEAD RUNNER IS NOT A BASELINE, and the spawn is checked BEFORE
  //  `stdout` is touched: a process that never starts returns `stdout: undefined`
  //  and `.indexOf` throws a TypeError.
  if (baseRun.error || typeof baseRun.status !== "number") {
    console.error(
      `BASELINE FAILED (${spec}): the runner did not run (${baseRun.error?.message ?? "no exit code"}).`,
    );
    process.exit(1);
  }
  if ((baseRun.stdout ?? "").indexOf("{") < 0) {
    console.error(
      `BASELINE FAILED (${spec}): the runner produced no JSON (exit ${baseRun.status}). Every ` +
        "killer would be scored against an empty list of results.",
    );
    if (baseRun.stderr) console.error(baseRun.stderr.slice(0, 2000));
    process.exit(1);
  }
  baselines.set(spec, assertionsOf(baseRun));
}

let killerFailed = false;
for (const m of ALL) {
  const { spec } = fileOf(m);
  const matches = baselines.get(spec).filter((a) => a.title === m.killer);
  if (matches.length !== 1) {
    console.error(
      `KILLER PRE-FLIGHT FAILED: "${m.killer}" appears ${matches.length} time(s) in ${spec}, expected 1`,
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
  for (const [spec, base] of baselines) {
    console.error(`\n${spec}:`);
    console.error(base.map((a) => `  [${a.status}] ${a.title}`).join("\n"));
  }
  process.exit(1);
}
console.log(`killer pre-flight: ${ALL.length} killers, each green at baseline\n`);

function runKiller(title, spec) {
  const r = report(spec);
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
for (const m of [...SMOKES, ...MUTANTS]) {
  const { target, spec } = fileOf(m);
  const original = originals.get(target);
  let r;
  try {
    writeFileSync(target, original.split(m.anchor).join(m.mutated), "utf8");
    r = runKiller(m.killer, spec);
  } finally {
    writeFileSync(target, original, "utf8"); // ★IN-MEMORY RESTORE, every time.
  }
  results.push({ ...m, ...r });
  const mark = r.killed ? "KILLED  " : "SURVIVED";
  const collateral = r.others ? `  (+${r.others} other spec(s) also failed)` : "";
  console.log(`${mark}  ${m.name}${collateral}`);
  await new Promise((resolve) => setImmediate(resolve));
  if (interrupted) bailOut(interrupted);
}

let restoreFailed = false;
for (const [target, original] of originals) {
  if (readFileSync(target, "utf8") !== original) {
    console.error(`\nRESTORE FAILED — ${target} does not match its original bytes.`);
    restoreFailed = true;
  }
}
if (restoreFailed) process.exit(1);

const survivors = results.filter((r) => !r.killed);
console.log(`\n${results.length - survivors.length}/${results.length} killed; restore verified.`);

const deadSmoke = results.filter((r) => r.name.startsWith("SMOKE") && !r.killed);
if (deadSmoke.length > 0) {
  console.error(
    "\n⚠️A SMOKE MUTANT SURVIVED. The runner is not detecting failures for that " +
      "(file, spec) pair, so every other score against it is meaningless:",
  );
  for (const s of deadSmoke) console.error(`  ${s.name} — ${s.how}`);
  process.exit(1);
}

if (survivors.length > 0) {
  console.error("\nSURVIVORS — classify each before fixing anything:");
  for (const s of survivors) console.error(`  ${s.name} (${s.how})`);
  process.exit(1);
}
console.log("every mutant killed, every smoke died.");
