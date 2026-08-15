/**
 * Inserting a saved reply, and the wrong version of it that looks right.
 *
 * "Insert" has an obvious implementation — set the textarea to the saved
 * reply — and it silently destroys work: someone half-way through typing
 * a personal sentence, who reaches for a saved reply to finish it, loses
 * the sentence. A convenience feature must never do that, so the append
 * behaviour is pinned rather than assumed.
 */

import { describe, it, expect } from "vitest";
import { appendReply } from "./saved-reply-picker";

const MAX = 1250;

describe("★inserting must not destroy a draft", () => {
  it("keeps what the person already typed", () => {
    expect(appendReply("Thanks for asking, Priya!", "Our plans start at ₹999.", MAX)).toBe(
      "Thanks for asking, Priya!\n\nOur plans start at ₹999.",
    );
  });

  it("separates the two with a blank line, so the seam is editable", () => {
    // Jammed together, the saved reply reads as part of the person's own
    // sentence and they have to find the join before they can fix it.
    const out = appendReply("Hi Sam", "Here are the details.", MAX);
    expect(out).toContain("\n\n");
  });

  it("does not add a leading blank line to an empty box", () => {
    // The common case: nothing typed yet. A reply starting with two
    // newlines looks like a mistake in the composer.
    expect(appendReply("", "Our plans start at ₹999.", MAX)).toBe(
      "Our plans start at ₹999.",
    );
  });

  it("treats a whitespace-only draft as empty", () => {
    // A stray space or newline from clicking around is not work worth
    // preserving, and preserving it produces the leading-blank-line bug.
    expect(appendReply("   \n ", "Our plans start at ₹999.", MAX)).toBe(
      "Our plans start at ₹999.",
    );
  });
});

describe("the channel cap", () => {
  it("never returns more than the composer will accept", () => {
    // The composer refuses over-length text on send. Handing it a value
    // it will reject moves the failure to the moment the person presses
    // the button, which is the worst possible time to discover it.
    const long = "x".repeat(2000);
    expect(appendReply("", long, MAX)).toHaveLength(MAX);
    expect(appendReply("hello", long, MAX)).toHaveLength(MAX);
  });

  it("respects a tighter cap than LinkedIn's", () => {
    // X is 280. The picker is channel-neutral and the cap comes from the
    // composer, which is the only thing that knows where the text is going.
    expect(appendReply("", "y".repeat(500), 280)).toHaveLength(280);
  });
});
