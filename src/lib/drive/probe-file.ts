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

/** Width and height of an image file. A file that is not a readable image (or not an image) answers nothing. */
export async function probeDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (typeof window === "undefined") return ABSENT;
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
    const out = { width: v.video.videoWidth, height: v.video.videoHeight };
    v.dispose();
    return out.width > 0 ? out : ABSENT;
  }
  return ABSENT;
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
