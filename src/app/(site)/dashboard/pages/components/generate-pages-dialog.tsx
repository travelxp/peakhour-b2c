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
 * one or more "topics" (an audience + an optional focus note). Each topic becomes a
 * generation segment sent to POST /v1/content/web-pages/generate.
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
const FOCUS_MAX = 1000;
const KEY_MAX = 64;

/** One page topic as the owner enters it. */
interface Topic {
  /** Human audience/industry label, e.g. "Cafés & restaurants" → industryLabel. */
  audience: string;
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

const emptyTopic = (): Topic => ({ audience: "", focus: "" });

/** Map filled topics → segments. A topic counts only if its audience slugifies to a
 *  non-empty key (that key is the page's required `industry` axis). */
function toSegments(topics: Topic[]): GenerateSegmentInput[] {
  const segments: GenerateSegmentInput[] = [];
  for (const t of topics) {
    const label = t.audience.trim();
    const industry = slugify(label);
    if (!industry) continue;
    const focus = t.focus.trim();
    segments.push({
      industry,
      industryLabel: label.slice(0, AUDIENCE_MAX),
      ...(focus ? { segmentSummary: focus.slice(0, FOCUS_MAX) } : {}),
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segments = toSegments(topics);
  // How many topics the owner actually typed an audience into.
  const typedAudiences = topics.filter((t) => t.audience.trim().length > 0).length;
  // Typed at least one audience but NONE produced a usable key (e.g. only
  // punctuation/emoji) → block: submitting would misleadingly seed-default.
  const typedButUnusable = typedAudiences > 0 && segments.length === 0;
  // Some usable, some not — the unusable ones are dropped; warn so it isn't silent.
  const droppedCount = segments.length > 0 ? typedAudiences - segments.length : 0;

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
    if (submitting || typedButUnusable) return;
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

      <div className="space-y-4">
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

        {(error || typedButUnusable) && (
          <p className="text-sm text-destructive" role="alert">
            {error ?? "Please use letters or numbers to describe who a topic is for."}
          </p>
        )}
        {!error && !typedButUnusable && droppedCount > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400" role="alert">
            {droppedCount === 1 ? "1 topic needs" : `${droppedCount} topics need`} letters or numbers
            to describe who they&apos;re for, and {droppedCount === 1 ? "it" : "they"} will be skipped.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" disabled={submitting} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={submitting || typedButUnusable} onClick={handleSubmit}>
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
