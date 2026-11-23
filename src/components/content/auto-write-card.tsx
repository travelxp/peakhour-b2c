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
  AUTO_WRITE_COPY,
  autoWriteErrorMessage,
  confirmSentence,
  parseCap,
  priceLine,
  suggestedCap,
  usageLine,
  type AutoWriteInput,
  type AutoWriteJobKey,
  type AutoWriteStatus,
} from "@/lib/auto-write";

export const AUTO_WRITE_KEY = ["content-auto-write"] as const;

/** Reads the setting: each job on or off, the one monthly limit, this month's use and today's price per draft. */
export function useAutoWrite() {
  return useQuery({
    queryKey: AUTO_WRITE_KEY,
    queryFn: () => api.get<AutoWriteStatus>("/v1/content/auto-write"),
    staleTime: 30_000,
  });
}

interface ViewProps {
  status: AutoWriteStatus;
  busy: boolean;
  error: string | null;
  /** May this person change it? The api takes an owner or admin. */
  canChange: boolean;
  /** The limit as typed in the box under the jobs. */
  limitText: string;
  onLimitText: (text: string) => void;
  /** The job whose confirmation is showing, with the limit typed in it. */
  confirming: AutoWriteJobKey | null;
  confirmLimitText: string;
  onConfirmLimitText: (text: string) => void;
  /** A switch was flipped: ON asks first, OFF goes straight through. */
  onToggle: (job: AutoWriteJobKey, on: boolean) => void;
  onSaveLimit: () => void;
  onYes: () => void;
  onNo: () => void;
}

