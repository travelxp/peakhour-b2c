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

const render = (open: ChangeCardData[], recent: ChangeCardData[], can = { propose: true, approve: true }) =>
  renderToStaticMarkup(createElement(RequestsList, { open, recent, labelFor: () => "Testnet", can, publishing: null, m, onRedo: () => undefined, canRedo: () => true }));

describe("the requests list", () => {
  it("draws nothing when there is nothing to list", () => {
    expect(render([], [])).toBe("");
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

  it("folds the finished ones under Done recently with their count, and says Declined by you apart from Rejected", () => {
    const html = render(
      [],
      [change({ id: "a", status: "rejected" }), change({ id: "b", status: "failed", reason: { code: "network_rejected", message: "Testnet refused it." } })],
    );
    expect(html).toContain("Done recently (2)");
    expect(html).toContain("<details");
    expect(html).toContain("Nothing is waiting.");
    expect(html).toContain("Declined by you");
    expect(html).toContain("Rejected by Testnet");
    expect(html).toContain("Make the change again");
  });

  it("gives each row an id the top line and the sections link to", () => {
    expect(render([change({ id: "abc" })], [])).toContain('id="request-abc"');
    expect(render([], [])).toBe("");
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

  it("opens Done recently when a finished request still needs the merchant, so the line at the top has a row to land on", () => {
    expect(render([], [change({ status: "failed" })])).toContain("<details open");
    expect(render([], [change({ status: "rejected" })])).not.toContain("<details open");
  });
});
