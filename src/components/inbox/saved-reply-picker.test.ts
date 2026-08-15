/**
 * Inserting a saved reply, and the two wrong versions of it that look
 * right.
 *
 * "Insert" has an obvious implementation — set the textarea to the saved
 * reply — and it silently destroys work: someone half-way through typing
 * a personal sentence, who reaches for a saved reply to finish it, loses
 * the sentence.
 *
 * The second-obvious implementation appends and then truncates to the
 * channel cap, which is worse in a quieter way: a near-full draft gains
 * half a word and the person posts it to a customer without noticing the
 * button did that.
 */

import { describe, it, expect } from "vitest";
import { appendReply } from "./saved-reply-picker";

const MAX = 1250;

describe("★inserting must not destroy a draft", () => {
  it("keeps what the person already typed", () => {
    const out = appendReply("Thanks for asking, Priya!", "Our plans start at ₹999.", MAX);
    expect(out).toEqual({
      text: "Thanks for asking, Priya!\n\nOur plans start at ₹999.",
      fitted: true,
    });
  });

  it("separates the two with a blank line, so the seam is editable", () => {
    // Jammed together, the saved reply reads as part of the person's own
    // sentence and they have to find the join before they can fix it.
    expect(appendReply("Hi Sam", "Here are the details.", MAX).text).toContain("\n\n");
  });

  it("does not add a leading blank line to an empty box", () => {
    // The common case: nothing typed yet. A reply starting with two
    // newlines looks like a mistake in the composer.
    expect(appendReply("", "Our plans start at ₹999.", MAX).text).toBe(
      "Our plans start at ₹999.",
    );
  });

  it("treats a whitespace-only draft as empty", () => {
    // A stray space or newline from clicking around is not work worth
    // preserving, and preserving it produces the leading-blank-line bug.
    expect(appendReply("   \n ", "Our plans start at ₹999.", MAX).text).toBe(
      "Our plans start at ₹999.",
    );
  });
});

describe("★when it does not fit, nothing happens", () => {
  it("refuses rather than appending half a sentence", () => {
    // The first cut sliced the joined string: a draft at 1,240 characters
    // gained "\n\nOur pl" and the person posted it. Silent, and the half
    // that gets cut is the end — where the call to action lives.
    const draft = "x".repeat(1240);
    const out = appendReply(draft, "Our plans start at ₹999 per month.", MAX);
    expect(out.fitted).toBe(false);
    expect(out.text).toBe(draft);
  });

  it("refuses rather than appending a bare newline", () => {
    // At 1,249 the old version added exactly "\n" and nothing else.
    const draft = "x".repeat(1249);
    expect(appendReply(draft, "Anything at all", MAX)).toEqual({
      text: draft,
      fitted: false,
    });
  });

  it("refuses a reply longer than the cap even into an empty box", () => {
    expect(appendReply("", "y".repeat(2000), MAX).fitted).toBe(false);
  });

  it("fits exactly at the cap", () => {
    // The boundary is inclusive — a reply that is precisely the limit is
    // a reply the composer will accept.
    const out = appendReply("", "z".repeat(MAX), MAX);
    expect(out.fitted).toBe(true);
    expect(out.text).toHaveLength(MAX);
  });

  it("respects a tighter cap than LinkedIn's", () => {
    // X is 280. The cap comes from the composer, which is the only thing
    // that knows where the text is going.
    expect(appendReply("", "y".repeat(500), 280).fitted).toBe(false);
    expect(appendReply("", "y".repeat(200), 280).fitted).toBe(true);
  });
});
