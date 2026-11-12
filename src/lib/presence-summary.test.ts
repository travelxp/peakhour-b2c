import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { needItems, requestNeedsYou, requestRowId, summaryLine, waitingLine, WAITING_WORDS, type SummaryInput } from "@/lib/presence-summary";
import { requestStatus, type ChangeCardData } from "@/lib/presence-edit";
import type { ListingScoreResponse } from "@/lib/presence-score";
import type { PresencePublishing } from "@/lib/presence-panels";

/**
 * The line at the top of the Presence page (GBP L7). Every status here is decided by the helpers the page already uses; these tests prove the
 * COUNT and the TARGETS. They cannot prove how the line looks or that the page passes the real reads (presence-wiring.test.ts reads that).
 */

const NOW = Date.parse("2026-11-11T10:00:00.000Z");
const ADMIN = { propose: true, approve: true };
const EDITOR = { propose: true, approve: false };
const VIEWER = { propose: false, approve: false };

const change = (over: Partial<ChangeCardData> = {}): ChangeCardData => ({
  id: "c1",
  listingId: "l1",
  network: "testnet",
  field: "description",
  status: "validated",
  riskTier: "ordinary",
  notes: [],
  source: "form",
  before: "Old.",
  after: "New.",
  reason: null,
  held: null,
  validation: null,
  createdAt: "2026-11-11T08:00:00.000Z",
  expiresAt: "2026-11-14T08:00:00.000Z",
  submittedAt: null,
  liveAt: null,
  liveCheck: null,
  undone: false,
  ...over,
});

const pub = (over: Partial<PresencePublishing> = {}): PresencePublishing => ({ state: "on", heldReason: null, blocker: null, keptForHours: 72, ...over });
const ready = (score: number | null, health: Array<{ id: string; state: "ok" | "attention" | "unknown" }> = []): ListingScoreResponse =>
  ({ state: "ready", listingId: "l1", network: { key: "testnet", label: "Testnet" }, score: { score }, health: health.map((h) => ({ ...h, headline: h.id })) }) as unknown as ListingScoreResponse;

// the network's own edits, as `changesView` reads them: a line each until it is kept or put back
const withChanges = (items: Array<{ field: string; suggested?: string; before?: string }>, publishing: PresencePublishing | null = pub()): NonNullable<SummaryInput["entry"]> => ({
  label: "Testnet",
  publishing,
  changes: { items, pendingFields: null, checkedAt: null, lastReadFailedAt: null, customerMediaAt: null },
  capabilities: { networkChanges: true } as never,
});
// no changes reported
const ent = (publishing: PresencePublishing | null = pub()) => withChanges([], publishing);

const input = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  score: ready(89),
  entry: ent(),
  can: ADMIN,
  changes: [],
  now: NOW,
  ...over,
});
const text = (i: SummaryInput) => summaryLine(i).map((p) => p.text);

describe("the summary line", () => {
  it("reads 'Listing 89/100 · Publishing on · Nothing needs you' when all is well, and the last part is not a link", () => {
    const parts = summaryLine(input());
    expect(parts.map((p) => p.text)).toEqual(["Listing 89/100", "Publishing on", "Nothing needs you"]);
    expect(parts.map((p) => p.href)).toEqual(["#listing-score", "#publishing-status", null]);
    expect(parts[2]!.sentence).toBe("Nothing needs you right now.");
  });

  it("says 'not scored yet' when there is no number, whether the api gave null or no listing is ready", () => {
    expect(text(input({ score: ready(null) }))[0]).toBe("Listing not scored yet");
    expect(text(input({ score: { state: "needs_reconnect" } }))[0]).toBe("Listing not scored yet");
  });

  it("says the publishing state from the status's own tone", () => {
    expect(text(input({ entry: ent(pub({ state: "held", heldReason: "Not started." })) }))[1]).toBe("Publishing hasn't started");
    const blocked = pub({ state: "blocked", blocker: { reason: "Suspended.", action: "reconnect", href: "/i" } });
    expect(text(input({ entry: ent(blocked) }))[1]).toBe("Can't publish");
  });

  it("leaves out a part whose data has not answered, and never claims 'Nothing needs you' before it has", () => {
    expect(text(input({ score: undefined }))).toEqual(["Publishing on"]);
    expect(text(input({ changes: undefined }))).toEqual(["Listing 89/100", "Publishing on"]);
    expect(text(input({ can: undefined }))).toEqual(["Listing 89/100"]);
    expect(text(input({ entry: null }))).toEqual(["Listing 89/100"]);
    // a network that publishes nothing has no status, and the rest still reads
    expect(text(input({ entry: ent(null) }))).toEqual(["Listing 89/100", "Nothing needs you"]);
  });

  it("names no network anywhere in its words", () => {
    const parts = summaryLine(input({ changes: [change()] }));
    for (const p of parts) expect(`${p.text} ${p.sentence}`).not.toMatch(/testnet/i);
  });
});

