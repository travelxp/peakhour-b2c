import { describe, it, expect } from "vitest";
import {
  AUDIENCE_OPTIONS,
  BROADCAST_INTRO,
  CART_INTRO,
  FEES_NOTE,
  NOT_UNDOABLE,
  audienceSentence,
  confirmSentence,
  moneyMinor,
  notSentLine,
  readinessCopy,
  resultsLine,
  winBackPatch,
  type BroadcastCounts,
  type WaSettings,
} from "./wa-marketing";

const counts = (over: Partial<BroadcastCounts> = {}): BroadcastCounts => ({ queued: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, skipped: 0, attributedOrders: 0, attributedMinor: 0, ...over });

describe("readinessCopy says what is in the way", () => {
  it("nothing when ready; the emergency stop outranks everything", () => {
    expect(readinessCopy("ready", false)).toBeNull();
    expect(readinessCopy("template_not_approved", true)?.heading).toBe("Your emergency stop is on");
  });
  it("Meta's approval is waiting, not failing", () => {
    const r = readinessCopy("template_not_approved", false)!;
    expect(r.tone).toBe("info");
    expect(r.body).toMatch(/nothing goes out, even if you switch this on/);
  });
  it("WhatsApp and set-up states", () => {
    expect(readinessCopy("no_whatsapp", false)?.heading).toBe("Connect WhatsApp first");
    expect(readinessCopy("no_template", false)?.heading).toBe("Cart reminders are not available for your store yet");
  });
});

describe("the sentences", () => {
  it("name each audience", () => {
    expect(audienceSentence({ kind: "purchased_recent", days: 30 })).toBe("Bought in the last 30 days");
    expect(audienceSentence({ kind: "bought_product", sourceProductId: "1" }, "Linen shirt")).toBe("Bought Linen shirt");
    expect(AUDIENCE_OPTIONS.map((o) => o.kind)).toEqual(["all_opted_in", "purchased_recent", "bought_product", "cod_buyers", "never_purchased"]);
  });
  it("the confirmation states how many, when, the estimate and that it cannot be undone", () => {
    const s = confirmSentence(120, "About 95 rupees. This is an estimate, billed by Meta to you directly. Peakhour adds nothing.", null);
    expect(s).toMatch(/send a WhatsApp message to 120 shoppers, starting now/);
    expect(s).toMatch(/estimate, billed by Meta/);
    expect(s).toContain(NOT_UNDOABLE);
    expect(confirmSentence(1, "x", null)).toMatch(/to 1 shopper,/);
  });
  it("the copy states the owner's rules", () => {
    expect(CART_INTRO).toMatch(/never messaged/);
    expect(CART_INTRO).toMatch(/reply STOP/);
    expect(FEES_NOTE).toBe("Meta bills its WhatsApp fees to you directly. Peakhour adds no markup.");
    expect(BROADCAST_INTRO).toMatch(/estimate of Meta's cost before anything is sent/);
    expect(NOT_UNDOABLE).toBe("Once a broadcast starts sending it cannot be cancelled or undone.");
  });
});

describe("results", () => {
  it("each figure beside its share of messages sent, and no division by zero", () => {
    expect(resultsLine(counts({ sent: 200, delivered: 190, read: 100, replied: 10, attributedOrders: 4 }))).toEqual([
      { label: "Sent", value: "200" },
      { label: "Delivered", value: "190 (95%)" },
      { label: "Read", value: "100 (50%)" },
      { label: "Replied", value: "10 (5%)" },
      { label: "Orders within 7 days", value: "4" },
    ]);
    expect(resultsLine(counts())[1]!.value).toBe("0 (0%)");
  });
  it("says why some were not sent", () => {
    expect(notSentLine(counts())).toBe("");
    expect(notSentLine(counts({ skipped: 2, failed: 1, queued: 3 }))).toBe("2 skipped (they opted out since, hit your message limit, or were removed); 1 could not be sent; 3 still waiting");
  });
  it("formats money at the currency's own precision", () => {
    expect(moneyMinor(149900, "INR")).toContain("1,499.00");
    expect(moneyMinor(1500, "JPY")).toContain("1,500");
    expect(moneyMinor(1500, "JPY")).not.toContain(".");
  });
});

describe("winBackPatch sends only what changed", () => {
  const current: WaSettings = { cartRecovery: { enabled: false, delayMinutes: 60, secondReminder: false }, broadcasts: { enabled: true }, frequencyCap: { max: 1, perDays: 3 } };
  const same = { enabled: false, delayMinutes: 60, secondReminder: false, max: "1", perDays: "3" };
  it("one changed field is one leaf; the rest is left to whoever else edited it", () => {
    expect(winBackPatch(current, { ...same, enabled: true })).toEqual({ ok: true, patch: { cartRecovery: { enabled: true } } });
    expect(winBackPatch(current, { ...same, max: "2", delayMinutes: 120 })).toEqual({ ok: true, patch: { cartRecovery: { delayMinutes: 120 }, frequencyCap: { max: 2 } } });
  });
  it("nothing changed is said, not sent", () => {
    expect(winBackPatch(current, same)).toEqual({ ok: false, error: "Nothing has changed, so nothing was saved." });
  });
  it("a bad limit names the fix and that nothing was changed", () => {
    expect(winBackPatch(current, { ...same, max: "11" })).toEqual({ ok: false, error: "Send each shopper between 1 and 10 messages in the period. Nothing was changed." });
    expect(winBackPatch(current, { ...same, perDays: "0" })).toMatchObject({ ok: false });
    expect(winBackPatch(current, { ...same, max: "1.5" })).toMatchObject({ ok: false });
  });
  it("never touches the broadcasts switch", () => {
    const r = winBackPatch(current, { ...same, enabled: true });
    expect(r.ok && "broadcasts" in r.patch).toBe(false);
  });
});

describe("audience wording", () => {
  it("a product broadcast without a known title does not claim one product", () => {
    expect(audienceSentence({ kind: "bought_product", sourceProductId: "7" })).toBe("Bought a product you chose");
  });
});
