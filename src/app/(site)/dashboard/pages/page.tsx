"use client";

import { useState } from "react";
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
import { GeneratePagesDialog } from "./components/generate-pages-dialog";

/** Turn a generate result into one plain-language toast line. */
function summarize(r: GenerateResult): { kind: "success" | "info"; msg: string } {
  if (r.groundingSource === "empty") {
    return {
      kind: "info",
      msg: "Add your business details first so pages can be written about what you actually offer.",
    };
  }
  const made = r.outcomes.filter((o) => o.draftId && !o.error).length;
  const failed = r.outcomes.filter((o) => o.error).length;
  if (made === 0) return { kind: "info", msg: "No new pages were created this time." };
  return {
    kind: "success",
    msg: `Created ${made} page${made !== 1 ? "s" : ""} for review${failed ? `, ${failed} couldn't be made` : ""}.`,
  };
}

export default function PagesDashboard() {
  const { business, isLoading: authLoading } = useAuth();
  const pending = usePendingWebPages();
  const generate = useGenerateWebPages();
  const [generateOpen, setGenerateOpen] = useState(false);

  /** Runs a generate request with the owner's chosen topics. Resolves on success
   *  (with a plain-language toast) so the dialog closes; throws on failure so the
   *  dialog can keep itself open and show the error inline (incl. SEGMENTS_REQUIRED,
   *  which it turns into a "name at least one topic" hint). */
  async function runGenerate(segments?: GenerateSegmentInput[]) {
    const res = await generate.mutateAsync(segments && segments.length > 0 ? { segments } : undefined);
    const { kind, msg } = summarize(res);
    if (kind === "success") toast.success(msg);
    else toast.info(msg);
  }

  const rows = pending.data?.rows ?? [];

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
        <Button onClick={() => setGenerateOpen(true)} disabled={generate.isPending || !business}>
          <Sparkles className="size-4" aria-hidden="true" />
          {generate.isPending ? "Writing pages…" : "Generate pages"}
        </Button>
      </div>

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
          <EmptyState
            icon={FileStack}
            title="No pages to review"
            description="Generate pages to get started. They'll appear here for you to read and approve."
            action={{ label: "Generate pages", onClick: () => setGenerateOpen(true) }}
          />
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

      <GeneratePagesDialog open={generateOpen} onOpenChange={setGenerateOpen} onGenerate={runGenerate} />
    </div>
  );
}
