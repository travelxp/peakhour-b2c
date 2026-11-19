"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QuoteBlock, type QuoteBlockState } from "@/components/studio/studio-quote";
import { PreviewImage } from "@/components/studio/preview-card";
import { RefusalNote } from "@/components/studio/refusal-note";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PreviewView, TweakOp } from "@/lib/api/creative-studio";
import { formatPeaks } from "@/lib/pricing";
import { WORDING_MAX, wordingOp, type StudioRefusal, type Swatch } from "@/lib/studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const T = STUDIO_COPY.tweak;

/** A quoted press inside the panel (another background, new wording): its own price, confirmed before it runs. */
export interface QuotedTweak {
  /** Is the use case switched on? false = shown disabled with "Coming soon", never a price. */
  available: boolean;
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** After "the price changed": drop the sentence; the price is asked again. */
  onClearRefusal: () => void;
  quote: { state: QuoteBlockState; peaks?: number; onRetry: () => void };
  left: number | null;
  pending: boolean;
  refusal?: StudioRefusal;
}

export interface TweakPanelViewProps {
  preview: PreviewView;
  /** The picture's alt text, built from its data (spec 4.7). */
  alt: string;
  palette: Swatch[];
  /** The products of the plan, for "Swap product" (shown only when there is more than one). */
  products: Array<{ id: string; title: string }>;
  canMake: boolean;
  /** A free change is on its way: the picture is dimmed, never blank. */
  pending: boolean;
  error?: StudioRefusal;
  /** The colour last chosen (the api does not say which one a layout holds). */
  chosenColour?: string;
  proTools: boolean;
  background: QuotedTweak;
  wording: QuotedTweak;
  onOp: (op: TweakOp) => void;
  onColour: (swatch: Swatch) => void;
  announcement?: string;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{label}</h3>
      {children}
    </section>
  );
}

function WordingField({
  id,
  label,
  field,
  initial,
  onSubmit,
  disabled,
}: {
  id: string;
  label: string;
  field: "headline" | "offer" | "cta";
  initial: string;
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(initial);
  const max = WORDING_MAX[field];
  const op = wordingOp(field, text);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={text}
          maxLength={max}
          aria-describedby={`${id}-count`}
          onChange={(e) => setText(e.target.value)}
          className="h-11"
          disabled={disabled}
        />
        <Button type="button" variant="outline" className="h-11" disabled={disabled || !op || text.trim() === initial} onClick={() => op && onSubmit(text)}>
          {T.apply}
        </Button>
      </div>
      <p id={`${id}-count`} className="text-xs text-muted-foreground">
        {T.counter(Array.from(text).length, max)}
      </p>
    </div>
  );
}

