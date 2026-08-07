"use client";

import { useState } from "react";
import { Check, Minus, Radar, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  useCreateSignal,
  useRemoveSignal,
  useSignalSnippet,
  useSignals,
  useUpdateSignal,
} from "@/hooks/use-signals";
import type { Signal, SignalProvider, SignalRail } from "@/lib/api/signals";
import {
  PARTNER_ID_CHANGE_WARNING,
  evidenceChain,
  providerLabel,
  railLabel,
  stateCopy,
} from "@/lib/signal-copy";

/**
 * Signals — the tracking tags on the customer's own website, and the evidence
 * they fire.
 *
 * `peakhour-mongodb/docs/idea/linkedin-ads-engine-v2.md` §5 item 1.
 *
 * ── ★WHY THIS SCREEN LOOKS LIKE A CHAIN AND NOT A TOGGLE ──────────────────
 *
 * §6 asks how "installed" is VERIFIED rather than asserted — "a fired event,
 * not a saved setting". The obvious UI for a tracking tag is a switch and a
 * green tick, and it would be a lie: a switch records that somebody CHOSE
 * something, which is the weakest of the three things we know and the one most
 * easily mistaken for installation.
 *
 * So the card renders the chain instead — set up → sent to your site → seen
 * working — with the middle step showing NOT APPLICABLE rather than "not done"
 * when the customer pastes the snippet themselves, because there is no step of
 * ours in that path to observe.
 *
 * ── ★AND THERE ARE NO NUMBERS ON IT ──────────────────────────────────────
 *
 * Not an omission. The collection stores no fire count on purpose — the beacon
 * is coalesced, so a counter would count observation windows rather than visits
 * — and a figure that is neither is a confident number nobody sourced sitting
 * next to real ones. "Last seen" is a fact; "1,284 hits" would not be.
 */
