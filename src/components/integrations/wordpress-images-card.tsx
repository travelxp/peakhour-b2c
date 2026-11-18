"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { driveAbilities } from "@/lib/drive/files-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  WP_IMAGES_COPY,
  confirmSentence,
  parseCap,
  priceLine,
  suggestedCap,
  usageLine,
  wpImagesErrorMessage,
  type AiFeaturedImagesInput,
  type AiFeaturedImagesStatus,
} from "@/lib/wordpress-ai-images";

export const AI_FEATURED_IMAGES_KEY = ["ai-featured-images"] as const;

/** Reads the setting: on or off, the limit, this month's use and today's price per image. */
export function useAiFeaturedImages() {
  return useQuery({
    queryKey: AI_FEATURED_IMAGES_KEY,
    queryFn: () => api.get<AiFeaturedImagesStatus>("/v1/ai-featured-images"),
    staleTime: 30_000,
  });
}

interface ViewProps {
  status: AiFeaturedImagesStatus;
  busy: boolean;
  error: string | null;
  /** May this person change it? The api takes an owner or admin. */
  canChange: boolean;
  /** The limit as typed in the box under the switch. */
  limitText: string;
  onLimitText: (text: string) => void;
  /** The confirmation is showing, with the limit typed in it. */
  confirming: boolean;
  confirmLimitText: string;
  onConfirmLimitText: (text: string) => void;
  /** The switch was flipped: ON asks first, OFF goes straight through. */
  onToggle: (on: boolean) => void;
  onSaveLimit: () => void;
  onYes: () => void;
  onNo: () => void;
}

