import type { CreateSourceInput } from "../types";
import { detectSourceType, defaultDisplayName } from "./detect-type";

/**
 * Parse an OPML 2.0 document — the canonical export format for
 * feed-readers (Feedly, NetNewsWire, Inoreader, etc.) — into a list
 * of CreateSourceInput rows ready to feed bulk-create.
 *
 * Walks `<outline>` elements, including nested ones inside
 * categorised exports (e.g., Feedly groups feeds under category
 * outlines). For each leaf outline that has an `xmlUrl` attribute
 * we treat it as an RSS feed; outlines with only `htmlUrl` fall
 * through to the website type via the standard auto-detect.
 *
 * What we deliberately ignore:
 *   • OPML categories themselves — we flatten. The Trusted Sources
 *     UI doesn't model categories; if it ever does, this parser
 *     can return `{ rows, groups }` instead.
 *   • Versioned OPML 1.x — the element shape is the same; what
 *     differs is the head metadata, which we don't read.
 *   • Non-feed outlines without xmlUrl/htmlUrl — these are
 *     organisational nodes; skipping them is correct.
 *
 * Errors thrown by this function bubble up to the caller's toast
 * surface — DOMParser silently produces a `<parsererror>` document
 * on malformed XML, so we look for that explicitly.
 */
export interface ParsedOpmlRow extends CreateSourceInput {
  /** Optional category breadcrumb from nested OPML outlines.
   *  Surfaced only for the preview UI, not sent to the backend
   *  (cnt_trusted_sources has no category column today). */
  category?: string;
}

export class OpmlParseError extends Error {}

export function parseOpml(xml: string): ParsedOpmlRow[] {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // Defensive: this util is intended for client use (file upload
    // handlers). If it ever gets wired to a server route, the
    // caller needs a node:xml parser instead.
    throw new OpmlParseError("OPML parsing requires DOMParser; call from a client component");
  }

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new OpmlParseError("File doesn't look like valid XML/OPML");
  }
  // `localName` returns the un-namespaced element name (e.g.
  // <opml:opml> → "opml"). Some legacy exporters wrap their OPML in
  // a custom namespace; `tagName` would include the prefix and fail
  // this check unnecessarily. Lowercase the compare since XML
  // element names are technically case-sensitive (real OPML uses
  // lowercase `<opml>`/`<outline>` per spec).
  if (doc.documentElement.localName.toLowerCase() !== "opml") {
    throw new OpmlParseError("Root element isn't <opml>");
  }

  // Dedupe by identifier — Feedly et al. export the same feed
  // under multiple categories, and bulk-create would generate one
  // 409 per duplicate. First occurrence wins so the breadcrumb
  // reflects the primary category.
  const seen = new Map<string, ParsedOpmlRow>();
  const root = doc.querySelector("body");
  if (root) walk(root, [], seen);
  return Array.from(seen.values());
}

function walk(node: Element, breadcrumbs: string[], seen: Map<string, ParsedOpmlRow>): void {
  for (const child of Array.from(node.children)) {
    // `localName` strips namespace prefixes — see the parseOpml
    // header for why. Real OPML exporters emit lowercase
    // `<outline>`; the case-fold is belt-and-braces.
    if (child.localName.toLowerCase() !== "outline") continue;

    // OPML 2.0 spec: attribute names are case-sensitive `xmlUrl` /
    // `htmlUrl`. All real-world exporters (Feedly, NetNewsWire,
    // Inoreader) emit canonical casing; we read it directly.
    const xmlUrl = child.getAttribute("xmlUrl");
    const htmlUrl = child.getAttribute("htmlUrl");
    const text = child.getAttribute("text") || child.getAttribute("title") || "";

    // A leaf with at least one URL → emit a row. We favour xmlUrl
    // because feed-reader exports lean on it; htmlUrl is used as
    // the fallback when xmlUrl is absent.
    const url = xmlUrl || htmlUrl;
    if (url) {
      const identifier = url.trim();
      if (!seen.has(identifier)) {
        const displayName = text.trim() || defaultDisplayName(url);
        const type = xmlUrl ? "rss" : detectSourceType(url);
        seen.set(identifier, {
          type,
          identifier,
          displayName,
          ...(breadcrumbs.length > 0 ? { category: breadcrumbs.join(" / ") } : {}),
        });
      }
      continue;
    }

    // Branch outline (no URL) — recurse with the breadcrumb. Use
    // the outline's text/title as the path segment.
    const segment = text.trim();
    walk(child, segment ? [...breadcrumbs, segment] : breadcrumbs, seen);
  }
}
