import { describe, it, expect } from "vitest";
import { insertAtCaret, clampCaret } from "./caret";

describe("insertAtCaret", () => {
  it("inserts at the caret and advances past the snippet", () => {
    const r = insertAtCaret("Hello world", 5, " there");
    expect(r.text).toBe("Hello there world");
    expect(r.caret).toBe(11); // 5 + " there".length (6)
  });

  it("inserts at the start", () => {
    const r = insertAtCaret("world", 0, "hello ");
    expect(r.text).toBe("hello world");
    expect(r.caret).toBe(6);
  });

  it("inserts at the end", () => {
    const r = insertAtCaret("hello", 5, "!");
    expect(r.text).toBe("hello!");
    expect(r.caret).toBe(6);
  });

  it("inserts into empty text", () => {
    const r = insertAtCaret("", 0, "😀");
    expect(r.text).toBe("😀");
    // Caret advances by the snippet's UTF-16 code-unit length (2 for an
    // astral emoji) — which is what setSelectionRange expects.
    expect(r.caret).toBe("😀".length);
  });

  it("clamps an out-of-range caret to the end (stale-caret safety)", () => {
    const r = insertAtCaret("abc", 999, "X");
    expect(r.text).toBe("abcX");
    expect(r.caret).toBe(4);
  });

  it("clamps a negative caret to the start", () => {
    const r = insertAtCaret("abc", -3, "X");
    expect(r.text).toBe("Xabc");
    expect(r.caret).toBe(1);
  });

  it("treats a NaN caret as end-of-text rather than dropping chars", () => {
    const r = insertAtCaret("abc", Number.NaN, "X");
    expect(r.text).toBe("abcX");
    expect(r.caret).toBe(4);
  });

  it("does not mutate the inputs", () => {
    const text = "abc";
    insertAtCaret(text, 1, "Z");
    expect(text).toBe("abc");
  });
});

describe("clampCaret", () => {
  it("passes through an in-range integer", () => {
    expect(clampCaret(3, 10)).toBe(3);
  });
  it("floors a fractional caret", () => {
    expect(clampCaret(2.9, 10)).toBe(2);
  });
  it("clamps overflow to length and underflow to 0", () => {
    expect(clampCaret(50, 10)).toBe(10);
    expect(clampCaret(-1, 10)).toBe(0);
  });
});
