import { SITE } from "@/lib/utils";

/**
 * The brand facts a client component may import: the name and the artwork's measured view boxes.
 * No path data lives here on purpose; the shapes are in brand-artwork.ts, which only server code and tests read,
 * so the logo costs the client bundle nothing (the bundle budget caught 6.7 KB of paths copied into four chunks).
 */

/** The name the artwork spells, for `aria-label` and `alt`: the site's one spelling (SITE.name). */
export const BRAND_NAME = SITE.name;

/** Mark + letters (the measured bounds of the official lockup, rounded outwards). */
export const LOCKUP_VIEWBOX = "33 34 1088 214";
/** The letters alone, for a slot that already shows the mark beside it. */
export const WORDMARK_VIEWBOX = "285 85 836 117";
