import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { onePress } from "./one-press";

/**
 * Owner answer 4 (2026-10-21): a double click on Pay must never pay twice.
 * The latch, and the three Pay buttons that must ask it before they send.
 * (b2c has no DOM test environment, so the callers are held by their source.)
 */
describe("onePress", () => {
  it("the first press goes ahead; a second while it is in flight does not", () => {
    const p = onePress();
    expect(p.take()).toBe(true);
    expect(p.busy).toBe(true);
    expect(p.take()).toBe(false);
    expect(p.take()).toBe(false);
  });

  it("once released, the next press goes ahead (a deliberate retry)", () => {
    const p = onePress();
    expect(p.take()).toBe(true);
    p.release();
    expect(p.busy).toBe(false);
    expect(p.take()).toBe(true);
  });

  it("each latch is its own: two buttons never block each other", () => {
    const a = onePress();
    const b = onePress();
    expect(a.take()).toBe(true);
    expect(b.take()).toBe(true);
  });
});

const src = (file: string) => readFileSync(join(__dirname, "..", "components", "upgrade", file), "utf8");
/** The body of the function or arrow named `name`, up to the next blank line
 *  at its own indent: enough to see what it does before it sends. */
const before = (text: string, from: string, until: string) => {
  const i = text.indexOf(from);
  const j = text.indexOf(until, i);
  if (i < 0 || j < 0) throw new Error(`no ${from} ... ${until}`);
  return text.slice(i, j);
};

describe("each Pay button asks the latch before it sends", () => {
  it("the plan picker: the latch is taken before the checkout mutation, and released when it settles", () => {
    const s = src("upgrade-plan-dialog.tsx");
    expect(before(s, "const startCheckout", "checkoutMut.mutate(")).toContain("if (!press.take()) return;");
    expect(s).toContain("onSettled: () => press.release()");
    expect(s).toContain("startCheckout(selected, selectedPrice.term)");
    expect(s).not.toMatch(/onClick=\{[^}]*checkoutMut\.mutate\(/);
  });

  it("the upgrade drawer: the latch is taken before the POST, and released in finally", () => {
    const s = src("upgrade-drawer.tsx");
    expect(before(s, "async function submitCheckout", 'api.post<CheckoutResult>("/v1/billing/checkout"')).toContain("!press.take()");
    expect(before(s, "async function submitCheckout", "function shareReferral")).toMatch(/finally \{\s*press\.release\(\);/);
  });

  it("the payment modal: Continue to payment launches the overlay once", () => {
    const s = src("payment-modal.tsx");
    const body = before(s, "const continueToPayment", 'setGate("launch");');
    expect(body).toContain("if (press.busy) return;");
    expect(body).toContain("press.take()");
  });
});
