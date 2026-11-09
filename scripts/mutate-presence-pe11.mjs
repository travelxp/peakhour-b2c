/**
 * Mutation harness for the PE-11 photos panel (b2c): what is waiting (from the change list, per network, sent included), withheld controls until the
 * change list answers, the batch words (who approves, only the open ones), the answer of a proposal read (blocked and unchecked are never "prepared"),
 * every open change always listed, a customer's photo with no delete control, the cap reasons, and the card keyed by place.
 *
 * Discipline (the api harness's, scripts/mutate-pe-11.mjs there): anchors appear EXACTLY once and every mutant differs from its source; every
 * designated title exists exactly once and is green at baseline; a kill counts only when a DESIGNATED test failed; a dead runner is an error;
 * the source is restored from an in-memory copy in a finally, on signals, and verified byte for byte.
 *
 * Run: node scripts/mutate-presence-pe11.mjs [--only <id>]
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = "src/lib/presence-photos.ts";
const CARD = "src/components/presence/edit/photos-card.tsx";
const HOME = "src/components/presence/presence-home.tsx";
const EDIT_CARD = "src/components/presence/edit/edit-listing-card.tsx";
const EDIT_LIB = "src/lib/presence-edit.ts";
const EDIT_API = "src/lib/api/presence-edit.ts";
const HOOK = "src/hooks/use-presence-photos.ts";

const T = "src/lib/presence-photos.test.ts";
const T_CARD = "src/components/presence/edit/photos-card.test.tsx";
const t = (file, ...names) => names.map((n) => ({ file, name: n }));

const WAITS = "what a person may press > what waits comes from the change list: a removal of THIS photo on THIS network that has not settled, sent ones included";
const KNOWN = "what a person may press > until the change list has answered, adding and removing are withheld and the reason is said; a role that says no keeps its own reason";
const OPEN_ONLY = "the batch summary > counts only the changes still open, and goes once they settle";
const WHO = "the batch summary > tells an admin to review and approve, and anyone else that an admin has to";
const NAMED = "the batch summary > names each photo that was blocked or could not be checked, and does not count them as prepared";
const SETTLE = "photos are read again when a change leaves the in-flight statuses > an in-flight change that has settled means the list is stale: sent then live, sent then failed, declined, expired, gone";
const NOT_SETTLE = "photos are read again when a change leaves the in-flight statuses > a change that is still open, or sent and waiting, or a new one, does not";
const LISTED = "every open change is listed; only the settled history is capped > keeps every change that has not settled, however many settled ones are newer, and caps the rest";
const MERGED = "every open change is listed; only the settled history is capped > the merged list never loses an open change to history: the open ones are read on their own and merged by id";
const OUTCOME = "what a proposal answered is read, never assumed > a checked row is prepared; a blocked row is blocked with its reason; a row the network could not check is not prepared";
const WIRING_REFRESH = "how the panel is wired (pinned as text: b2c vitest renders no DOM) > the photo lists are refreshed once after the batch, not per photo, and the proposal carries its place in its variables";

/** [id, kind, file, anchor, replacement, killers] */
const MUTANTS = [
  // ── what is waiting ──
  ["waiting-ignores-network", "kill", LIB, 'c.field === "media" && c.network === network', 'c.field === "media"', t(T, WAITS, "photos are read again when a change leaves the in-flight statuses > photoChanges, openPhotoChanges and inFlightPhotoChanges pick this network's photo changes")],
  ["sent-is-not-waiting", "kill", LIB, 'const IN_FLIGHT = [...OPEN, "submitted"];', "const IN_FLIGHT = [...OPEN];", t(T, WAITS, NOT_SETTLE)],
  ["live-is-waiting", "kill", LIB, 'const IN_FLIGHT = [...OPEN, "submitted"];', 'const IN_FLIGHT = [...OPEN, "submitted", "live", "failed"];', t(T, WAITS, SETTLE)],
  ["settle-ignores-failed-after-sent", "kill", LIB, "for (const id of before) if (!flying.has(id)) return true;", "for (const id of before) if (!flying.has(id) && false) return true;", t(T, SETTLE)],
  ["card-reads-waiting-from-photo-read", "kill", CARD, "const pending = pendingFor(items, network, p.ref);", "const pending = undefined;", t(T_CARD, "the photos card > a removal waiting for approval is read from the CHANGE LIST: that photo has no Remove, and its note matches the status", "the photos card > a removal already sent still counts as waiting on its tile, with words that match")],
  ["pending-words-approve-an-approved", "kill", LIB, 'if (status === "approved") return "Approved, waiting to be sent. It will be removed once it is sent.";', "", t(T, "what a person may press > the waiting words follow the change's own status, so nobody is told to approve what has no button")],

  // ── controls wait for the change list ──
  ["controls-before-changes-known", "kill", LIB, 'if (changes === "data" || changes === "data_stale") return access;', "return access;", t(T, KNOWN).concat(t(T_CARD, "the photos card > until the change list has answered, Remove and adding are withheld and it says why"))],
  ["role-reason-lost", "kill", LIB, 'if (access.mode !== "edit") return access;\n  if (changes === "data"', 'if (changes === "data"', t(T, KNOWN)],
  ["card-skips-changes-gate", "kill", CARD, "withChangesKnown(photoAccess(capsView, caps.data?.can), changesView)", "photoAccess(capsView, caps.data?.can)", t(T_CARD, "the photos card > until the change list has answered, Remove and adding are withheld and it says why")],
  ["role-unknown-blamed-on-role", "kill", LIB, 'return { mode: "view", why: "We could not check what your role can do, so photos cannot be changed from here right now. Reload the page to try again." };', 'return { mode: "view", why: "Your role can look at your photos but not change them. Ask an editor, admin or owner." };', t(T, "what a person may press > an answer that says no is the role's; no answer yet is checking; a failed answer is not blamed on the role")],

  // ── the batch ──
  ["batch-tells-editor-to-approve", "kill", LIB, 'can?.approve ? "Review each one, then approve it." : "An admin or owner has to approve each one."', '"Review each one, then approve it."', t(T, WHO)],
  ["batch-counts-settled", "kill", LIB, "const waiting = batch.prepared.filter((id) => openIds.has(id)).length;", "const waiting = batch.prepared.length;", t(T, OPEN_ONLY)],
  ["batch-never-clears", "kill", LIB, "return parts.length ? parts.join(\" \") : null;", 'return parts.length ? parts.join(" ") : "Done.";', t(T, OPEN_ONLY)],
  ["batch-hides-failures", "kill", LIB, "if (batch.failed.length > 0) {", "if (false) {", t(T, NAMED)],
  ["batch-hides-unchecked", "kill", LIB, "if (batch.notChecked.length > 0) {", "if (false) {", t(T, NAMED)],
  ["blocked-counts-as-prepared", "kill", LIB, 'if (row.status === "blocked") return', 'if (false) return', t(T, OUTCOME, "what a proposal answered is read, never assumed > another row's not-checked entry does not demote this one")],
  ["unchecked-counts-as-prepared", "kill", LIB, "if (unchecked) return", "if (false) return", t(T, OUTCOME)],
  ["card-counts-without-reading", "kill", CARD, "outcomeOf(await m.propose.mutateAsync({ ...target!, value: { op: \"add\", mediaId: a.id, category } }))", "({ kind: \"prepared\", id: a.id } as const)", t(T, "how the panel is wired (pinned as text: b2c vitest renders no DOM) > the answer of every proposal is read through outcomeOf, in the batch and for a removal")],

  // ── the cap and its reasons ──
  ["waiting-adds-blamed-on-full-listing", "kill", LIB, "holds < max && waitingAdds > 0", "false", t(T, "what a person may press > when the photos already WAITING are what reaches the cap, it says so, not 'remove one'").concat(t(T_CARD, "the photos card > waiting adds that would fill the cap are named as such, not blamed on a full listing"))],
  ["cap-ignores-waiting-adds", "kill", LIB, "max - Math.max(p.held, p.items.length) - waitingAdds", "max - Math.max(p.held, p.items.length)", t(T, "what a person may press > how many can be picked at once: the cap less what is held and what waits, never more than ten")],

  // ── every open change is listed ──
  ["listing-caps-open-changes", "kill", LIB, "const keep = new Set([...all.filter((c) => IN_FLIGHT.includes(c.status)), ...settled].map((c) => c.id));", "const keep = new Set([...settled].map((c) => c.id));", t(T, LISTED).concat(t(T_CARD, "the photos card > every open change is shown even beneath a long settled history"))],
  ["history-uncapped", "kill", LIB, ".slice(0, settledCap);", ";", t(T, LISTED)],
  ["merge-drops-open", "kill", EDIT_LIB, "for (const c of [...history, ...open]) byId.set(c.id, c);", "for (const c of [...history]) byId.set(c.id, c);", t(T, MERGED)],
  ["open-changes-not-read-on-their-own", "kill", EDIT_API, "status=open&limit=200", "limit=200", t(T, "how the panel is wired (pinned as text: b2c vitest renders no DOM) > the api client reads every open change on its own, then the latest history")],
  ["other-networks-changes-hidden", "kill", EDIT_CARD, 'some((c) => !(photoChangesElsewhere && c.field === "media" && c.network === network)', 'some((c) => !(photoChangesElsewhere && c.field === "media")', t(T, "how the panel is wired (pinned as text: b2c vitest renders no DOM) > the edit card lists photo changes itself when the photos card is not drawn, and always lists another network's")],

  // ── customers' photos and the lists ──
  ["customers-gap-unsaid", "kill", CARD, "{data.customersComplete === false && <p", "{false && <p", t(T_CARD, "the photos card > says when the customers' photos could not be read, apart from the owner's list")],
  ["owner-gap-unsaid", "kill", CARD, "{!data.complete && <p", "{false && <p", t(T_CARD, "the photos card > says when the list may be missing photos")],
  ["customer-photo-gets-delete", "kill", LIB, "if (!photo.removable) return { remove: false, note: null };", "", t(T, "what a person may press > a customer photo has no delete control, for any access, and its reason is not the role's", "what a person may press > an owner photo can be removed by an editor; not by a viewer; not while a removal of it waits")],
  ["video-draws-broken-image", "kill", LIB, 'p.format === "photo" ? p.url : null', "p.url", t(T, "what a person may press > a video with no thumbnail draws no picture; a photo falls back to its url")],

  // ── undo only when the api says so ──
  ["undo-always-offered", "kill", EDIT_LIB, "&& c.undoable !== false,", ",", t(T, "undo is offered only when the api says it can be put back > a change the api marks not undoable has no Undo; one marked undoable, or from an older api, has")],

  // ── the card is keyed, one refresh, lazy tiles ──
  ["card-not-keyed-by-place", "kill", HOME, '<PhotosCard key={`${panelLocation ?? ""}|${panelNetwork ?? ""}`} ', "<PhotosCard ", t(T, "how the panel is wired (pinned as text: b2c vitest renders no DOM) > the Presence page draws the card only for a network that declares photos, with the id on a wrapper, KEYED by place and network")],
  ["refresh-per-photo", "kill", CARD, "    for (const a of assets) {\n      const name", "    for (const a of assets) {\n      await m.refresh(target!);\n      const name", t(T, WIRING_REFRESH)],
  ["proposal-without-its-place", "kill", HOOK, "(v: PhotoTarget & { value: PhotoChange })", "(v: { value: PhotoChange })", t(T, WIRING_REFRESH)],
  ["tiles-eager", "kill", CARD, 'loading="lazy" alt={p.category', "alt={p.category", t(T, "how the panel is wired (pinned as text: b2c vitest renders no DOM) > tiles load lazily")],
];

