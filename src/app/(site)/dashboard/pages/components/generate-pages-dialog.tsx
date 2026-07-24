"use client";

import { useState } from "react";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import type { GenerateSegmentInput } from "@/hooks/use-web-pages";

/**
 * GeneratePagesDialog — the owner defines which landing pages to create by giving
 * one or more "topics" (an audience, optionally a specific segment of it, and a
 * focus note). Each topic becomes a generation segment sent to
 * POST /v1/content/web-pages/generate; a single CTA link applies to them all.
 *
 * Design notes:
 *   • Copy is deliberately non-technical (owner-facing) — no "segment", "pillar", or
 *     collection names. A "topic" == one page target.
 *   • Follows the RejectReasonDialog idiom: controlled open, inner body mounted only
 *     while open (so state resets on close with no useEffect), and dialog dismissal
 *     is blocked while a submit is in flight.
 *   • Seed-default preserved: submitting with NO topics filled sends `undefined`
 *     (segments omitted). The internal platform org falls back to its seed set; a
 *     customer gets SEGMENTS_REQUIRED, which the caller surfaces as an inline hint.
 */

// Mirror the API's zSegment caps (peakhour-api web-pages.ts) so the form can never
// round-trip to a 400. Kebab keys are derived + capped at 64; labels/summary here.
const MAX_TOPICS = 4;
const AUDIENCE_MAX = 200;
const PERSONA_MAX = 200;
const FOCUS_MAX = 1000;
const KEY_MAX = 64;
const HREF_MAX = 200;
/** Same as the API's zHref: an absolute http(s) URL or a same-site "/path". */
const SAFE_HREF = /^(https?:\/\/|\/)/;

/** One page topic as the owner enters it. */
interface Topic {
  /** Human audience/industry label, e.g. "Cafés & restaurants" → industryLabel. */
  audience: string;
  /** Optional narrower audience, e.g. "Owners short on time" → personaLabel. */
  who: string;
  /** Optional free-text focus → segmentSummary. */
  focus: string;
}

/** Lowercase kebab key from a human label: anything that is not a-z0-9 (spaces,
 *  punctuation, non-ASCII/accented letters) collapses to "-", then trim + cap. Empty
 *  when the label has no ASCII alphanumerics (caller filters those out). The key is an
 *  internal axis only — the human label is kept verbatim for the prompt. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, KEY_MAX)
    .replace(/-+$/g, ""); // in case the slice landed on a trailing hyphen
}

const emptyTopic = (): Topic => ({ audience: "", who: "", focus: "" });

/** Map filled topics → segments. A topic counts only if its audience slugifies to a
 *  non-empty key (that key is the page's required `industry` axis). An optional
 *  `who` adds the persona axis (only when it slugifies to a usable key); a shared
 *  `ctaHref` (already validated by the caller) is applied to every segment. */
function toSegments(topics: Topic[], ctaHref: string): GenerateSegmentInput[] {
  const cta = ctaHref.trim();
  const segments: GenerateSegmentInput[] = [];
  for (const t of topics) {
    const label = t.audience.trim();
    const industry = slugify(label);
    if (!industry) continue;
    const focus = t.focus.trim();
    const whoLabel = t.who.trim();
    const persona = slugify(whoLabel);
    segments.push({
      industry,
      industryLabel: label.slice(0, AUDIENCE_MAX),
      ...(focus ? { segmentSummary: focus.slice(0, FOCUS_MAX) } : {}),
      ...(persona ? { persona, personaLabel: whoLabel.slice(0, PERSONA_MAX) } : {}),
      ...(cta ? { ctaHref: cta.slice(0, HREF_MAX) } : {}),
    });
  }
  return segments;
}

export interface GeneratePagesDialogProps {
  /** Controlled open state — the parent already tracks it (header button + empty
   *  state both open the same dialog). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs the generation. Resolve to close the dialog; throw to keep it open and
   *  surface the error inline (SEGMENTS_REQUIRED becomes a "name a topic" hint).
   *  `segments` is undefined when the owner submitted no topics (seed-default path). */
  onGenerate: (segments?: GenerateSegmentInput[]) => Promise<void>;
}

