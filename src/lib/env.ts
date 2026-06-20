/**
 * Environment helpers. `NEXT_PUBLIC_VERCEL_ENV` is set by Vercel to
 * "production" | "preview" | "development" and inlined at build time, so these
 * are safe to call on the server or the client.
 *
 * Use `isProductionEnv()` to gate test-only affordances (dev cron triggers,
 * the theme switcher, in-development surfaces) — anything that should appear on
 * preview/local but never on the production deployment.
 */
export function isProductionEnv(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}

/** Inverse of {@link isProductionEnv} — true on preview + local dev. */
export function isNonProductionEnv(): boolean {
  return !isProductionEnv();
}
