"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInboxProducts } from "@/hooks/use-wa-conversations";
import {
  ATTACH_ACCEPT,
  CAPTION_MAX,
  CHECKOUT_MAX_LINES,
  CHECKOUT_NOTE,
  PRODUCT_SEARCH_EMPTY,
  addCheckoutLine,
  attachmentProblem,
  captionProblem,
  checkoutItems,
  checkoutLineLabel,
  defaultVariant,
  humanBytes,
  removeCheckoutLine,
  type CheckoutLine,
  type ProductHit,
} from "@/lib/inbox-media";
import { replySignature, type ReplyPayload } from "@/lib/wa-inbox-reply";

/**
 * Inbox rich messages: the composer's three extra ways to answer a shopper, shown only while the 24-hour window is open (an image, a
 * product card and a checkout link are free-form messages, like text).
 *
 *  - **Attach an image or PDF** (JPEG, PNG or PDF, up to 4 MB), with an optional caption.
 *  - **Send a product**: search this store's catalogue and send the product as a card (its photo, name, price and link).
 *  - **Send a checkout link**: pick products, options and quantities and send a link to the store's own checkout with them in the cart.
 *
 * ★MARKUP ONLY. What a file may be, what a basket does and what each refusal says are `lib/inbox-media.ts` and `lib/wa-inbox-reply.ts`'s,
 * tested there. A send goes through the composer's own `onSend`, so it has the same idempotency key, double-click guard and error card
 * as a text reply. `onSend` answers whether it was sent; a panel clears only then, so a refused send keeps what the person chose.
 */
type SendFn = (payload: ReplyPayload, file?: Blob) => Promise<boolean>;

/** The label of a send button: "Send again anyway" when THIS exact send is the one whose outcome is unknown (the press is the confirmation). */
function sendLabel(payload: ReplyPayload, unknownSig: string | null, idle: string, busy: boolean): string {
  if (busy) return "Sending…";
  return unknownSig !== null && replySignature(payload) === unknownSig ? "Send again anyway" : idle;
}

/**
 * ★A SEND WHOSE OUTCOME IS UNKNOWN BLOCKS A DIFFERENT SEND. The composer keeps one attempt per thread, so sending something else would
 * drop the "may already have reached the shopper" guard on the first and let it go out twice. Only the very same send may be pressed
 * again (its label says "Send again anyway"); anything else waits until the person has looked at the conversation.
 */
const blocked = (payload: ReplyPayload, unknownSig: string | null): boolean => unknownSig !== null && replySignature(payload) !== unknownSig;
export const UNKNOWN_BLOCK_NOTE = "A message you sent may not have arrived. Check the conversation before sending something else, or press Send again anyway on that message.";

