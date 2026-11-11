import { describe, it, expect } from "vitest";
import {
  CAROUSEL_MIN_CHARS,
  HAS_ORG_SCOPE,
  MAX_LEN,
  applyHookVariant,
  authorFromKey,
  buildAuthorOptions,
  buildPublishBody,
  buildScheduleChannels,
  composerGates,
  effectiveVisibilityFor,
  isOrgAuthorKey,
  scheduleTitleFor,
} from "./linkedin-composer";

const person = { urn: "urn:li:person:1", name: "Ada" };
const pages = [
  { id: "10", name: "Acme" },
  { id: "11", name: "" },
] as never;

describe("buildAuthorOptions", () => {
  it("lists pages first, then the personal feed when allowed", () => {
    const opts = buildAuthorOptions({ scopes: [HAS_ORG_SCOPE], pages, person });
    expect(opts.map((o) => o.value)).toEqual(["org:10", "org:11", "person"]);
    expect(opts[1].label).toBe("Page 11");
    expect(opts[0].sublabel).toBe("Company page");
  });
  it("hides the personal feed when the server disallows it and pages exist", () => {
    const opts = buildAuthorOptions({
      scopes: [HAS_ORG_SCOPE],
      pages,
      person,
      personalPostingAllowed: false,
    });
    expect(opts.map((o) => o.value)).toEqual(["org:10", "org:11"]);
  });
  it("falls back to the personal feed when no page option can be built", () => {
    const opts = buildAuthorOptions({ scopes: [], pages, person, personalPostingAllowed: false });
    expect(opts.map((o) => o.value)).toEqual(["person"]);
  });
  it("names an unnamed person", () => {
    const opts = buildAuthorOptions({ scopes: [], pages: [], person: { urn: "u", name: null } });
    expect(opts[0].label).toBe("My personal feed");
  });
});

describe("author helpers", () => {
  it("maps keys to authors and visibility", () => {
    expect(isOrgAuthorKey("org:5")).toBe(true);
    expect(isOrgAuthorKey("person")).toBe(false);
    expect(authorFromKey("org:5")).toEqual({ type: "org", pageId: "5" });
    expect(authorFromKey("person")).toEqual({ type: "person" });
    expect(effectiveVisibilityFor("org:5", "CONNECTIONS")).toBe("PUBLIC");
    expect(effectiveVisibilityFor("person", "CONNECTIONS")).toBe("CONNECTIONS");
  });
});

describe("applyHookVariant", () => {
  it("replaces only the first paragraph", () => {
    expect(applyHookVariant("old hook\n\nbody one\n\nbody two", "new")).toBe(
      "new\n\nbody one\n\nbody two",
    );
  });
  it("replaces a single-paragraph text outright", () => {
    expect(applyHookVariant("only hook", "new")).toBe("new");
  });
});

describe("scheduleTitleFor", () => {
  it("uses the first non-blank line, capped at 120", () => {
    expect(scheduleTitleFor("\n\n  Hello there  \nmore")).toBe("Hello there");
    expect(scheduleTitleFor("x".repeat(200))?.length).toBe(120);
    expect(scheduleTitleFor("   \n ")).toBeUndefined();
  });
});

describe("composerGates", () => {
  const ok = {
    text: "a".repeat(CAROUSEL_MIN_CHARS),
    showLink: false,
    linkUrl: "",
    pollActive: false,
    pollValid: false,
    anyPending: false,
    linkLooksLikeUrl: false,
  };
  it("is live for a normal draft", () => {
    const g = composerGates(ok);
    expect(g.publishDisabled).toBe(false);
    expect(g.scheduleDisabled).toBe(false);
    expect(g.carouselDisabled).toBe(false);
  });
  it("blocks everything when empty", () => {
    const g = composerGates({ ...ok, text: "  " });
    expect(g.empty).toBe(true);
    expect(g.publishDisabled && g.scheduleDisabled && g.carouselDisabled).toBe(true);
  });
  it("blocks over the length limit", () => {
    const g = composerGates({ ...ok, text: "a".repeat(MAX_LEN + 1) });
    expect(g.tooLong).toBe(true);
    expect(g.publishDisabled).toBe(true);
  });
  it("needs enough text for a carousel but not to publish", () => {
    const g = composerGates({ ...ok, text: "short" });
    expect(g.carouselTooShort).toBe(true);
    expect(g.carouselDisabled).toBe(true);
    expect(g.publishDisabled).toBe(false);
  });
  it("flags a bad link only when one is shown and typed", () => {
    expect(composerGates({ ...ok, showLink: true, linkUrl: "nope" }).linkInvalid).toBe(true);
    expect(composerGates({ ...ok, showLink: false, linkUrl: "nope" }).linkInvalid).toBe(false);
    expect(composerGates({ ...ok, showLink: true, linkUrl: "  " }).linkInvalid).toBe(false);
    expect(
      composerGates({ ...ok, showLink: true, linkUrl: "https://a.b", linkLooksLikeUrl: true })
        .linkInvalid,
    ).toBe(false);
  });
  it("an incomplete poll blocks publish; any poll blocks schedule and carousel", () => {
    const incomplete = composerGates({ ...ok, pollActive: true, pollValid: false });
    expect(incomplete.publishDisabled).toBe(true);
    const complete = composerGates({ ...ok, pollActive: true, pollValid: true });
    expect(complete.publishDisabled).toBe(false);
    expect(complete.scheduleDisabled).toBe(true);
    expect(complete.carouselDisabled).toBe(true);
  });
  it("a pending request blocks publish and carousel but not schedule", () => {
    const g = composerGates({ ...ok, anyPending: true });
    expect(g.publishDisabled).toBe(true);
    expect(g.carouselDisabled).toBe(true);
    expect(g.scheduleDisabled).toBe(false);
  });
});

