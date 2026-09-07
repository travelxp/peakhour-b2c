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
 * ⚠️NOTHING IS DROPPED, AND AN EARLIER VERSION WAS WRONG TO DROP ANYTHING. It
 * removed the TLD on the reasoning that "Quests" is the brand and ".travel" is
 * where it is hosted — which produced "Good afternoon, Quests" at the top of
 * that customer's own dashboard. The registered name is the whole string, and a
 * product that shortens the customer's name has decided it knows better. This
 * function CAPITALISES; it does not edit.
 */

/**
 * Trailing segments that mark a string as a hostname.
 *
 * ⚠️THESE ARE NO LONGER STRIPPED, ONLY DETECTED. An earlier version dropped the
 * suffix, so "quests.travel" was greeted as "Quests" — which is not the
 * business's name, it is a fragment of it. The registered name is the whole
 * thing, and a dashboard that shortens the customer's own name has decided it
 * knows better. The list survives because it is still the strongest signal that
 * a string was produced by a machine rather than typed by a person.
 */
const DOMAIN_SUFFIXES = new Set([
  "com", "net", "org", "io", "ai", "co", "app", "dev", "shop", "store",
  "travel", "agency", "studio", "media", "digital", "online", "site", "xyz",
  "in", "uk", "us", "au", "ca", "de", "fr", "es", "it", "nl", "sg", "ae",
]);

/** No whitespace, and only characters a hostname or slug is built from. */
const MACHINE_NAME = /^[A-Za-z0-9]+(?:[.\-_][A-Za-z0-9]+)+$/;

/**
 * ★SHAPE ALONE IS NOT ENOUGH, AND A REVIEW ROUND CAUGHT WHY. "T-Mobile",
 * "Coca-Cola" and "J.P.Morgan" all satisfy MACHINE_NAME — no whitespace, only
 * letters and separators — so shape by itself turned three real brands into
 * "T Mobile", "Coca Cola" and "J P Morgan" at the top of the owner's own
 * dashboard. That is precisely the mangling this module's docblock promises not
 * to do, and it was in the one code path everybody sees.
 *
 * So a machine-shaped string must ALSO carry a positive signal that a machine
 * made it, and there are exactly two:
 *
 *   • It ends in a known domain suffix. Only a hostname does that, and a
 *     hostname is never how anyone writes their business name by hand.
 *   • It is entirely lower-case. Slugs are; typed brand names essentially never
 *     are, because the capital is the first thing a person types.
 *
 * A capitalised, hyphenated name with no TLD — "T-Mobile", "BBC-News" — fails
 * both and is returned exactly as stored. The cost is that a lower-case
 * "t-mobile" becomes "T-Mobile", which is the right call: at that point the
 * string is indistinguishable from a slug, and capitalising a slug is the whole
 * job. (Note the separator survives — this used to read "T Mobile", from the
 * version that also joined the segments with spaces.)
 */
function looksMachineMade(raw: string, parts: string[]): boolean {
  if (DOMAIN_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) return true;
  return raw === raw.toLowerCase();
}

/**
 * ★THE SEPARATORS ARE KEPT, AND SO IS EVERY SEGMENT. "quests.travel" becomes
 * "Quests.Travel", not "Quests" and not "Quests Travel". This function's job is
 * CAPITALISATION, not editing: it makes a stored hostname presentable without
 * deciding which parts of the customer's name are worth showing.
 *
 * A leading "www." is the one exception, and it is not really an exception —
 * it is not part of a registered name, it is how you reach one.
 */
export function displayBusinessName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw || !MACHINE_NAME.test(raw)) return raw;

  if (!looksMachineMade(raw, raw.split(/[.\-_]+/).filter(Boolean))) return raw;

  // Strip a leading "www." only — never a trailing suffix.
  //
  // ⚠️A DOT, NOT ANY SEPARATOR. The first version matched `/^www[.\-_]/`, so a
  // workspace stored as "www-designs.com" displayed as "Designs.Com" — the same
  // name-shortening this function exists to stop, one prefix over. "www-" is
  // part of a name; "www." is not.
  //
  // ⚠️AND ONLY WHEN A DOMAIN REMAINS. "www.co" is not a site called "co" behind
  // a www prefix — there is nothing left that looks like a hostname — so it
  // keeps its first segment. Requiring another separator in the remainder is
  // what tells "www.questsandtrails.com" (strip) from "www.co" (keep).
  const rest = /^www\./i.test(raw) ? raw.slice(4) : null;
  const body = rest && /[.\-_]/.test(rest) ? rest : raw;

  // Capitalise each alphanumeric run IN PLACE, leaving every "." "-" and "_"
  // exactly where it was. A segment that already carries a capital is left as
  // typed — unconditional title-casing is what destroys "BBC", "eBay" and
  // "IKEA".
  return body.replace(/[A-Za-z0-9]+/g, (segment) =>
    /[A-Z]/.test(segment) ? segment : segment.charAt(0).toUpperCase() + segment.slice(1),
  );
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
