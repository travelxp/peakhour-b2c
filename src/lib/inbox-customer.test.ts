import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  DELETE_CONTACT_BODY,
  ORDERS_EMPTY,
  WINDOW_LIMITED_NOTE,
  actionError,
  canChangeConversation,
  canDeleteContactData,
  codLine,
  creditsLabel,
  deleteContactToast,
  deleteCopy,
  firstSeenLine,
  lifetimeLine,
  money,
  orderDate,
  ordersNote,
  plainStatus,
  priced,
  sentimentLabel,
} from "@/lib/inbox-customer";

describe("the price on a button", () => {
  it("says Peaks, singular for one, and Free for a free act", () => {
    expect(creditsLabel(10)).toBe("10 Peaks");
    expect(creditsLabel(1)).toBe("1 Peak");
    expect(creditsLabel(1200)).toBe("1,200 Peaks");
    expect(creditsLabel(0)).toBe("Free");
  });
  it("no price row is NOT Free: it is no label at all, and the button is unavailable", () => {
    for (const v of [null, undefined, NaN, -1]) expect(creditsLabel(v as number | null | undefined), String(v)).toBeNull();
    expect(priced("Suggest a reply", null)).toEqual({ text: "Suggest a reply", available: false });
    expect(priced("Suggest a reply", undefined)).toEqual({ text: "Suggest a reply", available: false });
  });
  it("puts the price on the button before it is pressed", () => {
    expect(priced("Suggest a reply", 10)).toEqual({ text: "Suggest a reply · 10 Peaks", available: true });
    expect(priced("Refresh summary", 0)).toEqual({ text: "Refresh summary · Free", available: true });
  });
  it("says Peaks on peakhour.ai, never AI credits (the Shopify app's word)", () => {
    expect(JSON.stringify([creditsLabel(10), priced("x", 10), WINDOW_LIMITED_NOTE, DELETE_CONTACT_BODY])).not.toMatch(/AI credit/i);
  });
});

describe("the orders", () => {
  it("formats money in the currency, and falls back to the raw figure for one the host does not know", () => {
    expect(money({ amount: "1499.00", currency: "INR" })).toContain("1,499.00");
    expect(money({ amount: "12.5", currency: "NOPE-X" })).toBe("12.5 NOPE-X");
    expect(money({ amount: "abc", currency: "INR" })).toBe("abc INR");
    expect(money(null)).toBe("");
  });
  it("shows an order of any age with its full date", () => {
    expect(orderDate("2019-03-01T10:00:00Z", "UTC")).toBe("1 Mar 2019");
    expect(orderDate("not a date")).toBe("");
    expect(orderDate(null)).toBe("");
  });
  it("turns Shopify's display statuses into plain words", () => {
    expect(plainStatus("PARTIALLY_REFUNDED")).toBe("Partially refunded");
    expect(plainStatus("PAID")).toBe("Paid");
    expect(plainStatus(undefined)).toBe("");
  });
  it("names the cash-on-delivery outcome in plain words, and nothing for a prepaid order", () => {
    expect(codLine({ isCod: false })).toBeNull();
    expect(codLine({ isCod: true })).toBe("Cash on delivery");
    expect(codLine({ isCod: true, state: "confirmed" })).toBe("Cash on delivery · customer confirmed");
    expect(codLine({ isCod: true, state: "declined" })).toBe("Cash on delivery · customer declined");
    expect(codLine({ isCod: true, state: "unconfirmed" })).toBe("Cash on delivery · no reply from the customer");
    // "no reply" and "couldn't reach" are different claims about the customer and are never merged
    expect(codLine({ isCod: true, state: "unreachable" })).not.toBe(codLine({ isCod: true, state: "unconfirmed" }));
  });
  it("each state that is not 'orders loaded' says what it is, and none reads as 'no orders'", () => {
    expect(ordersNote("ok")).toBeNull();
    for (const s of ["no_customer", "no_store", "unavailable"] as const) {
      expect(ordersNote(s), s).toBeTruthy();
      expect(ordersNote(s), s).not.toBe(ORDERS_EMPTY);
    }
    expect(ordersNote("unavailable")).toBe("Orders could not be loaded just now. Try again in a moment.");
    expect(ordersNote("no_customer")).toBe("No matching customer was found in your store for this conversation, so there are no orders to show.");
  });
  it("the 60-day note is the store's limit, never Peakhour's choice or an option", () => {
    expect(WINDOW_LIMITED_NOTE).toBe("This store hasn’t approved full order history yet, so Shopify only shares the last 60 days of orders.");
    expect(WINDOW_LIMITED_NOTE).not.toMatch(/choose|setting|option|we limit/i);
  });
  it("sums up the customer from Shopify's own figures", () => {
    expect(lifetimeLine({ orderCount: 7, amountSpent: { amount: "5400.00", currency: "INR" } })).toContain("7 orders · ");
    expect(lifetimeLine({ orderCount: 1, amountSpent: { amount: "10", currency: "INR" } })).toContain("1 order · ");
    expect(lifetimeLine({ orderCount: 1, amountSpent: { amount: "10", currency: "INR" } })).toContain("spent");
  });
});

