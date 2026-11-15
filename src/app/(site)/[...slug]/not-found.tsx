import { notFoundMetadata } from "@/components/marketing/public-not-found";
import { PublicNotFoundWithChrome } from "@/components/marketing/public-not-found-with-chrome";

/** The public 404 with the shared header and footer. */
export const metadata = notFoundMetadata;

export default function NotFound() {
  return <PublicNotFoundWithChrome />;
}