export function WaRichSend({ threadId, disabled, unknownSig, onSend }: { threadId: string; disabled: boolean; unknownSig: string | null; onSend: SendFn }) {
  const [mode, setMode] = useState<"product" | "checkout" | null>(null);
  return (
    <div className="space-y-2" data-testid="rich-send">
      {unknownSig !== null && <p className="text-[11px] text-muted-foreground">{UNKNOWN_BLOCK_NOTE}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <AttachButton disabled={disabled} unknownSig={unknownSig} onSend={onSend} />
        <Button size="xs" variant={mode === "product" ? "secondary" : "outline"} disabled={disabled} onClick={() => setMode(mode === "product" ? null : "product")}>
          Send a product
        </Button>
        <Button size="xs" variant={mode === "checkout" ? "secondary" : "outline"} disabled={disabled} onClick={() => setMode(mode === "checkout" ? null : "checkout")}>
          Send a checkout link
        </Button>
      </div>
      {mode && <ProductPanel key={mode} mode={mode} threadId={threadId} disabled={disabled} unknownSig={unknownSig} onSend={onSend} onDone={() => setMode(null)} />}
    </div>
  );
}

const attachPayload = (file: File, caption: string): ReplyPayload => ({
  kind: "media",
  file: { name: file.name, size: file.size, lastModified: file.lastModified, type: file.type },
  ...(caption.trim() ? { caption } : {}),
});

/** "Attach image or PDF": choose, check at once, add a caption, send. Nothing leaves until Send file is pressed. */
function AttachButton({ disabled, unknownSig, onSend }: { disabled: boolean; unknownSig: string | null; onSend: SendFn }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const captionIssue = captionProblem(caption);

  function choose(f: File | undefined) {
    if (!f) return;
    const p = attachmentProblem(f);
    setProblem(p);
    // a refused pick leaves the file already staged (and its caption) as it was
    if (!p) setFile(f);
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ATTACH_ACCEPT}
        className="hidden"
        aria-label="Choose an image or PDF to send"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          // the same file chosen again must fire again
          e.target.value = "";
        }}
      />
      <Button size="xs" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
        Attach image or PDF
      </Button>
      {problem && (
        <p role="alert" className="basis-full text-xs text-warning-on-tint">
          {problem}
        </p>
      )}
      {file && (
        <div className="basis-full space-y-1.5 rounded-md border bg-muted/30 p-2" data-testid="attachment">
          <p className="text-xs">
            <span className="font-medium">{file.name}</span> <span className="text-muted-foreground">({humanBytes(file.size)})</span>
          </p>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption (optional)" aria-label="Caption for the file" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{captionIssue ?? `${caption.trim().length}/${CAPTION_MAX}`}</span>
            <span className="flex gap-2">
              <Button size="xs" variant="ghost" disabled={disabled} onClick={() => { setFile(null); setCaption(""); }}>
                Remove
              </Button>
              <Button
                size="xs"
                disabled={disabled || Boolean(captionIssue) || blocked(attachPayload(file, caption), unknownSig)}
                onClick={async () => {
                  const sent = await onSend(attachPayload(file, caption), file);
                  if (sent) {
                    setFile(null);
                    setCaption("");
                  }
                }}
              >
                {sendLabel(attachPayload(file, caption), unknownSig, "Send file", disabled)}
              </Button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/** The catalogue search, for both "Send a product" (send one card) and "Send a checkout link" (build a basket). */
function ProductPanel({ mode, threadId, disabled, unknownSig, onSend, onDone }: { mode: "product" | "checkout"; threadId: string; disabled: boolean; unknownSig: string | null; onSend: SendFn; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [lines, setLines] = useState<CheckoutLine[]>([]);
  const [note, setNote] = useState<string | null>(null);
  // the search runs a moment after the person stops typing
  useEffect(() => {
    const t = setTimeout(() => setAsked(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const products = useInboxProducts(threadId, asked, true);
  const hits = products.data?.products ?? [];
  const optionCounts = new Map(hits.map((p) => [p.productId, p.variants.length]));

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2" data-testid={`rich-${mode}`}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your products" aria-label="Search your products" maxLength={100} />
      {mode === "checkout" && <p className="text-[11px] text-muted-foreground">{CHECKOUT_NOTE}</p>}
      {products.isLoading && <Skeleton className="h-10 w-full" />}
      {products.isError && (
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t load your products.{" "}
          <button className="underline underline-offset-2" onClick={() => void products.refetch()}>
            Try again
          </button>
        </p>
      )}
      {products.isSuccess && hits.length === 0 && <p className="text-xs text-muted-foreground">{PRODUCT_SEARCH_EMPTY}</p>}
      <ul className="max-h-56 space-y-1.5 overflow-y-auto">
        {hits.map((p) => (
          <ProductRow
            key={p.productId}
            p={p}
            mode={mode}
            disabled={disabled || blocked({ kind: "product", productId: p.productId }, unknownSig)}
            cardLabel={sendLabel({ kind: "product", productId: p.productId }, unknownSig, "Send card", false)}
            onCard={async () => {
              if (await onSend({ kind: "product", productId: p.productId })) onDone();
            }}
            onAdd={(variantId, qty) => {
              const r = addCheckoutLine(lines, p, variantId, qty);
              setNote(r.ok ? null : r.reason);
              if (r.ok) setLines(r.lines);
            }}
          />
        ))}
      </ul>
      {note && (
        <p role="alert" className="text-xs text-warning-on-tint">
          {note}
        </p>
      )}
      {mode === "checkout" && lines.length > 0 && (
        <div className="space-y-1.5 border-t pt-2" data-testid="basket">
          <ul className="space-y-1 text-xs">
            {lines.map((l) => (
              <li key={`${l.productId}:${l.variantId}`} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{checkoutLineLabel(l, optionCounts.get(l.productId) ?? 2)}</span>
                <Button size="xs" variant="ghost" disabled={disabled} onClick={() => setLines(removeCheckoutLine(lines, l.productId, l.variantId))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {lines.length}/{CHECKOUT_MAX_LINES} products
            </span>
            <Button
              size="xs"
              disabled={disabled || blocked({ kind: "checkout", items: checkoutItems(lines) }, unknownSig)}
              onClick={async () => {
                if (await onSend({ kind: "checkout", items: checkoutItems(lines) })) onDone();
              }}
            >
              {sendLabel({ kind: "checkout", items: checkoutItems(lines) }, unknownSig, "Send checkout link", disabled)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({ p, mode, disabled, cardLabel, onCard, onAdd }: { p: ProductHit; mode: "product" | "checkout"; disabled: boolean; cardLabel: string; onCard: () => void; onAdd: (variantId: string, qty: number) => void }) {
  const start = defaultVariant(p);
  const [variantId, setVariantId] = useState(start?.id ?? "");
  const [qty, setQty] = useState("1");
  const soldOut = p.variants.length > 0 && !start;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md bg-background p-1.5">
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- the store's own product photo, already on its CDN
        <img src={p.image} alt="" className="size-9 shrink-0 rounded object-cover" />
      ) : (
        <span className="size-9 shrink-0 rounded bg-muted" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{p.title}</span>
        <span className="block text-[11px] text-muted-foreground">{soldOut ? "Sold out" : (p.price ?? "No price")}</span>
      </span>
      {mode === "product" ? (
        <Button size="xs" disabled={disabled} onClick={onCard}>
          {cardLabel}
        </Button>
      ) : (
        <span className="flex items-center gap-1.5">
          {p.variants.length > 1 && (
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger className="h-7 w-32 text-xs" aria-label={`Option for ${p.title}`}>
                <SelectValue placeholder="Option" />
              </SelectTrigger>
              <SelectContent>
                {p.variants.map((v) => (
                  <SelectItem key={v.id} value={v.id} disabled={!v.available}>
                    {v.title}
                    {v.available ? "" : " (sold out)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            className="h-7 w-12 text-xs"
            aria-label={`Quantity of ${p.title}`}
          />
          <Button size="xs" disabled={disabled || soldOut || !variantId} onClick={() => onAdd(variantId, Number(qty) || 0)}>
            Add
          </Button>
        </span>
      )}
    </li>
  );
}
