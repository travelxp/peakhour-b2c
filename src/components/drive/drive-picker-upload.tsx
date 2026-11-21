"use client";

/**
 * The Upload and Link tabs of the one media picker, and the same machine without the sheet: drop or paste straight into a composer (PK-1).
 *
 * ONE PATH FOR EVERY FILE. A file that arrives by the Upload tab's dropzone, by a drop on a composer, by a paste, or as a link is measured,
 * judged against the destination's rule (`lib/media-rules.ts`, the api's table), and only then sent: through `uploadToDrive` into Drive, or
 * through `POST /v1/media/save` for a link. A file the place would refuse never leaves the browser, and says why on its own tile.
 *
 * The file chooser itself is the diceui primitive (`components/ui/file-upload.tsx`), and this module is the only user of it.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, FileText, Link2, Loader2, Upload, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload, FileUploadDropzone, FileUploadTrigger } from "@/components/ui/file-upload";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { saveToDrive, getMedia } from "@/lib/api/media";
import type { MediaAsset } from "@/components/composer/types";
import type { DriveFile } from "@/lib/drive/files";
import { assetOf } from "@/lib/drive/asset-of";
import { probeDimensions, probeDuration, probeVideo } from "@/lib/drive/probe-file";
import { uploadErrorMessage, uploadToDrive, UploadAborted, UploadFailed, type UploadedFile, type UploadOptions } from "@/lib/drive/upload-engine";
import { acceptOf, aloneProblem, judgeFile, kindOfMime, roomLeft, takesLine, useMediaRule, verdictText, type FileFacts, type MediaDestination, type MediaRule } from "@/lib/media-rules";

export type UploadSeam = Pick<UploadOptions, "deps"> & {
  /** Test seam: how a file is measured. */
  measure?: (file: File) => Promise<FileFacts>;
  /** Test seam: how long a video is. */
  duration?: (file: File) => Promise<number | undefined>;
};

/** What the browser can read off a file: its type and size, a picture's or video's shape, a video's length. */
export async function measureFile(file: File, seam?: UploadSeam): Promise<FileFacts> {
  if (seam?.measure) return seam.measure(file);
  const facts: FileFacts = { mimeType: file.type, sizeBytes: file.size };
  if (file.type.startsWith("video/") && !seam?.deps?.probe && !seam?.duration) {
    const v = await probeVideo(file).catch(() => ({}) as Awaited<ReturnType<typeof probeVideo>>);
    return { ...facts, ...v };
  }
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    const dims = await (seam?.deps?.probe ?? probeDimensions)(file).catch(() => ({}) as { width?: number; height?: number });
    if (dims.width && dims.height) {
      facts.width = dims.width;
      facts.height = dims.height;
    }
    if (file.type.startsWith("video/")) {
      const d = await (seam?.duration ?? probeDuration)(file).catch(() => undefined);
      if (d !== undefined) facts.durationSeconds = d;
    }
  }
  return facts;
}

export interface UploadedWithFacts extends UploadedFile {
  facts: FileFacts;
}

export interface Refused {
  name: string;
  reason: string;
}

/** What the files' owner says about how they are kept. */
export interface ProcessContext {
  rule: MediaRule;
  /** How many more files may be added; files beyond it are turned away with a sentence. */
  room: number;
  visibility: "published" | "private" | undefined;
  /** A public link is needed: a Private file already in Drive under these bytes cannot be used. */
  requirePublicUrl: boolean;
  /** This slot takes one file, whatever the place takes in all: the words say so. */
  single?: boolean;
  /** What is already going to the same place (chosen in the sheet), and how many files the place already holds: a rule about files together reads them. */
  alongside?: FileFacts[];
  attached?: number;
  signal?: AbortSignal;
  seam?: UploadSeam;
}

/** What `processFiles` reports as it goes, so a tab can draw a tile for each file. */
export interface ProcessHooks {
  begin?: (file: File) => number;
  /** A signal that stops THIS file only (its own Cancel button). */
  signalFor?: (key: number) => AbortSignal | undefined;
  patch?: (key: number, p: RowPatch) => void;
}

export type RowPatch = Partial<Pick<UploadRowState, "status" | "sent" | "reason" | "fix">>;


