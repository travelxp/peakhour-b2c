"use client";

import { useState } from "react";
import { ArrowRight, FilePlus2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PAGE_TEMPLATES, type PageTemplate } from "../page-templates";

/**
 * "Start from a template" — six starting briefs plus a blank one.
 *
 * ── ★★WHAT PROBLEM THIS ACTUALLY SOLVES
 *
 * The Generate dialog opens on an empty form asking "Who are these pages for?"
 * — a question with no wrong answer and therefore no obvious right one. That
 * blank field is where most owners stopped, and a page generator nobody can
 * start is worth nothing however good the writer behind it is. A gallery turns
 * the first move from composition into recognition.
 *
 * ── ★★THE PREVIEW IS THE SHAPE AND THE BRIEF, NOT MOCK COPY
 *
 * The composer decides the block sequence from what the business has to say, so
 * a rendered mock would be inventing the one thing the product is being asked
 * to produce — and the owner would then compare their real page to a fiction we
 * wrote. The preview shows the outline the brief typically produces and the
 * brief itself, filled in. See page-templates.ts.
 *
 * ── ★★AND "FROM SCRATCH" IS A PEER, NOT A FALLBACK
 *
 * It sits in the same grid rather than as a link underneath, because someone
 * who knows exactly what they want should not have to read six cards to find
 * out they can skip them.
 */
export function TemplateGallery({
  onUseTemplate,
  onStartBlank,
  disabled,
}: {
  /** Open the generate dialog prefilled with this template's brief. */
  onUseTemplate: (template: PageTemplate) => void;
  /** Open it empty. */
  onStartBlank: () => void;
  disabled?: boolean;
}) {
  const [previewing, setPreviewing] = useState<PageTemplate | null>(null);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Start from a template</h3>
        <p className="text-xs text-muted-foreground">
          Each one is a starting brief you can edit before anything is written.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PAGE_TEMPLATES.map((template) => (
          <Card key={template.id} className="u-lift flex h-full flex-col">
            <CardContent className="flex flex-1 flex-col gap-2 px-4 py-4">
              <p className="text-sm font-semibold">{template.name}</p>
              <p className="text-xs leading-snug text-muted-foreground">{template.blurb}</p>
              {/* `mt-auto` pins the actions to one baseline across the row,
                  however tall each blurb wraps. */}
              <div className="mt-auto flex items-center gap-1 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={disabled}
                  onClick={() => setPreviewing(template)}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={disabled}
                  onClick={() => onUseTemplate(template)}
                >
                  Use this
                  <ArrowRight className="size-3" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="u-lift flex h-full flex-col border-dashed">
          <CardContent className="flex flex-1 flex-col gap-2 px-4 py-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <FilePlus2 className="size-4 text-muted-foreground" aria-hidden />
              From scratch
            </p>
            <p className="text-xs leading-snug text-muted-foreground">
              You already know who the page is for. Write the brief yourself.
            </p>
            <div className="mt-auto pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={disabled}
                onClick={onStartBlank}
              >
                Start blank
                <ArrowRight className="size-3" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewing !== null} onOpenChange={(next) => !next && setPreviewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {previewing && (
            <>
              <DialogHeader>
                <DialogTitle>{previewing.name}</DialogTitle>
                <DialogDescription>{previewing.blurb}</DialogDescription>
              </DialogHeader>

              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Best for:</span> {previewing.bestFor}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What the page usually covers
                </p>
                {/* Numbered, because the order is the argument the page makes.
                    Labelled "usually" throughout: the composer chooses the real
                    sections from what the business actually has to say. */}
                <ol className="space-y-1">
                  {previewing.outline.map((line, i) => (
                    <li key={line} className="flex gap-2 text-sm">
                      <span className="w-4 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  The brief you&rsquo;ll start from
                </p>
                <dl className="space-y-1.5 rounded-lg border px-3 py-2.5 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Who are these pages for?</dt>
                    <dd className="font-medium">{previewing.example.audience}</dd>
                  </div>
                  {previewing.example.who && (
                    <div>
                      <dt className="text-xs text-muted-foreground">A specific group within them?</dt>
                      <dd className="font-medium">{previewing.example.who}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">What should they focus on?</dt>
                    <dd className="font-medium">{previewing.example.focus}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  Every field is editable before anything is written, and you review the finished
                  page before it goes live.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewing(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const t = previewing;
                    setPreviewing(null);
                    onUseTemplate(t);
                  }}
                >
                  <Sparkles className="size-4" aria-hidden />
                  Use this template
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
