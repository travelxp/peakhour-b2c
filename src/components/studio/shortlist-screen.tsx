"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { QueryError } from "@/components/dashboard/query-error";
import { EmptyState } from "@/components/molecules/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRemoveFromShortlist, useShortlist, useStudioAbilities } from "@/hooks/use-studio-flow";
import type { ShortlistItem, ShortlistResponse } from "@/lib/api/creative-studio";
import { ideasFeedStatus, STUDIO_ROUTES, type IdeasFeedStatus } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { shortlistChip, STUDIO_PATHS, studioRefusal, type ShortlistChip } from "@/lib/studio-flow";

const S = STUDIO_COPY.shortlist;
const SHELL = STUDIO_COPY.shells.shortlist;

const CHIP_TEXT: Record<ShortlistChip, string> = {
  waiting: S.chip.waiting,
  making: S.chip.making,
  ready: S.chip.ready,
  blocked: S.chip.blocked,
  failed: S.chip.failed,
  changed: S.chip.changed,
  posted: S.chip.posted,
  scheduled: S.chip.scheduled,
};

/** Group rows by creative, keeping the api's order (newest heart first) for the groups and the rows in them. */
export function groupByCreative(items: ShortlistItem[]): Array<{ creativeId: string; items: ShortlistItem[] }> {
  const groups = new Map<string, ShortlistItem[]>();
  for (const it of items) groups.set(it.creativeId, [...(groups.get(it.creativeId) ?? []), it]);
  return [...groups.entries()].map(([creativeId, rows]) => ({ creativeId, items: rows }));
}

/**
 * The Shortlist page (UX spec S9): one place to see everything waiting. Each row has the thumbnail, the headline, the product, a state chip and
 * two plain buttons (Open, Remove from shortlist; no hover-only menu). Loading skeletons; an error with Retry (never an empty list); the
 * designed empty state; and the reminder line once something has waited more than three days. The Make final bar below is the layout's.
 */
export function ShortlistView({
  status,
  data,
  canMake,
  onRetry,
  onRemove,
}: {
  status: IdeasFeedStatus;
  data: ShortlistResponse | undefined;
  canMake: boolean;
  onRetry: () => void;
  onRemove: (item: ShortlistItem) => void;
}) {
  if (status === "loading") {
    return (
      <div aria-busy="true" aria-label={S.loading} className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }
  if (status === "offline") return <QueryError what={S.error.what} kind="offline" />;
  if (status === "error") return <QueryError what={S.error.what} onRetry={onRetry} />;
  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title={SHELL.emptyTitle}
        description={SHELL.emptyDescription}
        action={{ label: SHELL.emptyAction, href: STUDIO_ROUTES.home }}
      />
    );
  }
  const waitingLong = items.some((i) => i.waitingLong);
  return (
    <div className="space-y-4" data-slot="studio-shortlist">
      {waitingLong && <p className="rounded-md bg-muted px-3 py-2 text-sm">{S.reminder}</p>}
      {groupByCreative(items).map((g) => (
        <section key={g.creativeId} aria-label={g.items[0]?.headline || S.untitled} className="space-y-2">
          <ul className="grid gap-3 md:grid-cols-3">
            {g.items.map((it) => (
              <li key={it.previewId}>
                <article className="flex gap-3 rounded-lg border bg-card p-3" data-state={it.state}>
                  <span className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {it.thumbUrl && <MediaImage src={it.thumbUrl} alt={it.headline || S.untitled} width={80} height={80} className="size-full object-cover" />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-sm font-medium">{it.headline || S.untitled}</p>
                    {it.productTitle && <p className="truncate text-xs text-muted-foreground">{it.productTitle}</p>}
                    <Badge variant="secondary" className="w-fit">
                      {CHIP_TEXT[shortlistChip(it)]}
                    </Badge>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Button asChild size="sm" variant="outline" className="h-11 sm:h-8">
                        <Link href={STUDIO_PATHS.creative(it.creativeId)} aria-label={`${S.open}: ${it.headline || S.untitled}`}>
                          {S.open}
                        </Link>
                      </Button>
                      {canMake && !it.lapsed && it.state === "shortlisted" && (
                        <Button type="button" size="sm" variant="ghost" className="h-11 sm:h-8" onClick={() => onRemove(it)}>
                          {S.remove}
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ShortlistScreen() {
  const q = useShortlist();
  const { canMake } = useStudioAbilities();
  const remove = useRemoveFromShortlist();
  return (
    <ShortlistView
      status={ideasFeedStatus(q)}
      data={q.data}
      canMake={canMake}
      onRetry={() => void q.refetch()}
      onRemove={(it) =>
        remove.mutate(
          { creativeId: it.creativeId, previewId: it.previewId },
          { onError: (e) => toast.error(studioRefusal(e).text) },
        )
      }
    />
  );
}
