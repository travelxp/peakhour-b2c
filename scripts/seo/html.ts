/*
 * Small, dependency-free readers for the server HTML the smoke suite fetches. Pure, so html.test.ts can hold
 * them to the page shapes Next really emits (React comments between text runs, HTML entities).
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
    const code = hex ? parseInt(hex, 16) : dec ? parseInt(dec, 10) : NaN;
    if (!Number.isNaN(code)) return code <= 0x10ffff ? String.fromCodePoint(code) : m;
    return ENTITIES[String(name).toLowerCase()] ?? m;
  });
}

/** Visible text of a fragment: tags and React's `<!-- -->` separators removed, entities decoded, whitespace collapsed. */
export function textOf(fragment: string): string {
  return decodeEntities(fragment.replace(/<br\s*\/?>/gi, " ").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** The collapsed text of every <h1>. */
export function h1s(html: string): string[] {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => textOf(m[1]));
}

/** The first <p> after the first </h1> that carries at least `min` characters of text: the page's direct answer. */
export function directAnswer(html: string, min = 60): string | undefined {
  const at = html.search(/<\/h1>/i);
  if (at < 0) return undefined;
  for (const m of html.slice(at).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = textOf(m[1]);
    if (t.length >= min) return t;
  }
  return undefined;
}

/** Every <a href> in the server HTML, raw. Standard anchors only: a router.push or an onClick is not one. */
export function anchorHrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/gi)].map((m) => decodeEntities(m[1]));
}

/**
 * The internal paths among `hrefs`: a root-relative path, or an absolute URL on one of `origins`. Query and
 * hash dropped. Files and framework paths (/_next, a dotted last segment) are not pages and are left out.
 */
export function internalPaths(hrefs: readonly string[], origins: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of hrefs) {
    let path: string;
    if (raw.startsWith("//")) continue;
    if (raw.startsWith("/")) path = raw;
    else {
      const origin = origins.find((o) => raw === o || /^[/?#]/.test(raw.slice(o.length)) && raw.startsWith(o));
      if (!origin) continue;
      path = raw.slice(origin.length) || "/";
    }
    path = path.split("#")[0].split("?")[0] || "/";
    if (path.startsWith("/_next") || /\.[a-z0-9]+$/i.test(path.split("/").pop() ?? "")) continue;
    out.add(path);
  }
  return [...out];
}

export function canonicalOf(html: string): string | undefined {
  return (
    /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html)?.[1] ??
    /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i.exec(html)?.[1]
  );
}

export function ogUrlOf(html: string): string | undefined {
  return (
    /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i.exec(html)?.[1] ??
    /<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i.exec(html)?.[1]
  );
}

/** The @type values of a node, whether it is a string or an array. */
export function typesOf(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  return Array.isArray(t) ? t.map(String) : t === undefined ? [] : [String(t)];
}

export type LdResult = { nodes: Record<string, unknown>[]; errors: string[] };

/** Every JSON-LD block, parsed. A block that does not parse, or lacks @context or @type, is an error. */
export function jsonLd(html: string): LdResult {
  const nodes: Record<string, unknown>[] = [];
  const errors: string[] = [];
  for (const m of html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]) as Record<string, unknown> | Record<string, unknown>[];
      for (const j of Array.isArray(parsed) ? parsed : [parsed]) {
        const graph = Array.isArray(j["@graph"]) ? (j["@graph"] as Record<string, unknown>[]) : undefined;
        if (j["@context"] !== "https://schema.org" || (!j["@type"] && !graph)) errors.push("missing @context or @type");
        else if (graph) nodes.push(...graph);
        else nodes.push(j);
      }
    } catch {
      errors.push("does not parse");
    }
  }
  return { nodes, errors };
}

/** Fields a page must not carry while nobody has reviewed it (Bible T14: no fabricated review fields). */
export const FABRICATED_FIELDS = ["aggregateRating", "review", "reviewRating", "ratingValue", "reviewCount"] as const;

export function hasFabricatedField(node: unknown): string | undefined {
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = hasFabricatedField(n);
      if (f) return f;
    }
    return undefined;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if ((FABRICATED_FIELDS as readonly string[]).includes(k)) return k;
      const f = hasFabricatedField(v);
      if (f) return f;
    }
  }
  return undefined;
}
