/** Whether this is the Vercel Production deployment (`VERCEL_ENV === "production"`). Decides what is published; SITE_INDEXABLE never does. */
export function isProductionDeployment(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production";
}

/**
 * Whether THIS deployment may be indexed by a search engine.
 *
 * True only on the Vercel Production deployment (`VERCEL_ENV === "production"`).
 * Dev (dev.peakhour.ai is master's Preview deployment), every preview URL and a
 * local build are not indexable, so a crawler that finds one reads "Disallow: /"
 * in robots.txt and `X-Robots-Tag: noindex, nofollow` on every page.
 *
 * ★ DECIDED BY THE DEPLOYMENT, NOT BY AN OPT-IN VARIABLE. Production is indexable
 * today. An opt-in variable (`SITE_INDEXABLE=true`) would de-index the live site
 * the moment this code shipped to production ahead of someone setting it. Keying
 * off VERCEL_ENV keeps production exactly as it is.
 *
 * ★ `SITE_INDEXABLE=false` IS A SWITCH-OFF ONLY. It forces false (to hold a
 * production deployment out of the index) and nothing can force true: no value of
 * any variable makes a preview or local build indexable.
 */
export function isIndexableDeployment(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SITE_INDEXABLE === "false") return false;
  return isProductionDeployment(env);
}

/** The X-Robots-Tag value for a deployment that must stay out of every index. */
export const NOINDEX_HEADER = "noindex, nofollow";