// ── plumbing ──────────────────────────────────────────────────────────────────────────────
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
const orig = new Map();
const read = (f) => {
  if (!orig.has(f)) orig.set(f, readFileSync(f, "utf8"));
  return orig.get(f);
};
const restore = () => {
  for (const [f, s] of orig) writeFileSync(f, s);
};
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    restore();
    process.exit(130);
  });
}
const out = mkdtempSync(join(tmpdir(), "mutate-b2c-pe11-"));
const vitest = "node_modules/vitest/vitest.mjs";

function runSpec(file, tag) {
  const json = join(out, `${tag}.json`);
  if (existsSync(json)) rmSync(json);
  const r = spawnSync(execPath, [vitest, "run", file, "--reporter=json", `--outputFile=${json}`], { encoding: "utf8", timeout: 600_000 });
  if (!existsSync(json)) throw new Error(`the runner produced no report for ${file} (status ${r.status}, signal ${r.signal}): ${String(r.stderr).slice(0, 300)}`);
  const rep = JSON.parse(readFileSync(json, "utf8"));
  const tests = rep.testResults.flatMap((s) => s.assertionResults);
  if (tests.length === 0) throw new Error(`no tests ran in ${file}`);
  return tests.map((x) => ({ title: [...(x.ancestorTitles ?? []), x.title].join(" > "), status: x.status }));
}

