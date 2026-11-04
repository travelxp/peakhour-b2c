"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { listVersions, restoreVersion, type FileVersion } from "@/lib/api/media";
import { placesSummary, replaceFailureText, versionLine } from "@/lib/drive/copy";

/**
 * Version history (D8, Main board): the files a replace took the place of, for the 30 days they are kept. A replaced file counts like
 * Trash (not against the storage) and is removed for good on the last day. Restore swaps it back, and moves the drafts and scheduled
 * posts that use the file with it; whatever had gone out stays as it went out.
 */

export function VersionRow({ version, now, canRestore, restoring, onRestore }: { version: FileVersion; now: Date; canRestore: boolean; restoring: boolean; onRestore: () => void }) {
  return (
    <li className="flex items-center gap-2.5">
      {version.publicUrl && version.mimeType.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element -- a stored file's own address, not an optimised asset
        <img src={version.publicUrl} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
      ) : (
        <div aria-hidden className="size-10 shrink-0 rounded-md border bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{version.name}</div>
        <div className="text-xs text-muted-foreground">{versionLine(version, now)}</div>
      </div>
      {canRestore && (
        <ConfirmDialog
          trigger={
            <Button type="button" size="xs" variant="outline" disabled={restoring}>
              {restoring ? "Restoring…" : "Restore"}
            </Button>
          }
          title="Put this version back?"
          description="It becomes the file again, and drafts and scheduled posts that use the file switch to it. Anything already published stays as it went out. The version you replace it with goes into version history."
          confirmLabel="Restore"
          onConfirm={onRestore}
        />
      )}
    </li>
  );
}

export function VersionHistory({ fileId, now, canEdit, onRestored }: { fileId: string; now: Date; canEdit: boolean; onRestored: (newFileId: string | null) => void }) {
  const qc = useQueryClient();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["drive", "versions", fileId], queryFn: () => listVersions(fileId), staleTime: 30_000 });

  if (q.isPending || q.isError || (q.data ?? []).length === 0) return null;

  const restore = async (v: FileVersion) => {
    setRestoringId(v.id);
    try {
      const r = await restoreVersion(fileId, v.id);
      toast.success(
        r.notChanged.length > 0
          ? `Restored, but ${placesSummary(r.notChanged)} could not be switched. They still use the other file.`
          : r.changed.length > 0
            ? `Restored. ${placesSummary(r.changed)} now use it.`
            : "Restored.",
      );
      void qc.invalidateQueries({ queryKey: ["drive"] });
      void qc.invalidateQueries({ queryKey: ["storage-usage"] });
      onRestored(r.fileId);
    } catch (e) {
      toast.error(replaceFailureText(e));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-muted-foreground">Earlier versions</div>
      <ul className="mt-1.5 flex flex-col gap-2">
        {q.data.map((v) => (
          <VersionRow key={v.id} version={v} now={now} canRestore={canEdit} restoring={restoringId === v.id} onRestore={() => void restore(v)} />
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-muted-foreground">Most are kept for 30 days. One that things you already published still show is kept for as long as that is true. None count against your storage.</p>
    </div>
  );
}
