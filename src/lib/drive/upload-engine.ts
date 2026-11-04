import { api, ApiError } from "@/lib/api";
import {
  abortUpload,
  completeUpload,
  initiateUpload,
  resumeUpload,
  type CompleteResponse,
  type InitiateResponse,
  type PartUrl,
  type ResumeResponse,
} from "@/lib/api/media-uploads";
import { sha256OfFile } from "./sha256";
import { captureVideoPoster, probeDimensions } from "./probe-file";

/**
 * Drive uploads (D4): multipart, direct to R2, resumable, with a per-file progress that does not depend on any screen.
 *
 * THE QUEUE LIVES AT MODULE LEVEL, NOT IN A COMPONENT. The tray is only a view of it: closing the tray, leaving the Drive page or
 * unmounting anything does not stop an upload, and the tray shows the live state when it comes back. (A browser reload ends it: a File
 * cannot be kept across one, which is why the api keeps the parts for 24 hours and a re-drop of the same file carries on from them.)
 *
 * One file goes through five steps:
 *   1. hash the whole file (the api answers "already in Drive" from it, with no upload);
 *   2. initiate: the api checks type, size and space BEFORE any byte moves, and returns a presigned URL per 8 MB part;
 *   3. send the parts straight to R2, three at a time, each retried with a wait; a part that keeps failing, or a URL that expired, asks the api
 *      which parts R2 already holds and carries on with the rest (that is the resume: nothing already sent is sent twice);
 *   4. complete: the api proves every part is there and makes the file;
 *   5. a video also sends one frame of itself as its poster, so the describer can see it. The poster is best effort: it never fails the video.
 *
 * Everything outside the browser (the api calls, the PUT, the hash, the frame) is a dependency, so the tests drive the whole machine with
 * fakes and no network.
 */

export type UploadStatus = "waiting" | "preparing" | "uploading" | "finishing" | "done" | "duplicate" | "failed" | "cancelled";

export type UploadKind = "image" | "video" | "document" | "other";

export interface UploadRow {
  id: string;
  /** What the person dropped. */
  filename: string;
  sizeBytes: number;
  kind: UploadKind;
  status: UploadStatus;
  /** 0..1 of the bytes sent. */
  progress: number;
  /** The file's id in Drive, once it exists (a duplicate answers the existing file's). */
  mediaId?: string;
  /** The name Drive holds it under (for a duplicate, the existing file's name kept or replaced by this one). */
  name?: string;
  publicUrl?: string;
  visibility?: "published" | "private";
  error?: string;
  /** Set on a failure that sending again will not fix (a full Drive, a type or size that is refused). */
  final?: boolean;
  /** Set when the failure is a full Drive, so the tray can offer space. */
  quotaFull?: boolean;
}

