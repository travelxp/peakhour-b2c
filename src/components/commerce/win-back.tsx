"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSaveWaSettings, useWaOverview } from "@/hooks/use-wa-marketing";
import { CART_INTRO, FEES_NOTE, moneyMinor, readinessCopy, winBackPatch, type WaOverview } from "@/lib/wa-marketing";

const DELAYS = [30, 60, 120, 360, 1440];
const delayLabel = (m: number) => (m === 1440 ? "24 hours" : m % 60 === 0 ? (m === 60 ? "1 hour" : `${m / 60} hours`) : `${m} minutes`);

/**
 * Commerce -> Win back carts (lane I3d). Cart reminders on WhatsApp for shoppers who opted in: the switch (off until the
 * merchant turns it on), the timing and limits, and what it brought back. Counts and revenue come from the api and are the
 * ones the Shopify admin app shows.
 *
 * States, none the same sentence: loading, could not load (with a retry, never "nothing happened"), store not supported, and
 * the page, with the reason nothing is being sent when that is so (Meta's approval, WhatsApp, the emergency stop).
 */
export function WinBackPanel() {
  const q = useWaOverview();
  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-destructive">We could not load your cart reminder settings. Nothing was changed.</p>
        <Button variant="outline" onClick={() => void q.refetch()}>Try again</Button>
      </div>
    );
  }
  if (!q.data.supported) {
    return <p className="text-sm text-muted-foreground">Cart reminders work with Shopify stores. Connect a Shopify store to use them.</p>;
  }
  // Not keyed by the stored settings: a remount after a save would reset the form and lose the "Saved." confirmation.
  return <WinBackView data={q.data} />;
}

export function WinBackView({ data }: { data: WaOverview }) {
  const save = useSaveWaSettings();
  const c = data.settings.cartRecovery;
  const f = data.settings.frequencyCap;
  const [enabled, setEnabled] = useState(c.enabled);
  const [delay, setDelay] = useState(c.delayMinutes);
  const [second, setSecond] = useState(c.secondReminder);
  const [max, setMax] = useState(String(f.max));
  const [days, setDays] = useState(String(f.perDays));
  const [problem, setProblem] = useState<string | null>(null);

  const banner = readinessCopy(data.recovery.ready, data.stopped);
  const delays = [...new Set([...DELAYS, delay])].sort((a, b) => a - b);

  function onSave() {
    const built = winBackPatch(data.settings, { enabled, delayMinutes: delay, secondReminder: second, max, perDays: days });
    if (!built.ok) return setProblem(built.error);
    setProblem(null);
    save.mutate(built.patch);
  }

  const r = data.recovery;
  return (
    <div className="space-y-6" data-win-back="ready">
      <p className="text-sm text-muted-foreground">{CART_INTRO}</p>
      {banner && (
        <div role="status" data-tone={banner.tone} className="rounded-lg border bg-muted/40 p-4">
          <p className="font-medium">{banner.heading}</p>
          <p className="mt-1 text-sm text-muted-foreground">{banner.body}</p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Cart reminders</CardTitle>
          <CardDescription>Off until you turn them on. {FEES_NOTE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch id="wb-enabled" checked={enabled} onCheckedChange={(v) => { save.reset(); setEnabled(v); }} disabled={save.isPending} />
            <Label htmlFor="wb-enabled">Send cart reminders</Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wb-delay">Send the first reminder after</Label>
            <select id="wb-delay" className="block h-9 rounded-md border bg-background px-3 text-sm" value={delay} disabled={save.isPending} onChange={(e) => { save.reset(); setDelay(Number(e.target.value)); }}>
              {delays.map((m) => (
                <option key={m} value={m}>{delayLabel(m)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="wb-second" checked={second} onCheckedChange={(v) => { save.reset(); setSecond(v); }} disabled={save.isPending} />
            <Label htmlFor="wb-second">Send one more reminder 24 hours later, if the cart is still open</Label>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="wb-max">Most messages one shopper gets</Label>
              <Input id="wb-max" className="w-28" inputMode="numeric" value={max} disabled={save.isPending} onChange={(e) => { save.reset(); setMax(e.target.value); }} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wb-days">In this many days</Label>
              <Input id="wb-days" className="w-28" inputMode="numeric" value={days} disabled={save.isPending} onChange={(e) => { save.reset(); setDays(e.target.value); }} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">This limit counts cart reminders and broadcasts together.</p>
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          {save.isError && <p role="alert" className="text-sm text-destructive">{save.error instanceof Error ? save.error.message : "We could not save that."} Nothing was changed.</p>}
          {save.isSuccess && !problem && <p role="status" className="text-sm text-muted-foreground">Saved.</p>}
          <Button onClick={onSave} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            How it is going <Badge variant="secondary">Measured</Badge>
          </CardTitle>
          <CardDescription>
            A cart counts as recovered when Shopify reports it completed after Peakhour&apos;s reminder. The last {r.windowDays} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Carts being watched", String(r.counts.watching)],
              ["Reminders sent", String(r.counts.reminded)],
              ["Carts recovered", String(r.counts.recovered)],
              ["Recovered revenue", r.recoveredRevenue.length === 0 ? "None yet" : r.recoveredRevenue.map((x) => moneyMinor(x.minor, x.currency)).join(" + ")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <p className="text-sm">
        Want to send an offer to everyone who opted in?{" "}
        <Link className="underline" href="/dashboard/commerce/broadcasts">Open Promo messages</Link>.
      </p>
    </div>
  );
}
