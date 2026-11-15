import type { PageRecord } from "@/lib/seo/types";

/** True when a page must not be mistaken for a published one: not yet `published`, or not indexable. */
export function isDraftPage(page: Pick<PageRecord, "editorialStatus" | "indexable">): boolean {
  return page.editorialStatus !== "published" || !page.indexable;
}

/**
 * A fixed, unmistakable "Draft, not published" ribbon. It shows on any page that is not publishable, so a reviewer
 * on dev can never take a draft for the real page. Production never renders such a page (the publish gate 404s it),
 * so this ribbon is never seen by the public. Solid ink with an amber edge: it clears AA on any page behind it.
 */
export function DraftRibbon({ page }: { page: Pick<PageRecord, "editorialStatus" | "indexable" | "pageId"> }) {
  if (!isDraftPage(page)) return null;
  return (
    <div
      role="note"
      aria-label="Draft, not published"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3"
    >
      <p className="max-w-full truncate rounded-full border-2 border-[var(--daylight-amber)] bg-ink px-4 py-2 text-sm font-extrabold tracking-wide text-on-ink shadow-[var(--daylight-shadow)]">
        Draft, not published
        <span className="ml-2 hidden font-mono text-xs font-semibold text-on-ink-dim sm:inline">
          {page.pageId} · {page.editorialStatus}
        </span>
      </p>
    </div>
  );
}