export interface UploadRowState {
  key: number;
  file: File;
  status: "checking" | "uploading" | "done" | "refused" | "error" | "cancelled";
  sent: number;
  /** Why it was not added. */
  reason?: string;
  /** What to do about it, for a file that could be made to fit. */
  fix?: string;
}

/**
 * The whole path for a list of files: measure, judge, send. Files are sent one at a time, so a refusal on the first (a full Drive) stops
 * the rest cleanly. Returns what is now in Drive and what was turned away.
 */
export async function processFiles(list: File[], ctx: ProcessContext, hooks: ProcessHooks = {}): Promise<{ done: UploadedWithFacts[]; refused: Refused[] }> {
  const done: UploadedWithFacts[] = [];
  const refused: Refused[] = [];
  let room = ctx.room;
  const turnAway = (key: number | undefined, file: File, reason: string, fix?: string) => {
    refused.push({ name: file.name, reason: fix ? `${reason} ${fix}` : reason });
    if (key !== undefined) hooks.patch?.(key, { status: "refused", reason, ...(fix ? { fix } : {}) });
  };
  for (let i = 0; i < list.length; i++) {
    const file = list[i]!;
    if (ctx.signal?.aborted) break;
    const key = hooks.begin?.(file);
    // What the type and size alone settle is judged before the file is opened to be measured: a video this place does not take is never decoded.
    const early = judgeFile(ctx.rule, { mimeType: file.type, sizeBytes: file.size });
    if (early.state === "refused") {
      turnAway(key, file, early.reason);
      continue;
    }
    const facts = await measureFile(file, ctx.seam);
    const v = judgeFile(ctx.rule, facts);
    if (v.state === "refused" || v.state === "fixable") {
      turnAway(key, file, v.reason, v.state === "fixable" ? v.fix : undefined);
      continue;
    }
    if (room <= 0) {
      turnAway(key, file, fullSentence(ctx.rule, ctx.single));
      continue;
    }
    const together = aloneProblem(ctx.rule, [...(ctx.alongside ?? []), ...done.map((d) => d.facts), facts], ctx.attached ?? 0);
    if (together) {
      turnAway(key, file, together);
      continue;
    }
    const own = key === undefined ? undefined : hooks.signalFor?.(key);
    const signal = ctx.signal && own ? AbortSignal.any([ctx.signal, own]) : (ctx.signal ?? own);
    try {
      const res = await uploadToDrive(file, {
        ...(ctx.visibility ? { visibility: ctx.visibility } : {}),
        ...(signal ? { signal } : {}),
        onProgress: ({ sent }) => key !== undefined && hooks.patch?.(key, { sent }),
        ...(ctx.seam?.deps ? { deps: ctx.seam.deps } : {}),
      });
      if (ctx.requirePublicUrl && res.visibility === "private") {
        // Drive already held this exact file as a Private one, so nothing new was made Published.
        turnAway(key, file, "This file is already in Drive as a Private file, and this needs a public link. Publish it in Drive, then choose it here.");
        continue;
      }
      room -= 1;
      if (key !== undefined) hooks.patch?.(key, { status: "done", sent: file.size });
      done.push({ ...res, mimeType: file.type, facts });
    } catch (err) {
      if (err instanceof UploadAborted) {
        // The whole run was stopped (the sheet closed): nothing more is sent. One file's own Cancel only ends that file.
        if (ctx.signal?.aborted) break;
        if (key !== undefined) hooks.patch?.(key, { status: "cancelled" });
        continue;
      }
      const reason = uploadErrorMessage(err);
      refused.push({ name: file.name, reason });
      if (key !== undefined) hooks.patch?.(key, { status: "error", reason });
      if (err instanceof UploadFailed && err.quotaFull) {
        // A full Drive refuses every file behind this one the same way: say so once, on each, and stop rather than try them all.
        for (const rest of list.slice(i + 1)) {
          const k = hooks.begin?.(rest);
          refused.push({ name: rest.name, reason });
          if (k !== undefined) hooks.patch?.(k, { status: "error", reason });
        }
        break;
      }
    }
  }
  return { done, refused };
}

/** What is said when no more files fit: "Only one file can go to this.", "Up to 10 files can go to an Instagram post." */
export function fullSentence(rule: MediaRule, single = false): string {
  return single || rule.maxCount === 1 ? `Only one file can go to ${single ? "this" : rule.label}.` : `Up to ${rule.maxCount} files can go to ${rule.label}.`;
}