let failed = false;
try {
  const produced = new Map();
  for (const [id, , file, anchor, to] of MUTANTS) {
    const src = read(file);
    if (src.includes("\r")) throw new Error(`${file} has CRLF line endings: a multi-line anchor would not match`);
    const n = src.split(anchor).length - 1;
    if (n !== 1) throw new Error(`${id}: anchor appears ${n} times in ${file} (need exactly 1): ${anchor.slice(0, 70)}`);
    const next = src.replace(anchor, () => to);
    if (next === src) throw new Error(`${id}: the mutant changes nothing (inert)`);
    const key = file + "\u0000" + next;
    if (produced.has(key)) throw new Error(`${id} produces the same file as ${produced.get(key)} (two names, one mutation)`);
    produced.set(key, id);
  }
  const specs = [...new Set(MUTANTS.flatMap((m) => m[5].map((k) => k.file)))];
  const baseline = new Map();
  for (const sp of specs) {
    const res = runSpec(sp, "baseline-" + sp.replace(/\W/g, "_"));
    baseline.set(sp, res);
    const red = res.filter((x) => x.status !== "passed");
    if (red.length > 0) throw new Error(`baseline is not green in ${sp}: ${red.map((x) => x.title).join(" | ")}`);
  }
  for (const [id, , , , , killers] of MUTANTS) {
    for (const k of killers) {
      const n = baseline.get(k.file).filter((x) => x.title === k.name).length;
      if (n !== 1) throw new Error(`${id}: killer "${k.name}" appears ${n} times in ${k.file} (need exactly 1)`);
    }
  }
  console.log(`preflight ok: ${MUTANTS.length} mutants, ${specs.length} specs green, every anchor once, every killer once`);

  let killed = 0;
  let ran = 0;
  for (const [id, kind, file, anchor, to, killers] of MUTANTS) {
    if (only && id !== only) continue;
    ran++;
    const src = orig.get(file);
    writeFileSync(file, src.replace(anchor, () => to));
    let verdict;
    try {
      const failedTitles = new Set();
      for (const sp of [...new Set(killers.map((k) => k.file))]) {
        for (const x of runSpec(sp, id)) if (x.status === "failed") failedTitles.add(sp + "::" + x.title);
      }
      const designatedFailed = killers.filter((k) => failedTitles.has(k.file + "::" + k.name));
      const others = [...failedTitles].filter((x) => !killers.some((k) => k.file + "::" + k.name === x));
      if (designatedFailed.length > 0) {
        killed++;
        verdict = `KILLED by ${designatedFailed.length}/${killers.length} designated${others.length ? ` (+${others.length} other)` : ""}`;
      } else if (others.length > 0) {
        failed = true;
        verdict = `WRONG GUARD: failed only ${others.length} non-designated test(s): ${others.slice(0, 2).join(" | ")}`;
      } else {
        failed = true;
        verdict = "SURVIVED";
      }
    } finally {
      writeFileSync(file, src);
    }
    console.log(`${kind === "wrong-way" ? "[wrong-way]" : "[kill]     "} ${id}: ${verdict}`);
  }
  console.log(`\n${killed}/${ran} killed by a designated spec`);
} catch (e) {
  failed = true;
  console.error(String(e.message ?? e));
} finally {
  restore();
  for (const [f, s] of orig) {
    if (readFileSync(f, "utf8") !== s) {
      console.error(`RESTORE FAILED for ${f}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
