import { describe, it, expect } from "vitest";
import {
  ACTIONABLE_STATUSES,
  badgeProps,
  canRevert,
  executeToast,
  failureLine,
  proposeErrorToast,
  revertErrorToast,
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

  it("an unknown status shows as itself, never as something it is not", () => {
    expect(statusMeta("something_new")).toEqual({ label: "something_new", verb: "something_new", tone: "outline" });
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
    expect(t.title).toContain("something_new");
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
    expect(revertErrorToast({ code: "UNDO_SETTLING", message })).toEqual({
      kind: "warning",
      title: "Not yet — your store may still be applying this",
      description: message,
    });
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

  it("PASS: any other failure keeps the old copy", () => {
    expect(proposeErrorToast({ code: "INTERNAL", message: "boom" })).toEqual({
      kind: "error",
      title: "Couldn't propose markdown",
      description: "Please try again shortly.",
    });
  });
});
