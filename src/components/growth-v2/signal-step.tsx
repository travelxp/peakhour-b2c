"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { googleAdsApi } from "@/lib/api/google-ads";
import { metaAdsApi } from "@/lib/api/meta-ads";
import { useSignalActions, useSignalReadiness } from "@/lib/api/growth-v2-signal";
import {
  SIGNAL_FOCUS_NOTE,
  SIGNAL_PLATFORM_LABEL,
  SIGNAL_WHAT_IT_DOES,
  UNTRACKED_BADGE_LABEL,
  UNTRACKED_EXPLANATION,
  canContinue,
  continueBlockedReason,
  signalStateSentence,
  type PlatformSignal,
  type SignalPlatform,
  type SignalReadiness,
} from "@/lib/growth-v2-signal";
import { useQuery } from "@tanstack/react-query";
import { MeasurementBadge } from "./measurement-badge";
import { ToneBadge } from "./tone";

/**
 * First run, step 4: switch on the signal (C3).
 *
 * The platforms bid on the sales Peakhour tells them about, so First-run does not
 * finish until each connected platform has a signal or the merchant has said, in
 * so many words, that it runs without one. That choice is shown afterwards as the
 * "Not tracked" measurement badge.
 *
 * `SignalStepView` is the pure half (rendered by the tests); `SignalStep` wires it
 * to the api. Whether Continue is on is the api's `complete`, never computed here.
 */

export interface AdAccountChoice {
  id: string;
  name: string;
}

export interface SignalStepViewProps {
  readiness: SignalReadiness | undefined;
  /** The merchant's words for the focused outcome, when the mandate has a focus. */
  focusLabel?: string;
  accounts: Record<SignalPlatform, AdAccountChoice[]>;
  chosenAccount: Record<SignalPlatform, string | undefined>;
  onChooseAccount: (platform: SignalPlatform, id: string) => void;
  onSetUp: (platform: SignalPlatform) => void;
  onAcceptUntracked: (platform: SignalPlatform) => void;
  onContinue: () => void;
  busy?: boolean;
  error?: string;
}

export function SignalStepView(p: SignalStepViewProps) {
  const blocked = continueBlockedReason(p.readiness);
  return (
    <Card>
      <CardHeader>
        <CardTitle>4 &middot; Tell the platforms which sales are yours</CardTitle>
        <CardDescription>
          Meta and Google bid on the sales they are told about. Switch the signal on for each platform you connected.
          {p.focusLabel ? ` ${SIGNAL_FOCUS_NOTE(p.focusLabel)}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {p.error ? (
          <p role="alert" className="text-sm text-destructive-on-tint">
            {p.error}
          </p>
        ) : null}
        {!p.readiness ? (
          <p className="text-sm text-muted-foreground" aria-busy="true">
            Checking your connections.
          </p>
        ) : (
          <div className="divide-y">
            {p.readiness.platforms.map((row) => (
              <PlatformRow key={row.platform} row={row} {...p} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {blocked ? <span className="text-xs text-muted-foreground">{blocked}</span> : null}
          <Button type="button" onClick={p.onContinue} disabled={!canContinue(p.readiness) || p.busy}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformRow({ row, ...p }: { row: PlatformSignal } & SignalStepViewProps) {
  const label = SIGNAL_PLATFORM_LABEL[row.platform];
  const accounts = p.accounts[row.platform];
  const chosen = p.chosenAccount[row.platform] ?? accounts[0]?.id;
  const open = row.state === "needed" || row.state === "needs_primary_goal";
  return (
    <div className="grid gap-2 py-3" data-platform={row.platform} data-state={row.state}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm font-medium">{label}</b>
        {row.state === "ready" ? <ToneBadge tone="good" dot>On</ToneBadge> : null}
        {row.state === "untracked_accepted" ? <MeasurementBadge state="untracked" /> : null}
        {row.state === "not_connected" ? <ToneBadge>Not connected</ToneBadge> : null}
        {open ? <ToneBadge tone="warn" dot>Needs a choice</ToneBadge> : null}
      </div>
      <p className="text-xs text-muted-foreground">{signalStateSentence(row)}</p>
      {row.state === "untracked_accepted" ? <p className="text-xs text-muted-foreground">{UNTRACKED_EXPLANATION}</p> : null}
      {open ? (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">{SIGNAL_WHAT_IT_DOES[row.platform]}</p>
          <div className="flex flex-wrap items-center gap-2">
            {accounts.length > 1 ? (
              <select
                aria-label={`${label} account`}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={chosen}
                onChange={(e) => p.onChooseAccount(row.platform, e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="button" size="sm" onClick={() => p.onSetUp(row.platform)} disabled={p.busy || !chosen}>
              {row.platform === "meta" ? "Pick or create my dataset" : "Set up my conversion action"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => p.onAcceptUntracked(row.platform)} disabled={p.busy}>
              Run without a signal
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Running without one shows as &ldquo;{UNTRACKED_BADGE_LABEL}&rdquo;. {UNTRACKED_EXPLANATION}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** The step, wired to the api. */
export function SignalStep({
  currency,
  optimizeFor,
  focusLabel,
  onContinue,
}: {
  currency: string;
  optimizeFor: "count" | "value";
  focusLabel?: string;
  onContinue: () => void;
}) {
  const readiness = useSignalReadiness();
  const actions = useSignalActions();
  const meta = useQuery({ queryKey: ["growth-v2", "signal", "meta-accounts"], queryFn: () => metaAdsApi.listAdAccounts(), retry: false });
  const google = useQuery({ queryKey: ["growth-v2", "signal", "google-accounts"], queryFn: () => googleAdsApi.listAdAccounts(), retry: false });
  const [chosen, setChosen] = useState<Record<SignalPlatform, string | undefined>>({ meta: undefined, google_ads: undefined });
  const [error, setError] = useState<string | undefined>(undefined);
  const accounts: Record<SignalPlatform, AdAccountChoice[]> = {
    meta: (meta.data?.accounts ?? []).map((a) => ({ id: a.id, name: a.name })),
    google_ads: (google.data?.adAccounts ?? []).map((a) => ({ id: a.id, name: a.name })),
  };
  const busy = actions.setUpMeta.isPending || actions.setUpGoogle.isPending || actions.acceptUntracked.isPending;
  const fail = (what: string) => (e: unknown) => {
    const message = e instanceof Error && e.message ? e.message : `We couldn't ${what}. Try again in a moment.`;
    setError(message);
    toast.error(message);
  };

  return (
    <SignalStepView
      readiness={readiness.data}
      focusLabel={focusLabel}
      accounts={accounts}
      chosenAccount={chosen}
      onChooseAccount={(platform, id) => setChosen((c) => ({ ...c, [platform]: id }))}
      busy={busy}
      error={error ?? (readiness.isError ? "We couldn't read your connections. Try again in a moment." : undefined)}
      onSetUp={(platform) => {
        setError(undefined);
        const id = chosen[platform] ?? accounts[platform][0]?.id;
        if (!id) return setError("There is no ad account to set this up on.");
        if (platform === "meta") actions.setUpMeta.mutate(id, { onError: fail("set up the dataset") });
        else actions.setUpGoogle.mutate({ adAccountId: id, signal: { currency, optimizeFor } }, { onError: fail("set up the conversion action") });
      }}
      onAcceptUntracked={(platform) => {
        setError(undefined);
        actions.acceptUntracked.mutate(platform, { onError: fail("save that") });
      }}
      onContinue={onContinue}
    />
  );
}
