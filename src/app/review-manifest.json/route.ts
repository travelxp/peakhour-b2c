import manifest from "../../../docs/seo/review-manifest.json";
import { isProductionDeployment } from "@/lib/seo/indexable";
import { overlayApprovals, type ReviewManifest } from "@/lib/seo/review-manifest-data";

// Read per request: whether this deployment is Production is an environment fact, not a build fact.
export const dynamic = "force-dynamic";

/**
 * /review-manifest.json: the committed review manifest (docs/seo/review-manifest.json) for the CMS approval screen
 * (peakhour-api reads it off dev). Dev and previews only: Production answers 404, by the same check the draft pages use
 * (isProductionDeployment), so the draft and review pages and their sources are never published by it. It is not in the
 * sitemap (the sitemap lists registry pages only), and the path has a dot, so the middleware matcher skips it and the
 * coming-soon gate does not stand in front of it.
 *
 * The committed file's approvals are as they stood when it was generated, so the live ones from approvals.ts are laid over it.
 */
export function GET(): Response {
  if (isProductionDeployment()) return new Response("Not found", { status: 404 });
  return Response.json(overlayApprovals(manifest as ReviewManifest), { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
