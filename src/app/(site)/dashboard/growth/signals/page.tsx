"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Check, Minus, Radar, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
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
  const { business } = useAuth();
  const { data, isPending, error, refetch, isFetching } = useSignals();
  // ★A REMOVAL MESSAGE THAT OUTLIVES THE CARD IT CAME FROM. Removing invalidates
  // the list, the signal disappears, and the card unmounts — so a notice
  // rendered inside it flashed for a few hundred milliseconds and vanished.
  // The one thing worth saying about removing ("your page is still loading the
  // tag") is exactly the thing that must survive.
  const [removed, setRemoved] = useState<string | null>(null);
  // ★AND IT STOPS THE MOMENT THAT PROVIDER IS CONFIGURED AGAIN. Nothing cleared
  // it, so after removing and re-adding, a present-tense "removed from
  // Peakhour … you will need to replace the snippet" sat above a working card,
  // advising something the customer had already done. DERIVED rather than
  // reset: a second piece of state that has to be cleared correctly is how the
  // first one got it wrong.
  const showRemoved = removed && !data?.signals.some((s) => s.provider === removed) ? removed : null;

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

      {showRemoved && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm">
          {providerLabel(showRemoved as SignalProvider)} removed from Peakhour. If the snippet
          is on your site it is still there and still loading — take it out of your pages
          to actually stop it. Setting it up again issues a NEW site key, so you will need
          to replace the snippet everywhere it appears.
        </p>
      )}

      {/* ★NO BUSINESS IS ITS OWN STATE, NOT A LOADING ONE — and round 1 made
          this worse rather than better. Adding `enabled: !!business` to the
          hook stopped the query firing, and a disabled TanStack query with no
          cached data reports `isPending` FOREVER: the fix replaced a correct
          "Pick a business first" message with a permanent skeleton, and made
          its own `NO_ACTIVE_BUSINESS` branch unreachable in the same commit.
          The pattern the rest of this app uses (`dashboard/pages`) checks the
          business before the query state, which is what this does now. */}
      {!business ? (
        <EmptyState
          icon={Radar}
          title="Pick a business first"
          description="Signals belong to one business at a time — choose one and they'll load."
        />
      ) : isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !data ? (
        // ★`!data`, NOT `isError`. A failed BACKGROUND refetch — a tab-away and
        // back on a flaky connection — sets `isError` while the loaded data is
        // still there, and branching on it would throw the whole screen away
        // over a transient blip.
        <EmptyState {...listErrorState(error, () => void refetch())} icon={Radar} />
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
                onRemoved={() => setRemoved(provider)}
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

/**
 * What to say when the list will not load, and whether a retry can help.
 *
 * ★"THAT'S ON US, TRY AGAIN" IS THE WRONG ANSWER TO TWO OF THESE. A caller with
 * no active business gets a 403 that no amount of retrying will change, and the
 * fix — pick a business — is one the customer can carry out. A remedy that
 * cannot resolve the failure is worse than none.
 */
export function listErrorState(error: unknown, onRetry: () => void) {
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === "NO_ACTIVE_BUSINESS") {
    return {
      title: "Pick a business first",
      description:
        "Signals belong to one business at a time — choose one and they'll load.",
    };
  }
  // ★THE TWO CODES THAT ACTUALLY REACH A CUSTOMER HERE, and neither was mapped.
  // A first cut listed `FORBIDDEN` — which this route does not emit, since it
  // carries no `requireRole` — while `NO_ORG` (from `requireOrg`) and
  // `UNAUTHORIZED` (an expired session whose refresh failed) both fell through
  // to "that's on us, try again", with a retry button that can never resolve
  // either. Mapping codes the route cannot produce and missing the ones it can
  // is worse than mapping none: it reads as coverage.
  if (code === "NO_ORG") {
    return {
      title: "This account isn't set up yet",
      description:
        "Signals belong to an organisation, and yours isn't finished. Finish onboarding and they'll load.",
    };
  }
  if (code === "UNAUTHORIZED") {
    return {
      title: "Your session has expired",
      description: "Sign in again and this will come straight back.",
    };
  }
  return {
    title: "We couldn't load your signals",
    description: "That's on us — nothing has been changed. Try again in a moment.",
    action: { label: "Try again", onClick: onRetry },
  };
}

/**
 * The message for a failed write.
 *
 * ★NO `FORBIDDEN` ENDS IN "TRY AGAIN". These routes are `requireRole("admin")`,
 * so an editor hits 403 on every write — being told to retry would be advice
 * that can never come good. And `NOTHING_TO_UPDATE` is its own code precisely
 * so that pressing Save with nothing changed does not produce a lecture about
 * Partner ID characters.
 *
 * ★AN EARLIER DRAFT CLAIMED "EVERY CODE THE API CAN RETURN" AND MISSED TWO —
 * `NO_ORG` and `UNAUTHORIZED`, both from middleware ABOVE the route, which is
 * exactly where a list built by reading one handler stops looking. The claim is
 * dropped rather than re-made: the default branch is the honest one, and every
 * code below is there because it was traced to a `fail(...)` that can reach a
 * customer.
 */
export function writeErrorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case "NO_ORG":
      return "This account isn't finished being set up — finish onboarding and try again.";
    case "UNAUTHORIZED":
      return "Your session has expired. Sign in again and nothing will be lost.";
    case "SIGNAL_EXISTS":
      return "This business already has one of these — reload the page to see it.";
    case "FORBIDDEN":
      return "You need an admin or owner role on this business to change a signal.";
    case "NO_ACTIVE_BUSINESS":
      return "Pick a business first — signals belong to one business at a time.";
    case "NOTHING_TO_UPDATE":
      return "Nothing was changed.";
    case "VALIDATION_ERROR":
      return "A Partner ID can only contain letters, numbers, hyphens and underscores.";
    case "NOT_FOUND":
      return "That signal isn't there any more — reload the page.";
    // ★FROM `csrfGuard`, MOUNTED APP-LEVEL ABOVE EVERY ROUTE — the layer a list
    // built by reading handlers AND their routers still stops one short of. The
    // client retries once, so these only surface when the retry fails too, and
    // the remedy is a reload rather than a wait.
    case "CSRF_MISSING":
    case "CSRF_INVALID":
      return "Your sign-in got out of step. Sign in again and nothing will be lost.";
    // ★NOT "TRY AGAIN IN A MOMENT". The rail is offered only to a business whose
    // WordPress site has checked in recently, and a site that has gone quiet
    // will not come back because the customer pressed Save again. Reachable
    // from the edit form, which deliberately keeps an unavailable stored rail
    // on screen, and from a second tab.
    case "RAIL_UNAVAILABLE":
      return "We haven't heard from a WordPress site on this business recently. If you've just updated the plugin it usually checks in within an hour of your site being visited — or choose to paste the snippet in yourself.";
    default:
      return "We couldn't save that. Nothing has been changed — try again in a moment.";
  }
}

