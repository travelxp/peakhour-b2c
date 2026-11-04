"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buyStoragePack, cancelStoragePack, getStorageUsage, type StoragePackOffer, type StorageUsage } from "@/lib/api/media";
import { CREDITS_KEY, useCreditsBalance } from "@/hooks/use-credits";
import { onePress } from "@/lib/one-press";
import { CONFIRM_BUY, USD_NOTE, gbText, longDate, packCostLine, packErrorMessage, peaksText, renewalLine, shortBy } from "@/lib/storage-copy";

/**
 * "Add space" (Peakhour Drive Q4): the packs a customer can choose, their Peaks balance, a confirm step, and the packs they
 * already have with the date each renews and a Cancel. It mirrors the Peaks top-up flow on /dashboard/peaks: choose, see the
 * cost and the balance, confirm, one press at a time.
 *
 * ONE DIALOG, TWO DOORS: the storage meter and the 402 upload error both call `openAddSpace()`; the dialog is mounted once, in
 * the dashboard sidebar footer, and listens for it.
 */

export const ADD_SPACE_EVENT = "peakhour:add-space";

export function openAddSpace(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADD_SPACE_EVENT));
}

export type AddSpaceStep = "choose" | "confirm" | "cancel";

export interface AddSpacePanelProps {
  usage: StorageUsage;
  /** Spendable Peaks, or null when unknown / unlimited. */
  balance: number | null;
  step: AddSpaceStep;
  /** The pack picked in "choose" and shown in "confirm". */
  selectedGb: number | null;
  /** The owned pack being cancelled in the "cancel" step. */
  cancelId: string | null;
  busy: boolean;
  error: string | null;
  onSelect: (gb: number) => void;
  onContinue: () => void;
  onBack: () => void;
  onBuy: () => void;
  onAskCancel: (id: string) => void;
  onCancelPack: () => void;
}

