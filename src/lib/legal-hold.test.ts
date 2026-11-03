import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  businessHoldLine,
  businessHoldPath,
  canLiftThreadHold,
  canManageHolds,
  canPlaceThreadHold,
  checkHoldReason,
  checkLiftReason,
  heldBadge,
  heldSince,
  businessLiftDeletes,
  liftConfirmLabel,
  LIFT_AND_DELETE_LABEL,
  THREAD_LIFT_DELETES,
  threadLiftDeletes,
  type HoldsListing,
  holdErrorMessage,
  HOLD_REASON_HINT,
  HOLD_REASON_MAX,
  LIFT_REASON_HINT,
  placeBody,
  placedByLabel,
  reasonCharsRemaining,
  threadTail,
  threadHoldPath,
} from "@/lib/legal-hold";

/**
 * Legal holds in the Inbox (privacy programme H1). The component is markup; every decision it makes is asserted here.
 * The api (`/v1/legal-holds`) is owner/admin only and is the real gate: this decides only what is OFFERED.
 */

describe("who is offered the action", () => {
  it("PASS: an owner and an admin", () => {
    expect(canManageHolds("owner")).toBe(true);
    expect(canManageHolds("admin")).toBe(true);
  });
  it("nobody else: editor, viewer, an unknown role, no role", () => {
    for (const r of ["editor", "viewer", "member", "", null, undefined]) expect(canManageHolds(r)).toBe(false);
  });
});

describe("the reason", () => {
  it("PASS: 1 character and exactly 500 are valid, and the trimmed text is what is sent", () => {
    expect(checkHoldReason("x")).toEqual({ ok: true, reason: "x" });
    expect(checkHoldReason("x".repeat(HOLD_REASON_MAX))).toEqual({ ok: true, reason: "x".repeat(500) });
    expect(checkHoldReason("  case 12  ")).toEqual({ ok: true, reason: "case 12" });
    expect(placeBody("  case 12  ")).toEqual({ reason: "case 12" });
  });
  it("empty and whitespace are refused with a sentence", () => {
    for (const bad of ["", "   ", "\n\t"]) {
      const r = checkHoldReason(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem).toMatch(/why/i);
    }
  });
  it("501 characters is refused and says by how much", () => {
    const r = checkHoldReason("x".repeat(501));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem).toMatch(/500.*501/);
  });
  it("the bound is the api's", () => {
    expect(HOLD_REASON_MAX).toBe(500);
    expect(reasonCharsRemaining("x".repeat(120))).toBe(380);
  });
  it("the hint tells the merchant to keep shopper details out", () => {
    expect(HOLD_REASON_HINT).toMatch(/Do not put the shopper's name, phone or email/);
  });
});

describe("the badge and which action a thread offers", () => {
  it("names how a thread is held, and nothing when it is not", () => {
    expect(heldBadge("conversation")).toBe("On legal hold");
    expect(heldBadge("business")).toBe("On hold (all conversations)");
    expect(heldBadge(null)).toBeNull();
    expect(heldBadge(undefined)).toBeNull();
  });
  it("two conversations held for the same reason are told apart by the tail of their key", () => {
    expect(threadTail("whatsapp:100200300:0123456789abcdef0123456789abcdef")).toBe("abcdef");
    expect(threadTail("abc")).toBe("abc");
  });
  it("PASS: a thread the api says is NOT held offers Keep; a thread held by name offers Lift", () => {
    expect(canPlaceThreadHold(null)).toBe(true);
    expect(canLiftThreadHold("conversation")).toBe(true);
  });
  it("an UNKNOWN state (an older api that sends no `held`) offers nothing: it is not 'not held'", () => {
    expect(canPlaceThreadHold(undefined)).toBe(false);
    expect(canLiftThreadHold(undefined)).toBe(false);
  });
  it("a thread held by its BUSINESS offers neither (it is lifted with the business hold)", () => {
    expect(canPlaceThreadHold("business")).toBe(false);
    expect(canLiftThreadHold("business")).toBe(false);
  });
  it("an unheld thread cannot be lifted and a held one cannot be held again", () => {
    expect(canLiftThreadHold(null)).toBe(false);
    expect(canPlaceThreadHold("conversation")).toBe(false);
  });
});

