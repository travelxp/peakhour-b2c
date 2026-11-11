"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FileText, Film, Image as ImageIcon, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openAddSpace } from "@/lib/add-space-event";
import { describePoller } from "@/lib/drive/describe-poller";
import { pillText, trayLine, trayName, trayTitle, trayWas } from "@/lib/drive/tray-copy";
import { uploadQueue, type UploadRow } from "@/lib/drive/upload-engine";
import type { DescribeStateRow } from "@/lib/api/media";

/**
 * The upload tray (Upload board). A VIEW of the one queue in lib/drive/upload-engine.ts: closing it, or leaving the Drive page, stops
 * nothing, and a closed tray with files still going up leaves a small pill that opens it again. Mounted once, in the dashboard layout.
 *
 * Under the rows it says what Peakhour does next, and that a file already in Drive is not stored twice. A file that stopped says why in plain
 * words with "Try again" (a full Drive offers "Add space").
 */

const ICON = { image: ImageIcon, video: Film, document: FileText, other: FileText } as const;

export function UploadTray({
  rows,
  described,
  onClose,
  onRetry,
  onCancel,
  onClear,
}: {
  rows: readonly UploadRow[];
  described: ReadonlyMap<string, DescribeStateRow>;
  onClose: () => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onClear: () => void;
}) {
  const anyDuplicate = rows.some((r) => r.status === "duplicate");
  const finished = rows.some((r) => ["done", "duplicate", "cancelled"].includes(r.status) || (r.status === "failed" && r.final));
  return (
    <section role="dialog" aria-label="Uploads" className="flex max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{trayTitle(rows)}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Close this any time. Uploads carry on, and resume if your connection drops.</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close uploads" onClick={onClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </div>
      <ul className="flex flex-col gap-2 overflow-y-auto">
        {rows.map((r) => {
          const desc = r.mediaId ? described.get(r.mediaId) : undefined;
          const Icon = ICON[r.kind];
          const active = ["waiting", "preparing", "uploading", "finishing"].includes(r.status);
          const was = trayWas(r, desc);
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2.5">
                  <span className="truncate text-sm font-medium">{trayName(r, desc)}</span>
                  <span className={`whitespace-nowrap text-xs ${r.status === "failed" ? "text-destructive-on-tint" : "text-muted-foreground"}`} role={r.status === "failed" ? "alert" : "status"}>
                    {r.status === "failed" ? "Stopped" : trayLine(r, desc)}
                  </span>
                </div>
                {was && <div className="text-xs text-muted-foreground">{was}</div>}
                {r.status === "failed" && <div className="mt-0.5 text-xs text-destructive-on-tint">{trayLine(r, desc)}</div>}
                <div className="mt-1.5 h-1 rounded-full bg-muted" aria-hidden>
                  <div className="h-1 rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(r.progress * 100)}%` }} />
                </div>
                {r.status === "failed" && !r.final && (
                  <div className="mt-1.5 flex gap-2">
                    <Button type="button" size="xs" variant="outline" onClick={() => onRetry(r.id)}>
                      <RotateCw aria-hidden />
                      Try again
                    </Button>
                    {r.quotaFull && (
                      <Button type="button" size="xs" variant="outline" onClick={openAddSpace}>
                        Add space
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {active && (
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Stop uploading ${r.filename}`} onClick={() => onCancel(r.id)}>
                  <X aria-hidden />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="rounded-lg bg-muted px-3.5 py-3 text-[13px] leading-relaxed text-foreground/90">
        Peakhour names each file, writes its description and alt text, and sorts it into collections.
        {anyDuplicate ? " One of these is already in your Drive, so it will not be stored twice." : ""}
      </p>
      <div className="flex justify-end gap-2">
        {finished && (
          <Button type="button" variant="ghost" onClick={onClear}>
            Clear finished
          </Button>
        )}
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    </section>
  );
}

/** Mounted once in the dashboard layout. Opens by itself when files are added; leaves a pill when closed with uploads still running. */
export function UploadTrayHost() {
  const rows = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getSnapshot, uploadQueue.getSnapshot);
  const added = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getAddedCount, uploadQueue.getAddedCount);
  // Open while files have been added since the person last closed it: closing remembers how many had been added, so new files open it again.
  const [closedAt, setClosedAt] = useState(0);
  const open = added > closedAt;
  const [described, setDescribed] = useState<ReadonlyMap<string, DescribeStateRow>>(new Map());

  // Files that have landed are watched until Peakhour has named them; nothing is asked when none has landed.
  const landed = rows.filter((r) => r.mediaId && (r.status === "done" || r.status === "duplicate")).map((r) => r.mediaId!);
  const landedKey = landed.join(",");
  useEffect(() => {
    describePoller.watch("tray", landedKey ? landedKey.split(",") : []);
    return () => describePoller.unwatch("tray");
  }, [landedKey]);
  useEffect(
    () =>
      describePoller.subscribe((answer) =>
        setDescribed((prev) => {
          const next = new Map(prev);
          for (const a of answer) next.set(a.id, a);
          return next;
        }),
      ),
    [],
  );

  if (rows.length === 0) return null;
  const pill = pillText(rows);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 [&>*]:pointer-events-auto">
      {open ? (
        <UploadTray rows={rows} described={described} onClose={() => setClosedAt(added)} onRetry={(id) => uploadQueue.retry(id)} onCancel={(id) => uploadQueue.cancel(id)} onClear={() => uploadQueue.clearFinished()} />
      ) : (
        pill && (
          <button type="button" onClick={() => setClosedAt(0)} className="rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-lg hover:bg-accent" aria-label={`${pill}. Open uploads`}>
            {pill}
          </button>
        )
      )}
    </div>
  );
}
