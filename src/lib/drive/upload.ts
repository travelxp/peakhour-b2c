import { api, ApiError } from "@/lib/api";

/**
 * Upload a file to Drive straight to R2 (api row D2): the bytes never pass through our server, so Vercel's 4.5 MB body limit does not
 * apply. A few small JSON calls and N part PUTs:
 *
 *   POST   /v1/media/uploads            start (or answer "you already have this file" with no upload at all)
 *   PUT    <signed part URL> x N        the bytes, `partSize` at a time, retried
 *   GET    /v1/media/uploads/:id        resume: which parts R2 holds, and fresh URLs for the rest (a signed URL lasts an hour)
 *   POST   /v1/media/uploads/:id/complete
 *   DELETE /v1/media/uploads/:id        give up
 *
 * Every side effect is behind `UploadDeps`, so a test drives the whole sequence with no network.
 */

export interface InitiateBody {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  visibility?: "published" | "private";
  width?: number;
  height?: number;
}

export interface PartUrl {
  partNumber: number;
  url: string;
}

export type InitiateAnswer =
  | { deduped: true; mediaId: string; name: string; publicUrl?: string; visibility: "published" | "private"; sizeBytes: number }
  | {
      deduped: false;
      uploadId: string;
      visibility: "published" | "private";
      kind: string;
      partSize: number;
      partCount: number;
      parts: PartUrl[];
      expiresAt: string;
    };

export interface ResumeAnswer {
  uploadId: string;
  partSize: number;
  partCount: number;
  uploaded: Array<{ partNumber: number; size: number }>;
  parts: PartUrl[];
}

export interface CompleteAnswer {
  mediaId: string;
  name: string;
  publicUrl?: string;
  visibility: "published" | "private";
  sizeBytes: number;
  deduped: boolean;
}

export interface UploadedFile {
  mediaId: string;
  name: string;
  publicUrl?: string;
  visibility: "published" | "private";
  sizeBytes: number;
  /** Drive already held this exact file; nothing was sent. */
  deduped: boolean;
  /** The browser's own type for the file, so a caller can show it before the list refetches. */
  mimeType?: string;
}

export interface UploadDeps {
  initiate(body: InitiateBody): Promise<InitiateAnswer>;
  resume(uploadId: string): Promise<ResumeAnswer>;
  complete(uploadId: string): Promise<CompleteAnswer>;
  abort(uploadId: string): Promise<void>;
  /** PUT one part. Rejects on a non-2xx answer or a network error. `onBytes` reports bytes sent so far within this part. */
  putPart(url: string, body: Blob, onBytes: (sent: number) => void, signal?: AbortSignal): Promise<void>;
  sha256Hex(file: Blob): Promise<string>;
  measureImage(file: File): Promise<{ width: number; height: number } | undefined>;
}

export interface UploadOptions {
  /** Defaults by kind on the server: documents Private, everything else Published. */
  visibility?: "published" | "private";
  onProgress?: (p: { sent: number; total: number }) => void;
  signal?: AbortSignal;
  deps?: Partial<UploadDeps>;
  /** Tries per part before the upload is resumed from what R2 holds. */
  partAttempts?: number;
}

export class UploadAborted extends Error {
  constructor() {
    super("Upload cancelled.");
    this.name = "UploadAborted";
  }
}

