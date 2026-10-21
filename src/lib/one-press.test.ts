import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { onePress } from "./one-press";

/**
 * Owner answer 4 (2026-10-21): a double click on Pay must never pay twice.
 * The latch, and the four Pay surfaces that must ask it before they send.
 * (b2c has no DOM test environment, so the callers are held by their source,
 * with comments removed so a comment naming the call cannot stand in for it.)
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

/** The source with `//` line comments and block comments removed. Crude, but
 *  these files hold no `//` or `/*` inside a string the checks below read. */
const code = (path: string) =>
  readFileSync(join(__dirname, "..", path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** The code from the first `from` to the first `until` after it. */
const between = (text: string, from: string, until: string) => {
  const i = text.indexOf(from);
  const j = text.indexOf(until, i);
  if (i < 0 || j < 0) throw new Error(`no ${from} ... ${until}`);
  return text.slice(i, j);
};

describe("each Pay surface: the latch while the POST is in flight, state while a payment payload is open", () => {
  it("the plan picker: refuses while a payload is open or the latch is taken; released when the mutation settles; disabled while a payload is open", () => {
    const s = code("components/upgrade/upgrade-plan-dialog.tsx");
    expect(between(s, "const startCheckout", "checkoutMut.mutate(")).toContain("if (checkout || !press.take()) return;");
    expect(s).toContain("startCheckout(selected, selectedPrice.term)");
    expect(s).not.toMatch(/onClick=\{[^}]*checkoutMut\.mutate\(/);
    expect(s).toContain("onSettled: () => press.release(),");
    expect(s).toMatch(/disabled=\{[^}]*\|\| !!checkout \|\|/);
  });

  it("the upgrade drawer: refuses while a payload is open or the latch is taken; released in finally; disabled while a payload is open", () => {
    const s = code("components/upgrade/upgrade-drawer.tsx");
    const fn = between(s, "async function submitCheckout", "function shareReferral");
    expect(between(fn, "async function submitCheckout", 'api.post<CheckoutResult>("/v1/billing/checkout"')).toContain("if (!tier || checkoutResult || !press.take()) return;");
    expect(fn).toMatch(/\} finally \{\s*press\.release\(\);/);
    expect(s).toContain("disabled={submitting || !!checkoutResult ||");
  });

  it("the Peaks pack Buy: refuses while a payload is open or the latch is taken; released in finally; disabled while a payload is open", () => {
    const s = code("app/(site)/dashboard/peaks/page.tsx");
    const fn = between(s, "const start = async (packKey: string) => {", "function ");
    expect(between(fn, "const start", "buyPack(packKey)")).toContain("if (checkout || !press.take()) return;");
    expect(fn).toMatch(/\} finally \{\s*press\.release\(\);/);
    expect(s).toContain("disabled={!canBuy(p) || busyKey !== null || checkout !== null}");
  });

  it("the payment modal: Continue to payment and Skip both take the latch, so the overlay launches once", () => {
    const s = code("components/upgrade/payment-modal.tsx");
    const body = between(s, "const continueToPayment", 'setGate("launch");');
    expect(body).toContain("if (!press.take()) return;");
    expect(body.indexOf("if (!press.take()) return;")).toBeLessThan(body.indexOf("setSavingGstin(true)"));
    expect(s).toContain('onClick={() => press.take() && setGate("launch")}');
  });
});
