/**
 * The page a search action applies to, rendered safely and readably.
 *
 * ★EXTRACTED SO THE JUDGEMENT CAN BE TESTED. This repo runs vitest in node with
 * no DOM by design, so what gets asserted is never the markup — it is the two
 * decisions that matter here: whether a value is safe to put in an `href` at
 * all, and what a person should see instead of a 90-character URL. Both live
 * here; the card renders what this returns and decides nothing.
 *
 * ★THE URL COMES FROM A COLLECTION WITH NO VALIDATOR. `ana_search_queries` is a
 * MongoDB time-series collection, which cannot carry a `$jsonSchema` — the
 * schema's own comment says so, and the GSC provider writes to it with a raw
 * `insertMany`. So although every value SHOULD be an https URL Google returned,
 * nothing between Search Console and this function enforces it, and the honest
 * assumption is that a string arriving here could be anything.
 */

/** What the card needs to draw a link, or null when there is nothing safe to draw. */
export interface ActionPage {
  /** Safe to place in an href. Always http(s). */
  href: string;
  /** What the reader sees — the path, not the whole URL. */
  label: string;
  /** Host, shown only when it is not the property the worklist is about. */
  foreignHost?: string;
}

/**
 * Longest label we render before eliding the middle.
 *
 * A worklist card is one line of metadata among several; a full product URL
 * with campaign tokens can be 120+ characters and pushes everything else off
 * the row. The elision is visual only — `href` always carries the whole URL.
 */
export const MAX_LABEL = 48;

/**
 * ★ONLY http AND https EVER REACH AN href.
 *
 * `javascript:alert(1)` is a valid URL to `new URL()`, and a valid `href`. It is
 * also the one string in this file that must never survive: an action's page is
 * data we did not author, from a collection nothing validates, rendered as a
 * link the user is being invited to click. Anything that is not http(s) is not a
 * page — it is refused, and the card renders without a link rather than with a
 * dangerous one.
 *
 * Deliberately an allowlist. A denylist of "javascript:, data:, vbscript:" is
 * the version that gets one wrong.
 */
function safeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    // ★NOT REPAIRED. A relative path could be resolved against the property,
    // but the provider stores absolute URLs from Search Console — so a value
    // that will not parse is a malformed row, and guessing what it meant would
    // invent an address rather than report one.
    return null;
  }
  return u.protocol === "https:" || u.protocol === "http:" ? u : null;
}

/** Middle-elide, so the beginning AND the end of a path both stay readable —
 *  the end is usually the slug, which is the part a person recognises. */
function elide(s: string, max = MAX_LABEL): string {
  if (s.length <= max) return s;
  // −1 for the ellipsis itself; bias the extra character to the head.
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${s.slice(0, head)}…${s.slice(s.length - tail)}`;
}

/**
 * Describe the page an action applies to.
 *
 * @param url      the action's `url`, absent for any term the pair sync has not
 *                 reached (a normal state — see the api service).
 * @param property the Search Console property the worklist is about, so a page
 *                 on a DIFFERENT host can be labelled as such rather than
 *                 silently looking local.
 */
export function describeActionPage(url?: string, property?: string): ActionPage | null {
  if (!url) return null;
  const u = safeUrl(url.trim());
  if (!u) return null;

  // Path + query, which is what distinguishes one page from another. The hash
  // is dropped: Search Console reports canonical pages, and a fragment would be
  // noise in a label that is already tight.
  const path = `${u.pathname}${u.search}`;
  const label = elide(path === "" ? "/" : path);

  const propertyHost = propertyToHost(property);
  const foreign = propertyHost && propertyHost !== u.host ? u.host : undefined;

  return { href: u.toString(), label, ...(foreign ? { foreignHost: foreign } : {}) };
}

/**
 * The host a Search Console property refers to.
 *
 * ★TWO PROPERTY SHAPES, AND ONLY ONE OF THEM IS A URL. A domain property is
 * `sc-domain:example.com` — not parseable as a URL at all — while a URL-prefix
 * property is `https://example.com/shop/`. Treating the first as a URL yields
 * null and would mark every page as foreign, putting a redundant hostname on
 * every card.
 */
export function propertyToHost(property?: string): string | null {
  if (!property) return null;
  const p = property.trim();
  if (p.startsWith("sc-domain:")) {
    const host = p.slice("sc-domain:".length).trim();
    return host || null;
  }
  const u = safeUrl(p);
  return u ? u.host : null;
}
