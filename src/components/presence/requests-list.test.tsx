import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestsList } from "@/components/presence/requests-list";
import type { ChangeCardData } from "@/lib/presence-edit";

/**
 * "Your requests" (GBP L4), drawn from changes the owner passes in. WHAT THIS CANNOT PROVE: a browser (static markup, so a press is not
 * clicked), the api (every row is a fixture), or that the page passes the listing's real changes (publishing-status wiring is read in
 * presence-wiring.test.ts, a string check and not a render).
 */

const change = (over: Partial<ChangeCardData>): ChangeCardData => ({
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

const idle = { isPending: false, variables: undefined, error: null, mutate: () => undefined };
const m = { approve: idle, reject: idle, undo: idle } as never;

const fmt = (iso: string | null | undefined) => `[${(iso ?? "").slice(5, 16)}]`;
const render = (open: ChangeCardData[], recent: ChangeCardData[], can = { propose: true, approve: true }, older: ChangeCardData[] = []) =>
  renderToStaticMarkup(createElement(RequestsList, { open, recent, older, labelFor: () => "Testnet", can, publishing: null, m, onRedo: () => undefined, canRedo: () => true, formatDateTime: fmt, now: Date.parse("2026-11-11T12:00:00.000Z") }));

describe("the requests list", () => {
  it("says where requests will appear when there are none", () => {
    const html = render([], []);
    expect(html).toContain("Your requests");
    expect(html).toContain("No requests yet. Changes you make under Change your listing appear here, from draft to live.");
    expect(html).not.toContain("request-counts");
  });

  it("counts each stage on top, in the order of the groups, and each count links to its group", () => {
    const html = render(
      [change({ id: "a", status: "validated" }), change({ id: "b", status: "submitted", liveCheck: { checkedAt: "x", outcome: "pending", note: null } })],
      [change({ id: "c", status: "live", liveAt: "2026-11-11T09:00:00.000Z" }), change({ id: "d", status: "live", liveAt: "2026-11-11T09:30:00.000Z" })],
    );
    const counts = /data-testid="request-counts">(.*?)<\/p>/.exec(html)![1]!.replace(/<[^>]+>/g, "");
    expect(counts).toBe("1 awaiting approval ·1 under review ·2 live");
    expect(html).toContain('href="#requests-group-live"');
    expect(html).toContain('id="requests-group-live"');
    expect([...html.matchAll(/data-group="(\w+)"/g)].map((x) => x[1])).toEqual(["awaiting", "review", "live"]);
  });

  it("never shows a submitted change as live, and says how a live one is known", () => {
    const sent = render([change({ status: "submitted", submittedAt: "2026-11-11T10:42:00.000Z", liveAt: "2026-11-11T10:55:00.000Z" })], []);
    expect(sent).not.toContain("Live on Testnet");
    expect(sent).toContain("Sent to Testnet");
    expect(sent).toContain("Sent [11-11T10:42]. Testnet hasn&#x27;t shown it yet. We check again within the hour.");
    expect(sent).not.toContain("shows it");
    const live = render([], [change({ status: "live", submittedAt: "2026-11-11T10:42:00.000Z", liveAt: "2026-11-11T10:55:00.000Z", liveCheck: { checkedAt: "2026-11-11T11:00:00.000Z", outcome: "confirmed", note: null } })]);
    expect(live).toContain("Live on Testnet");
    expect(live).toContain("Testnet shows this change. We checked on [11-11T11:00].");
    expect(live).toContain("Requested [11-11T08:00] · Sent [11-11T10:42] · Testnet shows it [11-11T10:55]");
  });

  it("draws the step line without the steps that have not happened", () => {
    const html = render([change({ status: "validated" })], []);
    expect(html).toContain("Requested [11-11T08:00]");
    expect(html).not.toContain("Sent [");
    expect(html).not.toContain("shows it");
  });

  it("keeps older finished requests behind Show older, with their count, and the recent ones in the open", () => {
    const html = render([], [change({ id: "r", status: "live", liveAt: "2026-11-11T09:00:00.000Z" })], { propose: true, approve: true }, [change({ id: "o1", status: "live" }), change({ id: "o2", status: "rejected" })]);
    expect(html).toContain("Show older (2)");
    const details = html.slice(html.indexOf("<details"));
    expect(details).toContain('id="request-o1"');
    expect(details).toContain('id="request-o2"');
    expect(html.slice(0, html.indexOf("<details"))).toContain('id="request-r"');
    expect(html.slice(0, html.indexOf("<details"))).not.toContain('id="request-o1"');
    expect(render([], [])).not.toContain("<details");
  });

  it("shows the field, the short before and after, the stage and the reason for an open request", () => {
    const html = render([change({ status: "submitted", liveCheck: { checkedAt: "x", outcome: "pending", note: null } })], []);
    expect(html).toContain("Your requests");
    expect(html).toContain("Description");
    expect(html).toContain("Old. → New.");
    expect(html).toContain("Under Testnet review");
    expect(html).toContain("is still reviewing this change");
    expect(html).not.toContain("Done recently");
  });

  it("offers Approve and Decline to an admin and nothing to a viewer", () => {
    const row = [change({ status: "validated" })];
    const admin = render(row, []);
    expect(admin).toContain("Approve");
    expect(admin).toContain("Decline");
    const viewer = render(row, [], { propose: false, approve: false } as never);
    expect(viewer).not.toContain("<button");
    expect(viewer).toContain("Awaiting your approval");
  });

  it("draws what followed a live request from the slot it is given, and only on a live row", () => {
    const slot = { kind: "answer", item: { id: "c1", outcome: { status: "measured", reason: "compared", message: "Compared.", lines: [{ text: "Calls: 40 before, 60 after." }] } } };
    const live = change({ status: "live", liveAt: "2026-11-11T09:00:00.000Z" });
    const withSlot = (c: ChangeCardData) =>
      renderToStaticMarkup(createElement(RequestsList, { open: [], recent: [c], labelFor: () => "Testnet", can: { propose: true, approve: true }, publishing: null, m, onRedo: () => undefined, outcomeFor: () => slot as never, canRedo: () => true }));
    expect(withSlot(live)).toContain("Calls: 40 before, 60 after.");
    expect(withSlot(change({ status: "failed" }))).not.toContain("Calls: 40");
  });

  it("draws no Make the change again where no editor can open", () => {
    const failed = [change({ status: "failed" })];
    const html = renderToStaticMarkup(createElement(RequestsList, { open: [], recent: failed, labelFor: () => "Testnet", can: { propose: true, approve: true }, publishing: null, m, onRedo: () => undefined, canRedo: () => false }));
    expect(html).toContain("Failed");
    expect(html).not.toContain("Make the change again");
  });

  it("shows the finished ones without a click, and says Declined by you apart from Rejected", () => {
    const html = render(
      [],
      [change({ id: "a", status: "rejected" }), change({ id: "b", status: "failed", reason: { code: "network_rejected", message: "Testnet refused it." } })],
    );
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Nothing is waiting.");
    expect(html).toContain("Declined by you");
    expect(html).toContain("Rejected by Testnet");
    expect(html).toContain("Make the change again");
  });

  it("gives each row an id the top line and the sections link to", () => {
    expect(render([change({ id: "abc" })], [])).toContain('id="request-abc"');
    expect(render([change({})], [])).toContain('id="your-requests"');
  });

  it("holds the Undo that the change cards used to, only for a sent or live change the api says can be put back, and only for someone who can propose", () => {
    const sent = (over: Partial<ChangeCardData>, can = { propose: true, approve: true }) => render([change({ status: "submitted", ...over })], [], can);
    expect(sent({ undoable: true })).toContain("Undo (needs approval)");
    expect(sent({})).toContain("Undo (needs approval)");
    expect(sent({ undoable: false })).not.toContain("Undo (needs approval)");
    expect(sent({ undone: true })).not.toContain("Undo (needs approval)");
    expect(sent({ undoable: true }, { propose: false, approve: false })).not.toContain("Undo (needs approval)");
    expect(render([change({ status: "validated" })], [])).not.toContain("Undo (needs approval)");
  });

  it("keeps the notes, the checks that did not pass, who suggested it and an undone mark that the change cards showed", () => {
    const html = render(
      [],
      [
        change({
          status: "live",
          liveAt: "2026-11-11T09:00:00.000Z",
          undone: true,
          source: "assistant",
          notes: ["Check this with your team."],
          validation: { checkedAt: "x", networkChecked: true, issues: [{ code: "x", message: "The hours overlap." }] },
        }),
      ],
    );
    expect(html).toContain("(undone)");
    expect(html).toContain("Suggested by Ask Peakhour.");
    expect(html).toContain("Check this with your team.");
    expect(html).toContain("The hours overlap.");
  });

  it("opens Show older when an older request still needs the merchant", () => {
    const can = { propose: true, approve: true };
    expect(render([], [], can, [change({ status: "failed" })])).toContain("<details open");
    expect(render([], [], can, [change({ status: "live" })])).not.toContain("<details open");
  });

  it("draws a failed request outside any fold, so the line at the top has a row to land on", () => {
    const html = render([], [change({ status: "failed" })]);
    expect(html).toContain('id="request-c1"');
    expect(html).not.toContain("<details");
  });
});
