"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/molecules/status-badge";
import { EmptyState } from "@/components/molecules/empty-state";
import type { PageBlock } from "@/lib/marketing-pages";
import { useWebPageDraft } from "@/hooks/use-web-pages";
import { WebPageActions } from "../components/web-page-actions";
import { WebPagePreview } from "../components/web-page-preview";

export default function WebPageReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: draft, isLoading, isError } = useWebPageDraft(id);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link href="/dashboard/pages">
        <ArrowLeft className="size-4" />
        Back to Pages
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {back}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !draft) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={FileStack}
          title="Page not found"
          description="This page may have already been published or sent back. Head back to your review queue."
          action={{ label: "Back to Pages", href: "/dashboard/pages" }}
        />
      </div>
    );
  }

  const name = draft.webPage.name || draft.title || draft.webPage.slug;
  const tax = draft.webPage.taxonomy;
  const audience = [tax?.industry, tax?.persona]
    .filter(Boolean)
    .map((s) => s!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" · ");
  const verified = draft.webPage.ai?.groundingVerified === true;
  const claims = draft.sourceMetadata?.groundingUnsupportedClaims ?? [];
  const blocks = (draft.webPage.blocks ?? []) as PageBlock[];

  return (
    <div className="space-y-6">
      {back}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
            {verified ? (
              <StatusBadge status="Ready" variant="success" />
            ) : (
              <StatusBadge status="Needs a look" variant="warning" />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {audience ? `${audience} · ` : ""}Will publish at <span className="font-mono text-xs">/{draft.webPage.slug}</span>
          </p>
        </div>
        <WebPageActions draftId={draft._id} name={name} size="default" onDone={() => router.push("/dashboard/pages")} />
      </div>

      {/* Things to double-check */}
      {!verified && claims.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            A few things to double-check before publishing
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            {claims.map((claim, i) => (
              <li key={i}>{claim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* What the page says — a readable summary of every section */}
      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">What this page says</p>
        <div className="overflow-hidden rounded-lg border bg-card">
          <WebPagePreview blocks={blocks} seo={draft.webPage.seo} />
        </div>
      </div>
    </div>
  );
}
