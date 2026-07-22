/**
 * Locale configuration — the single source of truth for which locales exist.
 *
 * Kept separate from request.ts so that a future locale-routing middleware can
 * import these constants without pulling in getRequestConfig (which belongs to
 * the per-request pipeline). English-only today; add codes here + a matching
 * messages/<locale>.json to grow.
 */
export const locales = ["en"] as const;
export const defaultLocale = "en" as const;
export type AppLocale = (typeof locales)[number];
