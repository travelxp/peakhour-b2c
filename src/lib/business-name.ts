/**
 * Turn a stored business name into something to greet a human with.
 *
 * ★WHY THIS IS NEEDED AT ALL. A workspace is very often created from a URL —
 * onboarding's whole promise is "paste a link and we'll do the rest" — so the
 * name it saves is frequently the hostname: `quests.travel`, `bellas-boutique`,
 * `acme_co`. Printing that back at the top of the owner's dashboard reads like
 * a database row, not their business, and "Good morning, quests.travel" is the
 * exact moment the product stops sounding like it knows who it is talking to.
 *
 * ★AND IT IS DELIBERATELY CONSERVATIVE. It only fires on strings that could not
 * be a real typed name: no whitespace, and made only of letters, digits and the
 * separators a slug or hostname uses. Anything a person actually typed —
 * "Bella's Boutique", "Smith & Sons", a name in any non-Latin script — has a
 * space or punctuation this rejects, and is returned untouched. A prettifier
 * that guessed would be worse than none: mangling a real name in the greeting
 * is a far louder failure than leaving a hostname alone.
 *
 * The TLD is dropped for the same reason the separators are: "Quests Travel" is
 * the brand, ".travel" is where it is hosted. Only well-known TLDs are stripped,
 * so a genuine last word is never eaten.
 */

/**
 * Trailing segments that are a domain suffix rather than part of the name.
 * Kept short on purpose — this list only needs the endings that actually show
 * up as workspace names, and every entry is a word we are choosing NOT to
 * display.
 */
const DOMAIN_SUFFIXES = new Set([
  "com", "net", "org", "io", "ai", "co", "app", "dev", "shop", "store",
  "travel", "agency", "studio", "media", "digital", "online", "site", "xyz",
  "in", "uk", "us", "au", "ca", "de", "fr", "es", "it", "nl", "sg", "ae",
]);

/** No whitespace, and only characters a hostname or slug is built from. */
const MACHINE_NAME = /^[A-Za-z0-9]+(?:[.\-_][A-Za-z0-9]+)+$/;

export function displayBusinessName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw || !MACHINE_NAME.test(raw)) return raw;

  const parts = raw.split(/[.\-_]+/).filter(Boolean);
  // Drop a trailing TLD, but never the only word — "shop.com" must not
  // prettify to an empty string, and "io.net" is more likely a name than two
  // suffixes.
  if (parts.length > 1 && DOMAIN_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  // A leading "www" is never part of a brand.
  if (parts.length > 1 && parts[0].toLowerCase() === "www") parts.shift();

  return parts
    .map((p) =>
      // An all-caps or mixed-caps segment is left as typed: "BBC", "eBay" and
      // "IKEA" are all destroyed by unconditional title-casing.
      /[A-Z]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(" ");
}

/**
 * "Good morning" / "Good afternoon" / "Good evening" for a given local hour.
 *
 * Takes the hour rather than reading the clock so the caller controls WHEN it
 * is sampled. That is not fussiness: reading `new Date()` during render is
 * impure, defeats React Compiler memoization, and — the part that actually
 * bites — makes the server and the client disagree across a boundary, so the
 * page hydrates with a greeting that flickers from "evening" to "morning".
 */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