/** The card, as a pure view of the api's status. */
export function AutoWriteCardView(p: ViewProps) {
  const { status } = p;
  const usage = usageLine(status);
  const limitCap = parseCap(p.limitText);
  const asking = p.confirming ? status.jobs.find((j) => j.job === p.confirming) : undefined;
  const confirmCap = parseCap(p.confirmLimitText);
  const askingPrice = asking?.pricePerDraftPeaks ?? null;
  // The limit must cover a draft of every job that is on, and of the one being asked about (the api checks the same).
  const dearest = Math.max(0, ...status.jobs.filter((j) => j.enabled || j.job === p.confirming).map((j) => j.pricePerDraftPeaks ?? 0));
  // What the dialog says: the sentence when the limit is good, otherwise WHY Yes is greyed out (a bad number, or one below a draft). Nothing while it is closed.
  const confirmText = !asking ? "" : confirmCap === null ? AUTO_WRITE_COPY.limitInvalid : askingPrice === null ? AUTO_WRITE_COPY.noPrice : confirmCap < dearest ? AUTO_WRITE_COPY.limitBelowPrice : confirmSentence(asking.label, askingPrice, confirmCap);
  const limitBelow = limitCap !== null && limitCap < dearest;
  const showLimit = p.canChange && (status.monthlyCapPeaks !== null || status.jobs.some((j) => j.enabled));
  return (
    <Card data-testid="auto-write-card">
      <CardHeader>
        <CardTitle>{AUTO_WRITE_COPY.title}</CardTitle>
        <CardDescription>{AUTO_WRITE_COPY.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border" data-testid="auto-write-jobs">
          {status.jobs.map((j) => {
            const price = priceLine(j.pricePerDraftPeaks);
            const id = `auto-write-${j.job}`;
            return (
              <li key={j.job} className="space-y-2 p-3" data-testid={`auto-write-job-${j.job}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label htmlFor={id} className="text-sm font-medium">
                      {j.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{j.what}</p>
                    {price ? (
                      <p className="text-xs" data-testid={`auto-write-price-${j.job}`}>
                        {price}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{AUTO_WRITE_COPY.noPrice}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={j.enabled ? "default" : "outline"}>{j.enabled ? AUTO_WRITE_COPY.on : AUTO_WRITE_COPY.off}</Badge>
                    <Switch id={id} checked={j.enabled} disabled={p.busy || !p.canChange || (!j.enabled && j.pricePerDraftPeaks === null)} onCheckedChange={(on) => p.onToggle(j.job, on)} />
                  </div>
                </div>
                {j.needsReaccept ? (
                  <div className="flex flex-wrap items-center gap-2" data-testid={`auto-write-reaccept-${j.job}`}>
                    <p role="status" className="text-xs text-muted-foreground">
                      {AUTO_WRITE_COPY.needsReaccept}
                    </p>
                    {p.canChange ? (
                      <Button size="sm" variant="outline" disabled={p.busy} onClick={() => p.onToggle(j.job, true)}>
                        {AUTO_WRITE_COPY.reaccept}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {status.monthlyCapPeaks === null ? (
          <p className="text-sm text-muted-foreground" data-testid="auto-write-nolimit">
            {AUTO_WRITE_COPY.noLimit}
          </p>
        ) : null}
        {usage ? (
          <p className="text-sm" data-testid="auto-write-usage">
            {usage}
          </p>
        ) : null}
        {showLimit ? (
          <div className="flex flex-wrap items-end gap-2" data-testid="auto-write-limit">
            <div className="space-y-1">
              <Label htmlFor="auto-write-limit" className="text-sm font-medium">
                {AUTO_WRITE_COPY.limitLabel}
              </Label>
              <Input id="auto-write-limit" inputMode="numeric" className="w-40" value={p.limitText} onChange={(e) => p.onLimitText(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" disabled={p.busy || limitCap === null || limitCap === status.monthlyCapPeaks || limitCap < dearest} onClick={p.onSaveLimit}>
              {AUTO_WRITE_COPY.saveLimit}
            </Button>
            {limitBelow ? (
              <p role="status" className="basis-full text-xs text-muted-foreground" data-testid="auto-write-limit-hint">
                {AUTO_WRITE_COPY.limitBelowPrice}
              </p>
            ) : null}
          </div>
        ) : null}
        {!p.canChange ? <p className="text-xs text-muted-foreground">{AUTO_WRITE_COPY.adminOnly}</p> : null}
        {p.error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="auto-write-error">
            {p.error}
          </p>
        ) : null}
      </CardContent>
      <AlertDialog open={p.confirming !== null} onOpenChange={(o) => (o ? undefined : p.onNo())}>
        <AlertDialogContent data-testid="auto-write-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{AUTO_WRITE_COPY.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription data-testid="auto-write-confirm-text">{confirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="auto-write-confirm-limit" className="text-sm font-medium">
              {AUTO_WRITE_COPY.limitLabel}
            </Label>
            <Input id="auto-write-confirm-limit" inputMode="numeric" value={p.confirmLimitText} onChange={(e) => p.onConfirmLimitText(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={p.onNo}>{AUTO_WRITE_COPY.no}</AlertDialogCancel>
            <AlertDialogAction disabled={p.busy || confirmCap === null || askingPrice === null || confirmCap < dearest} onClick={p.onYes}>
              {AUTO_WRITE_COPY.yes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** The container: reads the setting, asks before turning a job on, re-reads after every change. */
export function AutoWriteCard() {
  const query = useAutoWrite();
  const { org, orgs } = useAuth();
  const canChange = driveAbilities(orgs?.find((o) => o._id === org?._id)?.role).isAdmin;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AutoWriteJobKey | null>(null);
  const [confirmLimitText, setConfirmLimitText] = useState("");
  const [limitDraft, setLimitDraft] = useState<string | null>(null);

  if (!query.data) {
    if (query.isError) {
      return (
        <Card data-testid="auto-write-load-error">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <p role="alert" className="text-sm text-destructive">
              {AUTO_WRITE_COPY.loadFailed}
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

  async function save(input: AutoWriteInput) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.put("/v1/content/auto-write", input);
    } catch (err) {
      setError(autoWriteErrorMessage(err));
    } finally {
      // After a limit save the box shows what the api has (a refused limit does not stay typed in as if it were saved). A job toggle leaves a typed, unsaved limit alone.
      if (input.monthlyCapPeaks !== undefined) setLimitDraft(null);
      await query.refetch().catch(() => null);
      setBusy(false);
    }
  }

  const priceOf = (job: AutoWriteJobKey) => status.jobs.find((j) => j.job === job)?.pricePerDraftPeaks ?? null;
  const limitText = limitDraft ?? (status.monthlyCapPeaks === null ? "" : String(status.monthlyCapPeaks));

  return (
    <AutoWriteCardView
      status={status}
      busy={busy}
      error={error}
      canChange={canChange}
      limitText={limitText}
      onLimitText={setLimitDraft}
      confirming={confirming}
      confirmLimitText={confirmLimitText}
      onConfirmLimitText={setConfirmLimitText}
      onToggle={(job, on) => {
        if (!on) return void save({ jobs: { [job]: { enabled: false } } });
        const price = priceOf(job);
        if (price === null) return;
        setConfirmLimitText(String(status.monthlyCapPeaks ?? suggestedCap(price)));
        setConfirming(job);
      }}
      onSaveLimit={() => {
        const cap = parseCap(limitText);
        if (cap === null) return;
        void save({ monthlyCapPeaks: cap });
      }}
      onYes={() => {
        const job = confirming;
        const cap = parseCap(confirmLimitText);
        const price = job ? priceOf(job) : null;
        setConfirming(null);
        if (!job || cap === null || price === null) return;
        // What the merchant sees on screen is what is accepted: the price from this read travels back, and the api refuses it if it moved.
        void save({ monthlyCapPeaks: cap, jobs: { [job]: { enabled: true, acceptedPricePeaks: price } } });
      }}
      onNo={() => setConfirming(null)}
    />
  );
}