export function AddSpacePanel(p: AddSpacePanelProps) {
  const { usage } = p;
  const offer = usage.catalog.find((c) => c.gb === p.selectedGb) ?? null;
  const cancelling = usage.packs.find((x) => x.id === p.cancelId) ?? null;

  if (p.step === "cancel" && cancelling) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          {cancelling.paused
            ? `The ${gbText(cancelling.gb)} GB pack is paused because your Peaks were short. Cancelling ends it now, so its space goes at once. Your files are not deleted; if you are then over your limit, new uploads wait until you free space or add a pack.`
            : `Stop renewing the ${gbText(cancelling.gb)} GB pack? You keep the space until ${longDate(cancelling.nextChargeAt)}, and nothing more is charged.`}
        </p>
        {p.error ? <p role="alert" className="text-sm text-destructive">{p.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={p.onBack} disabled={p.busy}>Keep the pack</Button>
          <Button variant="destructive" onClick={p.onCancelPack} disabled={p.busy} aria-busy={p.busy}>
            {p.busy ? "Cancelling…" : "Stop renewing"}
          </Button>
        </div>
      </div>
    );
  }

  if (p.step === "confirm" && offer) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <p className="font-medium">{gbText(offer.gb)} GB storage pack</p>
          <p className="text-sm text-muted-foreground">{peaksText(offer.peaksPerMonth)} Peaks a month</p>
        </div>
        <p className="text-sm">{CONFIRM_BUY(offer)}</p>
        <p className="text-sm text-muted-foreground">
          Your Peaks: <span className="font-medium tabular-nums text-foreground">{p.balance === null ? "—" : peaksText(p.balance)}</span>
        </p>
        {shortBy(offer, p.balance) > 0 ? (
          <p className="text-sm text-muted-foreground">
            You need {peaksText(shortBy(offer, p.balance))} more Peaks for this pack. <Link href="/dashboard/peaks" className="underline">Top up your Peaks</Link>, then come back.
          </p>
        ) : null}
        {p.error ? <p role="alert" className="text-sm text-destructive">{p.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={p.onBack} disabled={p.busy}>Back</Button>
          <Button onClick={p.onBuy} disabled={p.busy || shortBy(offer, p.balance) > 0} aria-busy={p.busy}>
            {p.busy ? "Buying…" : `Pay ${peaksText(offer.peaksPerMonth)} Peaks`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {usage.canBuyPacks && usage.catalog.length > 0 ? (
        <section aria-label="Choose a pack" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your Peaks: <span className="font-medium tabular-nums text-foreground">{p.balance === null ? "—" : peaksText(p.balance)}</span>
          </p>
          <ul role="radiogroup" aria-label="Storage packs" className="space-y-2">
            {usage.catalog.map((c: StoragePackOffer) => {
              const short = shortBy(c, p.balance);
              const picked = p.selectedGb === c.gb;
              return (
                <li key={c.gb} role="presentation">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    disabled={short > 0}
                    onClick={() => p.onSelect(c.gb)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${picked ? "border-primary ring-2 ring-primary/20" : ""}`}
                  >
                    <span>{packCostLine(c)}</span>
                    {short > 0 ? <span className="text-xs text-muted-foreground">Needs {peaksText(short)} more Peaks</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {p.balance !== null && usage.catalog.some((c) => shortBy(c, p.balance) > 0) ? (
            <p className="text-xs text-muted-foreground">
              <Link href="/dashboard/peaks" className="underline">Top up your Peaks</Link> to unlock the larger packs.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={p.onContinue} disabled={p.selectedGb === null}>Continue</Button>
          </div>
        </section>
      ) : usage.source === "trial" ? (
        <p className="text-sm">
          You are on a trial, with {gbText(usage.limitGb ?? 0)} GB. <Link href="/dashboard/settings/billing" className="underline">Choose a plan</Link> to get more space.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Storage packs are not available on your account. Delete files you no longer need to free up space.</p>
      )}

      {usage.packs.length > 0 ? (
        <section aria-label="Your packs" className="space-y-2">
          <h3 className="text-sm font-medium">Your packs</h3>
          <ul className="space-y-2">
            {usage.packs.map((pack) => (
              <li key={pack.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{gbText(pack.gb)} GB</p>
                  <p className="text-xs text-muted-foreground">{renewalLine(pack)}</p>
                </div>
                {pack.cancelAtPeriodEnd ? null : (
                  <Button variant="outline" size="sm" onClick={() => p.onAskCancel(pack.id)}>
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">{USD_NOTE}</p>
    </div>
  );
}

export function AddSpaceDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<AddSpaceStep>("choose");
  const [selectedGb, setSelectedGb] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ★ONE PRESS, as on the Peaks page: a double click on Pay must never charge twice. The api locks and de-duplicates as well.
  const [press] = useState(onePress);

  // the same key and fetch as the sidebar meter (one request); `show` below refetches it explicitly each time the dialog opens
  const { data: cached, dataUpdatedAt } = useQuery({ queryKey: ["storage-usage"], queryFn: getStorageUsage, staleTime: 60_000 });
  const [openedAt, setOpenedAt] = useState(0);
  // only data read AFTER the dialog opened is shown: a cached copy up to a minute old could offer a pack that was just cancelled
  const usage = cached && dataUpdatedAt >= openedAt ? cached : undefined;
  const { data: credits } = useCreditsBalance();
  const balance = credits ? (credits.unlimited ? null : credits.remaining) : null;

  useEffect(() => {
    const show = () => {
      setStep("choose");
      setSelectedGb(null);
      setCancelId(null);
      setError(null);
      setOpenedAt(Date.now());
      setOpen(true);
      // the balance and the pack list are read fresh every time the dialog opens
      void qc.refetchQueries({ queryKey: ["storage-usage"] });
      void qc.refetchQueries({ queryKey: [CREDITS_KEY] });
    };
    window.addEventListener(ADD_SPACE_EVENT, show);
    return () => window.removeEventListener(ADD_SPACE_EVENT, show);
  }, [qc]);

  // The pack being confirmed or cancelled can vanish under a refresh (the cron removed it, the catalog changed): go back to the list
  // rather than sit on a step with nothing to show.
  useEffect(() => {
    if (!usage) return;
    if (step === "cancel" && !usage.packs.some((p) => p.id === cancelId)) setStep("choose");
    if (step === "confirm" && !usage.catalog.some((c) => c.gb === selectedGb)) setStep("choose");
  }, [usage, step, cancelId, selectedGb]);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["storage-usage"] });
    void qc.invalidateQueries({ queryKey: [CREDITS_KEY] });
  }, [qc]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (!press.take()) return;
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(packErrorMessage(err));
        refresh();
      } finally {
        setBusy(false);
        press.release();
      }
    },
    [press, refresh],
  );

  const buy = () =>
    run(async () => {
      if (selectedGb === null) return;
      const r = await buyStoragePack(selectedGb);
      toast.success(r.duplicate ? "That pack is already added." : `${gbText(r.pack.gb)} GB added to your Drive.`);
      refresh();
      setStep("choose");
      setSelectedGb(null);
    });

  const stop = () =>
    run(async () => {
      if (!cancelId) return;
      const r = await cancelStoragePack(cancelId);
      toast.success(r.spaceEndsNow ? "The pack has ended and its space is gone. Your files are not deleted." : "The pack will not renew. You keep the space until its renewal date.");
      refresh();
      setStep("choose");
      setCancelId(null);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // not while a purchase is in flight: closing would hide its result (a charge may or may not have happened)
        if (!v && busy) return;
        setOpen(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add space</DialogTitle>
          <DialogDescription>
            Extra space is a pack you choose, paid in Peaks. Nothing is charged for the space you use.
          </DialogDescription>
        </DialogHeader>
        {usage ? (
          <AddSpacePanel
            usage={usage}
            balance={balance}
            step={step}
            selectedGb={selectedGb}
            cancelId={cancelId}
            busy={busy}
            error={error}
            onSelect={setSelectedGb}
            onContinue={() => setStep("confirm")}
            onBack={() => {
              setStep("choose");
              setError(null);
            }}
            onBuy={() => void buy()}
            onAskCancel={(id) => {
              setCancelId(id);
              setStep("cancel");
              setError(null);
            }}
            onCancelPack={() => void stop()}
          />
        ) : (
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        )}
      </DialogContent>
    </Dialog>
  );
}
