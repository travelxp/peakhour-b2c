"use client";

/**
 * D-05c — the Ads hub's way into creative review, and the one query for the
 * business's creative summary (shared with the guardrails card, which reads
 * it to decide whether approved-assets-only can be offered at all).
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { growthApi } from "@/lib/api/growth";
import { CREATIVE_REVIEW_PATH, reviewEntryLine } from "@/lib/creative-review-copy";

/** Under the review screen's key prefix, so an approve or withdraw there refreshes it. */
export const CREATIVES_SUMMARY_KEY = ["growth-creatives", "summary"] as const;

export function useCreativesSummary() {
  return useQuery({
    queryKey: CREATIVES_SUMMARY_KEY,
    // The summary covers the whole business whatever the page; one row is the smallest page.
    queryFn: async () => {
      // A first page (no `before`) always carries it.
      const s = (await growthApi.listCreatives({ limit: 1 })).summary;
      if (!s) throw new Error("The creatives summary was missing.");
      return s;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function CreativesReviewEntry() {
  const summary = useCreativesSummary();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden />
          <div>
            <h3 className="font-medium">Ad creatives</h3>
            <p className="text-sm text-muted-foreground">
              {/* ★No data — loading, paused offline or failed — claims nothing. */}
              {summary.data ? reviewEntryLine(summary.data) : "Review and approve the ads Peakhour writes for you."}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={CREATIVE_REVIEW_PATH}>Review creatives</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
