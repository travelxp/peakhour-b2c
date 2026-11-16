import type { ByLocale, PageContent } from "@/lib/seo/page-content";

/**
 * Localized page copy, by pageId (see lib/seo/page-content.ts for the pattern).
 *
 * Empty today, on purpose: the existing English pages keep their copy in their own components, and no
 * non-English variant is published. A page gets an entry here when its first translation is written; the
 * publish gate still decides whether the variant is shown (lib/seo/publish.ts), and a test fails if a
 * variant is published with no copy.
 */
export const PAGE_CONTENT: Record<string, ByLocale<PageContent>> = {};
