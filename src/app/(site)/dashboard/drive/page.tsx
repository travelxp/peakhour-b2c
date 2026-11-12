"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { BrandKitTab } from "@/components/brand-kit/brand-kit-tab";
import { CleanupView } from "@/components/drive/cleanup-view";
import { FilesView, NewCollectionButton } from "@/components/drive/files-view";
import { StorageView } from "@/components/drive/storage-view";
import { TrashView } from "@/components/drive/trash-view";
import { driveAbilities } from "@/lib/drive/files-state";
import { DRIVE_TABS, tabFromParam } from "@/lib/drive/tabs";
import { uploadQueue } from "@/lib/drive/upload-engine";
import { cn } from "@/lib/utils";

/**
 * Drive (D4 + D9): everything the business makes and owns, in one place. Replaces the old Media page at /dashboard/media.
 *
 * The page is a shell: five tabs (Files, Brand Kit, Smart Cleanup, Trash, Storage), the Upload button, and a drop zone that is the whole
 * page. It starts uploads and leaves them to the one queue (lib/drive/upload-engine.ts) and the tray (mounted in the dashboard layout), so
 * leaving the page or closing the tray stops nothing. When a file lands the lists refresh.
 *
 * The tab lives in the URL (?tab=), so a link to "Smart Cleanup" or "Storage" works and the sidebar's storage meter can open the right one.
 * (Read through useSearchParams, not the hash: the hash is not there on the first render.)
 */

const MEDIA_CRONS = ["media-usage-scan", "media-cleanup-suggestions", "media-hard-delete", "media-storage-reconcile", "media-describe-sweep"] as const;

/** True when a drag carries files (not text or a link dragged around the page). */
const carriesFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");

function DriveHome() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { org, orgs, business } = useAuth();
  const role = orgs.find((o) => o._id === org?._id)?.role;
  const abilities = driveAbilities(role);
  const tab = tabFromParam(params.get("tab"));
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const setTab = (t: string) => router.replace(t === "files" ? pathname : `${pathname}?tab=${t}`, { scroll: false });

  const addFiles = useCallback(
    (list: FileList | File[] | null | undefined) => {
      const files = list ? [...list] : [];
      if (files.length > 0 && abilities.canEdit) uploadQueue.add(files);
    },
    [abilities.canEdit],
  );

  // A file landing refreshes everything that lists files or counts bytes.
  useEffect(
    () =>
      uploadQueue.onDone(() => {
        for (const key of [["drive", "files"], ["drive", "collections"], ["drive", "cleanup"], ["storage-usage"]]) void qc.invalidateQueries({ queryKey: key });
      }),
    [qc],
  );

  // Drag anywhere on the page. A counter, because dragenter and dragleave also fire for every child the pointer crosses.
  useEffect(() => {
    if (!abilities.canEdit) return;
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(e.dataTransfer?.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [abilities.canEdit, addFiles]);

  return (
    <PageShell width="wide">
      <CronToolbar crons={MEDIA_CRONS} onTriggered={() => void qc.invalidateQueries({ queryKey: ["drive"] })} />

      <PageHeader
        title="Drive"
        description={`Everything ${business?.name ?? "your business"} makes and owns, in one place.`}
        actions={
          abilities.canEdit ? (
            <>
            {tab === "files" && <NewCollectionButton />}
            <Button type="button" onClick={() => input.current?.click()}>
              <Upload aria-hidden className="size-4" />
              Upload
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              aria-label="Choose files to upload"
              tabIndex={-1}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            </>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList variant="line" aria-label="Drive sections" className="h-auto w-full flex-wrap justify-start border-b">
          {DRIVE_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="min-h-11 px-3.5">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="files">
          <FilesView abilities={abilities} />
        </TabsContent>
        <TabsContent value="brand">
          <BrandKitTab onUpload={abilities.canEdit ? () => input.current?.click() : undefined} />
        </TabsContent>
        <TabsContent value="cleanup">
          <CleanupView onMoved={() => setTab("trash")} />
        </TabsContent>
        <TabsContent value="trash">
          <TrashView abilities={abilities} />
        </TabsContent>
        <TabsContent value="storage">
          <StorageView />
        </TabsContent>
      </Tabs>

      <div
        aria-hidden={!dragging}
        className={cn(
          "pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity",
          dragging ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="rounded-2xl border-2 border-dashed border-foreground/40 bg-card px-10 py-8 text-center">
          <Upload aria-hidden className="mx-auto mb-2 size-6" />
          <div className="text-lg font-semibold">Drop to add to Drive</div>
          <div className="mt-1 text-sm text-muted-foreground">Images, videos and documents. Peakhour names and sorts them for you.</div>
        </div>
      </div>
    </PageShell>
  );
}

export default function DrivePage() {
  return (
    <Suspense fallback={null}>
      <DriveHome />
    </Suspense>
  );
}
