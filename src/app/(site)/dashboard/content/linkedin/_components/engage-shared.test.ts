import { describe, it, expect } from "vitest";
import { actorDisplayName, linkedInPostUrl } from "./engage-shared";

/**
 * `actorDisplayName` exists to stop one string drifting.
 *
 * Four surfaces render a commenter — the thread panel, the reactions list,
 * Top Engagers and the Feed — and every one of them had written its own
 * `?? "A member"`. The nameless case is the COMMON one (a decoration
 * expires at 24 hours while the things it decorates live 48 or
 * indefinitely), so a drifted fallback would be the text most users see
 * most of the time.
 */
describe("actorDisplayName", () => {
  it("uses the decorated name when there is one", () => {
    expect(actorDisplayName({ actorUrn: "urn:li:person:a", displayName: "Tester McTest" })).toBe(
      "Tester McTest",
    );
  });

  it("falls back to the neutral label when the decoration expired", () => {
    expect(actorDisplayName({ actorUrn: "urn:li:person:a" })).toBe("A member");
  });

  it("falls back when there is no profile at all", () => {
    expect(actorDisplayName(undefined)).toBe("A member");
  });

  it("★never renders the URN, which is the tempting wrong answer", () => {
    // Top Engagers shipped for months showing `Person · 4bcd…wxyz` because
    // an internal member id looks like better-than-nothing. It is not: it
    // is unreadable AND it reads as our bug rather than as an absent name.
    expect(actorDisplayName({ actorUrn: "urn:li:person:j8924gj82" })).not.toContain("j8924gj82");
  });

  it("★does not treat a profile with a headline but no name as named", () => {
    // `parseActorDecoration` returns a profile when ANY field is present,
    // so headline-without-name is a real shape. Rendering an empty string
    // as the name would leave a nameless row that no longer says so.
    expect(actorDisplayName({ actorUrn: "urn:li:person:a", headline: "CTO at Acme" })).toBe(
      "A member",
    );
  });
});

describe("linkedInPostUrl", () => {
  it("returns null rather than a broken link when there is no URN", () => {
    expect(linkedInPostUrl(null)).toBeNull();
    expect(linkedInPostUrl(undefined)).toBeNull();
  });
});
