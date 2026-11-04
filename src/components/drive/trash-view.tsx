"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatBytes, listMedia, restoreMedia, type MediaItem } from "@/lib/api/media";
import { daysLeft, daysLeftText } from "@/lib/drive/copy";
import { canChangeFile } from "@/lib/drive/files-state";

/**
 * Trash (D9, Main board). Files stay 30 days, do not count against the storage, and can be put back until the last day. A shared file
 * can be put back only by an admin: the others are not offered the button (and the api would answer 403).
 */

export function TrashRow({ item, now, canRestore, restoring, onRestore }: { item: MediaItem; now: Date; canRestore: boolean; restoring: boolean; onRestore: () => void }) {
  const left = daysLeftText(daysLeft(item.hardDeleteAfter, now));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium">{item.name}</div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">{[formatBytes(item.sizeBytes), left].filter(Boolean).join(". ")}</div>
      </div>
      {canRestore && (
        <Button type="button" variant="outline" disabled={restoring} onClick={onRestore}>
          {restoring ? "Restoring…" : "Restore"}
        </Button>
      )}
    </div>
  );
}

export function TrashList({ items, now, canRestore, restoringId, onRestore }: { items: MediaItem[]; now: Date; canRestore: (item: MediaItem) => boolean; restoringId: string | null; onRestore: (id: string) => void }) {
  return (
    <div className="flex max-w-3xl flex-col gap-2.5">
      <p className="text-sm text-muted-foreground">Files here do not count against your storage. Each one is removed for good after 30 days.</p>
      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Trash is empty.</div>
      ) : (
        items.map((it) => <TrashRow key={it.id} item={it} now={now} canRestore={canRestore(it)} restoring={restoringId === it.id} onRestore={() => onRestore(it.id)} />)
      )}
    </div>
  );
}

export function TrashView({ abilities }: { abilities: { canEdit: boolean; isAdmin: boolean } }) {
  const qc = useQueryClient();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["drive", "trash"],
    queryFn: ({ pageParam }) => listMedia({ status: "deleted", sort: "newest", page: pageParam, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.page + 1 : undefined),
  });
  const restore = useMutation({
    mutationFn: (id: string) => {
      setRestoringId(id);
      return restoreMedia(id);
    },
    onSuccess: () => {
      toast.success("Restored. It is back in your files.");
      for (const key of [["drive", "trash"], ["drive", "files"], ["drive", "cleanup"], ["storage-usage"]]) void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "That file could not be restored."),
    onSettled: () => setRestoringId(null),
  });

  if (q.isPending) {
    return q.fetchStatus === "paused" ? (
      <EmptyState icon={AlertTriangle} title="You look to be offline" description="Trash will load when the connection is back." />
    ) : (
      <div className="flex max-w-3xl flex-col gap-2.5" aria-busy="true" aria-label="Loading Trash">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return <EmptyState icon={AlertTriangle} title="Trash did not load" description="Something went wrong on our side. Nothing was changed." action={{ label: "Try again", onClick: () => void q.refetch() }} />;
  }
  const items = q.data.pages.flatMap((p) => p.items);
  return (
    <div className="flex flex-col gap-3">
      <TrashList items={items} now={new Date()} canRestore={(it) => canChangeFile(it, abilities)} restoringId={restoringId} onRestore={(id) => restore.mutate(id)} />
      {q.hasNextPage && (
        <div>
          <Button type="button" variant="outline" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? "Loading…" : "Show more"}
          </Button>
        </div>
      )}
    </div>
  );
}
