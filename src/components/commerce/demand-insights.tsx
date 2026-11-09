"use client";

import { ExternalLink } from "lucide-react";

/**
 * The link into the Shopify admin that an Insights card draws for a product next step (the old "What shoppers asked for" page, now the
 * Insights tab in the Inbox). The href is built by `adminUrl` in `lib/demand-insights` from the store's own handle and an allow-listed
 * path, never from a URL in the data; with no href there is no link and the text stands alone.
 */
export function AdminLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
      {children}
      <ExternalLink className="size-3" aria-hidden="true" />
      <span className="sr-only">(opens Shopify admin in a new tab)</span>
    </a>
  );
}
