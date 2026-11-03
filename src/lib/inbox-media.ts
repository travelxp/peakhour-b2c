import { ApiError } from "@/lib/api";

/**
 * Inbox rich messages: what the conversation says about a photo, voice note or document, and what the composer lets a team member
 * attach, search and send. Kept apart from the markup so it can be tested without a DOM.
 *
 * Contract: peakhour-api "Inbox rich messages" (mongodb mig 875). The thread read gives each attachment as
 * `media: { ref, kind, mimeType, filename, bytes }`; `ref` is the only thing the media route takes (never a Meta id).
 * `GET /v1/meta/whatsapp/conversations/:threadId/media/:ref` returns the file; `POST .../reply-media` (multipart),
 * `.../send-product` and `.../send-checkout-link` send; `GET .../products?q=` searches this business's catalogue.
 */

export type MediaKind = "image" | "audio" | "video" | "document" | "sticker";

/** An attachment on a thread line, as the thread read returns it. */
export interface MessageMedia {
  ref: string;
  kind: MediaKind;
  mimeType: string | null;
  filename: string | null;
  bytes: number | null;
}

export function mediaPath(threadId: string, ref: string): string {
  return `/v1/meta/whatsapp/conversations/${encodeURIComponent(threadId)}/media/${encodeURIComponent(ref)}`;
}

/** What the tap-to-open button says. Click to load: a thread of photos must not fetch fifty files on open. */
export function mediaActionLabel(m: Pick<MessageMedia, "kind" | "filename" | "mimeType">): string {
  switch (m.kind) {
    case "image":
      return "View photo";
    case "audio":
      return /^audio\/ogg(?![a-z0-9.+-])/i.test(m.mimeType ?? "") ? "Play voice note" : "Play audio";
    case "video":
      return "Play video";
    case "sticker":
      return "View sticker";
    case "document":
      return m.filename ? `Download ${m.filename}` : "Download document";
  }
}

/** The file size in words: "2.4 MB". Empty when unknown. */
export function humanBytes(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * What a failed open says, and what to do. The api's own sentence is used where it has one (it knows about the 30 days WhatsApp keeps
 * files, the reconnect, the size limit); a lost connection gets a retry.
 */
export function mediaOpenError(err: unknown): string {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message && err.message !== "Request failed") return err.message;
  if (err instanceof ApiError && err.code === "MEDIA_UNAVAILABLE" && err.message) return err.message;
  return "We couldn't open this file. Check your connection and press the button to try again.";
}

// ── What can be attached ─────────────────────────────────────────────────────────────────────────────────────────

export const ATTACH_ACCEPT = "image/jpeg,image/png,application/pdf";
/** The api's limit (`OUTBOUND_MAX_BYTES`): under WhatsApp's 5 MB image limit and the hosting platform's request size. */
export const ATTACH_MAX_BYTES = 4 * 1024 * 1024;
/** WhatsApp's caption limit. */
export const CAPTION_MAX = 1024;
const ATTACH_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
export const ATTACH_TYPES_COPY = "Only JPEG or PNG images and PDF files can be sent.";

/** Why a chosen file cannot be sent, or null. The api judges the bytes again; this is the instant answer. */
export function attachmentProblem(f: { type: string; size: number }): string | null {
  if (!ATTACH_TYPES.has((f.type || "").split(";")[0]!.trim().toLowerCase())) return ATTACH_TYPES_COPY;
  if (f.size === 0) return "That file is empty.";
  if (f.size > ATTACH_MAX_BYTES) return `That file is ${humanBytes(f.size)}. The most that can be sent is 4 MB, so choose a smaller one${f.type.startsWith("image/") ? " or reduce the photo's size" : ""}.`;
  return null;
}

export function captionProblem(caption: string): string | null {
  return caption.trim().length > CAPTION_MAX ? `A caption can have at most ${CAPTION_MAX} characters (this has ${caption.trim().length}).` : null;
}

// ── Send a product / a checkout link ─────────────────────────────────────────────────────────────────────────────

/** One product of this business's catalogue (`GET .../products`). */
export interface ProductHit {
  productId: string;
  title: string;
  image: string | null;
  price: string | null;
  variants: Array<{ id: string; title: string; price: string | null; available: boolean }>;
}

export const CHECKOUT_MAX_LINES = 10;
export const CHECKOUT_MAX_QTY = 50;

export interface CheckoutLine {
  productId: string;
  title: string;
  variantId: string;
  variantTitle: string;
  quantity: number;
}

/** The option a product starts on: its first one that is in stock. Null when every option is sold out (or there are none). */
export function defaultVariant(p: ProductHit): ProductHit["variants"][number] | null {
  return p.variants.find((v) => v.available) ?? null;
}

/**
 * Add a product option to the link: the same option twice adds its quantity (up to the limit) rather than making a second line, a
 * sold-out or unknown option is refused, and a full link refuses another product. Returns the new lines, or the reason.
 */
export function addCheckoutLine(
  lines: CheckoutLine[],
  p: ProductHit,
  variantId: string,
  quantity: number,
): { ok: true; lines: CheckoutLine[] } | { ok: false; reason: string } {
  const v = p.variants.find((x) => x.id === variantId);
  if (!v) return { ok: false, reason: "Choose an option for this product." };
  if (!v.available) return { ok: false, reason: `${p.title} (${v.title}) is sold out, so it can't go on a checkout link.` };
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: "The quantity must be at least 1." };
  const at = lines.findIndex((l) => l.productId === p.productId && l.variantId === variantId);
  if (at >= 0) {
    const total = lines[at]!.quantity + quantity;
    if (total > CHECKOUT_MAX_QTY) return { ok: false, reason: `At most ${CHECKOUT_MAX_QTY} of one product on a link.` };
    return { ok: true, lines: lines.map((l, i) => (i === at ? { ...l, quantity: total } : l)) };
  }
  if (lines.length >= CHECKOUT_MAX_LINES) return { ok: false, reason: `At most ${CHECKOUT_MAX_LINES} products on one link.` };
  if (quantity > CHECKOUT_MAX_QTY) return { ok: false, reason: `At most ${CHECKOUT_MAX_QTY} of one product on a link.` };
  return { ok: true, lines: [...lines, { productId: p.productId, title: p.title, variantId, variantTitle: v.title, quantity }] };
}

export function removeCheckoutLine(lines: CheckoutLine[], productId: string, variantId: string): CheckoutLine[] {
  return lines.filter((l) => !(l.productId === productId && l.variantId === variantId));
}

/** The items the api takes. */
export function checkoutItems(lines: CheckoutLine[]): Array<{ productId: string; variantId: string; quantity: number }> {
  return lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
}

/** The line a basket row shows. */
export function checkoutLineLabel(l: CheckoutLine, optionCount: number): string {
  return `${l.title}${optionCount > 1 && l.variantTitle ? ` (${l.variantTitle})` : ""} x${l.quantity}`;
}

/** What the composer says is about to happen, so a send is never a surprise. */
export const RICH_SEND_NOTE = "Sending this pauses the assistant on this conversation, like any reply.";
export const CHECKOUT_NOTE = "The link opens your store's own checkout with these items in the cart.";
export const PRODUCT_SEARCH_EMPTY = "No products match. Try a different word, or clear the search to see your newest products.";
