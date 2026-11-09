import { describe, it, expect } from "vitest";
import {
  ACTIONABLE_STATUSES,
  badgeProps,
  canRevert,
  executeErrorToast,
  executeToast,
  failureLine,
  proposeErrorToast,
  REVERT_SUCCESS_TOAST,
  revertErrorToast,
  revertLabel,
  statusMeta,
} from "./commerce-action-status";

/**
 * The cockpit's words for an action's ledger status (api#1434, mongodb mig 366).
 * ★`outcome_unknown` is a store write that may have applied: never a green
 * "Done", never "nothing was changed", always undoable.
 */

describe("which statuses the ready-to-ship list asks for, and which can be undone", () => {
  it("★★asks for outcome_unknown: it is the row the undo exists for", () => {
    expect([...ACTIONABLE_STATUSES]).toEqual(["proposed", "approved", "executed", "outcome_unknown", "staged"]);
  });

  it("★★outcome_unknown can be undone, alongside executed and staged", () => {
    expect(canRevert("outcome_unknown")).toBe(true);
    expect(canRevert("executed")).toBe(true);
    expect(canRevert("staged")).toBe(true);
  });

  it.each([["failed"], ["proposed"], ["approved"], ["reverted"], ["rejected"], ["executing"]])(
    "PASS: %s cannot be undone",
    (s) => expect(canRevert(s)).toBe(false),
  );
});

describe("statusMeta — one table for the list and the digest", () => {
  it("★outcome_unknown reads Unconfirmed, in the warning tone", () => {
    expect(statusMeta("outcome_unknown")).toEqual({ label: "Unconfirmed", verb: "unconfirmed", tone: "warning" });
  });

  it("★staged has an entry (the digest had none and showed the raw key)", () => {
    // The WHOLE entry: the fallback would also say "staged" as a verb.
    expect(statusMeta("staged")).toEqual({ label: "Staged", verb: "staged", tone: "outline" });
  });

  it("PASS: the long-standing statuses keep their words", () => {
    expect(statusMeta("executed")).toMatchObject({ label: "Shipped", verb: "shipped" });
    expect(statusMeta("rejected").verb).toBe("dismissed");
    expect(statusMeta("executing").verb).toBe("running");
    expect(statusMeta("failed").label).toBe("Failed");
  });

  it("an unknown status shows as itself, humanised — never as something it is not (round 3)", () => {
    expect(statusMeta("something_new")).toEqual({ label: "Something new", verb: "something new", tone: "outline" });
  });

  it("★a MISSING status is 'updated', not a crash (review round 1)", () => {
    expect(statusMeta(undefined)).toEqual({ label: "Updated", verb: "updated", tone: "outline" });
    expect(statusMeta(42)).toEqual({ label: "Updated", verb: "updated", tone: "outline" });
  });
});

describe("badgeProps — the one place a tone becomes a Badge", () => {
  it("★warning is an outline in the house warning colours (the Badge has no warning variant)", () => {
    expect(badgeProps("warning")).toEqual({
      variant: "outline",
      className: "shrink-0 border-warning/40 bg-warning/10 text-warning-on-tint",
    });
  });
  it("PASS: secondary and outline pass through", () => {
    expect(badgeProps("secondary")).toEqual({ variant: "secondary", className: "shrink-0" });
    expect(badgeProps("outline")).toEqual({ variant: "outline", className: "shrink-0" });
  });
});

