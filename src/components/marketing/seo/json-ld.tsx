import { safeJsonLd } from "@/lib/json-ld";
import type { JsonLdNode } from "@/lib/seo/structured-data";

/** One JSON-LD block, escaped through the repo's `safeJsonLd` so a value cannot close the script element. */
export function JsonLd({ data }: { data: JsonLdNode }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}