describe("the question 'Is this your business?'", () => {
  it("counts as one thing that needs you while it is open, first, linking to its panel", () => {
    const items = needItems(input({ nameAskHref: "#name-ask-net_a" }))!;
    expect(items).toEqual([{ kind: "name", href: "#name-ask-net_a", words: "say whether a listing is your business" }]);
    expect(summaryLine(input({ nameAskHref: "#name-ask-net_a" }))[2]).toMatchObject({ text: "1 thing needs you", href: "#name-ask-net_a" });
  });
  it("is one of several, and ahead of a request", () => {
    const items = needItems(input({ nameAskHref: "#name-ask-net_a", changes: [change({ id: "a1" })] }))!;
    expect(items.map((i) => i.kind)).toEqual(["name", "approve"]);
  });
  it("adds nothing once answered", () => {
    expect(needItems(input({ nameAskHref: undefined }))).toEqual([]);
  });
});

describe("what needs the merchant", () => {
  it("counts a request awaiting approval for someone who can approve, and links to its row", () => {
    const items = needItems(input({ changes: [change({ id: "a1" })] }))!;
    expect(items).toEqual([{ kind: "approve", href: `#${requestRowId("a1")}`, words: "approve or decline a request" }]);
    const parts = summaryLine(input({ changes: [change({ id: "a1" })] }));
    expect(parts[2]).toMatchObject({ text: "1 thing needs you", href: "#request-a1" });
    expect(parts[2]!.sentence).toBe("1 thing needs you. Go to the first one: approve or decline a request.");
  });

  it("a viewer or an editor is never counted an approval they cannot give", () => {
    for (const can of [VIEWER, EDITOR]) expect(needItems(input({ can, changes: [change()] }))).toEqual([]);
    expect(text(input({ can: VIEWER, changes: [change()] }))[2]).toBe("Nothing needs you");
  });

  it("counts a failed or refused request that can be made again, including one finished this week; not a declined or expired one", () => {
    const changes = [
      change({ id: "f", status: "failed", reason: { code: "x", message: "No." }, submittedAt: "2026-11-10T10:00:00.000Z" }),
      change({ id: "r", status: "failed", reason: { code: "network_rejected", message: "Refused." }, submittedAt: "2026-11-10T10:00:00.000Z" }),
      change({ id: "d", status: "rejected" }),
      change({ id: "e", status: "expired", expiresAt: "2026-11-10T10:00:00.000Z" }),
      change({ id: "l", status: "live", liveAt: "2026-11-10T10:00:00.000Z" }),
    ];
    expect(needItems(input({ changes }))!.map((i) => i.href).sort()).toEqual(["#request-f", "#request-r"]);
    // a viewer cannot make it again, so it is not theirs to do
    expect(needItems(input({ can: VIEWER, changes }))).toEqual([]);
  });

  it("a proposal that has run out is expired, not awaiting approval", () => {
    expect(needItems(input({ changes: [change({ expiresAt: "2026-11-11T09:00:00.000Z" })] }))).toEqual([]);
  });

  it("counts the publishing blocker once, and not again for a request it holds", () => {
    const blocker = { reason: "Suspended.", action: "fix_on_network" as const, href: "https://t.example/fix" };
    const held = change({ id: "h", status: "blocked", reason: { code: "blocked", message: "Suspended." } });
    const items = needItems(input({ entry: ent(pub({ state: "blocked", blocker })), changes: [held] }))!;
    expect(items).toEqual([{ kind: "publishing", href: "#publishing-status", words: "fix what stops publishing" }]);
    // a viewer is told what is wrong but has nothing to press
    expect(needItems(input({ can: VIEWER, entry: ent(pub({ state: "blocked", blocker })) }))).toEqual([]);
  });

  it("counts a change made on the listing itself, and each health row that needs attention", () => {
    const score = ready(70, [{ id: "a", state: "attention" }, { id: "b", state: "ok" }, { id: "c", state: "unknown" }, { id: "d", state: "attention" }]);
    const items = needItems(input({ score, entry: withChanges([{ field: "phone", suggested: "1", before: "2" }, { field: "website" }]) }))!;
    expect(items.map((i) => i.kind)).toEqual(["changed", "changed", "health", "health"]);
    expect(items[0]!.href).toBe("#network-changes");
    expect(items[2]!.href).toBe("#listing-score");
  });

  it("orders approvals, failed requests, the blocker, changes, then health, and links the count to the first", () => {
    const blocker = { reason: "Suspended.", action: "reconnect" as const, href: "/i" };
    const parts = summaryLine(
      input({
        score: ready(70, [{ id: "a", state: "attention" }]),
        entry: withChanges([{ field: "phone", suggested: "1", before: "2" }], pub({ state: "blocked", blocker })),
        changes: [change({ id: "ok" }), change({ id: "bad", status: "failed", reason: { code: "x", message: "No." }, submittedAt: "2026-11-10T10:00:00.000Z" })],
      }),
    );
    expect(parts[2]).toMatchObject({ text: "5 things need you", href: "#request-ok" });
  });

  it("counts no change when the network does not report them, has not answered, or said nothing changed", () => {
    const base = withChanges([{ field: "phone" }]);
    expect(needItems(input({ entry: { ...base, capabilities: { networkChanges: false } as never } }))).toEqual([]);
    expect(needItems(input({ entry: { ...base, changes: { ...base.changes, items: null } } }))).toEqual([]);
    expect(needItems(input({ entry: withChanges([]) }))).toEqual([]);
  });

  it("with no way to write, the parts that link to the status and the requests are dropped, and the rest still counts", () => {
    const blocker = { reason: "Suspended.", action: "reconnect" as const, href: "/i" };
    const read = input({ writes: false, entry: withChanges([{ field: "phone" }], pub({ state: "blocked", blocker })), changes: [change()], score: ready(70, [{ id: "a", state: "attention" }]) });
    expect(summaryLine(read).map((p) => p.text)).toEqual(["Listing 70/100", "2 things need you"]);
    expect(needItems(read)!.map((i) => i.kind)).toEqual(["changed", "health"]);
  });

  it("with no way to write, the role and the request list are not waited for", () => {
    const own = withChanges([{ field: "phone" }]);
    expect(needItems(input({ writes: false, can: undefined, changes: undefined, entry: own }))!.map((i) => i.kind)).toEqual(["changed"]);
    expect(needItems(input({ writes: true, can: undefined, changes: undefined, entry: own }))).toBeNull();
  });

  it("the anchor the line uses is the id the section is drawn with", () => {
    expect(readFileSync(join(process.cwd(), "src", "components", "presence", "control-section.tsx"), "utf8")).toContain("NETWORK_CHANGES_ID = SUMMARY_ANCHORS.networkChanges");
  });

  it("the list and the count use the same test for what needs the merchant", () => {
    const need = (status: ChangeCardData["status"], can = ADMIN) => requestNeedsYou(requestStatus(change({ status, reason: { code: "x", message: "m" } }), "Testnet", can, null));
    expect(need("failed")).toBe("request");
    expect(need("validated")).toBe("approve");
    expect(need("rejected")).toBeNull();
    expect(need("failed", VIEWER)).toBeNull();
  });

  it("is null while anything it counts has not been read", () => {
    expect(needItems(input({ changes: undefined }))).toBeNull();
    expect(needItems(input({ score: undefined }))).toBeNull();
  });
});

describe("the waiting line of a section", () => {
  const field = (f: string) => (c: Pick<ChangeCardData, "field" | "network">) => c.field === f && c.network === "testnet";
  it("points at the open request for the field, and says nothing for a settled one or another field or network", () => {
    expect(waitingLine([change({ id: "w" })], NOW, field("description"))).toEqual({ text: WAITING_WORDS, href: "#request-w" });
    expect(WAITING_WORDS).toBe("Waiting: see Your requests");
    expect(waitingLine([change({ status: "live", liveAt: "2026-11-10T10:00:00.000Z" })], NOW, field("description"))).toBeNull();
    expect(waitingLine([change()], NOW, field("hours"))).toBeNull();
    expect(waitingLine([change({ network: "other" })], NOW, field("description"))).toBeNull();
    expect(waitingLine(undefined, NOW, field("description"))).toBeNull();
  });
  it("counts a sent request as waiting, and a proposal past its time as not", () => {
    expect(waitingLine([change({ status: "submitted" })], NOW, field("description"))).not.toBeNull();
    expect(waitingLine([change({ expiresAt: "2026-11-11T09:00:00.000Z" })], NOW, field("description"))).toBeNull();
  });
});