describe("failureLine — decided by status, never by whether failure is present", () => {
  it("★★outcome_unknown says it may have applied and that the undo makes sure", () => {
    expect(failureLine("outcome_unknown", { detail: "WooCommerce API 502: Bad Gateway" })).toBe(
      "We couldn't confirm your store applied this. WooCommerce API 502: Bad Gateway. Undo it to be sure.",
    );
  });

  it("★failed WITH a reason says nothing was changed", () => {
    expect(failureLine("failed", { detail: "The product is not in the catalog" })).toBe(
      "Not applied — nothing was changed. The product is not in the catalog.",
    );
  });

  it("★★failed with NO recorded reason does NOT claim nothing was changed: it predates mig 366 and may have applied", () => {
    const line = failureLine("failed", null)!;
    expect(line).toBe("This change didn't complete, and Peakhour has no record of why.");
    expect(line).not.toMatch(/nothing was changed/i);
    expect(failureLine("failed", { detail: "  " })).toBe(line);
  });

  it("an unconfirmed row with no recorded detail still gets its sentence", () => {
    expect(failureLine("outcome_unknown", null)).toBe("We couldn't confirm your store applied this. Undo it to be sure.");
  });

  it("★★a detail ending in a CLOSING MARK still gets its full stop (review round 2)", () => {
    expect(failureLine("outcome_unknown", { detail: "Request failed (ETIMEDOUT)" })).toBe(
      "We couldn't confirm your store applied this. Request failed (ETIMEDOUT). Undo it to be sure.",
    );
    expect(failureLine("outcome_unknown", { detail: 'Store said "busy"' })).toBe(
      'We couldn\'t confirm your store applied this. Store said "busy". Undo it to be sure.',
    );
    // Curly closing quotes count too (round 3).
    expect(failureLine("outcome_unknown", { detail: "Store said \u201cbusy.\u201d" })).toBe(
      "We couldn't confirm your store applied this. Store said \u201cbusy.\u201d Undo it to be sure.",
    );
    // …and one that already ends a sentence inside its closing mark keeps it.
    expect(failureLine("outcome_unknown", { detail: "(Timed out.)" })).toBe(
      "We couldn't confirm your store applied this. (Timed out.) Undo it to be sure.",
    );
  });

  it("★★the DIGEST, which has no undo button, says where the undo is (review round 2)", () => {
    expect(failureLine("outcome_unknown", { detail: "timeout" }, { undoHere: false })).toBe(
      "We couldn't confirm your store applied this. timeout. You can undo it from Autopilot to be sure.",
    );
  });

  it("★the detail ends in exactly one full stop, whatever it ended in", () => {
    expect(failureLine("outcome_unknown", { detail: "Timed out." })).toBe(
      "We couldn't confirm your store applied this. Timed out. Undo it to be sure.",
    );
    expect(failureLine("outcome_unknown", { detail: " timeout  " })).toBe(
      "We couldn't confirm your store applied this. timeout. Undo it to be sure.",
    );
  });

  it("★a REVERTED row keeps its failure as history, and shows no failure line", () => {
    expect(failureLine("reverted", { detail: "timeout" })).toBeNull();
  });

  it.each([["executed"], ["staged"], ["approved"]])("PASS: %s shows none", (s) => {
    expect(failureLine(s, { detail: "x" })).toBeNull();
  });
});

describe("executeToast — what Ship it says", () => {
  it("★★outcome_unknown is a WARNING that names the undo — not a green Done, not 'nothing was changed'", () => {
    const t = executeToast({ status: "outcome_unknown", failure: { detail: "timeout" } });
    expect(t.kind).toBe("warning");
    expect(t.title).toBe("We couldn't confirm your store applied this");
    expect(t.description).toBe("timeout. You can undo it from Ready to ship in a few minutes.");
    expect(`${t.title} ${t.description}`).not.toMatch(/nothing was changed/i);
  });

  it("★failed is an error with the store's reason, and promises no retry", () => {
    const t = executeToast({ status: "failed", failure: { detail: "read-only key" } });
    expect(t).toEqual({ kind: "error", title: "Couldn't apply on the store", description: "read-only key. Nothing was changed." });
  });

  it("★a status this build does not know is a warning that names it, not a green 'Done'", () => {
    const t = executeToast({ status: "something_new" });
    expect(t.kind).toBe("warning");
    expect(t.title).toBe("The action is now something new");
  });

  it("★an answer with NO status still produces a toast (review round 1)", () => {
    expect(executeToast({})).toEqual({ kind: "warning", title: "The action is now updated" });
  });

  it("PASS: executed and staged read as before", () => {
    expect(executeToast({ status: "executed" })).toEqual({ kind: "success", title: "Shipped — applied to your store" });
    expect(executeToast({ status: "staged" })).toMatchObject({ kind: "success", title: "Staged" });
  });

  it("an unknown outcome or failure with no detail still reads cleanly", () => {
    expect(executeToast({ status: "outcome_unknown" }).description).toBe("You can undo it from Ready to ship in a few minutes.");
    expect(executeToast({ status: "failed" }).description).toBe("Nothing was changed.");
  });
});

describe("revertErrorToast — a settling undo is a wait, not a failure", () => {
  it("★★UNDO_SETTLING is a warning carrying the server's 'try again in about N minutes'", () => {
    const message = "Your store may still be applying this change, so it can't be undone yet. Try again in about 4 minutes — nothing was changed.";
    // The title does not repeat the reason the server's text already gives.
    expect(revertErrorToast({ code: "UNDO_SETTLING", message })).toEqual({ kind: "warning", title: "Not yet", description: message });
  });
  it("PASS: any other refusal is an error in the server's words, or a fallback", () => {
    expect(revertErrorToast({ code: "REVERT_FAILED", message: "Couldn't undo the action on the store" })).toEqual({
      kind: "error",
      title: "Couldn't undo the action on the store",
    });
    expect(revertErrorToast({})).toEqual({ kind: "error", title: "Couldn't revert this action" });
  });
});

