import type { PageApproval } from "@/lib/seo/approvals";
import { approvalState, capabilitiesSatisfied } from "@/lib/seo/publish";
import type { PageRecord } from "@/lib/seo/types";

type RibbonPage = Pick<PageRecord, "editorialStatus" | "indexable" | "pageId" | "capabilityIds" | "surface">;

/**
 * What the ribbon says, or null for a page that is as published:
 *  - "changed": the page makes claims and has an approval, but for older content (its copy or claims moved since);
 *  - "draft": not published, or published with no approval yet (a page with claims needs one), or not indexable.
 * A review page whose approval matches its current content is approved: no ribbon. The rule is publish.ts's; this only
 * names the reason.
 */
export function ribbonKind(page: RibbonPage, approvals?: readonly PageApproval[]): "draft" | "changed" | null {
  const state = approvalState(page.pageId, approvals);
  // An approved review page whose claims the capabilities do not yet satisfy is still not publishable: production 404s it.
  if (page.editorialStatus === "review") return state === "current" ? (capabilitiesSatisfied(page as PageRecord) ? null : "draft") : state === "stale" ? "changed" : "draft";
  if (page.editorialStatus === "published" && page.indexable && page.capabilityIds.length > 0 && state !== "current") {
    return state === "stale" ? "changed" : "draft";
  }
  return page.editorialStatus !== "published" || !page.indexable ? "draft" : null;
}

/** True when a page must not be mistaken for a published one. */
export function isDraftPage(page: RibbonPage): boolean {
  return ribbonKind(page) !== null;
}

const LABEL = { draft: "Draft, not published", changed: "Changed since approval" } as const;

/**
 * A fixed, unmistakable ribbon: "Draft, not published" on a page with no approval, "Changed since approval" on a page whose
 * approval is for older content. It shows on any page that is not publishable, so a reviewer on dev can never take a
 * draft for the real page. Production never renders such a page (the publish gate 404s it), so this ribbon is never seen
 * by the public. Solid ink with an amber edge: it clears AA on any page behind it.
 */
export function DraftRibbon({ page }: { page: RibbonPage }) {
  const kind = ribbonKind(page);
  if (!kind) return null;
  return (
    <div
      role="note"
      aria-label={LABEL[kind]}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3"
    >
      <p className="max-w-full truncate rounded-full border-2 border-[var(--daylight-amber)] bg-ink px-4 py-2 text-sm font-extrabold tracking-wide text-on-ink shadow-[var(--daylight-shadow)]">
        {LABEL[kind]}
        <span className="ml-2 hidden font-mono text-xs font-semibold text-on-ink-dim sm:inline">
          {page.pageId} · {page.editorialStatus}
        </span>
      </p>
    </div>
  );
}