describe("the customer", () => {
  it("first seen reads as a date, or nothing", () => {
    expect(firstSeenLine("2026-01-02T12:00:00Z")).toMatch(/^First seen \d{1,2} Jan 2026$/);
    expect(firstSeenLine(null)).toBeNull();
  });
  it("labels the sentiment in plain words", () => {
    expect(sentimentLabel("negative")).toBe("Unhappy lately");
    expect(sentimentLabel("positive")).toBe("Mostly positive");
    expect(sentimentLabel(null)).toBeNull();
  });
});

describe("who may do what", () => {
  it("Mark done, Suggest a reply and Refresh summary are for editors and above, as the api is", () => {
    for (const r of ["editor", "admin", "owner"]) expect(canChangeConversation(r), r).toBe(true);
    for (const r of ["viewer", null, undefined, ""]) expect(canChangeConversation(r as string | null), String(r)).toBe(false);
  });
  it("deleting a customer's data is for owners and admins, as the api is", () => {
    expect(canDeleteContactData("owner")).toBe(true);
    expect(canDeleteContactData("admin")).toBe(true);
    for (const r of ["editor", "viewer", null, undefined]) expect(canDeleteContactData(r), String(r)).toBe(false);
  });
});

describe("Delete this customer's data", () => {
  it("the confirmation says what is deleted, what is not, and that it cannot be undone", () => {
    expect(DELETE_CONTACT_BODY).toContain("their WhatsApp conversations");
    expect(DELETE_CONTACT_BODY).toContain("contact record (name, number, language and summary)");
    expect(DELETE_CONTACT_BODY).toContain("messages still waiting to be sent");
    expect(DELETE_CONTACT_BODY).toContain("Orders in your Shopify store are not touched");
    expect(DELETE_CONTACT_BODY).toContain("legal hold");
    expect(DELETE_CONTACT_BODY).toContain("can’t be undone");
  });
  it("says when a conversation was kept under a legal hold", () => {
    expect(deleteContactToast({ held: { deferred: 0 } })).toBe("Deleted this customer’s data.");
    expect(deleteContactToast(null)).toBe("Deleted this customer’s data.");
    expect(deleteContactToast({ held: { deferred: 1 } })).toBe("Deleted. One conversation is under a legal hold, so it was kept and will be deleted when you lift the hold.");
    expect(deleteContactToast({ held: { deferred: 3 } })).toContain("3 conversations are under a legal hold, so they were kept");
  });
});

describe("a refusal", () => {
  it("uses the api's own sentence when it names the fix", () => {
    expect(actionError(new ApiError("STATUS_CHANGED", "A new message arrived. Read it, then mark it done again.", 409), "Marking this done")).toBe(
      "A new message arrived. Read it, then mark it done again.",
    );
  });
  it("a 503 keeps its sentence; a network failure says what failed and what to do, never a bare code", () => {
    expect(actionError(new ApiError("NOT_CONFIGURED", "Suggested replies are not available right now.", 503), "Drafting a reply")).toBe("Suggested replies are not available right now.");
    const msg = actionError(new Error("fetch failed"), "Drafting a reply");
    expect(msg).toBe("Drafting a reply didn’t work just now. Check your connection and try again.");
    expect(msg).not.toMatch(/fetch failed|undefined|\[object/);
  });
});

describe("the delete dialog speaks of the chat that is open (SA-12)", () => {
  it("WhatsApp keeps its own words, with the contact record", () => {
    const c = deleteCopy("whatsapp");
    expect(c.body).toContain("their WhatsApp conversations");
    expect(c.body).toContain("contact record");
  });
  it("Messenger, Instagram and X name their own channel and claim no contact record, number or queue", () => {
    for (const [ch, name] of [["messenger", "Messenger"], ["instagram", "Instagram"], ["x", "X"]] as const) {
      const c = deleteCopy(ch);
      expect(`${c.title} ${c.body} ${c.confirm} ${c.done}`).not.toMatch(/whatsapp|number|contact record|queue/i);
      expect(c.body).toContain(`this ${name} conversation`);
    }
  });
  it("a website chat is about the visitor and the email", () => {
    expect(deleteCopy("storefront").body).toContain("including an email");
  });
  it("the toast follows the chat, and a held one still says it was kept", () => {
    expect(deleteContactToast(null, deleteCopy("messenger").done)).toBe("Deleted this conversation.");
    expect(deleteContactToast({ held: { deferred: 1 } }, deleteCopy("messenger").done)).toMatch(/legal hold/);
  });
});
