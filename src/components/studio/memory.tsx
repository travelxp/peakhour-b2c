"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { creativeApi, type MemoryLine, type MemoryRead } from "@/lib/api/creative";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { driveAbilities } from "@/lib/drive/files-state";
import { useStudioPrefs } from "@/hooks/use-studio";
import { MEMORY_KEY, useMemory } from "@/hooks/use-studio-memory";
import { ideasFeedStatus } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { exportBody, runChange } from "@/lib/studio-memory";
import { useAuth } from "@/providers/auth-provider";
import { MemoryView, type MemoryActions } from "./memory-view";

const C = STUDIO_COPY.learned;

/** Hand the export to the browser as a file. Nothing is uploaded; the JSON is the api's answer, as it is. */
function saveFile(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Some browsers start the download after this handler returns; revoking at once would cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * The page's wiring (UX spec S15): read, stop using a line, edit and add (Pro tools), the opt-in switch, export and wipe. Every change is
 * free. A line leaves the page only after the api has said so, so a failed delete never looks like a done one.
 */
export function Memory() {
  const qc = useQueryClient();
  const memory = useMemory();
  const { proTools } = useStudioPrefs();
  const { org, orgs } = useAuth();
  const canChange = driveAbilities(orgs?.find((o) => o._id === org?._id)?.role).canEdit;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [pooledBusy, setPooledBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: [MEMORY_KEY] });
  const patch = (fn: (m: MemoryRead) => MemoryRead) => qc.setQueriesData<MemoryRead>({ queryKey: [MEMORY_KEY] }, (old) => (old ? fn(old) : old));

  const actions: MemoryActions = useMemo(
    () => ({
      onStop: async (line: MemoryLine) => {
        setBusyId(line.id);
        const out = await runChange(() => creativeApi.deleteMemoryLine(line.id), { goneOn404: true });
        setBusyId(null);
        if (out === "failed") {
          toast.error(C.stopFailed);
          return;
        }
        patch((m) => ({ ...m, lines: m.lines.filter((l) => l.id !== line.id) }));
        toast(out === "gone" ? C.lineGone : C.stopped);
        void refresh();
      },
      onSave: async (line, text) => {
        const out = await runChange(() => creativeApi.editMemoryLine(line.id, text), { goneOn404: true });
        if (out === "done") {
          patch((m) => ({ ...m, lines: m.lines.map((l) => (l.id === line.id ? { ...l, text } : l)) }));
          toast(C.saved);
          void refresh();
          return true;
        }
        if (out === "gone") {
          toast(C.lineGone);
          void refresh();
          return true;
        }
        toast.error(C.saveFailed);
        return false;
      },
      onAdd: async (text) => {
        const out = await runChange(() => creativeApi.addMemoryLine(text));
        if (out === "done") {
          toast(C.added);
          void refresh();
          return true;
        }
        toast.error(C.addFailed);
        return false;
      },
      onPooled: async (optIn) => {
        // One change at a time, and the server has the last word: the switch is off while a change is on its way, and the page re-reads after.
        setPooledBusy(true);
        const out = await runChange(() => creativeApi.setPooled(optIn));
        setPooledBusy(false);
        if (out === "done") {
          patch((m) => ({ ...m, pooledOptIn: optIn }));
          toast(optIn ? C.pooledOn : C.pooledOff);
        } else {
          toast.error(C.pooledFailed);
        }
        void refresh();
      },
      onExport: async () => {
        setExporting(true);
        try {
          saveFile(C.exportFile, exportBody(await creativeApi.exportMemory()));
          toast(C.exportDone);
        } catch {
          toast.error(C.exportFailed);
        } finally {
          setExporting(false);
        }
      },
      onWipe: () => setWipeOpen(true),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- patch/refresh only close over the stable query client
    [qc],
  );

  const wipe = async () => {
    setWiping(true);
    const out = await runChange(() => creativeApi.wipeMemory());
    setWiping(false);
    setWipeOpen(false);
    if (out === "failed") {
      toast.error(C.wipeFailed);
      return;
    }
    toast(C.wiped);
    void refresh();
  };

  return (
    <>
      <MemoryView
        status={ideasFeedStatus(memory)}
        data={memory.data}
        proTools={proTools}
        canChange={canChange}
        busyId={busyId}
        exporting={exporting}
        pooledBusy={pooledBusy}
        onRetry={() => void memory.refetch()}
        actions={actions}
      />
      <AlertDialog open={wipeOpen} onOpenChange={(o) => !wiping && setWipeOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{C.wipeTitle}</AlertDialogTitle>
            <AlertDialogDescription>{C.wipeBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wiping}>{C.wipeCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={wiping}
              onClick={(e) => {
                e.preventDefault();
                void wipe();
              }}
            >
              {C.wipeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