export async function sha256HexOf(file: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("This browser cannot prepare a file for upload on an insecure page. Open the console over https.");
  const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function measureImageInBrowser(file: File): Promise<{ width: number; height: number } | undefined> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return undefined;
  try {
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch {
    return undefined;
  }
}

function putPartXhr(url: string, body: Blob, onBytes: (sent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadAborted());
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage answered ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("The connection dropped."));
    xhr.onabort = () => reject(new UploadAborted());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const liveDeps: UploadDeps = {
  initiate: (body) => api.post<InitiateAnswer>("/v1/media/uploads", body),
  resume: (id) => api.get<ResumeAnswer>(`/v1/media/uploads/${encodeURIComponent(id)}`),
  complete: (id) => api.post<CompleteAnswer>(`/v1/media/uploads/${encodeURIComponent(id)}/complete`, {}),
  abort: async (id) => {
    await api.delete(`/v1/media/uploads/${encodeURIComponent(id)}`);
  },
  putPart: putPartXhr,
  sha256Hex: sha256HexOf,
  measureImage: measureImageInBrowser,
};

/** The merchant's words for a refused upload: the api's own sentence, which names the limit or the plan, else a plain fallback. */
export function uploadErrorMessage(err: unknown): string {
  if (err instanceof UploadAborted) return "Cancelled.";
  if (err instanceof ApiError && err.message && err.message !== "Request failed") return err.message;
  return "That upload didn't finish. Check your connection and try again.";
}

export async function uploadToDrive(file: File, opts: UploadOptions = {}): Promise<UploadedFile> {
  const d: UploadDeps = { ...liveDeps, ...opts.deps };
  const attempts = opts.partAttempts ?? 3;
  const total = file.size;
  const check = () => {
    if (opts.signal?.aborted) throw new UploadAborted();
  };

  check();
  const [contentHash, size] = await Promise.all([d.sha256Hex(file), d.measureImage(file)]);
  check();
  const started = await d.initiate({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    contentHash,
    ...(opts.visibility ? { visibility: opts.visibility } : {}),
    ...(size ?? {}),
  });
  if (started.deduped) {
    opts.onProgress?.({ sent: total, total });
    return {
      mediaId: started.mediaId,
      name: started.name,
      publicUrl: started.publicUrl,
      visibility: started.visibility,
      sizeBytes: started.sizeBytes,
      deduped: true,
    };
  }

  const { uploadId, partSize } = started;
  /** Bytes of finished parts; the part in flight is counted live beside them, never both. */
  const done = new Map<number, number>();
  let inFlight = 0;
  const report = () => opts.onProgress?.({ sent: Math.min(total, [...done.values()].reduce((a, b) => a + b, 0) + inFlight), total });
  const sizeOf = (n: number) => Math.min(partSize, total - (n - 1) * partSize);

  async function send(parts: PartUrl[]): Promise<void> {
    for (const part of [...parts].sort((a, b) => a.partNumber - b.partNumber)) {
      if (done.has(part.partNumber)) continue;
      const from = (part.partNumber - 1) * partSize;
      const blob = file.slice(from, from + sizeOf(part.partNumber));
      let lastErr: unknown;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        check();
        try {
          inFlight = 0;
          await d.putPart(
            part.url,
            blob,
            (sent) => {
              inFlight = sent;
              report();
            },
            opts.signal,
          );
          inFlight = 0;
          done.set(part.partNumber, blob.size);
          report();
          lastErr = undefined;
          break;
        } catch (err) {
          inFlight = 0;
          if (err instanceof UploadAborted) throw err;
          lastErr = err;
        }
      }
      if (lastErr !== undefined) throw lastErr;
    }
  }

  try {
    try {
      await send(started.parts);
    } catch (err) {
      if (err instanceof UploadAborted) throw err;
      // A dropped connection or an expired link: ask R2 what it holds (the browser's memory is not trusted) and send what is missing.
      const r = await d.resume(uploadId);
      done.clear();
      for (const p of r.uploaded) done.set(p.partNumber, p.size);
      report();
      await send(r.parts);
    }
    check();
    const result = await d.complete(uploadId);
    opts.onProgress?.({ sent: total, total });
    return {
      mediaId: result.mediaId,
      name: result.name,
      publicUrl: result.publicUrl,
      visibility: result.visibility,
      sizeBytes: result.sizeBytes,
      deduped: result.deduped,
    };
  } catch (err) {
    // Resume already ran inside the try above, so a failure that reaches here is final for this attempt: throw the parts away rather
    // than leave an open session (a person holds at most 20) until it expires. Trying again starts a fresh upload.
    await d.abort(uploadId).catch(() => undefined);
    throw err;
  }
}