export function QuotedStep({ title, hint, q }: { title: string; hint: string; q: QuotedTweak }) {
  if (!q.available) {
    return (
      <div className="space-y-1">
        <Button type="button" variant="outline" className="h-11 w-full justify-between" disabled>
          {title}
          <Badge variant="secondary">{STUDIO_COPY.comingSoon.chip}</Badge>
        </Button>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    );
  }
  if (!q.open) {
    return (
      <div className="space-y-1">
        <Button type="button" variant="outline" className="h-11 w-full" onClick={q.onOpen}>
          {title}
        </Button>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{title}</p>
      <QuoteBlock
        state={q.quote.state}
        peaks={q.quote.peaks}
        kind="total"
        left={q.left}
        onRetry={q.quote.onRetry}
      />
      {q.refusal && <RefusalNote refusal={q.refusal} onRetry={q.onConfirm} onRequote={q.onClearRefusal} />}
      <div className="flex gap-2">
        <Button type="button" className="h-11 flex-1" disabled={q.quote.state !== "quote" || q.pending} onClick={q.onConfirm}>
          {q.quote.peaks !== undefined ? T.confirm(formatPeaks(q.quote.peaks)) : title}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={q.onCancel}>
          {T.cancel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Tap-to-tweak (UX spec S8). Every control but two is free: wording, colour, product, size and position re-render at once (no model).
 * "Try another background" and "Write new wording" are quoted, so each shows its own price and waits for a confirm. The picture is dimmed
 * (never blank) while a change is on its way. A refusal ("That wording doesn't fit...") is written inside the panel and nothing is lost.
 */
export function TweakPanelView(p: TweakPanelViewProps) {
  const { preview } = p;
  const off = !p.canMake || p.pending;
  const options = preview.wordingOptions;
  return (
    <div className="space-y-5" data-slot="studio-tweak">
      <div className={cn("mx-auto w-40 overflow-hidden rounded-md border transition-opacity motion-reduce:transition-none", p.pending && "opacity-50")} aria-busy={p.pending}>
        <PreviewImage preview={preview} alt={p.alt} />
      </div>
      <p role="status" aria-live="polite" className="text-center text-sm text-muted-foreground">
        {p.pending ? T.working : (p.announcement ?? "")}
      </p>
      {p.error && <RefusalNote refusal={p.error} />}

      <Group label={T.wording}>
        {options.length > 0 && (
          <div role="radiogroup" aria-label={T.wordingOptions} className="flex flex-wrap gap-2">
            {options.map((o, i) => (
              <button
                key={`${i}-${o}`}
                type="button"
                role="radio"
                aria-checked={preview.chosenOption === i}
                disabled={off}
                onClick={() => p.onOp({ op: "headline.option", index: i })}
                className={cn(
                  "min-h-11 max-w-full rounded-md border px-3 py-2 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  preview.chosenOption === i ? "border-primary bg-primary/10 font-medium" : "bg-background",
                )}
              >
                {o}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={off} onClick={() => p.onOp({ op: "text.shorter" })}>
            {T.shorter}
          </Button>
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={off} onClick={() => p.onOp({ op: "text.longer" })}>
            {T.longer}
          </Button>
        </div>
        <WordingField
          key={`h-${preview.layoutVersion}`}
          id="studio-tweak-headline"
          label={T.typeYourOwn}
          field="headline"
          initial={preview.headline ?? ""}
          disabled={off}
          onSubmit={(text) => p.onOp({ op: "headline.set", text })}
        />
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{T.moreWording}</summary>
          <div className="mt-3 space-y-3">
            <WordingField
              key={`o-${preview.layoutVersion}`}
              id="studio-tweak-offer"
              label={T.offer}
              field="offer"
              initial={preview.offer ?? ""}
              disabled={off}
              onSubmit={(text) => p.onOp({ op: "offer.set", text })}
            />
            <WordingField
              key={`c-${preview.layoutVersion}`}
              id="studio-tweak-cta"
              label={T.button}
              field="cta"
              initial={preview.cta ?? ""}
              disabled={off}
              onSubmit={(text) => p.onOp({ op: "cta.set", text })}
            />
          </div>
        </details>
      </Group>

      <Group label={T.colour}>
        <div role="radiogroup" aria-label={T.colour} className="flex flex-wrap gap-2">
          {p.palette.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={p.chosenColour === s.key}
              disabled={off}
              onClick={() => p.onColour(s)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                p.chosenColour === s.key && "border-primary bg-primary/10 font-medium",
              )}
            >
              <span aria-hidden="true" className="size-5 rounded-full border" style={{ backgroundColor: s.hex }} />
              {s.name}
            </button>
          ))}
        </div>
      </Group>

      <Group label={T.product}>
        {p.products.length > 1 && (
          <div role="radiogroup" aria-label={T.swapProduct} className="flex flex-wrap gap-2">
            {p.products.map((pr) => (
              <button
                key={pr.id}
                type="button"
                role="radio"
                aria-checked={preview.productId === pr.id}
                disabled={off}
                onClick={() => p.onOp({ op: "product.swap", productId: pr.id })}
                className={cn(
                  "min-h-11 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  preview.productId === pr.id ? "border-primary bg-primary/10 font-medium" : "bg-background",
                )}
              >
                {pr.title}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={off} onClick={() => p.onOp({ op: "product.size", step: "smaller" })}>
            {T.smaller}
          </Button>
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={off} onClick={() => p.onOp({ op: "product.size", step: "bigger" })}>
            {T.bigger}
          </Button>
        </div>
      </Group>

      <Group label={T.position}>
        <div className="grid grid-cols-3 gap-2">
          {(["top", "middle", "bottom"] as const).map((pos) => (
            <Button key={pos} type="button" variant="outline" className="h-11" disabled={off} onClick={() => p.onOp({ op: "position.set", position: pos })}>
              {T[pos]}
            </Button>
          ))}
        </div>
      </Group>

      <Group label={T.background}>
        <QuotedStep title={T.anotherBackground} hint={T.anotherBackgroundHint} q={p.background} />
        {p.proTools && <QuotedStep title={T.newWording} hint={T.newWordingHint} q={p.wording} />}
      </Group>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" className="h-11" disabled={off || !preview.canUndo} onClick={() => p.onOp({ op: "undo" })}>
          {T.undo}
        </Button>
        <Button type="button" variant="ghost" className="h-11" disabled={off} onClick={() => p.onOp({ op: "reset" })}>
          {T.reset}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{T.locked}</p>
      <p className="text-sm text-muted-foreground">{T.footer}</p>
    </div>
  );
}

/** The sheet around the panel: a bottom sheet on a phone and a side panel on a larger screen. */
export function TweakSheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const mobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 overflow-y-auto p-4", mobile ? "max-h-[92dvh]" : "sm:max-w-md")}>
        <SheetHeader className="p-0">
          <SheetTitle>{T.title}</SheetTitle>
          <SheetDescription>{T.description}</SheetDescription>
        </SheetHeader>
        {children}
        <Button type="button" className="h-11" onClick={() => onOpenChange(false)}>
          {T.close}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