export function GeneratePagesDialog({ open, onOpenChange, onGenerate }: GeneratePagesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <GeneratePagesDialogBody onGenerate={onGenerate} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function GeneratePagesDialogBody({
  onGenerate,
  onClose,
}: {
  onGenerate: GeneratePagesDialogProps["onGenerate"];
  onClose: () => void;
}) {
  const [topics, setTopics] = useState<Topic[]>([emptyTopic()]);
  const [ctaHref, setCtaHref] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The CTA link is optional, but if given it must be a full http(s) URL or a
  // "/path" (mirrors the API's zHref) — otherwise the whole request 400s.
  const ctaTrimmed = ctaHref.trim();
  const ctaInvalid = ctaTrimmed.length > 0 && !SAFE_HREF.test(ctaTrimmed);

  const segments = toSegments(topics, ctaHref);
  // Topics the owner put ANY detail into (audience, who, or focus) — a topic only
  // yields a page via its audience, so a filled who/focus with a blank audience is
  // otherwise-invisible input we must account for (else it vanishes silently).
  const topicsWithContent = topics.filter(
    (t) => t.audience.trim() || t.who.trim() || t.focus.trim(),
  ).length;
  // Content but zero usable audiences → block: submitting would misleadingly
  // seed-default. Some usable + some not → the unusable ones are skipped; warn.
  const typedButUnusable = topicsWithContent > 0 && segments.length === 0;
  const droppedCount = segments.length > 0 ? topicsWithContent - segments.length : 0;
  const canSubmit = !submitting && !typedButUnusable && !ctaInvalid;

  /** Move focus to a topic's audience input after the list changes (add/remove) so a
   *  keyboard user isn't stranded. rAF waits for the new/re-laid-out DOM to mount. */
  function focusAudience(i: number) {
    requestAnimationFrame(() => {
      document.getElementById(`audience-${i}`)?.focus();
    });
  }

  function update(i: number, patch: Partial<Topic>) {
    setError(null);
    setTopics((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function updateCta(value: string) {
    setError(null);
    setCtaHref(value);
  }
  function addTopic() {
    if (topics.length >= MAX_TOPICS) return;
    setError(null);
    setTopics((prev) => [...prev, emptyTopic()]);
    focusAudience(topics.length); // the new row's index
  }
  function removeTopic(i: number) {
    if (topics.length <= 1) return;
    setError(null);
    setTopics((prev) => prev.filter((_, idx) => idx !== i));
    focusAudience(Math.max(0, i - 1)); // fall back to the previous row
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    // No usable topics → seed-default path (send undefined). Otherwise send segments.
    const payload = segments.length > 0 ? segments : undefined;
    setSubmitting(true);
    setError(null);
    try {
      await onGenerate(payload);
      onClose();
    } catch (e) {
      // Turn the API's SEGMENTS_REQUIRED into an inline hint rather than a toast: it
      // means this (non-platform) business must name at least one topic. Any other
      // failure gets a friendly generic — never surface a raw backend/AI message.
      if (e instanceof ApiError && e.code === "SEGMENTS_REQUIRED") {
        setError("Add at least one topic — tell us who your pages should be for.");
      } else {
        setError("Couldn't start generating your pages. Please try again.");
      }
      setSubmitting(false);
    }
  }

  const block = (e: { preventDefault: () => void }) => {
    if (submitting) e.preventDefault();
  };

  return (
    <DialogContent
      className="sm:max-w-lg"
      // No built-in X — its DialogPrimitive.Close bypasses the `block` guards below
      // (Radix fires onOpenChange directly), which would unmount mid-submit and
      // silently swallow an in-flight failure. Cancel is the close affordance.
      showCloseButton={false}
      onEscapeKeyDown={block}
      onPointerDownOutside={block}
      onInteractOutside={block}
    >
      <DialogHeader>
        <DialogTitle>Generate pages</DialogTitle>
        <DialogDescription>
          Tell us who your pages should be for and we&apos;ll write a landing page for each. You
          review every page before anything goes live.
        </DialogDescription>
      </DialogHeader>

      {/* Only the topics scroll; the CTA + validation messages stay pinned below so
          a submit-blocking error is never hidden under the fold. */}
      <div className="max-h-[50vh] space-y-4 overflow-y-auto">
        {topics.map((t, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Topic {i + 1}</span>
              {topics.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={submitting}
                  onClick={() => removeTopic(i)}
                  aria-label={`Remove topic ${i + 1}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`audience-${i}`}>Who are these pages for?</Label>
                <Input
                  id={`audience-${i}`}
                  value={t.audience}
                  maxLength={AUDIENCE_MAX}
                  disabled={submitting}
                  placeholder="e.g. Cafés & restaurants"
                  onChange={(e) => update(i, { audience: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`who-${i}`}>
                  A specific group within them? <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id={`who-${i}`}
                  value={t.who}
                  maxLength={PERSONA_MAX}
                  disabled={submitting}
                  placeholder="e.g. Owners short on time"
                  onChange={(e) => update(i, { who: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`focus-${i}`}>
                  What should they focus on? <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id={`focus-${i}`}
                  value={t.focus}
                  maxLength={FOCUS_MAX}
                  disabled={submitting}
                  rows={2}
                  placeholder="e.g. Getting more table bookings from nearby customers"
                  onChange={(e) => update(i, { focus: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        {topics.length < MAX_TOPICS && (
          <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={addTopic}>
            <Plus className="size-4" aria-hidden="true" />
            Add another topic
          </Button>
        )}
      </div>

      {/* Pinned below the scroll area — applies to every page, and keeps the
          validation messages always visible. */}
      <div className="grid gap-1.5 border-t pt-4">
        <Label htmlFor="cta-href">
          Where should the buttons send visitors?{" "}
          <span className="text-muted-foreground">(optional — applies to every page)</span>
        </Label>
        <Input
          id="cta-href"
          type="text"
          inputMode="url"
          value={ctaHref}
          maxLength={HREF_MAX}
          disabled={submitting}
          aria-invalid={ctaInvalid}
          aria-describedby="cta-href-hint"
          placeholder="e.g. https://your-site.com/book or /contact"
          onChange={(e) => updateCta(e.target.value)}
        />
        <p
          id="cta-href-hint"
          aria-live="polite"
          className={`text-xs ${ctaInvalid ? "text-destructive" : "text-muted-foreground"}`}
        >
          {ctaInvalid
            ? "Enter a full web address (https://…) or a path that starts with /."
            : "Leave blank to point buttons at your home page."}
        </p>
      </div>

      {(error || typedButUnusable) && (
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Add an audience in “Who are these pages for?” so we know who at least one page is for."}
        </p>
      )}
      {!error && !typedButUnusable && droppedCount > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="alert">
          {droppedCount === 1 ? "1 topic is missing" : `${droppedCount} topics are missing`} an audience in
          “Who are these pages for?” and will be skipped.
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" type="button" disabled={submitting} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Writing pages…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden="true" />
              {segments.length > 0
                ? `Generate ${segments.length} page${segments.length !== 1 ? "s" : ""}`
                : "Generate pages"}
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
