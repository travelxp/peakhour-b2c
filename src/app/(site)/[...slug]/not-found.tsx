import { generateNotFoundMetadata } from "@/components/marketing/public-not-found";
import { PublicNotFoundWithChrome } from "@/components/marketing/public-not-found-with-chrome";

/** The public 404 with the shared header and footer. */
export const generateMetadata = generateNotFoundMetadata;

export default function NotFound() {
  return <PublicNotFoundWithChrome />;
}
