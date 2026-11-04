"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { getCleanup, trashCleanup, type CleanupGroup, type CleanupKind } from "@/lib/api/media";
import { cleanupCopy, cleanupTotals, gbText } from "@/lib/drive/copy";

/**
 * Smart Cleanup (D9, Main board "Cleanup"). Peakhour suggests, the person decides, and nothing happens without one confirm.
 *
 * ★WHAT THIS PAGE CAN AND CANNOT DO. It never lists a file that is in use or was put to use: the api reads only files with no "used in" at
 *  all, and the Trash call checks again. Nothing here removes a file for good: "Move to Trash" keeps it 30 days and it can be restored
 *  (Trash tab). "Large files worth shrinking" is advice: it has no checkbox and nothing is moved for it. No word on this page says "delete".
 */

const ORDER: CleanupKind[] = ["duplicate_content_hash", "orphan_generated", "unused_90d", "large_5mb_plus"];

export function CleanupPanel({
  groups,
  capped,
  chosen,
  onToggle,
  onMove,
  moving,
}: {
  groups: CleanupGroup[];
  capped: boolean;
  chosen: ReadonlySet<CleanupKind>;
  onToggle: (kind: CleanupKind) => void;
  onMove: () => void;
  moving: boolean;
}) {
  const shown = ORDER.map((k) => groups.find((g) => g.kind === k)).filter((g): g is CleanupGroup => !!g && g.count > 0);
  const totals = cleanupTotals(groups, chosen);
  if (shown.length === 0) {
    return (
      <div className="max-w-3xl rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        <Sparkles aria-hidden className="mx-auto mb-2 size-5" />
        Nothing to tidy up right now. Peakhour looks again every week, and only ever suggests files that are not used anywhere.
      </div>
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-xl border bg-card p-4">
        <div>
          <div className="text-lg font-semibold">You can free {gbText(totals.bytes)}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">Files in use, or ever published, are never listed here. Anything you move stays in Trash for 30 days.</p>
        </div>
        <ConfirmDialog
          trigger={
            <Button type="button" disabled={totals.count === 0 || moving}>
              {moving ? "Moving…" : `Move ${totals.count} ${totals.count === 1 ? "file" : "files"} to Trash`}
            </Button>
          }
          title={`Move ${totals.count} ${totals.count === 1 ? "file" : "files"} to Trash?`}
          description={`That frees ${gbText(totals.bytes)} now. You can restore any of them from Trash for 30 days, then they are removed for good.`}
          confirmLabel="Move to Trash"
          onConfirm={onMove}
        />
      </div>
      {shown.map((g) => {
        const copy = cleanupCopy(g.kind, g.count);
        const id = `cleanup-${g.kind}`;
        return (
          <div key={g.kind} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5">
            {g.trashable ? (
              <Checkbox id={id} checked={chosen.has(g.kind)} onCheckedChange={() => onToggle(g.kind)} className="size-5" aria-label={copy.title} />
            ) : (
              <span className="inline-flex size-5 items-center justify-center text-muted-foreground" aria-hidden>
                <Sparkles className="size-4" />
              </span>
            )}
            <label htmlFor={g.trashable ? id : undefined} className="min-w-0 flex-1 cursor-pointer">
              <div className="text-[15px] font-medium">{copy.title}</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{copy.why}</div>
            </label>
            <div className="whitespace-nowrap text-sm text-foreground/80">{gbText(g.reclaimableBytes)}</div>
          </div>
        );
      })}
      {capped && <p className="text-xs text-muted-foreground">There are more files to review than this page lists. Move these first, then look again.</p>}
    </div>
  );
}

export function CleanupView({ onMoved }: { onMoved: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["drive", "cleanup"], queryFn: getCleanup, staleTime: 30_000 });
  const groups = useMemo(() => q.data?.groups ?? [], [q.data]);
  // Everything that can be moved starts chosen; what the person turns off is remembered, so a group that arrives later is chosen too.
  const [off, setOff] = useState<Set<CleanupKind>>(new Set());
  const chosen = useMemo(() => new Set(groups.filter((g) => g.trashable && g.count > 0 && !off.has(g.kind)).map((g) => g.kind)), [groups, off]);

  const move = useMutation({
    mutationFn: () => trashCleanup([...chosen].filter((k) => groups.find((g) => g.kind === k)?.trashable)),
    onSuccess: (r) => {
      toast.success(
        r.deletedCount === 0
          ? "Nothing was moved: those files are in use now."
          : `${r.deletedCount} ${r.deletedCount === 1 ? "file" : "files"} moved to Trash. ${gbText(r.freedBytes)} freed.${r.remaining > 0 ? ` ${r.remaining} more are left. Run Smart Cleanup again.` : ""}`,
      );
      for (const key of [["drive", "cleanup"], ["drive", "files"], ["drive", "trash"], ["storage-usage"]]) void qc.invalidateQueries({ queryKey: key });
      if (r.deletedCount > 0) onMoved();
    },
    onError: () => toast.error("Nothing was moved. Try again."),
  });

  if (q.isPending) {
    return q.fetchStatus === "paused" ? (
      <EmptyState icon={AlertTriangle} title="You look to be offline" description="Smart Cleanup will load when the connection is back." />
    ) : (
      <div className="flex max-w-3xl flex-col gap-3.5" aria-busy="true" aria-label="Looking for files to tidy up">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return <EmptyState icon={AlertTriangle} title="Smart Cleanup did not load" description="Something went wrong on our side. Nothing was changed." action={{ label: "Try again", onClick: () => void q.refetch() }} />;
  }
  return (
    <CleanupPanel
      groups={groups}
      capped={q.data.capped}
      chosen={chosen}
      moving={move.isPending}
      onToggle={(k) =>
        setOff((prev) => {
          const next = new Set(prev);
          if (next.has(k)) next.delete(k);
          else next.add(k);
          return next;
        })
      }
      onMove={() => move.mutate()}
    />
  );
}
