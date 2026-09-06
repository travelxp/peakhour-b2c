import { describe, it, expect } from "vitest";
import {
  describeActionPage,
  propertyToHost,
  readablePath,
  MAX_LABEL,
} from "./search-action-page";

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
  it("is flagged when it really is another domain", () => {
    const page = describeActionPage("https://elsewhere.com/post", "sc-domain:x.com");
    expect(page?.foreignHost).toBe("elsewhere.com");
  });

  it("does NOT flag a subdomain under a domain property", () => {
    // ★★A `sc-domain:` PROPERTY COVERS ITS SUBDOMAINS BY DEFINITION, and
    // `www.` is the common setup. A first version compared hosts strictly and
    // asserted the opposite of this — so it stamped a redundant
    // `www.example.com` on every card of a normal site, which is the exact
    // outcome the flag exists to prevent, and the test agreed with it.
    expect(describeActionPage("https://www.x.com/a", "sc-domain:x.com")?.foreignHost).toBeUndefined();
    expect(describeActionPage("https://blog.x.com/a", "sc-domain:x.com")?.foreignHost).toBeUndefined();
    expect(
      describeActionPage("https://deep.blog.x.com/a", "sc-domain:x.com")?.foreignHost,
    ).toBeUndefined();
  });

  it("matches subdomains on a DOT BOUNDARY, not a suffix", () => {
    // `notx.com` merely ends with `x.com`.
    expect(describeActionPage("https://notx.com/a", "sc-domain:x.com")?.foreignHost).toBe("notx.com");
    expect(
      describeActionPage("https://evil-x.com/a", "sc-domain:x.com")?.foreignHost,
    ).toBe("evil-x.com");
  });

  it("is case-insensitive about the property", () => {
    // The api trims a property but never case-normalises it, and `new URL()`
    // lowercases a host — so a mixed-case property matched nothing at all.
    expect(describeActionPage("https://x.com/a", "sc-domain:X.com")?.foreignHost).toBeUndefined();
    expect(describeActionPage("https://www.x.com/a", "SC-DOMAIN:X.COM")?.foreignHost).toBeUndefined();
  });

  it("is not flagged when it matches a domain property exactly", () => {
    expect(describeActionPage("https://x.com/a", "sc-domain:x.com")?.foreignHost).toBeUndefined();
  });

  it("keeps a URL-prefix property EXACT — it is scoped to one origin", () => {
    expect(describeActionPage("https://x.com/a", "https://x.com/shop/")?.foreignHost).toBeUndefined();
    // A subdomain is NOT covered by a URL-prefix property.
    expect(describeActionPage("https://www.x.com/a", "https://x.com/shop/")?.foreignHost).toBe(
      "www.x.com",
    );
  });

  it("is not flagged when we do not know the property", () => {
    // ★NO PROPERTY MEANS NO CLAIM. Marking everything foreign because we could
    // not resolve the property would put a redundant hostname on every card.
    expect(describeActionPage("https://x.com/a")?.foreignHost).toBeUndefined();
    expect(describeActionPage("https://x.com/a", "not a property")?.foreignHost).toBeUndefined();
    expect(describeActionPage("https://x.com/a", "sc-domain:")?.foreignHost).toBeUndefined();
  });
});

describe("propertyToHost — two property shapes, one of them not a URL", () => {
  it("lowercases a mixed-case domain property, matching the URL branch", () => {
    expect(propertyToHost("sc-domain:Example.COM")).toBe("example.com");
  });

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

describe("a label a person can actually read", () => {
  it("decodes a non-Latin slug instead of showing escape sequences", () => {
    // ★`u.pathname` IS ALWAYS PERCENT-ENCODED. A short Japanese path arrives as
    // ~139 characters of `%E5%86%AC…` — unreadable, and long enough to trip an
    // elision it never needed, which then cuts an escape sequence in half.
    const page = describeActionPage("https://x.com/冬のブーツ")!;
    expect(page.label).toBe("/冬のブーツ");
    expect(page.label).not.toContain("%");
    expect(page.label.length).toBeLessThanOrEqual(MAX_LABEL);
  });

  it("keeps the href encoded — only the label is decoded", () => {
    const page = describeActionPage("https://x.com/冬のブーツ")!;
    expect(page.href).toContain("%E5%86%AC");
    expect(page.href).not.toContain("冬");
  });

  it("does not elide a decoded path that fits, though its encoding would not", () => {
    // Encoded this is well past MAX_LABEL; decoded it is nine characters.
    const page = describeActionPage("https://x.com/冬のブーツアウター")!;
    expect(page.label).not.toContain("…");
  });

  it("falls back to the raw path on a malformed escape rather than showing nothing", () => {
    // A lone `%` throws inside decodeURIComponent.
    expect(readablePath("/100%")).toBe("/100%");
    expect(readablePath("/a%zz")).toBe("/a%zz");
  });

  it("strips a right-to-left override, which reverses what the reader sees", () => {
    // ★DECODING RE-ANIMATES WHAT THE ENCODING MADE INERT. U+202E inside a link
    // label reorders the text after it — `/gnp.eciovni` displayed as
    // `/invoice.png`, over an href that goes somewhere else entirely.
    const stripped = readablePath("/a‮b");
    expect(stripped).toBe("/ab");
    expect(stripped).not.toContain("‮");
  });

  it("strips control characters", () => {
    expect(readablePath("/a bcd")).toBe("/abcd");
  });

  it("strips them AFTER decoding, which is the only point they exist", () => {
    // Percent-encoded, U+202E is inert; decoded, it is not. A strip that ran
    // before the decode would miss every one that arrived encoded — which is
    // how it would actually arrive.
    expect(describeActionPage("https://x.com/a%E2%80%AEb")?.label).toBe("/ab");
  });

  it("leaves ordinary text alone", () => {
    expect(readablePath("/collections/winter-boots?sort=price")).toBe(
      "/collections/winter-boots?sort=price",
    );
  });
});
