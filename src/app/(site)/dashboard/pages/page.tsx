"use client";

import { useState } from "react";
import Link from "next/link";
import { FileStack, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { useAuth } from "@/providers/auth-provider";
import {
  usePendingWebPages,
  useGenerateWebPages,
  type GenerateResult,
  type GenerateSegmentInput,
} from "@/hooks/use-web-pages";
import { WebPageRow } from "./components/web-page-row";
import { GeneratePagesDialog, type TopicSeed } from "./components/generate-pages-dialog";
import { TemplateGallery } from "./components/template-gallery";

/**
 * Turn a generate result into one plain-language line.
 *
 * ── ★★THE TWO MESSAGES THIS FIXES, AND WHY THEY WERE BOTH WRONG
 *
 * 1. "Add your business details first so pages can be written about what you
 *    actually offer." — shown whenever grounding came back empty. Owners saw it
 *    after completing every onboarding step the dashboard asked of them,
 *    because neither a value proposition nor taxonomy sectors is a required
 *    field anywhere in that flow. The root cause is fixed in peakhour-api
 *    (grounding now also reads sectors derived from the business's own tagged
 *    content, and its businessDna drivers), and what remains here is the
 *    message for a business that genuinely has nothing on file — which now
 *    NAMES THE SCREEN instead of asking for "details" in the abstract.
 *
 * 2. "No new pages were created this time." — shown whenever `made` was 0,
 *    which lumped three different outcomes into one shrug: every page failed,
 *    every page was skipped, or — the common one — every page was a REWRITE of
 *    a draft already in the queue. That last case is not a failure at all; the
 *    generator is idempotent per slug, so running the same brief twice replaces
 *    rather than duplicates. The api now reports `replaced`, so a re-run can
 *    say what it did instead of implying nothing happened.
 */
function summarize(r: GenerateResult): {
  kind: "success" | "info" | "error";
  msg: string;
  action?: { label: string; href: string };
} {
  if (r.groundingSource === "empty") {
    return {
      kind: "info",
      msg: "Peakhour doesn't know what your business offers yet — pages are only written from things we can point to.",
      action: { label: "Add it on Your business", href: "/dashboard/growth/business" },
    };
  }

  const created = r.outcomes.filter((o) => o.draftId && !o.error && !o.replaced).length;
  const rewritten = r.outcomes.filter((o) => o.draftId && !o.error && o.replaced).length;
  const failed = r.outcomes.filter((o) => o.error).length;

  if (created === 0 && rewritten === 0) {
    return {
      kind: "error",
      msg: failed
        ? "We couldn't finish writing your pages. Try one topic at a time, or try again in a moment."
        : "Nothing was written — the topics didn't give us enough to work with.",
    };
  }

  const parts: string[] = [];
  if (created) parts.push(`Created ${created} page${created !== 1 ? "s" : ""}`);
  // Named as a rewrite rather than folded into the created count: the review
  // queue does not grow, and an owner watching a list that did not move needs
  // the sentence to account for that.
  if (rewritten) parts.push(`rewrote ${rewritten} you already had`);
  if (failed) parts.push(`${failed} couldn't be made`);
  return { kind: "success", msg: `${parts.join(", ")}.` };
}

export default function PagesDashboard() {
  const { business, isLoading: authLoading } = useAuth();
  const pending = usePendingWebPages();
  const generate = useGenerateWebPages();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [seed, setSeed] = useState<TopicSeed | undefined>(undefined);

  function openWithSeed(next: TopicSeed | undefined) {
    setSeed(next);
    setGenerateOpen(true);
  }

  /** Runs a generate request with the owner's chosen topics. Resolves on success
   *  (with a plain-language toast) so the dialog closes; throws on failure so the
   *  dialog can keep itself open and show the error inline (incl. SEGMENTS_REQUIRED,
   *  which it turns into a "name at least one topic" hint). */
  async function runGenerate(segments?: GenerateSegmentInput[]) {
    const res = await generate.mutateAsync(segments && segments.length > 0 ? { segments } : undefined);
    const { kind, msg, action } = summarize(res);
    // The action is a real link in the toast, not a sentence telling the owner
    // where to navigate. "Add your business details" with nowhere to click is
    // how the original message became a dead end.
    const options = action
      ? {
          duration: 10_000,
          action: {
            label: action.label,
            onClick: () => {
              window.location.href = action.href;
            },
          },
        }
      : undefined;
    if (kind === "success") toast.success(msg, options);
    else if (kind === "error") toast.error(msg, options);
    else toast.info(msg, options);
  }

  const rows = pending.data?.rows ?? [];
  const busy = generate.isPending || !business;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pages</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Ready-made landing pages for your business, written for you. Review each one and
            approve to publish — nothing goes live until you say so.
          </p>
        </div>
        <Button onClick={() => openWithSeed(undefined)} disabled={busy}>
          <Sparkles className="size-4" aria-hidden="true" />
          {generate.isPending ? "Writing pages…" : "Generate pages"}
        </Button>
      </div>

      {/* ★THE GALLERY LEADS WHEN THE QUEUE IS EMPTY, AND FOLLOWS WHEN IT IS NOT.
          A first-time owner's problem is knowing what page to ask for; a
          returning owner's is reviewing what is already waiting. Same two
          blocks, ordered by which question the account is actually asking. */}
      {business && rows.length === 0 && !pending.isLoading && (
        <TemplateGallery
          onUseTemplate={(t) => openWithSeed(t.example)}
          onStartBlank={() => openWithSeed(undefined)}
          disabled={busy}
        />
      )}

      {/* Queue */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Waiting for your review{pending.data ? ` (${pending.data.total})` : ""}
        </h3>

        {authLoading || (business && pending.isLoading) ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !business ? (
          <EmptyState
            icon={FileStack}
            title="Pick a business first"
            description="Choose a business at the top of the page to manage its pages."
          />
        ) : pending.isError ? (
          <EmptyState
            icon={FileStack}
            title="Couldn't load your pages"
            description="Something went wrong loading the review queue. Please refresh and try again."
          />
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing waiting. Pick a template above and your first page lands here for review.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((draft) => (
              <WebPageRow key={draft._id} draft={draft} />
            ))}
            {pending.data && pending.data.total > rows.length && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Showing the first {rows.length} of {pending.data.total}. Approve or send some back to see the rest.
              </p>
            )}
          </div>
        )}
      </section>

      {business && rows.length > 0 && (
        <TemplateGallery
          onUseTemplate={(t) => openWithSeed(t.example)}
          onStartBlank={() => openWithSeed(undefined)}
          disabled={busy}
        />
      )}

      {/* Where the grounding comes from, said once, where it is actionable.
          Pages are only written from things Peakhour can point to, and the
          owner has no other way to learn that until a generate run tells them. */}
      <p className="text-xs text-muted-foreground">
        Pages are written only from what we know about your business — no invented claims.{" "}
        <Link href="/dashboard/growth/business" className="font-medium text-brand-label hover:underline">
          Check what we know
        </Link>
        .
      </p>

      <GeneratePagesDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerate={runGenerate}
        seed={seed}
      />
    </div>
  );
}
