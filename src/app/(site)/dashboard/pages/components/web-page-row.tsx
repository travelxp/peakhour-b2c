"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/molecules/status-badge";
import type { WebPageDraft } from "@/hooks/use-web-pages";
import { WebPageActions } from "./web-page-actions";

/** One page in the review queue: name, who it's for, whether it's ready, and the
 *  Review / Approve / Send-back actions. */
export function WebPageRow({ draft }: { draft: WebPageDraft }) {
  const name = draft.webPage.name || draft.title || draft.webPage.slug;
  const tax = draft.webPage.taxonomy;
  const audience = [tax?.industry, tax?.persona]
    .filter(Boolean)
    .map((s) => s!.replace(/-/g, " "))
    .join(" · ");
  const verified = draft.webPage.ai?.groundingVerified === true;
  const claims = draft.sourceMetadata?.groundingUnsupportedClaims?.length ?? 0;
  const href = `/dashboard/pages/${draft._id}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className="truncate font-medium hover:underline">
            {name}
          </Link>
          {verified ? (
            <StatusBadge status="Ready" variant="success" />
          ) : (
            <StatusBadge status="Needs a look" variant="warning" />
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {audience || "General"} · /{draft.webPage.slug}
          {claims > 0 ? ` · ${claims} thing${claims > 1 ? "s" : ""} to double-check` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>Review</Link>
        </Button>
        <WebPageActions draftId={draft._id} name={name} />
      </div>
    </div>
  );
}
