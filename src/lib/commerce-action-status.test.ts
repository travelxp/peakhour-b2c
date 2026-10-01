import { describe, it, expect } from "vitest";
import {
  ACTIONABLE_STATUSES,
  canRevert,
  executeToast,
  failureLine,
  proposeErrorToast,
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
});

describe("failureLine — decided by status, never by whether failure is present", () => {
  it("★★outcome_unknown says it may have applied and that the undo makes sure", () => {
    expect(failureLine("outcome_unknown", { detail: "WooCommerce API 502: Bad Gateway" })).toBe(
      "We couldn't confirm your store applied this: WooCommerce API 502: Bad Gateway Undo it to be sure.",
    );
  });

  it("★failed says nothing was changed", () => {
    expect(failureLine("failed", { detail: "the product is not in the catalog" })).toBe(
      "Not applied — nothing was changed: the product is not in the catalog",
    );
  });

  it("a row with no recorded detail still gets its sentence", () => {
    expect(failureLine("outcome_unknown", null)).toBe("We couldn't confirm your store applied this. Undo it to be sure.");
    expect(failureLine("failed", { detail: "  " })).toBe("Not applied — nothing was changed.");
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
    expect(t.description).toBe("timeout You can undo it from Ready to ship in a few minutes.");
    expect(`${t.title} ${t.description}`).not.toMatch(/nothing was changed/i);
  });

  it("★failed is an error with the store's reason, and promises no retry", () => {
    const t = executeToast({ status: "failed", failure: { detail: "read-only key" } });
    expect(t).toEqual({ kind: "error", title: "Couldn't apply on the store", description: "read-only key Nothing was changed." });
  });

  it("★a status this build does not know is a warning that names it, not a green 'Done'", () => {
    const t = executeToast({ status: "something_new" });
    expect(t.kind).toBe("warning");
    expect(t.title).toContain("something_new");
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

describe("proposeErrorToast — a live markdown is not 'try again'", () => {
  it("★★LIVE_MARKDOWN is a warning in the server's words", () => {
    const t = proposeErrorToast({ code: "LIVE_MARKDOWN", message: "This product already has a markdown in place. Undo it before marking it down again." });
    expect(t).toEqual({
      kind: "warning",
      title: "This product already has a markdown",
      description: "This product already has a markdown in place. Undo it before marking it down again.",
    });
  });

  it("PASS: any other failure keeps the old copy", () => {
    expect(proposeErrorToast({ code: "INTERNAL", message: "boom" })).toEqual({
      kind: "error",
      title: "Couldn't propose markdown",
      description: "Please try again shortly.",
    });
  });
});
