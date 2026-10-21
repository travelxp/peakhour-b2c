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

describe("each Pay surface asks the latch before it sends, and holds it until the overlay closes", () => {
  it("the plan picker: taken before the mutation; released on an error, on an answer with no overlay, and when the overlay closes", () => {
    const s = code("components/upgrade/upgrade-plan-dialog.tsx");
    expect(between(s, "const startCheckout", "checkoutMut.mutate(")).toContain("if (!press.take()) return;");
    expect(s).toContain("startCheckout(selected, selectedPrice.term)");
    expect(s).not.toMatch(/onClick=\{[^}]*checkoutMut\.mutate\(/);
    expect(s).not.toContain("onSettled");
    expect(between(s, "onError:", "});")).toContain("press.release();");
    // Each answer that opens no overlay releases it; the overlay's close does.
    expect(between(s, "onSuccess: (res) => {", "setCheckout(res as CheckoutResult);").split("press.release();").length - 1).toBe(3);
    expect(between(s, "<PaymentModal", "/>")).toMatch(/if \(!o\) \{\s*setCheckout\(null\);\s*press\.release\(\);/);
  });

  it("the upgrade drawer: taken before the POST; released on a failure and when the overlay closes, never on the payload", () => {
    const s = code("components/upgrade/upgrade-drawer.tsx");
    const fn = between(s, "async function submitCheckout", "function shareReferral");
    expect(between(fn, "async function submitCheckout", 'api.post<CheckoutResult>("/v1/billing/checkout"')).toContain("!press.take()");
    expect(between(fn, "setCheckoutResult(r);", "toast.error(")).not.toContain("press.release()");
    expect(between(fn, "} finally {", "}")).not.toContain("press.release()");
    expect(fn.split("press.release();").length - 1).toBe(2);
    expect(between(s, "<PaymentModal", "/>")).toMatch(/if \(!o\) \{\s*setCheckoutResult\(null\);\s*press\.release\(\);/);
  });

  it("the Peaks pack Buy: taken before the purchase; released on a failure and when the overlay closes", () => {
    const s = code("app/(site)/dashboard/peaks/page.tsx");
    const fn = between(s, "const start = async (packKey: string) => {", "} finally {");
    expect(between(fn, "const start", "buyPack(packKey)")).toContain("if (!press.take()) return;");
    expect(between(fn, "} catch (err) {", "if (err instanceof")).toContain("press.release();");
    expect(between(s, "<PaymentModal", "/>")).toMatch(/if \(!open\) \{\s*setCheckout\(null\);\s*press\.release\(\);/);
  });

  it("the payment modal: Continue to payment and Skip both take the latch, so the overlay launches once", () => {
    const s = code("components/upgrade/payment-modal.tsx");
    const body = between(s, "const continueToPayment", 'setGate("launch");');
    expect(body).toContain("if (!press.take()) return;");
    expect(body.indexOf("if (!press.take()) return;")).toBeLessThan(body.indexOf("setSavingGstin(true)"));
    expect(s).toContain('onClick={() => press.take() && setGate("launch")}');
  });
});
