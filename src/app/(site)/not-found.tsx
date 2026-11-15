import { PublicNotFound, notFoundMetadata } from "@/components/marketing/public-not-found";

/**
 * Root 404: any `notFound()` below the site layout that has no closer one. The public
 * Daylight page, WITHOUT the shared header and footer, which would put their client
 * code in every route's bundle (see PublicNotFound). Unknown URLs and the coming-soon
 * gate's 404 reach the fuller version through [...slug] and gate-404.
 */
export const metadata = notFoundMetadata;

export default function NotFound() {
  return <PublicNotFound />;
}
