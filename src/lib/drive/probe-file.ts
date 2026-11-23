/**
 * What the browser can read off a file before it is sent (Drive D4): an image's size, and one frame of a video to stand as its poster.
 * Browser-only (it uses Image, <video> and <canvas>); the arithmetic is in two small pure functions the tests cover.
 */

/** The longest side of a poster frame. Big enough for the describer to read a scene, small enough to be a few hundred KB. */
export const POSTER_MAX_SIDE = 1280;
/** A poster is one JPEG at this quality. */
export const POSTER_QUALITY = 0.85;

/** Scale `width` x `height` to fit inside `maxSide`, never up, keeping the ratio. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const k = maxSide / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/**
 * Where in a video to take the frame. The first frame of a video is often black or a title card, so one second in, or a tenth of the way
 * for a short clip, and never past the last frame.
 */
export function posterTime(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(1, durationSeconds * 0.1, Math.max(0, durationSeconds - 0.05));
}

const ABSENT = {};

/** What the browser can say of a file before it is sent: a picture's or video's shape, a video's length, a PDF's pages. Each is absent when it cannot be read. */
export interface FileMeasure {
  width?: number;
  height?: number;
  durationSeconds?: number;
  pageCount?: number;
}

/**
 * Pages in a PDF, read from its bytes with no library: the page tree's ROOT is the `/Type /Pages` dictionary with no `/Parent`, and its `/Count` is the
 * document's pages. A bookmark tree (`/Outlines`) also carries a `/Count`, and every inner node of the page tree carries a smaller one, so only a `/Pages`
 * dictionary without a `/Parent` is read; a PDF saved in increments keeps older roots, and the LAST one is the live one. A PDF that keeps its page tree inside a
 * compressed object stream (PDF 1.5 and later, often) shows no such dictionary in the clear: nothing is said then, and the limit is simply not checked (the
 * verdict is "not fully checked", never a refusal). Pure.
 */
export function pdfPageCountOf(text: string): number | undefined {
  let pages: number | undefined;
  for (const m of text.matchAll(/\/Type\s*\/Pages\b/g)) {
    const at = m.index ?? 0;
    const open = text.lastIndexOf("<<", at);
    const close = text.indexOf(">>", at);
    if (open < 0 || close < 0) continue;
    const dict = text.slice(open, close);
    if (/\/Parent\b/.test(dict)) continue;
    const count = /\/Count\s+(\d{1,6})\b/.exec(dict);
    if (count && Number(count[1]) >= 1) pages = Number(count[1]);
  }
  return pages;
}

/** The biggest PDF the browser reads for its pages (a larger one is not read, and its pages are not checked): the whole file is held as text while it is read. */
export const PDF_PROBE_MAX_BYTES = 40 * 1024 * 1024;

/** A PDF's page count, or nothing. */
export async function probePdfPages(file: File): Promise<number | undefined> {
  if (typeof window === "undefined" || file.type !== "application/pdf" || file.size > PDF_PROBE_MAX_BYTES) return undefined;
  try {
    return pdfPageCountOf(new TextDecoder("latin1").decode(await file.arrayBuffer()));
  } catch {
    return undefined;
  }
}

/** Width and height of an image file; width, height and length of a video; pages of a PDF. A file that is not readable answers nothing. */
export async function probeDimensions(file: File): Promise<FileMeasure> {
  if (typeof window === "undefined") return ABSENT;
  if (file.type === "application/pdf") {
    const pageCount = await probePdfPages(file);
    return pageCount !== undefined ? { pageCount } : ABSENT;
  }
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
    try {
      const bmp = await createImageBitmap(file);
      const out = { width: bmp.width, height: bmp.height };
      bmp.close();
      return out;
    } catch {
      return ABSENT;
    }
  }
  if (file.type.startsWith("video/")) {
    const v = await loadVideo(file).catch(() => null);
    if (!v) return ABSENT;
    const d = v.video.duration;
    const out = { width: v.video.videoWidth, height: v.video.videoHeight, ...(Number.isFinite(d) && d > 0 ? { durationSeconds: d } : {}) };
    v.dispose();
    return out.width > 0 ? out : ABSENT;
  }
  return ABSENT;
}

/** How long a video is, in seconds. Nothing for a file the browser cannot open (a codec it does not play), so the length is then simply not checked. */
export async function probeDuration(file: File): Promise<number | undefined> {
  if (typeof window === "undefined" || !file.type.startsWith("video/")) return undefined;
  const v = await loadVideo(file).catch(() => null);
  if (!v) return undefined;
  const d = v.video.duration;
  v.dispose();
  return Number.isFinite(d) && d > 0 ? d : undefined;
}

/** A video's shape and length from ONE decode of its metadata (a large video is not opened twice). Nothing for a file the browser cannot open. */
export async function probeVideo(file: File): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  if (typeof window === "undefined" || !file.type.startsWith("video/")) return {};
  const v = await loadVideo(file).catch(() => null);
  if (!v) return {};
  const { videoWidth, videoHeight, duration } = v.video;
  v.dispose();
  return {
    ...(videoWidth > 0 && videoHeight > 0 ? { width: videoWidth, height: videoHeight } : {}),
    ...(Number.isFinite(duration) && duration > 0 ? { durationSeconds: duration } : {}),
  };
}

interface LoadedVideo {
  video: HTMLVideoElement;
  dispose: () => void;
}

function loadVideo(file: File): Promise<LoadedVideo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    const dispose = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      dispose();
      reject(new Error("The video took too long to open"));
    }, 15_000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve({ video, dispose });
    };
    video.onerror = () => {
      clearTimeout(timer);
      dispose();
      reject(new Error("The browser cannot read this video"));
    };
    video.src = url;
  });
}

/**
 * One frame of a video, as a JPEG file the upload engine sends like any image. Resolves null when the browser cannot decode the video
 * (a codec it does not play): the video is then uploaded without a poster, never refused for it.
 */
export async function captureVideoPoster(file: File): Promise<File | null> {
  if (typeof window === "undefined") return null;
  const loaded = await loadVideo(file).catch(() => null);
  if (!loaded) return null;
  const { video, dispose } = loaded;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("seek timed out")), 15_000);
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("seek failed"));
      };
      video.currentTime = posterTime(video.duration);
    });
    const size = fitWithin(video.videoWidth, video.videoHeight, POSTER_MAX_SIDE);
    if (size.width <= 0 || size.height <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", POSTER_QUALITY));
    if (!blob) return null;
    const base = file.name.replace(/\.[^.]+$/, "") || "video";
    return new File([blob], `${base} poster.jpg`, { type: "image/jpeg" });
  } catch {
    return null;
  } finally {
    dispose();
  }
}
