/**
 * Dashboard avatars — the registry behind Settings → Your avatar and the tile
 * beside the sidebar profile.
 *
 * TWO FAMILIES, AND THE SPLIT IS THE PRODUCT DECISION. `monogram` is the
 * user's own initials on one of six brand-derived gradients; `character` is a
 * small curated set of flat illustrated faces. Between them they cover the two
 * things people actually want from a B2B avatar — "look like me" and "be
 * identifiable in a list" — without shipping a face builder or licensing a 3D
 * render set.
 *
 * ★NOTHING IS FETCHED, AND THAT IS WHY THERE IS NO THIRD FAMILY. Every avatar
 * here is CSS and an emoji glyph: no CDN in the connect-src, no sprite sheet to
 * cache-bust, no image that can 404 into a broken tile in the sidebar. A
 * Bitmoji-style builder or a 3D set would each have meant remote artwork on the
 * shell's critical path, for a decoration.
 *
 * ★AND THE TOKEN IS OPAQUE TO THE SERVER. peakhour-api validates
 * `^(monogram|character):[a-z0-9-]{1,32}$` and stores the string; the artwork
 * lives here. That is what lets design add a character without a migration —
 * and it is why `resolveAvatar` must never throw on an unknown variant. A user
 * who picked an avatar that was later retired sees their monogram, not a hole.
 */

/** Brand-derived gradients for the initials monogram. */
export interface MonogramVariant {
  id: string;
  label: string;
  /** Tailwind classes producing the tile's fill. */
  className: string;
}

/** One illustrated character. `glyph` is rendered on `className`'s tint. */
export interface CharacterVariant {
  id: string;
  label: string;
  glyph: string;
  className: string;
}

/**
 * Six gradients, not twelve. Past about six a colour picker stops being a
 * choice and starts being a task, and every extra one is another value that
 * has to stay legible against white initials in both themes.
 *
 * The text is white in every case — these are all mid-to-deep fills, verified
 * against white at the 4.5:1 small-text threshold. If a lighter gradient is
 * ever added it needs its own foreground, not a shared one.
 */
export const MONOGRAM_VARIANTS: readonly MonogramVariant[] = [
  { id: "amber", label: "Amber", className: "bg-linear-to-br from-amber-400 to-orange-600 text-white" },
  { id: "violet", label: "Violet", className: "bg-linear-to-br from-violet-500 to-indigo-700 text-white" },
  { id: "teal", label: "Teal", className: "bg-linear-to-br from-teal-400 to-cyan-700 text-white" },
  { id: "rose", label: "Rose", className: "bg-linear-to-br from-rose-400 to-pink-700 text-white" },
  { id: "lime", label: "Lime", className: "bg-linear-to-br from-lime-400 to-emerald-700 text-white" },
  { id: "slate", label: "Slate", className: "bg-linear-to-br from-slate-500 to-slate-800 text-white" },
] as const;

/**
 * Twelve characters. Deliberately a mix of people and non-people: an owner who
 * does not want a face on their account should not have to fall back to
 * initials to avoid one.
 *
 * The tints are flat rather than gradient so a character tile and a monogram
 * tile read as the same family of object at 32px.
 */
export const CHARACTER_VARIANTS: readonly CharacterVariant[] = [
  { id: "founder", label: "Founder", glyph: "🧑‍💼", className: "bg-amber-100 dark:bg-amber-950" },
  { id: "maker", label: "Maker", glyph: "🧑‍🎨", className: "bg-rose-100 dark:bg-rose-950" },
  { id: "chef", label: "Chef", glyph: "🧑‍🍳", className: "bg-orange-100 dark:bg-orange-950" },
  { id: "builder", label: "Builder", glyph: "🧑‍🔧", className: "bg-stone-100 dark:bg-stone-900" },
  { id: "scientist", label: "Scientist", glyph: "🧑‍🔬", className: "bg-cyan-100 dark:bg-cyan-950" },
  { id: "teacher", label: "Teacher", glyph: "🧑‍🏫", className: "bg-indigo-100 dark:bg-indigo-950" },
  { id: "grower", label: "Grower", glyph: "🌱", className: "bg-emerald-100 dark:bg-emerald-950" },
  { id: "rocket", label: "Rocket", glyph: "🚀", className: "bg-violet-100 dark:bg-violet-950" },
  { id: "peak", label: "Peak", glyph: "🏔️", className: "bg-sky-100 dark:bg-sky-950" },
  { id: "spark", label: "Spark", glyph: "✨", className: "bg-yellow-100 dark:bg-yellow-950" },
  { id: "fox", label: "Fox", glyph: "🦊", className: "bg-orange-100 dark:bg-orange-950" },
  { id: "owl", label: "Owl", glyph: "🦉", className: "bg-teal-100 dark:bg-teal-950" },
] as const;

export type ResolvedAvatar =
  | { family: "monogram"; variant: MonogramVariant }
  | { family: "character"; variant: CharacterVariant };

/**
 * Pick a stable default monogram gradient for a user who has never chosen one.
 *
 * ★DERIVED FROM THE SEED, NOT RANDOM AND NOT ALWAYS THE FIRST. Random would
 * change on every render; always-amber would make a team page a column of
 * identical tiles, which is the one job an avatar has. Hashing the email (or
 * name) gives each teammate a different colour that never moves.
 */
export function defaultMonogramId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    // Plain FNV-ish accumulate. `| 0` keeps it in int32 so a long email can't
    // drift into float territory and make the modulo non-uniform.
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return MONOGRAM_VARIANTS[Math.abs(hash) % MONOGRAM_VARIANTS.length].id;
}

/**
 * Resolve a stored token to artwork. NEVER throws and never returns null: an
 * unknown family, an unknown variant, a malformed token and `null` all land on
 * the seed's default monogram.
 *
 * That total-ness is the contract the api relies on to keep the stored value a
 * loose pattern instead of an enum — retiring a character is then a change in
 * this file alone, and the users who had picked it degrade to their initials
 * rather than to an empty circle.
 */
export function resolveAvatar(token: string | null | undefined, seed: string): ResolvedAvatar {
  const fallback = (): ResolvedAvatar => ({
    family: "monogram",
    variant:
      MONOGRAM_VARIANTS.find((v) => v.id === defaultMonogramId(seed)) ?? MONOGRAM_VARIANTS[0],
  });
  if (!token) return fallback();
  const sep = token.indexOf(":");
  if (sep < 0) return fallback();
  const family = token.slice(0, sep);
  const id = token.slice(sep + 1);
  if (family === "monogram") {
    const variant = MONOGRAM_VARIANTS.find((v) => v.id === id);
    return variant ? { family: "monogram", variant } : fallback();
  }
  if (family === "character") {
    const variant = CHARACTER_VARIANTS.find((v) => v.id === id);
    return variant ? { family: "character", variant } : fallback();
  }
  return fallback();
}

/**
 * Up to two initials from a display name, falling back to the email's first
 * character.
 *
 * ★`Array.from`, NOT `name[0]`. A name beginning with an astral character — an
 * emoji, or a script outside the BMP — indexes to half a surrogate pair, which
 * renders as U+FFFD. The tile then shows a replacement glyph for exactly the
 * users whose names the product is least able to display already.
 */
export function initialsOf(name: string | null | undefined, email?: string | null): string {
  const parts = (name ?? "").split(/\s+/).filter(Boolean);
  if (parts.length) {
    return parts
      .slice(0, 2)
      .map((p) => Array.from(p)[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return (Array.from(email ?? "")[0] ?? "?").toUpperCase();
}