export interface UploadDeps {
  initiate: typeof initiateUpload;
  resume: typeof resumeUpload;
  complete: typeof completeUpload;
  abort: typeof abortUpload;
  putPart: (url: string, body: Blob, onLoaded: (loaded: number) => void, signal: AbortSignal) => Promise<void>;
  hash: (file: File) => Promise<string>;
  probe: (file: File) => Promise<{ width?: number; height?: number }>;
  poster: (file: File) => Promise<File | null>;
  attachPoster: (videoId: string, posterId: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  /** Files in flight at once. */
  fileConcurrency: number;
  /** Parts of one file in flight at once. */
  partConcurrency: number;
  /** Tries per part before the file asks the api what R2 holds. */
  partTries: number;
  /** How many times one file may ask the api what R2 holds before it gives up. */
  maxResumes: number;
}

/** Wait before try `n` (1-based after the first) of a part: 1 s, 2 s, 4 s. */
export const partBackoffMs = (attempt: number): number => 1000 * 2 ** (attempt - 1);

/** The PUT of one part, with progress. XHR, because fetch cannot report upload progress. */
export function xhrPutPart(url: string, body: Blob, onLoaded: (loaded: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onLoaded(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onLoaded(body.size);
        resolve();
      } else {
        reject(new PartError(xhr.status));
      }
    };
    xhr.onerror = () => reject(new PartError(0));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

export class PartError extends Error {
  constructor(public status: number) {
    super(status === 0 ? "The connection dropped" : `R2 answered ${status}`);
    this.name = "PartError";
  }
}

export const defaultDeps = (): UploadDeps => ({
  initiate: initiateUpload,
  resume: resumeUpload,
  complete: completeUpload,
  abort: abortUpload,
  putPart: xhrPutPart,
  hash: sha256OfFile,
  probe: probeDimensions,
  poster: captureVideoPoster,
  attachPoster: async (videoId, posterId) => {
    await api.patch(`/v1/media/${videoId}`, { posterMediaId: posterId });
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  fileConcurrency: 2,
  partConcurrency: 3,
  partTries: 3,
  maxResumes: 3,
});

interface Internal {
  file: File;
  controller: AbortController;
  visibility?: "published" | "private";
  hash?: string;
  dims?: { width?: number; height?: number };
  uploadId?: string;
  settle: Array<() => void>;
}

const kindOf = (mime: string): UploadKind => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime === "application/pdf" || mime.startsWith("text/") || mime.includes("officedocument") || mime.includes("msword") || mime.includes("ms-") ? "document" : "other");

/** The sentence a person reads when a file stops. Plain, with what to do next. */
export function failureMessage(err: unknown): { message: string; final: boolean; quotaFull: boolean } {
  if (err instanceof ApiError) {
    if (err.status === 402) return { message: err.message || "Your Drive is full. Add space or clear some files, then try again.", final: false, quotaFull: true };
    if (err.status === 413 || err.status === 415 || err.status === 400) return { message: err.message, final: true, quotaFull: false };
    if (err.status === 429) return { message: err.message || "Too many uploads are open at once. Let some finish, then try again.", final: false, quotaFull: false };
    if (err.status === 503) return { message: err.message || "Storage is busy. Try again in a moment.", final: false, quotaFull: false };
    return { message: err.message || "This file could not be uploaded.", final: false, quotaFull: false };
  }
  if (err instanceof PartError) return { message: "The connection dropped. Try again and it carries on from where it stopped.", final: false, quotaFull: false };
  return { message: "This file could not be uploaded. Try again.", final: false, quotaFull: false };
}

export class UploadQueue {
  private rows: UploadRow[] = [];
  private internal = new Map<string, Internal>();
  private listeners = new Set<() => void>();
  private doneListeners = new Set<(row: UploadRow) => void>();
  private active = 0;
  private seq = 0;

  /** How many files have ever been added: only goes up, so the tray can tell "new files arrived" from "the list got shorter". */
  getAddedCount = (): number => this.seq;

  constructor(private deps: UploadDeps = defaultDeps()) {}

  /** useSyncExternalStore: the same array until something changes. */
  getSnapshot = (): readonly UploadRow[] => this.rows;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  /** Called when a file settles as done or duplicate (so the page can refresh its list). */
  onDone(fn: (row: UploadRow) => void): () => void {
    this.doneListeners.add(fn);
    return () => this.doneListeners.delete(fn);
  }

  /** Add files. Returns their rows. Starts at once, up to `fileConcurrency` at a time. */
  add(files: File[], opts: { visibility?: "published" | "private" } = {}): UploadRow[] {
    const added = files.map((file): UploadRow => {
      const id = `u${++this.seq}`;
      this.internal.set(id, { file, controller: new AbortController(), settle: [], ...(opts.visibility ? { visibility: opts.visibility } : {}) });
      return { id, filename: file.name, sizeBytes: file.size, kind: kindOf(file.type), status: "waiting", progress: 0 };
    });
    this.rows = [...this.rows, ...added];
    this.emit();
    this.pump();
    return added;
  }

  /** Resolves when the file is done, a duplicate, failed or cancelled. */
  whenSettled(id: string): Promise<UploadRow> {
    return new Promise((resolve) => {
      const check = () => {
        const r = this.rows.find((x) => x.id === id);
        if (!r || ["done", "duplicate", "failed", "cancelled"].includes(r.status)) {
          resolve(r ?? { id, filename: "", sizeBytes: 0, kind: "other", status: "cancelled", progress: 0 });
          return true;
        }
        return false;
      };
      if (check()) return;
      const un = this.subscribe(() => {
        if (check()) un();
      });
    });
  }

  /** Try a failed file again. It carries on from the parts R2 already holds. */
  retry(id: string): void {
    const row = this.rows.find((r) => r.id === id);
    const i = this.internal.get(id);
    if (!row || !i || row.status !== "failed" || row.final) return;
    i.controller = new AbortController();
    this.patch(id, { status: "waiting", error: undefined, quotaFull: undefined });
    this.pump();
  }

  /** Stop a file. Its parts are thrown away at R2. */
  cancel(id: string): void {
    const row = this.rows.find((r) => r.id === id);
    const i = this.internal.get(id);
    if (!row || !i || ["done", "duplicate", "cancelled"].includes(row.status)) return;
    i.controller.abort();
    if (i.uploadId) void this.deps.abort(i.uploadId).catch(() => {});
    i.uploadId = undefined;
    this.patch(id, { status: "cancelled" });
  }

  /** Take finished, cancelled and refused rows off the list. */
  clearFinished(): void {
    const keep = this.rows.filter((r) => !(["done", "duplicate", "cancelled"].includes(r.status) || (r.status === "failed" && r.final)));
    for (const r of this.rows) if (!keep.includes(r)) this.internal.delete(r.id);
    this.rows = keep;
    this.emit();
  }

  get busy(): boolean {
    return this.rows.some((r) => ["waiting", "preparing", "uploading", "finishing"].includes(r.status));
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private patch(id: string, p: Partial<UploadRow>) {
    this.rows = this.rows.map((r) => (r.id === id ? { ...r, ...p } : r));
    this.emit();
  }

  private pump() {
    while (this.active < this.deps.fileConcurrency) {
      const next = this.rows.find((r) => r.status === "waiting");
      if (!next) return;
      this.active++;
      this.patch(next.id, { status: "preparing" });
      void this.run(next.id).finally(() => {
        this.active--;
        this.pump();
      });
    }
  }

  private async run(id: string): Promise<void> {
    const i = this.internal.get(id)!;
    try {
      const out = await this.upload(id, i, i.file, true);
      if (out === "cancelled") return;
      // The row may have been cleared from the tray while a poster was still going up: the page still needs to refresh its list.
      const row = this.rows.find((r) => r.id === id) ?? { id, filename: i.file.name, sizeBytes: i.file.size, kind: kindOf(i.file.type), status: "done" as const, progress: 1 };
      this.emitDone(row);
    } catch (err) {
      if (i.controller.signal.aborted) return;
      const f = failureMessage(err);
      this.patch(id, { status: "failed", error: f.message, final: f.final, ...(f.quotaFull ? { quotaFull: true } : {}) });
    }
  }

  private emitDone(row: UploadRow) {
    for (const l of this.doneListeners) l(row);
  }

  /**
   * One file, start to finish. `visible` rows report progress; a poster frame is uploaded the same way with no row of its own.
   * Returns the media id, or "cancelled".
   */
  private async upload(id: string | null, i: Internal, file: File, visible: boolean): Promise<string | "cancelled"> {
    const d = this.deps;
    const signal = i.controller.signal;
    const patch = (p: Partial<UploadRow>) => visible && id && this.patch(id, p);

    if (!i.hash) i.hash = await d.hash(file);
    if (signal.aborted) return "cancelled";
    if (!i.dims) i.dims = await d.probe(file).catch(() => ({}));

    // A retry first asks about the session it already has; a gone or expired one starts afresh.
    let session: { uploadId: string; partSize: number; partCount: number; parts: PartUrl[]; uploaded: number[] } | null = null;
    if (i.uploadId) {
      const r = await this.resumeOrNull(i.uploadId);
      if (r === "gone") i.uploadId = undefined;
      else session = r;
    }
    if (!session) {
      const init: InitiateResponse = await d.initiate({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        contentHash: i.hash,
        ...(i.visibility ? { visibility: i.visibility } : {}),
        ...(i.dims?.width ? { width: i.dims.width, height: i.dims.height } : {}),
      });
      if (signal.aborted) return "cancelled";
      if (init.deduped) {
        patch({ status: "duplicate", progress: 1, mediaId: init.mediaId, name: init.name, publicUrl: init.publicUrl, visibility: init.visibility });
        return init.mediaId;
      }
      i.uploadId = init.uploadId;
      session = { uploadId: init.uploadId, partSize: init.partSize, partCount: init.partCount, parts: init.parts, uploaded: [] };
    }

    patch({ status: "uploading" });
    const sent = new Map<number, number>(); // part number -> bytes sent so far
    const partBytes = (n: number) => Math.min(session!.partSize, file.size - (n - 1) * session!.partSize);
    for (const n of session.uploaded) sent.set(n, partBytes(n));
    const report = () => {
      let total = 0;
      for (const v of sent.values()) total += v;
      patch({ progress: Math.min(1, total / file.size) });
    };
    report();

    let todo = session.parts.filter((p) => !session!.uploaded.includes(p.partNumber));
    let resumes = 0;
    for (;;) {
      const failed: number[] = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < todo.length) {
          const part = todo[cursor++]!;
          const ok = await this.sendPart(file, part, session!.partSize, sent, report, signal);
          if (signal.aborted) return;
          if (!ok) failed.push(part.partNumber);
        }
      };
      await Promise.all(Array.from({ length: Math.min(d.partConcurrency, todo.length) }, worker));
      if (signal.aborted) return "cancelled";
      if (failed.length === 0) break;
      if (++resumes > d.maxResumes) throw new PartError(0);
      // Ask what R2 really holds, and get fresh URLs for the rest: the browser's memory is not trusted, and a URL may have expired.
      const r = await this.resumeOrNull(session.uploadId);
      if (r === "gone") {
        i.uploadId = undefined;
        throw new PartError(0);
      }
      session = { ...r, uploadId: session.uploadId };
      for (const n of r.uploaded) sent.set(n, partBytes(n));
      for (const n of failed) if (!r.uploaded.includes(n)) sent.set(n, 0);
      report();
      todo = r.parts.filter((p) => !r.uploaded.includes(p.partNumber));
      if (todo.length === 0) break;
    }

    patch({ status: "finishing", progress: 1 });
    const done: CompleteResponse = await d.complete(session.uploadId);
    i.uploadId = undefined;
    if (signal.aborted) return "cancelled";
    patch({ status: done.deduped ? "duplicate" : "done", mediaId: done.mediaId, name: done.name, publicUrl: done.publicUrl, visibility: done.visibility, progress: 1 });

    if (visible && !done.deduped && file.type.startsWith("video/")) await this.sendPoster(i, file, done.mediaId);
    return done.mediaId;
  }

  /**
   * Ask the api what R2 holds for an upload. "gone" when the session is no longer there (expired, or never ours): the caller starts afresh.
   * An upload whose parts are all in and already stitched answers "every part is in": there is nothing left to send, only to complete.
   */
  private async resumeOrNull(uploadId: string): Promise<{ uploadId: string; partSize: number; partCount: number; parts: PartUrl[]; uploaded: number[] } | "gone"> {
    try {
      const r: ResumeResponse = await this.deps.resume(uploadId);
      return { uploadId: r.uploadId, partSize: r.partSize, partCount: r.partCount, parts: r.parts, uploaded: r.uploaded.map((u) => u.partNumber) };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return { uploadId, partSize: 1, partCount: 0, parts: [], uploaded: [] };
      if (err instanceof ApiError && (err.status === 404 || err.status === 410)) return "gone";
      throw err;
    }
  }

  /** One part with its tries. Resolves false when every try failed (the caller resumes), true when R2 took it. */
  private async sendPart(file: File, part: PartUrl, partSize: number, sent: Map<number, number>, report: () => void, signal: AbortSignal): Promise<boolean> {
    const d = this.deps;
    const start = (part.partNumber - 1) * partSize;
    const blob = file.slice(start, Math.min(file.size, start + partSize));
    for (let attempt = 1; attempt <= d.partTries; attempt++) {
      if (signal.aborted) return false;
      try {
        await d.putPart(part.url, blob, (loaded) => {
          sent.set(part.partNumber, loaded);
          report();
        }, signal);
        sent.set(part.partNumber, blob.size);
        report();
        return true;
      } catch (err) {
        if (signal.aborted) return false;
        sent.set(part.partNumber, 0);
        report();
        // A refused URL (expired, wrong) will not work on a retry: ask for fresh ones now.
        if (err instanceof PartError && err.status === 403) return false;
        if (attempt < d.partTries) await d.sleep(partBackoffMs(attempt));
      }
    }
    return false;
  }

  private async sendPoster(i: Internal, video: File, videoId: string): Promise<void> {
    try {
      const frame = await this.deps.poster(video);
      if (!frame) return;
      const inner: Internal = { file: frame, controller: new AbortController(), settle: [] };
      const posterId = await this.upload(null, inner, frame, false);
      if (posterId === "cancelled") return;
      await this.deps.attachPoster(videoId, posterId);
    } catch {
      // The video is safe in Drive without a poster; the describer waits for one and counts no try.
    }
  }
}

/** The one queue the app uses. */
export const uploadQueue = new UploadQueue();

/** Thrown by {@link uploadToDrive} when the caller's signal cancelled the upload. */
export class UploadAborted extends Error {
  constructor() {
    super("Upload cancelled.");
    this.name = "UploadAborted";
  }
}

/** Thrown by {@link uploadToDrive} when a file stopped. The message is already the sentence for a person. */
export class UploadFailed extends Error {
  constructor(
    message: string,
    readonly final: boolean,
  ) {
    super(message);
    this.name = "UploadFailed";
  }
}

export interface UploadedFile {
  mediaId: string;
  name: string;
  publicUrl?: string;
  visibility: "published" | "private";
  sizeBytes: number;
  /** Drive already held this exact file; nothing was sent. */
  deduped: boolean;
  mimeType?: string;
}

export interface UploadOptions {
  /** Defaults by kind on the server: documents Private, everything else Published. */
  visibility?: "published" | "private";
  onProgress?: (p: { sent: number; total: number }) => void;
  signal?: AbortSignal;
  /** Test seam. */
  deps?: Partial<UploadDeps>;
}

/** The merchant's words for a file that stopped. */
export function uploadErrorMessage(err: unknown): string {
  if (err instanceof UploadAborted) return "Cancelled.";
  if (err instanceof UploadFailed) return err.message;
  return "That upload didn't finish. Check your connection and try again.";
}

/**
 * One file through the SAME machine as the tray (hash in slices, parts, resume, poster), on a queue of its own, resolved when it is in
 * Drive. For a screen that shows its own progress and must stop when it closes (the Drive picker): the file does not appear in the tray,
 * and aborting `signal` cancels it and throws {@link UploadAborted}.
 */
export async function uploadToDrive(file: File, opts: UploadOptions = {}): Promise<UploadedFile> {
  if (opts.signal?.aborted) throw new UploadAborted();
  const queue = new UploadQueue({ ...defaultDeps(), ...opts.deps });
  const [row] = queue.add([file], opts.visibility ? { visibility: opts.visibility } : {});
  const unsub = queue.subscribe(() => {
    const r = queue.getSnapshot()[0];
    if (r) opts.onProgress?.({ sent: Math.min(file.size, Math.floor(r.progress * file.size)), total: file.size });
  });
  const onAbort = () => queue.cancel(row!.id);
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const settled = await queue.whenSettled(row!.id);
    if (settled.status === "cancelled") throw new UploadAborted();
    if ((settled.status === "done" || settled.status === "duplicate") && settled.mediaId) {
      return {
        mediaId: settled.mediaId,
        name: settled.name ?? file.name,
        publicUrl: settled.publicUrl,
        visibility: settled.visibility ?? opts.visibility ?? "published",
        sizeBytes: file.size,
        deduped: settled.status === "duplicate",
        mimeType: file.type,
      };
    }
    throw new UploadFailed(settled.error ?? "This file could not be uploaded.", settled.final === true);
  } finally {
    unsub();
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
