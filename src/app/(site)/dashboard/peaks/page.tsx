"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Zap, History, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useCreditsBalance, useCreditsRateCard, useCreditsHistory } from "@/hooks/use-credits";
import { usePeaksPacks, buyPack, confirmPackPurchase } from "@/hooks/use-peaks-packs";
import { PaymentModal, type CheckoutResult } from "@/components/upgrade/payment-modal";

// ── Formatting helpers ────────────────────────────────────────────────────

function fmtPeaks(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtResetDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

// ── Usage History Sheet ────────────────────────────────────────────────────

function UsageHistorySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data, isLoading } = useCreditsHistory();

  const days = data?.days ?? [];
  const total = data?.total ?? 0;

  // Find max for bar scaling
  const maxPeaks = days.reduce((m, d) => Math.max(m, d.peaks), 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="size-4" />
            Usage History
          </SheetTitle>
          <SheetDescription>Peaks consumed per day over the last 30 days.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-auto px-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : days.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Zap className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No Peaks used in the last 30 days.</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-foreground">{fmtPeaks(total)} Peaks</span>
              </p>
              <div className="space-y-2">
                {[...days].reverse().map((d) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {fmtDate(d.date)}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(2, (d.peaks / maxPeaks) * 100)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs tabular-nums text-foreground">
                        {fmtPeaks(d.peaks)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Buy more Peaks ─────────────────────────────────────────────────────────

/** Card-level copy when nothing is buyable, so the section leads with one
 *  message and a way forward instead of repeating itself per pack. */
function blockedCopy(reason: "plan_required" | "unlimited" | null): string | null {
  if (reason === "unlimited") return "Your plan already includes unlimited Peaks.";
  if (reason === "plan_required") return "Peaks packs need an active paid plan.";
  return null;
}

function BuyPeaks() {
  const qc = useQueryClient();
  const search = useSearchParams();
  const { data, isLoading } = usePeaksPacks();
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // The pack a link-out asked for (Shopify and the WordPress plugin both send
  // `?pack=`), highlighted so a merchant who already chose doesn't have to
  // choose again.
  const wanted = search.get("pack");

  // Stripe returns the buyer here with `?purchase=success&session_id=cs_…`.
  // Confirm synchronously so the new Peaks are visible on this paint rather
  // than whenever the webhook happens to land. Runs ONCE per session id.
  const confirmed = useRef<string | null>(null);
  useEffect(() => {
    const sessionId = search.get("session_id");
    if (!sessionId || confirmed.current === sessionId) return;
    confirmed.current = sessionId;
    void (async () => {
      try {
        const res = await confirmPackPurchase(sessionId);
        if (res.credited) {
          toast.success(
            res.credits ? `${res.credits.toLocaleString()} Peaks added.` : "Your Peaks have been added.",
          );
        }
      } catch {
        // The webhook is the backstop — never turn a successful payment into an
        // error message on the buyer's return page.
      } finally {
        void qc.invalidateQueries({ queryKey: ["/v1/dashboard/credits"] });
      }
    })();
  }, [search, qc]);

  const start = async (packKey: string) => {
    setBusyKey(packKey);
    try {
      setCheckout(await buyPack(packKey));
    } catch {
      toast.error("We couldn't start checkout. Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  // Dormant by design: no public priced pack means nothing to show at all,
  // rather than an empty card that reads like a fault.
  if (isLoading || !data || data.packs.length === 0) return null;

  const cardBlocked = data.packs.some((p) => p.purchasable)
    ? null
    : blockedCopy(data.packs[0].blockedReason);

  return (
    <>
      <PaymentModal
        checkout={checkout}
        onOpenChange={(open) => {
          if (!open) setCheckout(null);
        }}
        onSuccess={() => {
          // Razorpay's overlay reports success in-page; the webhook does the
          // crediting, so refetch rather than assuming a number.
          toast.success("Payment received — your Peaks are on the way.");
          void qc.invalidateQueries({ queryKey: ["/v1/dashboard/credits"] });
        }}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buy more Peaks</CardTitle>
          <CardDescription className="mt-1">
            {cardBlocked ??
              "One-time top-ups. Bought Peaks don't expire and are used after your monthly allowance."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.packs.map((p) => (
              <div
                key={p.key}
                className={`flex flex-col gap-3 rounded-xl border p-4 ${
                  p.key === wanted ? "border-primary ring-primary/20 ring-2" : ""
                }`}
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {fmtPeaks(p.credits)} Peaks
                  </p>
                </div>
                <div className="mt-auto flex items-end justify-between gap-2">
                  <span className="text-lg font-semibold tabular-nums">
                    {p.currency} {p.amount}
                  </span>
                  <Button
                    size="sm"
                    disabled={!p.purchasable || busyKey !== null}
                    onClick={() => void start(p.key)}
                  >
                    {busyKey === p.key ? "Opening…" : "Buy"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PeaksPage() {
  const { data: balance, isLoading: balanceLoading } = useCreditsBalance();
  const { data: rateCard, isLoading: rateLoading } = useCreditsRateCard();
  const [historyOpen, setHistoryOpen] = useState(false);

  const pct =
    balance && !balance.unlimited && balance.hardCap > 0
      ? Math.min(100, Math.round((balance.used / balance.hardCap) * 100))
      : 0;

  const capColor =
    balance && !balance.unlimited
      ? pct >= 100
        ? "bg-red-500"
        : pct >= 80
          ? "bg-amber-500"
          : "bg-primary"
      : "bg-primary";

  return (
    <>
      <UsageHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />

      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Zap className="size-6" />
              Peaks
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              AI credits that power every feature. Resets monthly on your billing date.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-4" />
            Usage history
          </Button>
        </div>

        {/* ── Balance card ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Balance</CardTitle>
            {balance && !balance.unlimited && (
              <CardDescription>
                Resets on {fmtResetDate(balance.resetAt)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="h-16 animate-pulse rounded-md bg-muted" />
            ) : !balance ? (
              <p className="text-sm text-muted-foreground">Could not load balance.</p>
            ) : balance.unlimited ? (
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold tracking-tight">∞</span>
                <span className="text-muted-foreground">Unlimited Peaks</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-4xl font-bold tabular-nums tracking-tight">
                      {fmtPeaks(balance.remaining)}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      / {fmtPeaks(balance.hardCap)} remaining
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {pct}% used
                  </span>
                </div>
                {/* Styled progress bar — uses a raw div so we can color-code it */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${capColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {pct >= 80 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {pct >= 100
                        ? "AI features are paused until your Peaks reset."
                        : "Getting close — AI features pause when you hit the limit."}
                    </p>
                    <Button size="sm" variant="outline" asChild className="gap-1">
                      <Link href="/dashboard/settings/billing">
                        Upgrade <ArrowUpRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Buy more Peaks ────────────────────────────────────────── */}
        {/* Suspense: BuyPeaks reads useSearchParams (the ?pack= deep link and
            Stripe's ?session_id= return), which Next requires a boundary for. */}
        <Suspense fallback={null}>
          <BuyPeaks />
        </Suspense>

        {/* ── Rate card ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Rate Card</CardTitle>
                <CardDescription className="mt-1">
                  How many Peaks each AI feature uses per activation.
                  Actual usage varies by output length.
                </CardDescription>
              </div>
              {rateLoading && (
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rateLoading ? (
              <div className="space-y-2 p-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : !rateCard || rateCard.useCases.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Rate card not available. Contact support if this persists.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Min Peaks / call</TableHead>
                    <TableHead className="text-right">Rate multiplier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateCard.useCases.map((u) => (
                    <TableRow key={u.useCase}>
                      <TableCell className="font-medium">{u.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u.minCreditsPerCall > 0 ? u.minCreditsPerCall.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {u.creditMultiplier}×
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Explainer ─────────────────────────────────────────────── */}
        <p className="text-xs text-muted-foreground">
          1 Peak ≈ $0.001 in AI compute. Peaks are consumed when the AI runs — not when you write
          or edit. Unused Peaks reset each month and do not roll over.
        </p>
      </div>
    </>
  );
}
