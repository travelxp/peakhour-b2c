import { PublicNotFound, notFoundMetadata } from "@/components/marketing/public-not-found";

/** The public 404 with the shared header and footer. */
export const metadata = notFoundMetadata;

export default function NotFound() {
  return <PublicNotFound chrome />;
}
