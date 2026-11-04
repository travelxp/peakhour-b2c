import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  ATTACH_MAX_BYTES,
  ATTACH_TYPES_COPY,
  CAPTION_MAX,
  CHECKOUT_MAX_LINES,
  CHECKOUT_MAX_QTY,
  addCheckoutLine,
  attachmentProblem,
  captionProblem,
  checkoutItems,
  checkoutLineLabel,
  defaultVariant,
  humanBytes,
  mediaActionLabel,
  mediaOpenError,
  mediaPath,
  removeCheckoutLine,
  type CheckoutLine,
  type ProductHit,
} from "@/lib/inbox-media";
import { replyErrorCopy, replyRequest, replySignature, type ReplyPayload } from "@/lib/wa-inbox-reply";

const TEE: ProductHit = {
  productId: "a".repeat(24),
  title: "Black Tee",
  image: null,
  price: "999.00 INR",
  variants: [
    { id: "111", title: "M", price: "999.00", available: true },
    { id: "112", title: "L", price: "999.00", available: false },
  ],
};
const SOLD_OUT: ProductHit = { ...TEE, productId: "b".repeat(24), variants: [{ id: "211", title: "S", price: "1.00", available: false }] };

describe("what the bubble offers for an attachment", () => {
  it("names the action for each kind; a document names its file", () => {
    expect(mediaActionLabel({ kind: "image", filename: null, mimeType: "image/jpeg" })).toBe("View photo");
    expect(mediaActionLabel({ kind: "audio", filename: null, mimeType: "audio/ogg; codecs=opus" })).toBe("Play voice note");
    expect(mediaActionLabel({ kind: "audio", filename: null, mimeType: "audio/mpeg" })).toBe("Play audio");
    expect(mediaActionLabel({ kind: "video", filename: null, mimeType: "video/mp4" })).toBe("Play video");
    expect(mediaActionLabel({ kind: "sticker", filename: null, mimeType: "image/webp" })).toBe("View sticker");
    expect(mediaActionLabel({ kind: "document", filename: "invoice.pdf", mimeType: "application/pdf" })).toBe("Download invoice.pdf");
    expect(mediaActionLabel({ kind: "document", filename: null, mimeType: null })).toBe("Download document");
  });

  it("the route is the thread's own, with both parts encoded", () => {
    expect(mediaPath("whatsapp:1:abc", "f".repeat(64))).toBe(`/v1/meta/whatsapp/conversations/whatsapp%3A1%3Aabc/media/${"f".repeat(64)}`);
    expect(mediaPath("a/b", "x y")).toBe("/v1/meta/whatsapp/conversations/a%2Fb/media/x%20y");
  });

  it("sizes are in words, and unknown is empty", () => {
    expect(humanBytes(512)).toBe("512 B");
    expect(humanBytes(2048)).toBe("2 KB");
    expect(humanBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(humanBytes(null)).toBe("");
    expect(humanBytes(-1)).toBe("");
    expect(humanBytes(Number.NaN)).toBe("");
  });

  it("a refused open says the api's own sentence (30 days, reconnect, size); a lost connection says what to do", () => {
    expect(mediaOpenError(new ApiError("MEDIA_EXPIRED", "WhatsApp no longer has this file. It keeps photos for 30 days.", 404))).toContain("30 days");
    expect(mediaOpenError(new ApiError("WHATSAPP_UNAVAILABLE", "WhatsApp needs to be reconnected.", 409))).toContain("reconnected");
    expect(mediaOpenError(new ApiError("MEDIA_UNAVAILABLE", "This file is too large to open here (the limit is 16 MB).", 502))).toContain("16 MB");
    const lost = mediaOpenError(new TypeError("Failed to fetch"));
    expect(lost).toContain("try again");
    expect(mediaOpenError(new ApiError("REQUEST_FAILED", "Request failed", 404))).toBe(lost);
  });
});

describe("what can be attached", () => {
  const f = (type: string, size: number) => ({ type, size });
  it("JPEG, PNG and PDF up to 4 MB pass; 4 MB + 1 byte does not", () => {
    for (const t of ["image/jpeg", "image/png", "application/pdf"]) expect(attachmentProblem(f(t, 1000)), t).toBeNull();
    expect(attachmentProblem(f("image/jpeg", ATTACH_MAX_BYTES))).toBeNull();
    expect(attachmentProblem(f("image/jpeg", ATTACH_MAX_BYTES + 1))).toContain("choose a smaller one or reduce the photo's size");
    expect(attachmentProblem(f("application/pdf", ATTACH_MAX_BYTES + 1))).toContain("choose a smaller one.");
    expect(attachmentProblem(f("application/pdf", ATTACH_MAX_BYTES + 1))).not.toContain("photo");
  });

  it("every other type says what is allowed", () => {
    for (const t of ["image/gif", "image/svg+xml", "application/msword", "text/html", "", "video/mp4"]) expect(attachmentProblem(f(t, 10)), t).toBe(ATTACH_TYPES_COPY);
    expect(ATTACH_TYPES_COPY).toBe("Only JPEG or PNG images and PDF files can be sent.");
  });

  it("a type with parameters or capitals is the same type; an empty file is refused", () => {
    expect(attachmentProblem(f("Image/JPEG; q=1", 10))).toBeNull();
    expect(attachmentProblem(f("image/png", 0))).toBe("That file is empty.");
  });

  it("a caption is limited to WhatsApp's 1024 characters, counted trimmed", () => {
    expect(captionProblem("x".repeat(CAPTION_MAX))).toBeNull();
    expect(captionProblem(`  ${"x".repeat(CAPTION_MAX)}  `)).toBeNull();
    expect(captionProblem("x".repeat(CAPTION_MAX + 1))).toContain("1024");
    expect(captionProblem("")).toBeNull();
  });
});

describe("the checkout link's basket", () => {
  const add = (lines: CheckoutLine[], p: ProductHit, v: string, q: number) => {
    const r = addCheckoutLine(lines, p, v, q);
    if (!r.ok) throw new Error(r.reason);
    return r.lines;
  };

  it("starts on the first option in stock; a product with none in stock has no start", () => {
    expect(defaultVariant(TEE)?.id).toBe("111");
    expect(defaultVariant(SOLD_OUT)).toBeNull();
    expect(defaultVariant({ ...TEE, variants: [] })).toBeNull();
  });

  it("adds a line, and the same option again adds to its quantity instead of making a second line", () => {
    const one = add([], TEE, "111", 2);
    expect(one).toEqual([{ productId: TEE.productId, title: "Black Tee", variantId: "111", variantTitle: "M", quantity: 2 }]);
    const two = add(one, TEE, "111", 3);
    expect(two).toHaveLength(1);
    expect(two[0]!.quantity).toBe(5);
  });

  it("refuses a sold-out option, an unknown option, a zero quantity and a fraction, each with a reason", () => {
    expect(addCheckoutLine([], TEE, "112", 1)).toEqual({ ok: false, reason: "Black Tee (L) is sold out, so it can't go on a checkout link." });
    expect(addCheckoutLine([], TEE, "999", 1)).toEqual({ ok: false, reason: "Choose an option for this product." });
    expect(addCheckoutLine([], TEE, "111", 0)).toEqual({ ok: false, reason: "The quantity must be at least 1." });
    expect(addCheckoutLine([], TEE, "111", 1.5)).toEqual({ ok: false, reason: "The quantity must be at least 1." });
  });

  it("holds at 50 of one option and 10 lines, as the api does", () => {
    const fifty = add([], TEE, "111", CHECKOUT_MAX_QTY);
    expect(addCheckoutLine(fifty, TEE, "111", 1).ok).toBe(false);
    expect(addCheckoutLine([], TEE, "111", CHECKOUT_MAX_QTY + 1).ok).toBe(false);
    let lines: CheckoutLine[] = [];
    for (let i = 0; i < CHECKOUT_MAX_LINES; i++) lines = add(lines, { ...TEE, productId: String(i).padStart(24, "0") }, "111", 1);
    const full = addCheckoutLine(lines, { ...TEE, productId: "f".repeat(24) }, "111", 1);
    expect(full).toEqual({ ok: false, reason: "At most 10 products on one link." });
    // the same option again still adds to a full link
    expect(addCheckoutLine(lines, { ...TEE, productId: "0".repeat(24) }, "111", 1).ok).toBe(true);
  });

  it("removes exactly one line and sends only what the api takes", () => {
    const lines = add(add([], TEE, "111", 2), { ...TEE, productId: "c".repeat(24) }, "111", 1);
    expect(removeCheckoutLine(lines, TEE.productId, "111")).toHaveLength(1);
    expect(removeCheckoutLine(lines, TEE.productId, "112")).toHaveLength(2);
    expect(checkoutItems(lines)).toEqual([
      { productId: TEE.productId, variantId: "111", quantity: 2 },
      { productId: "c".repeat(24), variantId: "111", quantity: 1 },
    ]);
  });

  it("a basket row names the option only when the product has more than one", () => {
    const l = add([], TEE, "111", 2)[0]!;
    expect(checkoutLineLabel(l, 2)).toBe("Black Tee (M) x2");
    expect(checkoutLineLabel(l, 1)).toBe("Black Tee x2");
  });
});

describe("the composer's new payloads go through the same idempotency rules as a text", () => {
  const MEDIA_ID = "a".repeat(24);
  const file = { name: "tee.jpg", size: 1234, type: "image/jpeg" };
  const media: ReplyPayload = { kind: "media", mediaId: MEDIA_ID, file, caption: " Here " };
  const product: ReplyPayload = { kind: "product", productId: "A".repeat(24) };
  const checkout: ReplyPayload = { kind: "checkout", items: [{ productId: "A".repeat(24), variantId: "111", quantity: 2 }] };

  it("the same choice has the same signature (so the same key); another Drive file, caption, product or quantity has another", () => {
    expect(replySignature(media)).toBe(replySignature({ kind: "media", mediaId: MEDIA_ID.toUpperCase(), file, caption: "Here" }));
    expect(replySignature(media)).not.toBe(replySignature({ kind: "media", mediaId: "b".repeat(24), file, caption: " Here " }));
    expect(replySignature(media)).not.toBe(replySignature({ kind: "media", mediaId: MEDIA_ID, file, caption: "Other" }));
    expect(replySignature(product)).toBe(replySignature({ kind: "product", productId: "a".repeat(24) }));
    expect(replySignature(product)).not.toBe(replySignature({ kind: "product", productId: "b".repeat(24) }));
    expect(replySignature(checkout)).not.toBe(replySignature({ kind: "checkout", items: [{ productId: "A".repeat(24), variantId: "111", quantity: 3 }] }));
    expect(new Set([replySignature(media), replySignature(product), replySignature(checkout), replySignature({ kind: "text", text: "x" })]).size).toBe(4);
  });

  it("a product and a checkout link go to their own routes with the key; an attachment names its Drive file", () => {
    expect(replyRequest("whatsapp:1:abc", product, "key-0000001")).toEqual({
      path: "/v1/meta/whatsapp/conversations/whatsapp%3A1%3Aabc/send-product",
      body: { productId: "A".repeat(24), idempotencyKey: "key-0000001" },
    });
    expect(replyRequest("whatsapp:1:abc", checkout, "key-0000002")).toEqual({
      path: "/v1/meta/whatsapp/conversations/whatsapp%3A1%3Aabc/send-checkout-link",
      body: { items: [{ productId: "A".repeat(24), variantId: "111", quantity: 2 }], idempotencyKey: "key-0000002" },
    });
    expect(replyRequest("whatsapp:1:abc", media, "key-0000003")).toEqual({
      path: "/v1/meta/whatsapp/conversations/whatsapp%3A1%3Aabc/reply-media",
      body: { mediaId: MEDIA_ID, caption: "Here", idempotencyKey: "key-0000003" },
    });
    // no caption: the key is absent, not an empty string
    const bare = replyRequest("t", { kind: "media", mediaId: MEDIA_ID, file }, "key-0000004");
    expect(bare.body).toEqual({ mediaId: MEDIA_ID, idempotencyKey: "key-0000004" });
    expect(replyRequest("t", { kind: "media", mediaId: MEDIA_ID, file, caption: "   " }, "key-0000005").body).not.toHaveProperty("caption");
  });

  it("each refusal before the send says nothing was sent, and the next try gets a fresh key", () => {
    for (const [code, kind, title] of [
      ["MEDIA_REFUSED", "media", "This file can't be sent"],
      ["PRODUCT_NOT_FOUND", "product", "That product isn't in your catalogue any more"],
      ["CHECKOUT_UNAVAILABLE", "checkout", "A checkout link can't be built for this"],
    ] as const) {
      const c = replyErrorCopy(new ApiError(code, "The api's reason.", 400), kind);
      expect(c.title).toBe(title);
      expect(c.detail).toContain("The api's reason.");
      expect(c.detail).toContain("Nothing was sent.");
      expect(c.attempt).toBe("fresh");
    }
  });

  it("a validation refusal of a card, a link or a file speaks for that, not for a text length", () => {
    for (const kind of ["media", "product", "checkout"] as const) {
      const c = replyErrorCopy(new ApiError("VALIDATION_ERROR", "Pick at least one product", 400), kind);
      expect(c.detail).toBe("Pick at least one product Nothing was sent.");
      expect(c.detail).not.toContain("4,096");
    }
    expect(replyErrorCopy(new ApiError("VALIDATION_ERROR", "x", 400), "text").detail).toContain("4,096");
  });

  it("the window closing mid-way is the same refusal as for a text", () => {
    const c = replyErrorCopy(new ApiError("OUTSIDE_24H", "Use a template.", 409), "media");
    expect(c.closesWindow).toBe(true);
    expect(c.detail).toContain("Nothing was sent.");
  });
});