/** The three levels, drawn so that "not applicable" cannot read as "not done". */
function EvidenceChain({ signal, railOffered }: { signal: Signal; railOffered: boolean }) {
  return (
    <ol className="space-y-3">
      {evidenceChain(signal, railOffered).map((step) => (
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
  onRemoved,
}: {
  signal: Signal;
  rails: SignalRail[];
  onRecheck: () => void;
  rechecking: boolean;
  onRemoved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [partnerId, setPartnerId] = useState(signal.partnerId);
  const [rail, setRail] = useState<SignalRail>(signal.delivery.rail);
  const [showSnippet, setShowSnippet] = useState(false);
  const update = useUpdateSignal();
  const remove = useRemoveSignal();
  // ★THE COPY NEEDS TO KNOW WHETHER THE API STILL OFFERS THIS RAIL. It is the
  // only evidence that the plugin is alive — the api withdraws the rail when a
  // site stops checking in — and without it the card promises a delivery the
  // api has already given up on.
  const railOffered = rails.includes(signal.delivery.rail);
  const state = stateCopy(signal, railOffered);

  const partnerIdChanged = partnerId.trim() !== signal.partnerId;
  const railChanged = rail !== signal.delivery.rail;
  const hasChanges = partnerIdChanged || railChanged;

  /** Reset the form to whatever the server now says, and open or close it.
   *  ★WITHOUT THIS, `useState(signal.partnerId)` keeps the value it was
   *  initialised with: after a save the card re-renders with fresh props and
   *  the form still shows what was typed, so cancelling and re-opening shows a
   *  stale draft as if it were stored. */
  const toggleEditing = (open: boolean) => {
    if (open) {
      setPartnerId(signal.partnerId);
      setRail(signal.delivery.rail);
      update.reset();
    }
    setEditing(open);
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">{providerLabel(signal.provider)}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Partner ID {signal.partnerId} · {railLabel(signal.delivery.rail)}
          </p>
        </div>
        {/* ★CardAction, NOT A flex-row OVERRIDE. CardHeader is a GRID, and
            tailwind-merge keeps both `grid` and `flex-row` because they are in
            different groups — so the override did nothing and the badge stacked
            underneath the title instead of sitting top-right. */}
        <CardAction>
          <Badge
            variant={state.tone === "ok" ? "default" : "secondary"}
            className={state.tone === "attention" ? "border-warning/40 text-warning-on-tint" : undefined}
          >
            {state.title}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm">{state.body}</p>

        <EvidenceChain signal={signal} railOffered={railOffered} />

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
          <Button variant="outline" size="sm" onClick={() => toggleEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          {/* ★CONFIRMED, BECAUSE IT IS NOT REVERSIBLE. Setting the signal up
              again mints a NEW site key, so every page already carrying the old
              snippet beacons to a key that no longer exists — silently, forever
              — and the customer has to re-paste everywhere. That is the whole
              reason this is a dialog and not a click. */}
          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={remove.isPending}
              >
                Remove
              </Button>
            }
            title={`Remove your ${providerLabel(signal.provider)}?`}
            description={
              "This removes our record and our proof that it works — not the code on your site. " +
              "Setting it up again issues a NEW site key, so you would have to replace the snippet " +
              "on every page that carries it."
            }
            variant="destructive"
            confirmLabel="Remove"
            onConfirm={() =>
              remove.mutate(signal.provider, { onSuccess: () => onRemoved() })
            }
          />
        </div>

        {/* A failed remove used to produce nothing at all: the button re-enabled
            and the card stayed, which reads as "it didn't register the click". */}
        {remove.isError && (
          <p className="text-sm text-destructive">{writeErrorMessage(remove.error)}</p>
        )}

        {showSnippet && <SnippetBlock provider={signal.provider} />}

        {editing && (
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-partner-${signal.provider}`}>Partner ID</Label>
              <Input
                id={`edit-partner-${signal.provider}`}
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
              <p className="text-sm text-warning-on-tint">{PARTNER_ID_CHANGE_WARNING}</p>
            )}
            {update.isError && (
              <p className="text-sm text-destructive">{writeErrorMessage(update.error)}</p>
            )}
            {/* ★DISABLED WHEN NOTHING CHANGED, rather than sending an empty
                patch. The api answers a `{}` body with a 400, and mapping that
                to a message means telling somebody who pressed Save without
                editing anything that their Partner ID is malformed. */}
            <Button
              size="sm"
              disabled={update.isPending || !hasChanges}
              onClick={() =>
                update.mutate(
                  {
                    provider: signal.provider,
                    patch: {
                      ...(partnerIdChanged ? { partnerId: partnerId.trim() } : {}),
                      ...(railChanged ? { rail } : {}),
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
  // ★KEYED ON THE SNIPPET ITSELF, NOT A BOOLEAN. A boolean never reset, so a
  // customer who copied, changed their Partner ID and saved would be looking at
  // a NEW snippet under a button still reading "Copied" — which is the precise
  // failure the change warning exists to prevent, one component further down.
  const [copiedText, setCopiedText] = useState<string | null>(null);
  // ★KEYED ON THE SNIPPET TOO, for the reason is. A boolean stayed
  // true across a refetch, so a stale "we could not copy that" sat under a NEW
  // snippet — the same bug as the stale "Copied", one state variable along.
  const [copyFailedFor, setCopyFailedFor] = useState<string | null>(null);

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
          // ★A FAILURE HERE MUST NOT BE SILENT. On an insecure origin
          // `navigator.clipboard` is undefined and the optional chain made the
          // click a no-op — no copy, no error, button unchanged — so the
          // customer walks away believing they have the snippet. A rejected
          // `writeText` (permission denied, document not focused) did the same.
          setCopyFailedFor(null);
          const clipboard = navigator.clipboard;
          if (!clipboard) {
            setCopyFailedFor(data.snippet);
            return;
          }
          clipboard.writeText(data.snippet).then(
            () => setCopiedText(data.snippet),
            () => setCopyFailedFor(data.snippet),
          );
        }}
      >
        {copiedText === data.snippet ? "Copied" : "Copy snippet"}
      </Button>
      {copyFailedFor === data.snippet && (
        <p className="text-sm text-destructive">
          Your browser wouldn&apos;t let us copy that. Select the snippet above and copy it
          by hand.
        </p>
      )}
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
  // ★A STORED RAIL THE SERVER NO LONGER OFFERS RENDERS AS TEXT, NOT AS A BLANK
  // SELECT. Radix suppresses the placeholder when `value` is set and portals
  // nothing when no item matches — so a `wordpress` row (which this PR
  // deliberately keeps alive) opened an edit form with an empty control under
  // the label "How it reaches your site", and Save disabled because nothing had
  // changed. The field looked broken on exactly the row the feature spends its
  // largest fix defending.
  if (!rails.includes(value)) {
    return (
      <p className="text-sm text-muted-foreground">
        {railLabel(value)} — this option isn&apos;t available any more.{" "}
        {rails.length === 1
          ? `Switch now, then Save, to move it to “${railLabel(rails[0])}”.`
          : "Pick another below."}
        {rails.length === 1 && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 pl-1"
            onClick={() => onChange(rails[0])}
          >
            Switch now
          </Button>
        )}
      </p>
    );
  }
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
          <p className="text-sm text-destructive">{writeErrorMessage(create.error)}</p>
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