/** An uploaded file, in the shape the grid shows. */
export function driveFileOf(u: UploadedWithFacts): DriveFile {
  return {
    id: u.mediaId,
    name: u.name,
    kind: kindOfMime(u.facts.mimeType) ?? "document",
    mimeType: u.facts.mimeType,
    visibility: u.visibility,
    publicUrl: u.publicUrl,
    sizeBytes: u.sizeBytes,
    ...(u.facts.width ? { width: u.facts.width } : {}),
    ...(u.facts.height ? { height: u.facts.height } : {}),
    ...(u.facts.durationSeconds !== undefined ? { durationSeconds: u.facts.durationSeconds } : {}),
    source: "uploaded",
    createdAt: new Date().toISOString(),
  };
}

// ── Upload tab ───────────────────────────────────────────

export function UploadTab({
  rule,
  room,
  single,
  alongside,
  attached,
  requirePublicUrl,
  visibility,
  onDone,
  seam,
}: {
  rule: MediaRule;
  room: number;
  single?: boolean;
  alongside?: FileFacts[];
  attached?: number;
  requirePublicUrl: boolean;
  visibility: "published" | "private" | undefined;
  onDone: (done: UploadedWithFacts[]) => void;
  seam?: UploadSeam;
}) {
  const [rows, setRows] = useState<UploadRowState[]>([]);
  const next = useRef(0);
  const controller = useRef(new AbortController());
  /** One controller per tile, so Cancel on a tile ends that file and nothing else. */
  const own = useRef(new Map<number, AbortController>());
  const onDoneRef = useRef(onDone);
  const roomRef = useRef(room);
  /** Files of batches still on their way: the host's `room` does not count them until the batch lands, so two drops must not each see the same room. */
  const reserved = useRef(0);
  useEffect(() => {
    onDoneRef.current = onDone;
    roomRef.current = room;
  }, [onDone, room]);

  // Closing the picker (or leaving this tab) ends the upload in flight AND stops the queue behind it: its progress has nowhere to show.
  useEffect(() => {
    const ctl = (controller.current = new AbortController());
    return () => ctl.abort();
  }, []);

  const patch = useCallback((key: number, p: RowPatch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r))), []);

  const start = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const room = Math.max(0, roomRef.current - reserved.current);
      const reserve = Math.min(room, files.length);
      reserved.current += reserve;
      const { done } = await processFiles(
        files,
        { rule, room, ...(single ? { single } : {}), ...(alongside ? { alongside } : {}), ...(attached ? { attached } : {}), visibility, requirePublicUrl, signal: controller.current.signal, ...(seam ? { seam } : {}) },
        {
          begin: (file) => {
            const key = next.current++;
            own.current.set(key, new AbortController());
            setRows((rs) => [{ key, file, status: "checking", sent: 0 }, ...rs]);
            return key;
          },
          signalFor: (key) => own.current.get(key)?.signal,
          patch: (key, p) => patch(key, p.status === undefined && p.sent !== undefined ? { ...p, status: "uploading" } : p),
        },
      );
      reserved.current = Math.max(0, reserved.current - reserve);
      if (done.length > 0 && !controller.current.signal.aborted) onDoneRef.current(done);
    },
    [rule, single, alongside, attached, visibility, requirePublicUrl, seam, patch],
  );

  // Sent to the primitive as a plain rejection so a file the type or size refuses still gets a tile that says why.
  const reject = useCallback(
    (file: File, reason: string) => {
      const key = next.current++;
      setRows((rs) => [{ key, file, status: "refused", sent: 0, reason }, ...rs]);
    },
    [],
  );

  const validate = useCallback(
    (file: File): string | null => {
      const v = judgeFile(rule, { mimeType: file.type, sizeBytes: file.size });
      // Only what the file's own bytes settle is turned away here; a shape or a length needs it measured, which `processFiles` does.
      return v.state === "refused" || (v.state === "fixable" && v.what === "size") ? (verdictText(v) ?? "This file can't be used here.") : null;
    },
    [rule],
  );

  const accept = useMemo(() => acceptOf(rule), [rule]);
  const line = takesLine(rule);
  const full = room <= 0;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="upload-tab">
      <FileUpload accept={accept} multiple={room > 1} disabled={full} onFileValidate={validate} onFileReject={reject} onAccept={(files) => void start(files)} className="w-full">
        <FileUploadDropzone
          className={cn(
            "flex flex-col items-center justify-center gap-0 rounded-lg border-2 border-dashed bg-muted/30 px-6 py-12 text-center transition-colors motion-reduce:transition-none",
            "data-[dragging]:border-primary data-[dragging]:bg-primary/5",
            full && "opacity-60",
          )}
        >
          <Upload className="size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">{full ? `${single || rule.maxCount === 1 ? "One file is" : `${rule.maxCount} files are`} already chosen for ${single ? "this" : rule.label}.` : "Drop files here, or choose them."}</p>
          {line && <p className="mt-1 text-xs text-muted-foreground">{line}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Large files are sent in pieces, and carry on if your connection drops.</p>
          {!full && (
            <FileUploadTrigger render={<Button type="button" variant="outline" size="sm" className="mt-4 gap-1.5" />}>
              <Upload className="size-3.5" aria-hidden /> Choose {room > 1 ? "files" : "a file"}
            </FileUploadTrigger>
          )}
        </FileUploadDropzone>
      </FileUpload>
      {rows.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-2.5" aria-label="Uploads">
          {rows.filter((r) => r.status !== "cancelled").map((r) => (
            <UploadTile key={r.key} row={r} onCancel={() => own.current.get(r.key)?.abort()} onDismiss={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A thumbnail with a ring of progress over it while it is sent, and its refusal (and what to do) under it. */
function UploadTile({ row, onCancel, onDismiss }: { row: UploadRowState; onCancel: () => void; onDismiss: () => void }) {
  const url = useObjectUrl(row.file);
  const pct = row.file.size ? Math.min(100, Math.round((row.sent / row.file.size) * 100)) : 0;
  const failed = row.status === "refused" || row.status === "error";
  return (
    <li className={cn("overflow-hidden rounded-lg border bg-card text-xs", failed ? "border-destructive/50" : "border-border")}>
      <div className="relative flex h-24 items-center justify-center overflow-hidden bg-muted">
        {url && row.file.type.startsWith("image/") ? (
          // A local preview of the file being sent: an object URL, which the image optimiser cannot fetch.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : row.file.type.startsWith("video/") ? (
          <Video className="size-7 text-muted-foreground" aria-hidden />
        ) : (
          <FileText className="size-7 text-muted-foreground" aria-hidden />
        )}
        {(row.status === "checking" || row.status === "uploading") && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60" role="progressbar" aria-label={`Sending ${row.file.name}`} aria-valuenow={row.status === "uploading" ? pct : undefined} aria-valuemin={0} aria-valuemax={100}>
            {row.status === "uploading" ? <Ring pct={pct} /> : <Loader2 className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />}
          </div>
        )}
        {(row.status === "checking" || row.status === "uploading") && (
          <Button type="button" variant="secondary" size="icon" className="absolute right-1 top-1 size-6" aria-label={`Cancel ${row.file.name}`} onClick={onCancel}>
            <X className="size-3.5" />
          </Button>
        )}
        {failed && (
          <Button type="button" variant="secondary" size="icon" className="absolute right-1 top-1 size-6" aria-label={`Dismiss ${row.file.name}`} onClick={onDismiss}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="space-y-0.5 px-2 py-1.5">
        <div className="truncate font-medium">{row.file.name}</div>
        {row.status === "done" && <div className="text-success-on-tint">Added</div>}
        {failed && (
          <div role="alert" className="text-destructive-on-tint">
            <span className="flex items-start gap-1">
              <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>{row.reason}</span>
            </span>
            {row.fix && <span className="mt-0.5 block text-muted-foreground">{row.fix}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

/** A circular progress ring, in the page's own colours. */
function Ring({ pct }: { pct: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-muted-foreground/25" />
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-primary" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

function useObjectUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an object URL exists only in the browser and must be revoked with the tile; the effect owns both ends
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

// ── Link tab ─────────────────────────────────────────────

export const LINK_NEEDS_HTTPS = "Paste a link that starts with https://.";

/** The address as the api takes it, or null when it is not an https link. */
export function linkOf(text: string): string | null {
  const t = text.trim();
  if (!/^https:\/\/\S+$/i.test(t)) return null;
  try {
    return new URL(t).toString();
  } catch {
    return null;
  }
}

/**
 * A picture or file at an https link. The api fetches it (`POST /v1/media/save`, the one safe fetcher: nothing is fetched from this browser),
 * stores it in Drive, and the saved file is then judged like any other: a link to something this place would refuse is in Drive, and says why
 * it was not added.
 */
export function LinkTab({
  rule,
  room,
  single,
  alongside,
  attached,
  requirePublicUrl,
  onDone,
  readFile = getMedia,
  save = saveToDrive,
}: {
  rule: MediaRule;
  room: number;
  single?: boolean;
  alongside?: FileFacts[];
  attached?: number;
  requirePublicUrl: boolean;
  onDone: (file: DriveFile) => void;
  readFile?: typeof getMedia;
  save?: typeof saveToDrive;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const url = linkOf(text);

  async function add() {
    if (!url || busy) return;
    if (room <= 0) {
      setProblem(fullSentence(rule, single));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const saved = await save({ from: "draft_asset", url });
      const m = await readFile(saved.mediaId);
      const facts: FileFacts = { mimeType: m.mimeType, sizeBytes: m.sizeBytes, ...(m.width ? { width: m.width } : {}), ...(m.height ? { height: m.height } : {}), ...(m.durationSeconds !== undefined ? { durationSeconds: m.durationSeconds } : {}) };
      const v = judgeFile(rule, facts);
      if (v.state === "refused" || v.state === "fixable") {
        setProblem(`It is saved in Drive, but it was not added. ${verdictText(v)}`);
        return;
      }
      const together = aloneProblem(rule, [...(alongside ?? []), facts], attached ?? 0);
      if (together) {
        setProblem(`It is saved in Drive, but it was not added. ${together}`);
        return;
      }
      if (requirePublicUrl && saved.visibility === "private") {
        setProblem("That file is in Drive as a Private file, and this needs a public link. Publish it in Drive, then choose it there.");
        return;
      }
      setText("");
      onDone({
        id: saved.mediaId,
        name: saved.name,
        kind: kindOfMime(m.mimeType) ?? "document",
        mimeType: m.mimeType,
        visibility: saved.visibility,
        ...(saved.publicUrl ? { publicUrl: saved.publicUrl } : {}),
        sizeBytes: m.sizeBytes,
        ...(m.width ? { width: m.width } : {}),
        ...(m.height ? { height: m.height } : {}),
        ...(m.durationSeconds !== undefined ? { durationSeconds: m.durationSeconds } : {}),
        source: "uploaded",
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setProblem(err instanceof ApiError && err.message ? err.message : "We couldn't get that file. Check the link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      data-testid="link-tab"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          Link to a file
        </Label>
        <Input id={id} value={text} inputMode="url" autoComplete="off" onChange={(e) => setText(e.target.value)} placeholder="https://example.com/photo.jpg" className="h-10" aria-invalid={text.trim() !== "" && !url} />
        {text.trim() !== "" && !url && <p className="text-xs text-muted-foreground">{LINK_NEEDS_HTTPS}</p>}
      </div>
      <Button type="submit" disabled={!url || busy} className="w-full gap-1.5">
        {busy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Link2 className="size-3.5" aria-hidden />}
        {busy ? "Getting it…" : "Get this file"}
      </Button>
      {problem && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive-on-tint">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{problem}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">We fetch the file and keep a copy in Drive. {takesLine(rule)}</p>
    </form>
  );
}

// ── Drop and paste into a composer ───────────────────────

export interface DropPasteOptions {
  destination: MediaDestination;
  /** How many files the place already holds. */
  attached?: number;
  /** A reply's file must not get a public address, and so on: the same two the picker takes. */
  uploadAs?: "published" | "private";
  requirePublicUrl?: boolean;
  needUrl?: boolean;
  disabled?: boolean;
  onAdd: (assets: MediaAsset[]) => void;
  /**
   * Called ONCE per drop or paste, before `onAdd`, with every file turned away in it and its sentence (an empty list when none were). The host
   * REPLACES what it shows with it, so a drop that is all accepted clears the last one's refusals, and `onAdd` must not clear them.
   */
  onRefuse?: (refused: Refused[]) => void;
  seam?: UploadSeam;
}

/**
 * Drop or paste pictures straight into a composer: the same rules and the same upload engine as the picker. Pass the returned `ref` to the
 * element that takes the drop (the whole composer card): a paste anywhere inside it is taken too.
 * `busy` is true while files are on their way, so the host can say so.
 */
export function useDropPaste<T extends HTMLElement>(opts: DropPasteOptions): { ref: (el: T | null) => void; busy: boolean; dragging: boolean } {
  const [el, setEl] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ruleState = useMediaRule(opts.destination);
  // the row itself is stable (it is the query's own data), so the listeners are attached once per place, not once per render
  const r = ruleState.state === "ready" ? ruleState.rule : undefined;
  const latest = useRef(opts);
  /** Files taken by drops still on their way: the host's `attached` does not count them until they land, so two quick drops must not each see the same room. */
  const reserved = useRef(0);
  const inFlight = useRef(0);
  useEffect(() => {
    latest.current = opts;
  });
  /** Ends with the host (not with the rules or the element changing): files still on their way are then neither added nor waited for. */
  const life = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = (life.current = new AbortController());
    return () => c.abort();
  }, []);

  useEffect(() => {
    if (!el) return;
    const hasFiles = (dt: DataTransfer | null) => Boolean(dt && Array.from(dt.types ?? []).includes("Files"));
    const take = async (files: File[]) => {
      const o = latest.current;
      const stop = life.current ?? new AbortController();
      if (files.length === 0) return;
      if (o.disabled) {
        o.onRefuse?.(files.map((f) => ({ name: f.name, reason: "This can't take files right now." })));
        return;
      }
      if (!r) {
        // Taken, never left to the browser (which would open the file in this tab and lose the draft): the rules are not here yet, or not there at all.
        o.onRefuse?.(files.map((f) => ({ name: f.name, reason: ruleState.state === "unknown" ? "This place can't take files yet." : "We're still checking what this place takes. Try again in a moment." })));
        return;
      }
      inFlight.current += 1;
      setBusy(true);
      const room = Math.max(0, roomLeft(r, o.attached ?? 0) - reserved.current);
      const reserve = Math.min(room, files.length);
      reserved.current += reserve;
      try {
        const requirePublicUrl = o.requirePublicUrl ?? true;
        const visibility = o.uploadAs ?? (requirePublicUrl ? "published" : undefined);
        const { done, refused } = await processFiles(files, { rule: r, room, attached: o.attached ?? 0, visibility, requirePublicUrl, signal: stop.signal, ...(o.seam ? { seam: o.seam } : {}) });
        const refusedAll: Refused[] = [...refused];
        const assets: MediaAsset[] = [];
        for (const u of done) {
          const asset = await assetFromUpload(u, requirePublicUrl, o.needUrl ?? true);
          if (asset) assets.push(asset);
          else refusedAll.push({ name: u.name, reason: "We couldn't get a link for this file. Try again in a moment." });
        }
        // The host went away while the files were on their way: nothing is left to add them to.
        if (!stop.signal.aborted) o.onRefuse?.(refusedAll);
        if (assets.length > 0 && !stop.signal.aborted) o.onAdd(assets);
      } finally {
        reserved.current = Math.max(0, reserved.current - reserve);
        inFlight.current = Math.max(0, inFlight.current - 1);
        if (inFlight.current === 0 && !stop.signal.aborted) setBusy(false);
      }
    };
    // A drag or a drop that carries files is ALWAYS taken: left alone, the browser opens the file in this tab and the draft is lost. A host that
    // cannot take it says so (`take` refuses with a sentence) and shows no drop ring.
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      if (!latest.current.disabled) setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
      setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      setDragging(false);
      void take(Array.from(e.dataTransfer?.files ?? []));
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length === 0) return;
      // Text copied from Word, Excel or a web page comes with a picture of itself: that paste is the text's, and is left alone.
      const types = Array.from(e.clipboardData?.types ?? []);
      if (types.includes("text/plain") || types.includes("text/html")) return;
      e.preventDefault();
      void take(files);
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    el.addEventListener("paste", onPaste);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("paste", onPaste);
    };
  }, [r, ruleState.state, el]);

  return { ref: setEl, busy, dragging };
}

async function assetFromUpload(u: UploadedWithFacts, requirePublicUrl: boolean, needUrl: boolean): Promise<MediaAsset | null> {
  return assetOf(driveFileOf(u), requirePublicUrl, needUrl);
}