describe("proposeErrorToast — a live markdown is not 'try again'", () => {
  it("★★LIVE_MARKDOWN is a warning with a NEUTRAL title and the server's words", () => {
    const message = "This product has a markdown that may be live (its result is unknown). Undo it before marking it down again.";
    const t = proposeErrorToast({ code: "LIVE_MARKDOWN", message });
    expect(t).toEqual({ kind: "warning", title: "Can't propose another markdown for this product", description: message });
    // Neutral: the standing markdown may be one whose result is unknown.
    expect(t.title).not.toMatch(/already has/);
  });

  it("★★a markdown mid-write (executing) is a WAIT: it cannot be undone and is not in Ready to ship", () => {
    const t = proposeErrorToast({ code: "LIVE_MARKDOWN", message: "…Undo it before…", details: { actionId: "a", status: "executing" } });
    expect(t).toEqual({
      kind: "warning",
      title: "Can't propose another markdown for this product",
      description: "A markdown for it is being applied right now. Try again in a minute.",
    });
  });

  it("★★a 4xx refusal keeps the SERVER'S words — retrying will not change it (review round 2)", () => {
    const message = "That product isn't in the current markdown plan (it may be selling fine, or discounts are disabled).";
    expect(proposeErrorToast({ code: "NOT_FOUND", status: 404, message })).toEqual({
      kind: "error",
      title: "Couldn't propose markdown",
      description: message,
    });
  });

  it("PASS: a server failure, or no message of the api's own, keeps 'try again' (round 3)", () => {
    expect(proposeErrorToast({ code: "INTERNAL", status: 500, message: "boom" }).description).toBe("Please try again shortly.");
    // What api.ts actually produces with no envelope message, and for a CDN's non-JSON 4xx:
    expect(proposeErrorToast({ code: "UNKNOWN", status: 400, message: "Request failed" }).description).toBe("Please try again shortly.");
    expect(proposeErrorToast({ code: "PARSE_ERROR", status: 429, message: "Server returned non-JSON response (429)" }).description).toBe(
      "Please try again shortly.",
    );
    expect(proposeErrorToast({}).description).toBe("Please try again shortly.");
  });
});

describe("executeErrorToast — when Ship it itself is refused", () => {
  it("★★CONFLICT never shows the raw ledger key (review round 2)", () => {
    const t = executeErrorToast({ code: "CONFLICT", status: 409, message: "Action is outcome_unknown, not executable" });
    expect(t).toEqual({
      kind: "warning",
      title: "This action has already moved on",
      description: "The list has been refreshed to show where it stands.",
    });
    expect(JSON.stringify(t)).not.toContain("outcome_unknown");
  });

  it("PASS: the long-standing refusals read as before", () => {
    expect(executeErrorToast({ code: "AUTONOMY_DISABLED", status: 403 }).title).toBe("Raise this agent to Approve (L2) before it can ship");
    expect(executeErrorToast({ code: "KILL_SWITCH", status: 423 }).title).toBe("The kill switch is on — turn it off to ship actions");
    expect(executeErrorToast({ code: "GUARDRAIL", status: 422 }).title).toBe("A guardrail blocked this action");
    expect(executeErrorToast({ code: "GRANT_MISSING", status: 409, message: "Approve it in Shopify" }).title).toBe("Approve it in Shopify");
    expect(executeErrorToast({ code: "UNKNOWN", status: 400 })).toEqual({ kind: "error", title: "Couldn't ship this action" });
  });

  it.each([
    ["a gateway timeout's HTML (PARSE_ERROR 504)", { code: "PARSE_ERROR", status: 504, message: "Server returned non-JSON response (504)" }],
    ["a 502 with an envelope", { code: "UNKNOWN", status: 502, message: "Bad gateway" }],
    ["no reply at all (fetch's TypeError)", { message: "Failed to fetch" }],
    ["a status-0 reply", { code: "UNKNOWN", status: 0, message: "x" }],
  ])("★★%s may have shipped: a WARNING that names Ready to ship, not 'couldn't ship' (round 3)", (_l, e) => {
    expect(executeErrorToast(e)).toEqual({
      kind: "warning",
      title: "We couldn't confirm Ship it went through",
      description: "Check Ready to ship: if it shows as Unconfirmed, you can undo it there.",
    });
  });
});

describe("REVERT_SUCCESS_TOAST — true of an unconfirmed row too", () => {
  it("★says the store is back as it was, never that a change was reverted (round 3)", () => {
    expect(REVERT_SUCCESS_TOAST).toEqual({ kind: "success", title: "Undone", description: "Your store is back as it was before this action." });
  });
});

describe("revertLabel — what the undo button says", () => {
  it("★an unconfirmed write's button says what it is for", () => {
    expect(revertLabel("outcome_unknown")).toBe("Undo to be sure");
  });
  it.each([["executed"], ["staged"]])("PASS: %s is Revert", (s) => expect(revertLabel(s)).toBe("Revert"));
});