describe("buildPublishBody", () => {
  const input = {
    authorKey: "person",
    visibility: "CONNECTIONS" as const,
    text: "  Hello  ",
    segments: null,
    poll: null,
    showLink: false,
    linkUrl: "",
    linkTitle: "",
  };
  it("sends trimmed raw commentary", () => {
    expect(buildPublishBody(input)).toEqual({
      author: { type: "person" },
      visibility: "CONNECTIONS",
      commentary: "Hello",
    });
  });
  it("sends segments instead of commentary when given", () => {
    const segments = [{ type: "text", value: "Hi" }] as never;
    const body = buildPublishBody({ ...input, segments });
    expect(body.commentarySegments).toBe(segments);
    expect("commentary" in body).toBe(false);
  });
  it("forces PUBLIC for a page", () => {
    const body = buildPublishBody({ ...input, authorKey: "org:9" });
    expect(body.author).toEqual({ type: "org", pageId: "9" });
    expect(body.visibility).toBe("PUBLIC");
  });
  it("trims the link and drops an empty title", () => {
    const body = buildPublishBody({
      ...input,
      showLink: true,
      linkUrl: " https://a.b ",
      linkTitle: " ",
    });
    expect(body.link).toEqual({ url: "https://a.b", title: undefined });
  });
  it("never sends segments with a poll", () => {
    const segments = [{ type: "text", value: "Hi" }] as never;
    const body = buildPublishBody({
      ...input,
      segments,
      poll: { question: "Q?", options: [{ text: "A" }, { text: "B" }], duration: "ONE_DAY" },
    });
    expect("commentarySegments" in body).toBe(false);
    expect(body.commentary).toBe("Hello");
  });
  it("ignores a hidden link when the toggle is off", () => {
    expect(
      buildPublishBody({ ...input, showLink: false, linkUrl: "https://a.b" }).link,
    ).toBeUndefined();
  });
  it("a poll wins over a link, trims, and drops blank options", () => {
    const body = buildPublishBody({
      ...input,
      showLink: true,
      linkUrl: "https://a.b",
      poll: {
        question: " Q? ",
        options: [{ text: " A " }, { text: "" }, { text: "B" }],
        duration: "ONE_DAY",
      },
    });
    expect(body.poll).toEqual({ question: "Q?", options: ["A", "B"], duration: "ONE_DAY" });
    expect(body.link).toBeUndefined();
  });
});

describe("buildScheduleChannels", () => {
  const input = {
    authorKey: "person",
    personUrn: "urn:li:person:1",
    visibility: "PUBLIC" as const,
    showLink: false,
    linkUrl: "",
    linkTitle: "",
    text: " Hi ",
  };
  it("targets the person urn", () => {
    expect(buildScheduleChannels(input)).toEqual([
      {
        channel: "linkedin",
        payload: {
          text: "Hi",
          channelOptions: { authorUrn: "urn:li:person:1", visibility: "PUBLIC" },
        },
      },
    ]);
  });
  it("targets an organization urn for a page", () => {
    const [c] = buildScheduleChannels({ ...input, authorKey: "org:77" });
    expect(c.payload.channelOptions.authorUrn).toBe("urn:li:organization:77");
  });
  it("forces PUBLIC for a page, like publish", () => {
    const [c] = buildScheduleChannels({ ...input, authorKey: "org:77", visibility: "CONNECTIONS" });
    expect(c.payload.channelOptions.visibility).toBe("PUBLIC");
    const [d] = buildScheduleChannels({ ...input, visibility: "CONNECTIONS" });
    expect(d.payload.channelOptions.visibility).toBe("CONNECTIONS");
  });
  it("carries a link, with the title only when set", () => {
    const [a] = buildScheduleChannels({ ...input, showLink: true, linkUrl: " https://a.b " });
    expect(a.payload.channelOptions.link).toEqual({ url: "https://a.b" });
    const [b] = buildScheduleChannels({
      ...input,
      showLink: true,
      linkUrl: "https://a.b",
      linkTitle: " T ",
    });
    expect(b.payload.channelOptions.link).toEqual({ url: "https://a.b", title: "T" });
  });
});
