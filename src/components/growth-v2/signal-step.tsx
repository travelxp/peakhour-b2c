"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { adsErrorMessage } from "@/lib/ads-error-message";
import { googleConversionErrorMessage } from "@/lib/google-conversion-view";
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
  needsAChoice,
  signalStateSentence,
  type PlatformSignal,
  type SignalPlatform,
  type SignalReadiness,
} from "@/lib/growth-v2-signal";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
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
  /** The account's billing currency, when known. Google's conversion action takes it. */
  currency?: string;
}

export interface SignalStepViewProps {
  readiness: SignalReadiness | undefined;
  /** The merchant's words for the focused outcome, when the mandate has a focus. */
  focusLabel?: string;
  accounts: Record<SignalPlatform, AdAccountChoice[]>;
  chosenAccount: Record<SignalPlatform, string | undefined>;
  /** A platform whose ad-account list could not be read: said on its row, not blamed on the merchant. */
  accountsFailed?: Partial<Record<SignalPlatform, boolean>>;
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
  const open = needsAChoice(row.state);
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
          {p.accountsFailed?.[row.platform] ? (
            <p role="alert" className="text-xs text-destructive-on-tint">
              We couldn&apos;t load your {label} ad accounts. Reload the page to try again.
            </p>
          ) : null}
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

/** The account to use: the pick if it is still offered, else the first. What the select shows is what is sent. */
export function effectiveAccount(list: readonly AdAccountChoice[], picked: string | undefined): string | undefined {
  return list.some((a) => a.id === picked) ? picked : list[0]?.id;
}

/** Codes the Meta dataset routes write for the merchant (`routes/meta-ads`). */
const META_MERCHANT_FACING: ReadonlySet<string> = new Set([
  "DATASET_NOT_FOUND",
  "DATASET_UNAVAILABLE",
  "DATASET_ID_UNSUPPORTED",
  "AD_ACCOUNT_NOT_ALLOWED",
  "CONNECTION_GONE",
  "NO_BUSINESS",
]);
const UNTRACKED_MERCHANT_FACING: ReadonlySet<string> = new Set(["NOT_CONNECTED", "NO_BUSINESS"]);

/**
 * What a failure says, never a raw message: an api code written for the merchant shows its sentence (Google's through
 * the panel's own table), anything else is the fallback with the request reference. A plain Error is one this app
 * threw itself (a currency it does not know), and is ours to show.
 */
export function signalErrorMessage(platform: SignalPlatform | "untracked", err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (platform === "google_ads") return googleConversionErrorMessage(err, fallback);
    return adsErrorMessage(err, fallback, platform === "meta" ? META_MERCHANT_FACING : UNTRACKED_MERCHANT_FACING);
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

/** The step, wired to the api. */
export function SignalStep({
  optimizeFor,
  focusLabel,
  onContinue,
}: {
  optimizeFor: "count" | "value";
  focusLabel?: string;
  onContinue: () => void;
}) {
  const { business } = useAuth();
  const readiness = useSignalReadiness();
  const actions = useSignalActions();
  // BUSINESS-SCOPED, like the readiness: another business's ad accounts must never be offered, or defaulted to.
  const scope = business?._id ?? "none";
  const meta = useQuery({ queryKey: ["growth-v2", "signal", scope, "meta-accounts"], queryFn: () => metaAdsApi.listAdAccounts(), enabled: !!business, retry: false });
  const google = useQuery({ queryKey: ["growth-v2", "signal", scope, "google-accounts"], queryFn: () => googleAdsApi.listAdAccounts(), enabled: !!business, retry: false });
  // an account picked, or an error shown, for one business is not for the next
  const [pick, setPick] = useState<{ scope: string; chosen: Record<SignalPlatform, string | undefined> }>({ scope, chosen: { meta: undefined, google_ads: undefined } });
  const [failure, setFailure] = useState<{ scope: string; message: string } | undefined>(undefined);
  const picked = pick.scope === scope ? pick.chosen : { meta: undefined, google_ads: undefined };
  const error = failure?.scope === scope ? failure.message : undefined;
  const accounts: Record<SignalPlatform, AdAccountChoice[]> = {
    meta: (meta.data?.accounts ?? []).map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
    google_ads: (google.data?.adAccounts ?? []).map((a) => ({ id: a.id, name: a.name, currency: a.currencyCode })),
  };
  // THE ACCOUNT THAT IS SHOWN IS THE ACCOUNT THAT IS USED: a pick that is no longer in the list falls back to the first.
  const chosen: Record<SignalPlatform, string | undefined> = {
    meta: effectiveAccount(accounts.meta, picked.meta),
    google_ads: effectiveAccount(accounts.google_ads, picked.google_ads),
  };
  const busy = actions.setUpMeta.isPending || actions.setUpGoogle.isPending || actions.acceptUntracked.isPending;
  const fail = (platform: SignalPlatform | "untracked", what: string) => (e: unknown) => {
    const message = signalErrorMessage(platform, e, `We couldn't ${what}. Try again in a moment.`);
    setFailure({ scope, message });
    toast.error(message);
  };
  const clear = () => setFailure(undefined);

  return (
    <SignalStepView
      readiness={readiness.data}
      focusLabel={focusLabel}
      accounts={accounts}
      chosenAccount={chosen}
      accountsFailed={{ meta: meta.isError, google_ads: google.isError }}
      onChooseAccount={(platform, id) => setPick({ scope, chosen: { ...picked, [platform]: id } })}
      busy={busy}
      error={error ?? (readiness.isError ? "We couldn't read your connections. Try again in a moment." : undefined)}
      onSetUp={(platform) => {
        clear();
        const id = chosen[platform];
        if (!id) return setFailure({ scope, message: "There is no ad account to set this up on." });
        if (platform === "meta") {
          actions.setUpMeta.mutate(id, { onSuccess: clear, onError: fail("meta", "set up the dataset") });
          return;
        }
        // THE ACCOUNT'S OWN CURRENCY, never the mandate's and never a guess: it becomes the default-value currency in their account.
        const currency = accounts.google_ads.find((a) => a.id === id)?.currency;
        if (!currency) return setFailure({ scope, message: "We don't know this Google Ads account's currency yet. Reconnect Google Ads and try again." });
        actions.setUpGoogle.mutate({ adAccountId: id, signal: { currency, optimizeFor } }, { onSuccess: clear, onError: fail("google_ads", "set up the conversion action") });
      }}
      onAcceptUntracked={(platform) => {
        clear();
        actions.acceptUntracked.mutate(platform, { onSuccess: clear, onError: fail("untracked", "save that") });
      }}
      onContinue={onContinue}
    />
  );
}
