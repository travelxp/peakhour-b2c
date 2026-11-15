import { describe, expect, it } from "vitest";
import {
  anchorHrefs, canonicalOf, decodeEntities, directAnswer, h1s, hasFabricatedField, internalPaths, jsonLd, ogUrlOf, textOf, typesOf,
} from "./html";

describe("smoke html readers", () => {
  it("reads an H1 across React comments, entities and a line break", () => {
    const html = `<h1 class="a">Your store&#x27;s AI team,<!-- --> <span>right inside Shopify.</span></h1>
      <h1>Everything online.<br/>One plan.</h1>`;
    expect(h1s(html)).toEqual(["Your store's AI team, right inside Shopify.", "Everything online. One plan."]);
  });

  it("finds the direct answer after the H1, skipping short paragraphs", () => {
    const long = "Peakhour answers shoppers from your catalogue, on Shopify, and you approve each change.";
    expect(directAnswer(`<p>Before the heading is a long enough paragraph to be ignored entirely.</p><h1>H</h1><p>Short.</p><p>${long}</p>`)).toBe(long);
    expect(directAnswer("<p>No heading here, so no answer at all, however long the paragraph runs on.</p>")).toBeUndefined();
    expect(directAnswer("<h1>H</h1><p>Too short.</p>")).toBeUndefined();
  });

  it("collects only standard anchors", () => {
    const html = `<a class="x" href="/pricing">p</a><button onclick="go('/nope')">b</button><a href="https://peakhour.ai/shopify?x=1#y">s</a>`;
    expect(anchorHrefs(html)).toEqual(["/pricing", "https://peakhour.ai/shopify?x=1#y"]);
  });

  it("keeps internal pages and drops files, framework paths, other hosts and protocol-relative links", () => {
    const origins = ["https://peakhour.ai", "https://dev.peakhour.ai"];
    expect(
      internalPaths(
        ["/pricing", "/pricing#faq", "https://peakhour.ai", "https://peakhour.ai/shopify?x=1", "https://dev.peakhour.ai/peaks",
          "/_next/static/a.css", "/brand/logo.svg", "//cdn.example.com/x", "https://example.com/pricing", "https://peakhour.ai.evil.com/x", "mailto:a@b.c"],
        origins,
      ).sort(),
    ).toEqual(["/", "/peaks", "/pricing", "/shopify"]);
  });

  it("reads the canonical and og:url in either attribute order", () => {
    expect(canonicalOf(`<link rel="canonical" href="https://peakhour.ai/a"/>`)).toBe("https://peakhour.ai/a");
    expect(canonicalOf(`<link href="https://peakhour.ai/b" rel="canonical"/>`)).toBe("https://peakhour.ai/b");
    expect(ogUrlOf(`<meta property="og:url" content="https://peakhour.ai/c"/>`)).toBe("https://peakhour.ai/c");
    expect(canonicalOf("<p>none</p>")).toBeUndefined();
  });

  it("parses JSON-LD and flags a block that does not parse or lacks a type", () => {
    const ok = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"x"}</script>`;
    expect(jsonLd(ok)).toEqual({ nodes: [{ "@context": "https://schema.org", "@type": "WebSite", name: "x" }], errors: [] });
    expect(jsonLd(`<script type="application/ld+json">{nope</script>`).errors).toEqual(["does not parse"]);
    expect(jsonLd(`<script type="application/ld+json">{"@type":"X"}</script>`).errors).toEqual(["missing @context or @type"]);
  });

  it("finds a review or rating field however deep", () => {
    expect(hasFabricatedField([{ a: { b: [{ aggregateRating: { ratingValue: 5 } }] } }])).toBe("aggregateRating");
    expect(hasFabricatedField([{ "@type": "FAQPage", mainEntity: [{ name: "q" }] }])).toBeUndefined();
  });

  it("decodes named and numeric entities and leaves an unknown one alone", () => {
    expect(decodeEntities("a &amp; b &#39;c&#x27; &madeup;")).toBe("a & b 'c' &madeup;");
    expect(textOf("<p>a  <b>b</b>\n c</p>")).toBe("a b c");
  });

  it("reads JSON-LD with other attributes first, a top-level array, an @graph and an array @type", () => {
    const a = `<script id="ld" nonce="n" type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"},{"@type":["Article","X"]}]}</script>`;
    const r = jsonLd(a);
    expect(r.errors).toEqual([]);
    expect(r.nodes.map(typesOf)).toEqual([["BreadcrumbList"], ["Article", "X"]]);
    const arr = jsonLd(`<script type='application/ld+json'>[{"@context":"https://schema.org","@type":"WebSite"}]</script>`);
    expect(arr.nodes).toHaveLength(1);
  });

  it("leaves an out-of-range numeric entity alone instead of throwing", () => {
    expect(decodeEntities("a &#99999999; b &#xFFFFFFF; c")).toBe("a &#99999999; b &#xFFFFFFF; c");
  });
});
