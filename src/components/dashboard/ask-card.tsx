"use client";

/**
 * Ask Peakhour entry-point card for the dashboard Overview. Self-hides unless
 * the ASK_ENABLED flag is on (parallel with the legacy chat until PR-11 cutover).
 */

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ASK_ENABLED } from "@/lib/flags";

export function AskCard() {
  if (!ASK_ENABLED) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Ask Peakhour</p>
            <p className="text-xs text-muted-foreground">
              Ask about your traffic, search, and pages — grounded in your real data, never made up.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/dashboard/ask">
            Ask a question
            <ArrowRight className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
