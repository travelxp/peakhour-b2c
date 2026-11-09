import { api, newActionKey } from "@/lib/api";
import type { MediaAsset } from "@/components/composer/types";

/**
 * Generate an image to Drive (lane F): the picker's Generate tab on every screen, not only the Strategist's.
 *
 * `POST /v1/media/generate` is charged as the registered act `content.generate_image`, the same one the Strategist's image is, so the price the
 * tab shows is `usePeaksQuote(PEAKS_ACTIONS.generateImage)` and the receipt for it travels as `x-peaks-quote`. One key per click
 * (`newActionKey`) makes a retry or a double click of that click one charge. The api charges only an image that was stored.
 */

export type GenerateAspect = "1:1" | "16:9" | "4:5" | "9:16";

interface GeneratedImage {
  mediaId: string;
  name: string;
  mimeType: string;
  publicUrl?: string;
  width?: number;
  height?: number;
  deduped: boolean;
}

/**
 * The api stored nothing new: these bytes were already in Drive as a PRIVATE file, so there is no public link to hand a screen. The image WAS made
 * (the api answered 200), so this is not a failure to wave away: the picker tells the person where it is and does not say "you were not charged".
 */
export class GeneratedPrivateError extends Error {
  constructor(readonly mediaId: string) {
    super("That picture is already in Drive as a Private file, so we kept that one. Find it in the Drive tab.");
    this.name = "GeneratedPrivateError";
  }
}

export async function generateImageToDrive(args: { prompt: string; aspect?: GenerateAspect; quoteToken?: string }): Promise<MediaAsset> {
  const headers = { ...newActionKey(), ...(args.quoteToken ? { "x-peaks-quote": args.quoteToken } : {}) };
  const made = await api.post<GeneratedImage>("/v1/media/generate", { prompt: args.prompt, aspect: args.aspect ?? "1:1" }, headers);
  // The same picture can already be in Drive as a Private file; it then has no public link to hand to a screen that needs one.
  if (!made.publicUrl) throw new GeneratedPrivateError(made.mediaId);
  return {
    id: made.mediaId,
    url: made.publicUrl,
    name: made.name,
    mime: made.mimeType,
    ...(made.width ? { width: made.width } : {}),
    ...(made.height ? { height: made.height } : {}),
    visibility: "published",
    source: "ai_image",
    createdAt: new Date().toISOString(),
  };
}
