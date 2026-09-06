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

/**
 * Remove characters that can make displayed text lie about itself.
 *
 * ★CONTROLS, BIDI, AND THE INVISIBLES. A right-to-left override reorders the
 * text after it — `/gnp.eciovni` displayed as `/invoice.png` — and the
 * zero-width family (U+200B–200D, U+FEFF) hides differences between two
 * strings entirely, so two addresses can render identically. U+2028/2029 are
 * line separators, which break a one-line label. U+061C is the Arabic letter
 * mark, a bidi control that a class built around U+202x misses.
 *
 * ★EXPORTED BECAUSE IT IS NOT ONLY FOR PATHS. Any untrusted string rendered
 * as, or beside, a link needs it — a page TITLE reorders a label just as well
 * as a path does, and sanitising the href while printing the title raw leaves
 * exactly the attack this was written to stop.
 */
export function stripUnsafeText(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2028\u2029\u2066-\u2069\uFEFF]/g, "");
}
/**
 * Turn a percent-encoded path into something a person can read.
 *
 * ★`u.pathname` IS ALWAYS PERCENT-ENCODED, which makes a non-Latin slug
 * unreadable AND much longer: a 22-character Japanese path arrives as 139
 * characters of `%E5%86%AC…`, which then trips a 48-character elision it never
 * needed — and the elision cuts an escape sequence in half, so the result is
 * both meaningless and mangled. Decoding is for the LABEL only; `href` keeps
 * the encoded form the browser needs.
 *
 * ★AND THE DECODED TEXT IS STRIPPED OF CONTROL AND BIDI CHARACTERS. Decoding
 * re-animates anything the encoding had made inert, and a right-to-left
 * override (U+202E) inside a link label can reorder what the reader sees —
 * `/gnp.eciovni` displayed as `/invoice.png`. The href is unaffected, so this
 * costs nothing real.
 */
export function readablePath(path: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A lone `%` or a truncated escape throws. Show the raw path rather than
    // nothing — it is still the address, just uglier.
    decoded = path;
  }
  // C0/C1 controls, plus the bidi overrides and isolates.
  return stripUnsafeText(decoded);
}

/** Middle-elide, so the beginning AND the end of a path both stay readable —
 *  the end is usually the slug, which is the part a person recognises. */
function elide(s: string, max = MAX_LABEL): string {
  // ★BY CODE POINT, NOT BY UTF-16 INDEX. `.slice()` cuts a surrogate pair in
  // half, and an emoji or any astral character in a slug then renders as a lone
  // surrogate — U+FFFD, a black diamond, in the middle of an address.
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  const keep = max - 1; // −1 for the ellipsis itself
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${chars.slice(0, head).join("")}…${chars.slice(chars.length - tail).join("")}`;
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

  const foreign = property && !hostMatchesProperty(u.host, property) ? u.host : undefined;

  // ★THE HOST IS PART OF THE ADDRESS, SO IT SPENDS THE SAME BUDGET. The card
  // renders `foreignHost` immediately before `label` inside one truncating
  // span, so a label elided to the full MAX_LABEL beside a 30-character host
  // overflows and the CSS truncation clips the tail — removing the slug, which
  // is the half the middle-elide exists to protect. Budgeting here keeps the
  // elision the thing that decides what is dropped.
  // A floor of 12 so a pathological host cannot reduce the path to an ellipsis.
  const budget = foreign ? Math.max(12, MAX_LABEL - foreign.length) : MAX_LABEL;
  const label = elide(readablePath(path === "" ? "/" : path), budget);

  return { href: u.toString(), label, ...(foreign ? { foreignHost: foreign } : {}) };
}

/**
 * A bare hostname, in the form `new URL().host` would give it.
 *
 * ★★LOWERCASE IS NOT ENOUGH — IT ALSO HAS TO PUNYCODE. `new URL().host` returns
 * the A-label, so a page on `münchen.de` reports as `xn--mnchen-3ya.de`. A
 * property stored as `sc-domain:münchen.de` compared as plain lowercase matches
 * NONE of its own pages, which is the redundant-host-on-every-card result once
 * more — the third distinct route to it in this file, after strict equality and
 * after case. Running the value through the URL parser makes both sides the
 * same normalisation by construction rather than by a chain of string fixes.
 *
 * Returns null for anything that will not resolve to a host.
 */
function normaliseHost(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    // The scheme is only a vehicle for the parser; the host is what we keep.
    const host = new URL(`https://${v}`).host;
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Does this page's host belong to the property?
 *
 * ★★A DOMAIN PROPERTY COVERS ITS SUBDOMAINS — that is the whole difference
 * between the two property kinds, and strict host equality gets it exactly
 * backwards. `sc-domain:example.com` includes `www.example.com`, which is the
 * COMMON setup, so equality marked the normal case foreign and stamped a
 * redundant `www.example.com` on every card — the precise outcome the flag
 * exists to prevent. And since a URL-prefix property only ever reports pages on
 * its own host, the domain branch is the only one where this can fire at all:
 * equality made the feature a pure false-positive generator.
 *
 * ★THE SUBDOMAIN TEST IS ON A DOT BOUNDARY. `endsWith(host)` alone would treat
 * `notexample.com` as part of `example.com`.
 *
 * A URL-prefix property stays EXACT: it is scoped to one origin, so a page on
 * another host really is from somewhere else.
 */
export function hostMatchesProperty(host: string, property: string): boolean {
  const p = property.trim();
  const h = host.toLowerCase();
  if (p.toLowerCase().startsWith("sc-domain:")) {
    const domain = normaliseHost(p.slice("sc-domain:".length));
    if (!domain) return true; // nothing to compare against — make no claim
    return h === domain || h.endsWith(`.${domain}`);
  }
  const propertyHost = propertyToHost(p);
  // Unresolvable property → no claim, rather than "everything is foreign".
  return propertyHost === null || propertyHost === h;
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
  if (p.toLowerCase().startsWith("sc-domain:")) {
    return normaliseHost(p.slice("sc-domain:".length));
  }
  const u = safeUrl(p);
  return u ? u.host : null;
}
