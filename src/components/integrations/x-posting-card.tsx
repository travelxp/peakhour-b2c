"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X_POSTING_COPY, confirmSentence, priceLine, xPostingErrorMessage, type XPostingPrices, type XPostingStatus } from "@/lib/x-posting";

export const X_POSTING_KEY = ["x-posting-status"] as const;

/** Reads the posting status: both prices and the switch. Shared by the X card, the composer and the held-post choices. */
export function useXPosting() {
  return useQuery({
    queryKey: X_POSTING_KEY,
    queryFn: () => api.get<XPostingStatus>("/v1/x/content/posting"),
    staleTime: 30_000,
  });
}

/**
 * The confirmation before posts with links are turned on: a title, ONE plain sentence with the price, and "Yes" and "No" (the owner's
 * words). "Yes" turns it on; "No" closes it and leaves it off. Turning it off never asks.
 */
export function XLinksConfirmDialog({
  open,
  prices,
  onYes,
  onNo,
}: {
  open: boolean;
  prices: XPostingPrices;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => (o ? undefined : onNo())}>
      <AlertDialogContent data-testid="x-links-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{X_POSTING_COPY.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmSentence(prices)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onNo}>{X_POSTING_COPY.no}</AlertDialogCancel>
          <AlertDialogAction onClick={onYes}>{X_POSTING_COPY.yes}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ViewProps {
  status: XPostingStatus;
  busy: boolean;
  error: string | null;
  /** The confirmation is showing. */
  confirming: boolean;
  /** The switch was flipped: ON asks first, OFF goes straight through. */
  onToggle: (on: boolean) => void;
  onYes: () => void;
  onNo: () => void;
}

/** The card, as a pure view of the api's status. */
export function XPostingCardView({ status, busy, error, confirming, onToggle, onYes, onNo }: ViewProps) {
  const prices = priceLine(status.prices);
  return (
    <Card data-testid="x-posting-card">
      <CardHeader>
        <CardTitle>{X_POSTING_COPY.title}</CardTitle>
        <CardDescription>{X_POSTING_COPY.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!status.connected ? <p className="text-sm text-muted-foreground">{X_POSTING_COPY.connectFirst}</p> : null}
        {status.connected ? (
          <>
            {prices ? (
              <p className="text-sm" data-testid="x-posting-prices">
                {prices}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{X_POSTING_COPY.noPrice}</p>
            )}
            <div className="flex flex-wrap items-start justify-between gap-2" data-testid="x-posting-switch">
              <div className="space-y-0.5">
                <Label htmlFor="x-post-links" className="text-sm font-medium">
                  {X_POSTING_COPY.switchLabel}
                </Label>
                <p className="text-xs text-muted-foreground">{X_POSTING_COPY.switchHelp}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={status.linksEnabled ? "default" : "outline"}>{status.linksEnabled ? X_POSTING_COPY.on : X_POSTING_COPY.off}</Badge>
                <Switch id="x-post-links" checked={status.linksEnabled} disabled={busy} onCheckedChange={onToggle} />
              </div>
            </div>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="x-posting-error">
            {error}
          </p>
        ) : null}
      </CardContent>
      <XLinksConfirmDialog open={confirming} prices={status.prices} onYes={onYes} onNo={onNo} />
    </Card>
  );
}

/** The container: reads the status, asks before turning links on, re-reads after every change. */
export function XPostingCard() {
  const query = useXPosting();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!query.data) {
    if (query.isError) {
      return (
        <Card data-testid="x-posting-load-error">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <p role="alert" className="text-sm text-destructive">
              {X_POSTING_COPY.loadFailed}
            </p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  async function setLinks(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.put("/v1/x/content/posting/links", { enabled });
    } catch (err) {
      setError(xPostingErrorMessage(err));
    } finally {
      await query.refetch().catch(() => null);
      setBusy(false);
    }
  }

  return (
    <XPostingCardView
      status={query.data}
      busy={busy}
      error={error}
      confirming={confirming}
      onToggle={(on) => (on ? setConfirming(true) : void setLinks(false))}
      onYes={() => {
        setConfirming(false);
        void setLinks(true);
      }}
      onNo={() => setConfirming(false)}
    />
  );
}
