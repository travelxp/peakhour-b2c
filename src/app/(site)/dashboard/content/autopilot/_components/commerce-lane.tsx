"use client";

import Link from "next/link";
import { IndianRupee, ArrowRight, Store, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CommerceLane as CommerceLaneData } from "@/hooks/use-home-summary";

/**
 * The commerce lane — the moat made visible. Two honest variants:
 *
 *  • "moneyloop" (a store is connected): the hero of the both-state —
 *    "content → ₹ sales", the one number no pure-play marketing tool can
 *    show because it doesn't own the storefront. The attribution compute
 *    ships in a later PR, so v1 renders an honest "switching on" state
 *    rather than a fabricated number — never fake data.
 *
 *  • "teaser" (marketing-only): a tasteful cross-sell that turns the home
 *    into a product-led expansion surface — connect a store to unlock the
 *    loop. Placed quietly at the bottom so it never competes with the
 *    core content.
 */

function MoneyLoopCard({ data }: { data: CommerceLaneData }) {
  const live = data.moneyLoop && typeof data.moneyLoop.revenueAttributed === "number";
  return (
    <Card className="gap-0 overflow-hidden border-emerald-200 bg-linear-to-br from-emerald-50 to-background p-5 dark:border-emerald-900/50 dark:from-emerald-950/40">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400">
          <IndianRupee className="size-4" />
        </span>
        <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Content → Sales
        </h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
          <Store className="size-3" /> Store connected
        </span>
      </div>

      {live ? (
        <div className="mt-3">
          <div className="text-3xl font-semibold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-300">
            {data.moneyLoop!.currency ?? "₹"}
            {data.moneyLoop!.revenueAttributed!.toLocaleString()}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            from {data.moneyLoop!.orders ?? 0} orders this week
            {data.moneyLoop!.topDriver
              ? ` · top driver: ${data.moneyLoop!.topDriver}`
              : ""}
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-emerald-800/40 dark:text-emerald-300/40">
              —
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-3.5" /> Switching on
            </span>
          </div>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            We&apos;re wiring your store&apos;s orders to your content. Soon
            you&apos;ll see exactly how much revenue each post drove — the one
            number every other marketing tool leaves you guessing.
          </p>
        </div>
      )}
    </Card>
  );
}

function CrossSellTeaser() {
  return (
    <Card className="flex flex-col items-start gap-3 border-dashed bg-muted/20 p-5 sm:flex-row sm:items-center">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
        <Store className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">See what your content actually sold</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Connect your store and Autopilot closes the loop — from post to
          revenue. It&apos;s the one number every other marketing tool can&apos;t
          show you.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/dashboard/integrations">
          Connect your store
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </Card>
  );
}

export function CommerceLane({
  variant,
  data,
  className,
}: {
  variant: "moneyloop" | "teaser";
  data?: CommerceLaneData | null;
  className?: string;
}) {
  if (variant === "moneyloop") {
    if (!data?.connected) return null;
    return (
      <div className={className}>
        <MoneyLoopCard data={data} />
      </div>
    );
  }
  return (
    <div className={className}>
      <CrossSellTeaser />
    </div>
  );
}
