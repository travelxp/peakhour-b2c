"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { previewReplace, replaceMedia, type MediaItem, type ReplaceItem, type ReplaceResult } from "@/lib/api/media";
import { placeLine, replaceFailureText, replaceIntro, replaceOutcome } from "@/lib/drive/copy";
import { uploadErrorMessage, uploadToDrive } from "@/lib/drive/upload-engine";

/**
 * Replace everywhere (D8, Main board). "New logo: one action, every draft and scheduled post takes it. Things already published stay as they
 * went out." The dialog shows what will change and what will stay BEFORE anything is uploaded, then uploads the new file the ordinary way (the
 * same resumable engine as the tray) and swaps. What did not change is listed with a Try again that finishes it: the same call is safe to repeat.
 */

const ACCEPT: Record<MediaItem["kind"], string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/quicktime",
  document: ".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
  font: ".woff2,.woff,.ttf,.otf",
};

function Places({ title, items, tone }: { title: string; items: ReplaceItem[]; tone?: "muted" }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-muted-foreground">{title}</div>
      <ul className={`mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm ${tone === "muted" ? "text-muted-foreground" : ""}`}>
        {items.map((it) => (
          <li key={`${it.kind}:${it.refId}`}>{placeLine(it)}</li>
        ))}
      </ul>
    </div>
  );
}

type Phase = { name: "choose" } | { name: "working"; step: "uploading" | "swapping" } | { name: "done"; result: ReplaceResult } | { name: "error"; message: string; uploadedId?: string };

export function ReplaceFileDialog({ item, onReplaced }: { item: MediaItem; onReplaced: (newFileId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "choose" });
  const input = useRef<HTMLInputElement>(null);
  // The screen moves to the new file only when this dialog closes, so a Try again still names the file being replaced.
  const replacedTo = useRef<string | null>(null);

  const preview = useQuery({
    queryKey: ["drive", "replace-preview", item.id],
    queryFn: () => previewReplace(item.id),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const reset = () => {
    setFile(null);
    setPhase({ name: "choose" });
  };

  const close = () => {
    setOpen(false);
    const to = replacedTo.current;
    replacedTo.current = null;
    reset();
    if (to) onReplaced(to);
  };

  const swap = async (mediaId: string) => {
    setPhase({ name: "working", step: "swapping" });
    try {
      const result = await replaceMedia(item.id, mediaId);
      setPhase({ name: "done", result });
      replacedTo.current = result.fileId;
    } catch (e) {
      setPhase({ name: "error", message: replaceFailureText(e), uploadedId: mediaId });
    }
  };

  const run = async () => {
    if (!file) return;
    setPhase({ name: "working", step: "uploading" });
    let uploaded;
    try {
      // The new file has the same visibility as the one it replaces: nothing that holds it gains or loses a public address.
      uploaded = await uploadToDrive(file, { visibility: item.visibility });
    } catch (e) {
      setPhase({ name: "error", message: uploadErrorMessage(e) });
      return;
    }
    await swap(uploaded.mediaId);
  };

  const working = phase.name === "working";
  const done = phase.name === "done" ? phase.result : null;
  const outcome = done ? replaceOutcome(done) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (working) return; // an upload or a swap in flight is not abandoned by a stray click
        if (next) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="col-span-2 gap-1.5">
          <Replace aria-hidden className="size-3.5" /> Replace everywhere
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace &ldquo;{item.name}&rdquo; everywhere</DialogTitle>
          <DialogDescription>
            {preview.isPending ? "Checking everywhere this file is used…" : preview.isError ? "We could not check where this file is used, so nothing can be replaced right now." : replaceIntro(preview.data.willChange, preview.data.staysAsSent)}
          </DialogDescription>
        </DialogHeader>

        {phase.name !== "done" && preview.data && (
          <div className="space-y-3">
            <Places title="These will use the new file" items={preview.data.willChange} />
            <Places title="These stay exactly as they went out" items={preview.data.staysAsSent} tone="muted" />
          </div>
        )}

        {(phase.name === "choose" || phase.name === "error") && !preview.isError && (
          <div className="space-y-2">
            <input
              ref={input}
              type="file"
              accept={ACCEPT[item.kind]}
              aria-label="Choose the new file"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                if (phase.name === "error") setPhase({ name: "choose" });
              }}
            />
            {phase.name === "error" && (
              <p role="alert" className="text-sm text-destructive-on-tint">
                {phase.message}
              </p>
            )}
          </div>
        )}

        {phase.name === "working" && (
          <p role="status" className="text-sm font-medium text-brand-label">
            {phase.step === "uploading" ? "Uploading the new file…" : "Moving everything over to it…"}
          </p>
        )}

        {done && outcome && (
          <div className="space-y-3">
            <p role={outcome.failed ? "alert" : "status"} className={`text-sm font-medium ${outcome.failed ? "text-warning-on-tint" : "text-success-on-tint"}`}>
              {outcome.headline}
            </p>
            <Places title="Could not be changed" items={done.notChanged} />
            <Places title="Stayed as they went out" items={done.staysAsSent} tone="muted" />
          </div>
        )}

        <DialogFooter>
          {done ? (
            <>
              {outcome?.failed && (
                <Button type="button" onClick={() => void swap(done.fileId)} disabled={working}>
                  Try again
                </Button>
              )}
              <Button type="button" variant={outcome?.failed ? "outline" : "default"} onClick={close}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={working} onClick={close}>
                Cancel
              </Button>
              {phase.name === "error" && phase.uploadedId ? (
                <Button type="button" onClick={() => void swap(phase.uploadedId!)} disabled={working}>
                  Try again
                </Button>
              ) : (
                <Button type="button" disabled={!file || working || preview.isPending || preview.isError} onClick={() => void run()}>
                  {working ? "Replacing…" : "Replace everywhere"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