export default function SignalsPage() {
  const { data, isPending, isError, refetch, isFetching } = useSignals();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Signals</h2>
        <p className="text-muted-foreground">
          A small piece of code on your website that lets LinkedIn recognise the people
          who visit it. It&apos;s what makes retargeting — advertising to people who
          already came to your site — possible at all.
        </p>
      </div>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={Radar}
          title="We couldn&apos;t load your signals"
          description="That&apos;s on us — nothing has been changed. Try again in a moment."
          action={{ label: "Try again", onClick: () => void refetch() }}
        />
      ) : (
        <div className="space-y-4">
          {data.availableProviders.map((provider) => {
            const signal = data.signals.find((s) => s.provider === provider);
            return signal ? (
              <SignalCard
                key={provider}
                signal={signal}
                rails={data.availableRails}
                onRecheck={() => void refetch()}
                rechecking={isFetching}
              />
            ) : (
              <SetUpCard key={provider} provider={provider} rails={data.availableRails} />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The three levels, drawn so that "not applicable" cannot read as "not done". */
function EvidenceChain({ signal }: { signal: Signal }) {
  return (
    <ol className="space-y-3">
      {evidenceChain(signal).map((step) => (
        <li key={step.label} className="flex gap-3">
          <span
            aria-hidden
            className={
              step.reached === true
                ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
                : step.reached === false
                  ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground"
                  : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            }
          >
            {step.reached === true ? (
              <Check className="size-3" />
            ) : step.reached === null ? (
              <Minus className="size-3" />
            ) : (
              <X className="size-3 opacity-40" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {step.label}
              {/* ★SAID IN WORDS, NOT ONLY IN AN ICON. A dash and a cross are two
                  greys apart; "doesn't apply" is the whole difference between a
                  rail that cannot report and a rail that has not. */}
              {step.reached === null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  doesn&apos;t apply here
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SignalCard({
  signal,
  rails,
  onRecheck,
  rechecking,
}: {
  signal: Signal;
  rails: SignalRail[];
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [partnerId, setPartnerId] = useState(signal.partnerId);
  const [rail, setRail] = useState<SignalRail>(signal.delivery.rail);
  const [showSnippet, setShowSnippet] = useState(false);
  const update = useUpdateSignal();
  const remove = useRemoveSignal();
  const state = stateCopy(signal);

  const partnerIdChanged = partnerId.trim() !== signal.partnerId;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{providerLabel(signal.provider)}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Partner ID {signal.partnerId} · {railLabel(signal.delivery.rail)}
          </p>
        </div>
        <Badge
          variant={state.tone === "ok" ? "default" : "secondary"}
          className={state.tone === "attention" ? "border-amber-500/40 text-amber-700" : undefined}
        >
          {state.title}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm">{state.body}</p>

        <EvidenceChain signal={signal} />

        <div className="flex flex-wrap gap-2">
          {/* ★"CHECK AGAIN", NOT A LIVE POLL. We are not watching the customer's
              site; we look when asked. A spinner that implied otherwise would be
              a claim about our own behaviour that is not true. */}
          <Button variant="outline" size="sm" onClick={onRecheck} disabled={rechecking}>
            {rechecking ? "Checking…" : "Check again"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSnippet((v) => !v)}>
            {showSnippet ? "Hide snippet" : "Show snippet"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(signal.provider)}
          >
            Remove
          </Button>
        </div>

        {/* ★REMOVING OUR RECORD IS NOT REMOVING THEIR TAG, and saying so
            afterwards would be too late to be useful. */}
        {remove.isSuccess && (
          <p className="text-sm text-muted-foreground">
            Removed from Peakhour. If you pasted the snippet into your site yourself, it
            is still there and still loading — take it out of your pages to stop it.
          </p>
        )}

        {showSnippet && <SnippetBlock provider={signal.provider} />}

        {editing && (
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="partnerId">Partner ID</Label>
              <Input
                id="partnerId"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                placeholder="1234567"
              />
            </div>
            <div className="space-y-1.5">
              <Label>How it reaches your site</Label>
              <RailSelect value={rail} rails={rails} onChange={setRail} />
            </div>
            {/* ★THE COST OF THE CHANGE, BEFORE THE CLICK. Changing the Partner ID
                clears the verification, so the card drops back to "Not seen yet"
                — which reads as a regression to anybody who was not told why. */}
            {partnerIdChanged && (
              <p className="text-sm text-amber-700">{PARTNER_ID_CHANGE_WARNING}</p>
            )}
            {update.isError && (
              <p className="text-sm text-destructive">
                {update.error instanceof ApiError && update.error.code === "VALIDATION_ERROR"
                  ? "A Partner ID can only contain letters, numbers, hyphens and underscores."
                  : "We couldn't save that. Nothing has been changed — try again in a moment."}
              </p>
            )}
            <Button
              size="sm"
              disabled={update.isPending}
              onClick={() =>
                update.mutate(
                  {
                    provider: signal.provider,
                    patch: {
                      ...(partnerIdChanged ? { partnerId: partnerId.trim() } : {}),
                      ...(rail !== signal.delivery.rail ? { rail } : {}),
                    },
                  },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnippetBlock({ provider }: { provider: SignalProvider }) {
  const { data, isPending, isError } = useSignalSnippet(provider);
  const [copied, setCopied] = useState(false);

  if (isPending) return <Skeleton className="h-40 w-full" />;
  if (isError || !data) {
    // ★THE ONE ERROR WORTH ITS OWN SENTENCE. The api REFUSES to build a snippet
    // it cannot address correctly, rather than emitting one pointing at the
    // wrong deployment — which would be pasted somewhere permanent and could
    // never verify.
    return (
      <p className="text-sm text-destructive">
        We couldn&apos;t build your snippet just now. Don&apos;t paste an older copy —
        try again in a moment and use the fresh one.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{data.placement}</p>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
        <code>{data.snippet}</code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(data.snippet).then(() => setCopied(true));
        }}
      >
        {copied ? "Copied" : "Copy snippet"}
      </Button>
    </div>
  );
}

function RailSelect({
  value,
  rails,
  onChange,
}: {
  value: SignalRail;
  rails: SignalRail[];
  onChange: (r: SignalRail) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SignalRail)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {/* ★THE RAILS ARE THE SERVER'S. There is no Shopify option because there
            is no Shopify rail — nothing in the product can inject a script into
            a Shopify theme, and an option that recorded an intention we cannot
            act on would read as installed while installing nothing. A Shopify
            merchant pastes the snippet, which is `manual` and is a first-class
            choice here rather than a fallback. */}
        {rails.map((r) => (
          <SelectItem key={r} value={r}>
            {railLabel(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SetUpCard({ provider, rails }: { provider: SignalProvider; rails: SignalRail[] }) {
  const [partnerId, setPartnerId] = useState("");
  const [rail, setRail] = useState<SignalRail>(rails[0] ?? "manual");
  const create = useCreateSignal();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{providerLabel(provider)}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Not set up yet. You&apos;ll find your Partner ID in LinkedIn Campaign Manager
          under Account Assets → Insight Tag.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`partner-${provider}`}>Partner ID</Label>
          <Input
            id={`partner-${provider}`}
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            placeholder="1234567"
          />
        </div>
        <div className="space-y-1.5">
          <Label>How it should reach your site</Label>
          <RailSelect value={rail} rails={rails} onChange={setRail} />
        </div>
        {create.isError && (
          <p className="text-sm text-destructive">
            {create.error instanceof ApiError && create.error.code === "SIGNAL_EXISTS"
              ? "This business already has one of these — reload the page to see it."
              : create.error instanceof ApiError && create.error.code === "FORBIDDEN"
                ? "You need an admin or owner role on this business to set up a signal."
                : create.error instanceof ApiError && create.error.code === "VALIDATION_ERROR"
                  ? "A Partner ID can only contain letters, numbers, hyphens and underscores."
                  : "We couldn't save that. Nothing has been changed — try again in a moment."}
          </p>
        )}
        <Button
          size="sm"
          disabled={create.isPending || partnerId.trim().length === 0}
          onClick={() => create.mutate({ provider, partnerId: partnerId.trim(), rail })}
        >
          Set up
        </Button>
      </CardContent>
    </Card>
  );
}