describe("lifting takes an optional reason", () => {
  it("PASS: empty is fine (the api records 'Hold lifted'); text is trimmed and bounded at 500 like a placement", () => {
    expect(checkLiftReason("")).toEqual({ ok: true, reason: null });
    expect(checkLiftReason("   ")).toEqual({ ok: true, reason: null });
    expect(checkLiftReason(" case closed ")).toEqual({ ok: true, reason: "case closed" });
    expect(checkLiftReason("x".repeat(500))).toEqual({ ok: true, reason: "x".repeat(500) });
  });
  it("501 characters is refused, and a PLACEMENT still refuses empty", () => {
    expect(checkLiftReason("x".repeat(501)).ok).toBe(false);
    expect(checkHoldReason("").ok).toBe(false);
  });
  it("the lift hint does not ask why it must be KEPT", () => {
    expect(LIFT_REASON_HINT).not.toMatch(/must be kept/);
    expect(LIFT_REASON_HINT).toMatch(/Do not put the shopper's name, phone or email/);
  });
});

describe("the business-wide hold line", () => {
  it("PASS: when, by whom and why", () => {
    expect(businessHoldLine({ heldAt: "2026-11-02T10:00:00.000Z", byKind: "support", reason: "litigation 42" })).toBe(
      "Held since 2 Nov 2026. Placed by Peakhour support. Reason: litigation 42",
    );
  });
  it("a missing or bad date leaves no empty fragment (no '. .')", () => {
    const line = businessHoldLine({ heldAt: "nope", byKind: "merchant", reason: "r" });
    expect(line).toBe("Placed by your team. Reason: r");
    expect(line).not.toMatch(/\.\s*\./);
  });
});

describe("requests", () => {
  it("the thread id is encoded (a WhatsApp key has colons) and lift is a sub-path", () => {
    expect(threadHoldPath("whatsapp:100:abc", "place")).toBe("/v1/legal-holds/conversations/whatsapp%3A100%3Aabc");
    expect(threadHoldPath("whatsapp:100:abc", "lift")).toBe("/v1/legal-holds/conversations/whatsapp%3A100%3Aabc/lift");
  });
  it("the business hold paths", () => {
    expect(businessHoldPath("place")).toBe("/v1/legal-holds/business");
    expect(businessHoldPath("lift")).toBe("/v1/legal-holds/business/lift");
  });
});

describe("what a refusal says", () => {
  const err = (code: string, status: number, message = "Request failed") => new ApiError(code, message, status);
  it("a non-admin is told who can", () => {
    expect(holdErrorMessage(err("FORBIDDEN", 403), "place")).toMatch(/owner or an admin/);
  });
  it("a thread held by its business points at the business hold", () => {
    expect(holdErrorMessage(err("BUSINESS_HOLD", 409), "lift")).toMatch(/business hold/);
  });
  it("a stale view (not held any more) and a missing thread have their own sentence", () => {
    expect(holdErrorMessage(err("NOT_HELD", 409), "lift")).toMatch(/no longer on hold/);
    expect(holdErrorMessage(err("NOT_FOUND", 404), "place")).toMatch(/could not be found/);
  });
  it("the api's own message wins for anything else, with a fallback when it sent none", () => {
    expect(holdErrorMessage(err("REASON_REQUIRED", 400, "A reason of 1 to 500 characters is required"), "place")).toMatch(/1 to 500/);
    expect(holdErrorMessage(err("X", 500), "place")).toBe("Couldn't place the hold.");
  });
  it("a transport failure does not claim either outcome", () => {
    expect(holdErrorMessage(new Error("Failed to fetch"), "place")).toMatch(/couldn't confirm whether the hold was placed/);
    expect(holdErrorMessage(new Error("Failed to fetch"), "lift")).toMatch(/couldn't confirm whether the hold was lifted/);
  });
});

describe("dates and labels", () => {
  it("a held date reads in UTC, whatever the machine's zone", () => {
    expect(heldSince("2026-11-02T23:30:00.000Z")).toBe("Held since 2 Nov 2026");
    expect(heldSince("2026-01-01T00:00:00.000Z")).toBe("Held since 1 Jan 2026");
  });
  it("a missing or bad date is blank, not 'NaN'", () => {
    expect(heldSince(null)).toBe("");
    expect(heldSince("nope")).toBe("");
  });
  it("support placements are labelled", () => {
    expect(placedByLabel("support")).toBe("Placed by Peakhour support");
    expect(placedByLabel("merchant")).toBe("Placed by your team");
  });
});

describe("the lift says when it deletes for good (H4)", () => {
  const row = (threadId: string, eraseDeferred: boolean): HoldsListing["conversations"][number] => ({
    threadId,
    heldAt: "2026-11-01T00:00:00.000Z",
    heldBy: null,
    byKind: "merchant",
    reason: "case",
    scope: "conversation",
    eraseDeferred,
  });
  const listing = (conversations: HoldsListing["conversations"]): HoldsListing => ({ business: null, conversations, truncated: false });

  it("the exact single-conversation sentence and button name", () => {
    expect(THREAD_LIFT_DELETES).toBe(
      "Lifting this hold deletes this conversation permanently right away, because the store or the customer asked for it to be erased. This cannot be undone.",
    );
    expect(LIFT_AND_DELETE_LABEL).toBe("Lift and delete");
  });
  it("KILL: a listed conversation whose erasure is waiting warns", () => {
    expect(threadLiftDeletes(listing([row("t1", true)]), "t1")).toBe(true);
  });
  it("PASS: a held conversation with no erasure waiting, an unlisted one and no listing yet all show the normal dialog", () => {
    expect(threadLiftDeletes(listing([row("t1", false)]), "t1")).toBe(false);
    expect(threadLiftDeletes(listing([row("t2", true)]), "t1")).toBe(false); // another thread's flag is not this one's
    expect(threadLiftDeletes(undefined, "t1")).toBe(false);
  });
  it("KILL: a business count of N is named in the sentence", () => {
    expect(businessLiftDeletes(3)).toBe(
      "Lifting this hold deletes 3 conversations permanently right away, because the store or the customer asked for them to be erased. This cannot be undone.",
    );
    expect(businessLiftDeletes(12)).toContain("deletes 12 conversations");
  });
  it("one conversation reads in the singular", () => {
    expect(businessLiftDeletes(1)).toBe(
      "Lifting this hold deletes 1 conversation permanently right away, because the store or the customer asked for it to be erased. This cannot be undone.",
    );
  });
  it("PASS: a count of 0, a missing count (older api) and nonsense show the normal dialog", () => {
    for (const c of [0, undefined, null, -2, Number.NaN]) expect(businessLiftDeletes(c)).toBeNull();
  });
  it("the confirm button is renamed only when there is a warning", () => {
    expect(liftConfirmLabel("x", "Lift hold")).toBe("Lift and delete");
    expect(liftConfirmLabel(null, "Lift hold")).toBe("Lift hold");
  });
});