/** The card, as a pure view of the api's status. */
export function WordPressImagesCardView(p: ViewProps) {
  const { status } = p;
  const price = priceLine(status.pricePerImagePeaks);
  const usage = status.enabled ? usageLine(status) : null;
  const confirmCap = parseCap(p.confirmLimitText);
  const limitCap = parseCap(p.limitText);
  const priced = status.pricePerImagePeaks !== null;
  return (
    <Card data-testid="wp-images-card">
      <CardHeader>
        <CardTitle>{WP_IMAGES_COPY.title}</CardTitle>
        <CardDescription>{WP_IMAGES_COPY.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {price ? (
          <p className="text-sm" data-testid="wp-images-price">
            {price}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{WP_IMAGES_COPY.noPrice}</p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-2" data-testid="wp-images-switch">
          <div className="space-y-0.5">
            <Label htmlFor="wp-ai-images" className="text-sm font-medium">
              {WP_IMAGES_COPY.switchLabel}
            </Label>
            <p className="text-xs text-muted-foreground">{WP_IMAGES_COPY.switchHelp}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.enabled ? "default" : "outline"}>{status.enabled ? WP_IMAGES_COPY.on : WP_IMAGES_COPY.off}</Badge>
            <Switch id="wp-ai-images" checked={status.enabled} disabled={p.busy || !p.canChange || (!status.enabled && !priced)} onCheckedChange={p.onToggle} />
          </div>
        </div>
        {status.needsReaccept ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="wp-images-reaccept">
            <p role="status" className="text-sm text-muted-foreground">
              {WP_IMAGES_COPY.needsReaccept}
            </p>
            {p.canChange ? (
              <Button size="sm" variant="outline" disabled={p.busy} onClick={() => p.onToggle(true)}>
                {WP_IMAGES_COPY.reaccept}
              </Button>
            ) : null}
          </div>
        ) : null}
        {usage ? (
          <p className="text-sm" data-testid="wp-images-usage">
            {usage}
          </p>
        ) : null}
        {status.enabled && p.canChange ? (
          <div className="flex flex-wrap items-end gap-2" data-testid="wp-images-limit">
            <div className="space-y-1">
              <Label htmlFor="wp-ai-images-limit" className="text-sm font-medium">
                {WP_IMAGES_COPY.limitLabel}
              </Label>
              <Input id="wp-ai-images-limit" inputMode="numeric" className="w-40" value={p.limitText} onChange={(e) => p.onLimitText(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" disabled={p.busy || limitCap === null || limitCap === status.monthlyCapPeaks} onClick={p.onSaveLimit}>
              {WP_IMAGES_COPY.saveLimit}
            </Button>
          </div>
        ) : null}
        {!p.canChange ? <p className="text-xs text-muted-foreground">{WP_IMAGES_COPY.adminOnly}</p> : null}
        {p.error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="wp-images-error">
            {p.error}
          </p>
        ) : null}
      </CardContent>
      <AlertDialog open={p.confirming} onOpenChange={(o) => (o ? undefined : p.onNo())}>
        <AlertDialogContent data-testid="wp-images-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{WP_IMAGES_COPY.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{status.pricePerImagePeaks !== null && confirmCap !== null ? confirmSentence(status.pricePerImagePeaks, confirmCap) : WP_IMAGES_COPY.limitInvalid}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="wp-ai-images-confirm-limit" className="text-sm font-medium">
              {WP_IMAGES_COPY.limitLabel}
            </Label>
            <Input id="wp-ai-images-confirm-limit" inputMode="numeric" value={p.confirmLimitText} onChange={(e) => p.onConfirmLimitText(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={p.onNo}>{WP_IMAGES_COPY.no}</AlertDialogCancel>
            <AlertDialogAction disabled={confirmCap === null || status.pricePerImagePeaks === null || confirmCap < status.pricePerImagePeaks} onClick={p.onYes}>
              {WP_IMAGES_COPY.yes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** The container: reads the setting, asks before turning it on, re-reads after every change. */
export function WordPressImagesCard() {
  const query = useAiFeaturedImages();
  const { org, orgs } = useAuth();
  const canChange = driveAbilities(orgs?.find((o) => o._id === org?._id)?.role).isAdmin;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmLimitText, setConfirmLimitText] = useState("");
  const [limitDraft, setLimitDraft] = useState<string | null>(null);

  if (!query.data) {
    if (query.isError) {
      return (
        <Card data-testid="wp-images-load-error">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <p role="alert" className="text-sm text-destructive">
              {WP_IMAGES_COPY.loadFailed}
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
  const status = query.data;

  async function save(input: AiFeaturedImagesInput) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.put("/v1/ai-featured-images", input);
      setLimitDraft(null);
    } catch (err) {
      setError(wpImagesErrorMessage(err));
    } finally {
      await query.refetch().catch(() => null);
      setBusy(false);
    }
  }

  // What the merchant sees on screen is what is accepted: the price from this read travels back with the save, and the api refuses it if it moved.
  const price = status.pricePerImagePeaks;
  const limitText = limitDraft ?? (status.monthlyCapPeaks === null ? "" : String(status.monthlyCapPeaks));

  return (
    <WordPressImagesCardView
      status={status}
      busy={busy}
      error={error}
      canChange={canChange}
      limitText={limitText}
      onLimitText={setLimitDraft}
      confirming={confirming}
      confirmLimitText={confirmLimitText}
      onConfirmLimitText={setConfirmLimitText}
      onToggle={(on) => {
        if (!on) return void save({ enabled: false });
        if (price === null) return;
        setConfirmLimitText(String(status.monthlyCapPeaks ?? suggestedCap(price)));
        setConfirming(true);
      }}
      onSaveLimit={() => {
        const cap = parseCap(limitText);
        if (cap === null || price === null) return;
        void save({ enabled: true, monthlyCapPeaks: cap, acceptedPricePeaks: price });
      }}
      onYes={() => {
        const cap = parseCap(confirmLimitText);
        setConfirming(false);
        if (cap === null || price === null) return;
        void save({ enabled: true, monthlyCapPeaks: cap, acceptedPricePeaks: price });
      }}
      onNo={() => setConfirming(false)}
    />
  );
}
