import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { CODE_LENGTH, cleanCode, codeIsComplete, linkErrorMessage, linkIsDead } from "./growth-link";

/**
 * H5: the page behind the WhatsApp link. A code is six digits and nothing else; a dead link says where to get a new one;
 * a raw message from the server is never shown.
 */

describe("the code box", () => {
  it("keeps digits only and stops at six, so a code pasted with a space is still a code", () => {
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode("12a3-45")).toBe("12345");
    expect(cleanCode("1234567890")).toBe("123456");
    expect(cleanCode("")).toBe("");
  });
  it("is complete at six digits and not before", () => {
    expect(CODE_LENGTH).toBe(6);
    expect(codeIsComplete("12345")).toBe(false);
    expect(codeIsComplete("123456")).toBe(true);
    expect(codeIsComplete("12 34 56")).toBe(true);
    expect(codeIsComplete("abcdef")).toBe(false);
  });
});

describe("a link that fails", () => {
  it.each(["LINK_INVALID", "LINK_EXPIRED", "LINK_USED", "OTP_LOCKED"])("%s ends the link and says where a new one comes from", (code) => {
    const e = new ApiError(code, "server words", 410);
    expect(linkIsDead(e)).toBe(true);
    expect(linkErrorMessage(e)).not.toBe("server words");
    expect(linkErrorMessage(e).length).toBeGreaterThan(20);
  });
  it.each(["OTP_WRONG", "OTP_EXPIRED", "OTP_COOLDOWN", "OTP_NOT_SENT", "OTP_DELIVERY_FAILED"])("%s leaves the link alive, so the person can try again", (code) => {
    expect(linkIsDead(new ApiError(code, "x", 403))).toBe(false);
  });
  it("a wrong code says it is not right; an unexpected failure shows no server text", () => {
    expect(linkErrorMessage(new ApiError("OTP_WRONG", "x", 403))).toMatch(/not right/);
    expect(linkErrorMessage(new ApiError("INTERNAL", "stack trace at line 4", 500))).not.toMatch(/stack/);
    expect(linkErrorMessage(new TypeError("Failed to fetch"))).toMatch(/Try again/);
    expect(linkIsDead(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("the link's host and route", () => {
  const SRC = path.resolve(__dirname, "..");

  it("lives at /growth/confirm/[token], the path the WhatsApp template's URL button points at", () => {
    const page = readFileSync(path.join(SRC, "app", "(site)", "growth", "confirm", "[token]", "page.tsx"), "utf8");
    expect(page).toContain("params: Promise<{ token: string }>");
    expect(page).toContain("<MandateConfirm token={token} />");
  });

  it("is reachable with no session while the coming-soon gate is on, and is kept out of search and Referer headers", () => {
    const middleware = readFileSync(path.join(SRC, "middleware.ts"), "utf8");
    expect(middleware).toMatch(/PUBLIC_PATHS = \[[^\]]*"\/growth\/confirm"/);
    // `/growth` itself is a marketing page and stays behind the gate
    expect(middleware).not.toMatch(/PUBLIC_PATHS = \[[^\]]*"\/growth"/);
    const page = readFileSync(path.join(SRC, "app", "(site)", "growth", "confirm", "[token]", "page.tsx"), "utf8");
    expect(page).toContain("index: false");
    expect(page).toContain('referrer: "no-referrer"');
  });
});
