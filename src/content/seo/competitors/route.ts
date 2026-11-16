import type { PageFamily, PageScope, Surface } from "@/lib/seo/types";
import type { CompetitorBrief } from "./types";

/** Where a comparison lives, from its brief's scope: the one place that maps scope to path, family and surface. */
export function compareRoute(b: Pick<CompetitorBrief, "slug" | "scope">): {
  path: string;
  family: PageFamily;
  scope: PageScope;
  surface: Surface;
  global: boolean;
} {
  const global = b.scope === "global";
  return global
    ? { path: `/compare/${b.slug}`, family: "compare", scope: "global", surface: "web", global }
    : { path: `/shopify/compare/${b.slug}`, family: "shopify-compare", scope: "shopify", surface: "shopify", global };
}
