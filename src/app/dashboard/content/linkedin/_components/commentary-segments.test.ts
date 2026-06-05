import { describe, it, expect } from "vitest";
import { buildCommentarySegments, type ResolvedMention } from "./commentary-segments";

const acme: ResolvedMention = { name: "Acme Corp", urn: "urn:li:organization:123" };

describe("buildCommentarySegments", () => {
  it("returns null when there are no mentions (caller uses raw commentary)", () => {
    expect(buildCommentarySegments("Hello #world", [])).toBeNull();
  });

  it("returns null when recorded mentions don't appear in the text", () => {
    // user deleted the inserted mention → fall back to raw commentary
    expect(buildCommentarySegments("just plain text", [acme])).toBeNull();
  });

  it("splits text + a mention into ordered segments", () => {
    expect(buildCommentarySegments("Thanks @Acme Corp for the help", [acme])).toEqual([
      { type: "text", value: "Thanks " },
      { type: "mention", urn: "urn:li:organization:123", name: "Acme Corp" },
      { type: "text", value: " for the help" },
    ]);
  });

  it("emits a mention at the very start", () => {
    expect(buildCommentarySegments("@Acme Corp ships", [acme])).toEqual([
      { type: "mention", urn: "urn:li:organization:123", name: "Acme Corp" },
      { type: "text", value: " ships" },
    ]);
  });

  it("converts #hashtags to hashtag segments when in segment mode", () => {
    expect(buildCommentarySegments("Hi @Acme Corp #growth #b2b", [acme])).toEqual([
      { type: "text", value: "Hi " },
      { type: "mention", urn: "urn:li:organization:123", name: "Acme Corp" },
      { type: "text", value: " " },
      { type: "hashtag", value: "growth" },
      { type: "text", value: " " },
      { type: "hashtag", value: "b2b" },
    ]);
  });

  it("matches the same mention more than once", () => {
    const segs = buildCommentarySegments("@Acme Corp and @Acme Corp again", [acme]);
    expect(segs?.filter((s) => s.type === "mention")).toHaveLength(2);
  });

  it("prefers the longer name when one is a prefix of another", () => {
    const mentions: ResolvedMention[] = [
      { name: "Acme", urn: "urn:li:organization:1" },
      { name: "Acme Corp", urn: "urn:li:organization:2" },
    ];
    expect(buildCommentarySegments("ping @Acme Corp", mentions)).toEqual([
      { type: "text", value: "ping " },
      { type: "mention", urn: "urn:li:organization:2", name: "Acme Corp" },
    ]);
  });

  it("does not match a mention glued to a preceding word char (email@Acme Corp)", () => {
    expect(buildCommentarySegments("mail to bob@Acme Corp", [acme])).toBeNull();
  });

  it("does not match when the name is immediately followed by a word char", () => {
    // "@Acme Corpx" — the trailing 'x' means it isn't exactly the org name
    expect(buildCommentarySegments("hey @Acme Corpx", [acme])).toBeNull();
  });

  it("does not treat a mid-word # as a hashtag", () => {
    const segs = buildCommentarySegments("c#sharp @Acme Corp", [acme]);
    // the "c#sharp" stays text (no boundary before #), the mention still parses
    expect(segs).toEqual([
      { type: "text", value: "c#sharp " },
      { type: "mention", urn: "urn:li:organization:123", name: "Acme Corp" },
    ]);
  });

  it("ignores blank-name mentions", () => {
    expect(
      buildCommentarySegments("@Acme Corp", [{ name: "  ", urn: "urn:li:organization:9" }, acme]),
    ).toEqual([{ type: "mention", urn: "urn:li:organization:123", name: "Acme Corp" }]);
  });
});
