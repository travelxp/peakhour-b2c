"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/dashboard/query-error";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRestore, useVersions } from "@/hooks/use-studio-pro";
import type { HistoryItem } from "@/lib/api/creative-studio";
import { groupHistory, restoreMessage, type HistoryGroup } from "@/lib/studio-pro";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const H = STUDIO_COPY.history;

const whenLabel = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(t));
};

export interface VersionHistoryViewProps {
  groups: HistoryGroup[];
  canMake: boolean;
  /** The version being restored, so its button reads "Going back" and the rest wait. */
  busy: { previewId: string; version: number } | null;
  message?: { tone: "ok" | "error"; text: string };
  onRestore: (previewId: string, version: number) => void;
}

/**
 * The timeline (UX spec S17): each preview's looks, newest first, with what changed and when, and "Go back to this". Going back adds a new look on top; nothing is erased,
 * and the heart lapses, which the banner says. A viewer sees the list and cannot go back.
 */
export function VersionHistoryView({ groups, canMake, busy, message, onRestore }: VersionHistoryViewProps) {
  if (groups.length === 0) return <EmptyState icon={History} title={H.empty.title} description={H.empty.description} />;
  return (
    <div className="space-y-5" data-slot="studio-history">
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-lg border p-3 text-sm", message.tone === "error" ? "border-destructive/40" : "bg-muted/40")}>
          {message.text}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.previewId} aria-label={H.forPreview(g.number)} className="space-y-2">
          <h3 className="text-sm font-semibold">
            {H.forPreview(g.number)}
            {g.headline && <span className="font-normal text-muted-foreground">: {g.headline}</span>}
          </h3>
          <ol className="space-y-2 border-s ps-4">
            {g.items.map((it: HistoryItem) => {
              const mine = busy?.previewId === g.previewId && busy.version === it.version;
              return (
                <li key={`${it.previewId}-${it.version}-${it.current ? "now" : "old"}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>{H.version(it.version)}</span>
                      {it.current && <Badge>{H.current}</Badge>}
                    </p>
                    <p className="text-sm">{it.summary}</p>
                    <p className="text-xs text-muted-foreground">{whenLabel(it.at)}</p>
                  </div>
                  {it.restorable && (
                    <Button type="button" variant="outline" className="h-11" disabled={!canMake || busy !== null} onClick={() => onRestore(g.previewId, it.version)}>
                      {mine ? H.restoring : H.restore}
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {!canMake && <p className="text-xs text-muted-foreground">{H.viewer}</p>}
    </div>
  );
}

/** The history sheet on the creative page (Pro tools): a bottom sheet on a phone, the right panel on a larger screen. Reads only while open. */
export function VersionHistorySheet({
  creativeId,
  open,
  onOpenChange,
  previews,
  canMake,
}: {
  creativeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previews: Array<{ id: string; headline: string | null }>;
  canMake: boolean;
}) {
  const mobile = useIsMobile();
  const q = useVersions(creativeId, open);
  const restore = useRestore(creativeId);
  const [busy, setBusy] = useState<{ previewId: string; version: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | undefined>();

  const onRestore = (previewId: string, version: number) => {
    setMessage(undefined);
    setBusy({ previewId, version });
    restore.mutate(
      { previewId, version },
      {
        onSuccess: () => {
          setMessage({ tone: "ok", text: H.restored });
          toast.success(H.restored);
        },
        onError: (e) => setMessage({ tone: "error", text: restoreMessage(e) }),
        onSettled: () => setBusy(null),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setMessage(undefined);
        onOpenChange(o);
      }}
    >
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 overflow-y-auto p-4", mobile ? "max-h-[92dvh]" : "sm:max-w-lg")}>
        <SheetHeader className="p-0">
          <SheetTitle>{H.title}</SheetTitle>
          <SheetDescription>{H.description}</SheetDescription>
        </SheetHeader>
        {q.isPending && q.errorUpdatedAt === 0 ? (
          <Skeleton aria-busy="true" aria-label={H.title} className="h-40 rounded-lg" />
        ) : q.data ? (
          <VersionHistoryView groups={groupHistory(q.data, previews)} canMake={canMake} busy={busy} message={message} onRestore={onRestore} />
        ) : (
          <QueryError what={H.error} onRetry={() => void q.refetch()} />
        )}
      </SheetContent>
    </Sheet>
  );
}
