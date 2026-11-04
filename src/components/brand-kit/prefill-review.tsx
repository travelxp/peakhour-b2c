"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BrandPrefill } from "@/lib/api/brand-kit";
import {
  colorSourceLabel,
  fontHint,
  logoSourceLabel,
  prefillSummary,
  selectionCount,
  type PrefillSelection,
} from "@/lib/brand-kit";

/**
 * The review step of a website pre-fill (Peakhour Drive B2). Peakhour reads the page; the person decides. Nothing here writes: "Use these"
 * hands the ticked suggestions to the editor, which shows them as unsaved changes (the page) or saves them (onboarding).
 */

export type PrefillState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: BrandPrefill; selection: PrefillSelection; applying: boolean; notice?: string };

export interface PrefillReviewProps {
  state: Exclude<PrefillState, { status: "idle" }>;
  /** What the confirm button says: "Use these" in the editor, "Save and continue" in onboarding. */
  confirmLabel: string;
  onToggleColor: (hex: string) => void;
  onToggleLogo: (url: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}

/** A suggested logo as the browser sees it. A site can refuse to be hot-linked, so a preview that will not load says so and stays tickable: the server fetches it differently. */
function LogoPreview({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-16 items-center justify-center overflow-hidden rounded-md bg-muted text-center text-xs text-muted-foreground">
      {broken ? (
        "No preview"
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a suggestion from the customer's own site: not ours to optimise or allow-list
        <img src={url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      )}
    </span>
  );
}

export function PrefillReview({ state, confirmLabel, onToggleColor, onToggleLogo, onConfirm, onDismiss, onRetry }: PrefillReviewProps) {
  if (state.status === "loading") {
    return (
      <div role="status" className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Reading your website…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-card p-4 text-sm">
        <span>{state.message}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const { data, selection, applying, notice } = state;
  const count = selectionCount(selection);
  const hint = fontHint(data);
  const nothing = data.colors.length === 0 && data.logos.length === 0;
  return (
    <section aria-label="Review what we found" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-[15px] font-semibold">Review what we found</h2>
        <p className="mt-1 text-sm text-muted-foreground">{prefillSummary(data)}</p>
      </div>

      {data.colors.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold tracking-wide text-muted-foreground">Colours</legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
            {data.colors.map((c) => {
              const on = selection.colors.includes(c.hex);
              return (
                <label
                  key={c.hex}
                  className={cn(
                    "flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border p-2 text-xs has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    on ? "border-primary" : "opacity-60",
                  )}
                  title={colorSourceLabel(c.source)}
                >
                  <span className="h-9 rounded-md border" style={{ background: c.hex }} aria-hidden="true" />
                  <span className="flex items-center gap-1.5">
                    <input type="checkbox" className="size-4 accent-primary" checked={on} onChange={() => onToggleColor(c.hex)} />
                    <span className="font-mono">{c.hex}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {data.logos.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold tracking-wide text-muted-foreground">Logos</legend>
          <p className="text-xs text-muted-foreground">A logo you keep is added to Drive as a Published image.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
            {data.logos.map((l) => {
              const on = selection.logos.includes(l.url);
              return (
                <label
                  key={l.url}
                  className={cn(
                    "flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border p-2 text-xs has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    on ? "border-primary" : "opacity-60",
                  )}
                >
                  <LogoPreview url={l.url} />
                  <span className="flex items-center gap-1.5">
                    <input type="checkbox" className="size-4 accent-primary" checked={on} onChange={() => onToggleLogo(l.url)} />
                    <span>{logoSourceLabel(l.source)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {notice && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onConfirm} disabled={applying || count === 0}>
          {applying ? (
            <>
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Adding…
            </>
          ) : (
            <>
              <Check aria-hidden="true" /> {confirmLabel}
            </>
          )}
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={applying}>
          {nothing ? "Close" : "Not now"}
        </Button>
        {!nothing && count === 0 && <span className="text-sm text-muted-foreground">Tick at least one to continue.</span>}
      </div>
    </section>
  );
}
