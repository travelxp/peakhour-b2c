import { describe, it, expect } from "vitest";
import { describeActionPage, propertyToHost, MAX_LABEL } from "./search-action-page";

/**
 * The two decisions in search-action-page.ts: what is safe to put in an href,
 * and what a person should read instead of a 90-character URL.
 *
 * ★THE SAFETY BLOCK IS THE ONE THAT MATTERS. The URL arrives from
 * ana_search_queries, a MongoDB time-series collection — which cannot carry a
 * $jsonSchema validator at all — written by a raw insertMany. So nothing
 * between Search Console and this function enforces that the string is even a
 * URL, and it is rendered as a link the user is invited to click.
 */

describe("only http(s) ever becomes an href", () => {
  it("refuses javascript:", () => {
    // The one that matters: a valid URL, a valid href, and an XSS vector.
    expect(describeActionPage("javascript:alert(1)")).toBeNull();
  });

  it("refuses data:", () => {
    expect(describeActionPage("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
  });

  it("refuses vbscript: and file:", () => {
    expect(describeActionPage("vbscript:msgbox(1)")).toBeNull();
    expect(describeActionPage("file:///etc/passwd")).toBeNull();
  });

  it("refuses a scheme it has simply never heard of", () => {
    // ★ALLOWLIST, NOT DENYLIST — this is the case a denylist gets wrong.
    expect(describeActionPage("chrome-extension://abc/page.html")).toBeNull();
    expect(describeActionPage("intent://x#Intent;scheme=http;end")).toBeNull();
  });

  it("is not fooled by case or leading whitespace", () => {
    expect(describeActionPage("  JavaScript:alert(1)")).toBeNull();
    expect(describeActionPage("\tjavascript:alert(1)")).toBeNull();
  });

  it("accepts the two schemes a page can actually be on", () => {
    expect(describeActionPage("https://x.com/a")?.href).toBe("https://x.com/a");
    expect(describeActionPage("http://x.com/a")?.href).toBe("http://x.com/a");
  });

  it("refuses an unparseable value rather than repairing it", () => {
    // A relative path COULD be resolved against the property — but the provider
    // stores absolute URLs, so this is a malformed row, and guessing invents an
    // address instead of reporting one.
    expect(describeActionPage("/collections/boots")).toBeNull();
    expect(describeActionPage("not a url")).toBeNull();
    expect(describeActionPage("")).toBeNull();
  });

  it("returns null for the absent case, which is normal", () => {
    // Terms the pair sync has not reached have no url at all.
    expect(describeActionPage(undefined)).toBeNull();
  });
});

describe("the label a person reads", () => {
  it("is the path, not the whole URL", () => {
    expect(describeActionPage("https://x.com/collections/winter-boots")?.label).toBe(
      "/collections/winter-boots",
    );
  });

  it("keeps the query string, which distinguishes two pages", () => {
    expect(describeActionPage("https://x.com/search?q=boots")?.label).toBe("/search?q=boots");
  });

  it("shows a bare root as /", () => {
    expect(describeActionPage("https://x.com")?.label).toBe("/");
    expect(describeActionPage("https://x.com/")?.label).toBe("/");
  });

  it("drops the fragment", () => {
    expect(describeActionPage("https://x.com/a#reviews")?.label).toBe("/a");
  });

  it("elides the MIDDLE of a long path, keeping the slug visible", () => {
    // ★THE END IS THE PART A PERSON RECOGNISES. Truncating the tail would leave
    // every long URL on a big site looking identical.
    const long = `https://x.com/${"a".repeat(40)}/winter-boots-mens-waterproof`;
    const label = describeActionPage(long)!.label;
    expect(label.length).toBeLessThanOrEqual(MAX_LABEL);
    expect(label).toContain("…");
    expect(label.startsWith("/aaa")).toBe(true);
    expect(label.endsWith("waterproof")).toBe(true);
  });

  it("does not elide a path that already fits", () => {
    const label = describeActionPage("https://x.com/shop")!.label;
    expect(label).toBe("/shop");
    expect(label).not.toContain("…");
  });

  it("never elides the href, only the label", () => {
    const long = `https://x.com/${"a".repeat(80)}`;
    const page = describeActionPage(long)!;
    expect(page.href).toBe(long);
    expect(page.label.length).toBeLessThan(page.href.length);
  });
});

describe("a page on a different host than the property", () => {
  it("is flagged, so it does not silently look local", () => {
    const page = describeActionPage("https://blog.x.com/post", "sc-domain:x.com");
    expect(page?.foreignHost).toBe("blog.x.com");
  });

  it("is not flagged when it matches a domain property", () => {
    expect(describeActionPage("https://x.com/a", "sc-domain:x.com")?.foreignHost).toBeUndefined();
  });

  it("is not flagged when it matches a URL-prefix property", () => {
    expect(describeActionPage("https://x.com/a", "https://x.com/shop/")?.foreignHost).toBeUndefined();
  });

  it("is not flagged when we do not know the property", () => {
    // ★NO PROPERTY MEANS NO CLAIM. Marking everything foreign because we could
    // not resolve the property would put a redundant hostname on every card.
    expect(describeActionPage("https://x.com/a")?.foreignHost).toBeUndefined();
  });
});

describe("propertyToHost — two property shapes, one of them not a URL", () => {
  it("reads a domain property", () => {
    // ★`sc-domain:example.com` DOES NOT PARSE AS A URL. Treating it as one
    // returns null and marks every page foreign.
    expect(propertyToHost("sc-domain:example.com")).toBe("example.com");
  });

  it("reads a URL-prefix property", () => {
    expect(propertyToHost("https://example.com/shop/")).toBe("example.com");
  });

  it("keeps a port, which is part of the host", () => {
    expect(propertyToHost("http://example.com:8080/")).toBe("example.com:8080");
  });

  it("returns null for nothing, junk, or an empty domain property", () => {
    expect(propertyToHost(undefined)).toBeNull();
    expect(propertyToHost("")).toBeNull();
    expect(propertyToHost("sc-domain:")).toBeNull();
    expect(propertyToHost("not a property")).toBeNull();
  });
});
