"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CAP_RANGE_ERROR, LOAD_FAILED, REFRESH_FAILED, X_DM_COPY, capReachedLine, isNotReleased, parseCap, priceLine, usageLine, xDmErrorMessage, type XDmStatus } from "@/lib/x-dm";

const STATUS_KEY = ["x-dm-status"] as const;
const RETURN_TO = "/dashboard/integrations";

/** The X login with the message scopes asked in addition (the api adds them only while X messages are released). */
export const xMessagesAuthorizeUrl = (): string => `${API_BASE_URL}/v1/integrations/x/authorize?dm=1&returnTo=${encodeURIComponent(RETURN_TO)}`;

interface ViewProps {
  status: XDmStatus;
  /** True while a switch or a limit change is in flight: EVERY control is disabled until it has finished AND the status is re-read. */
  busy: boolean;
  error: string | null;
  onGrant: () => void;
  onSwitch: (on: boolean) => void;
  onCap: (cap: number) => void;
}

function CapForm({ status, busy, onCap }: { status: XDmStatus; busy: boolean; onCap: (cap: number) => void }) {
  // a number outside the range is said so beside the box, not swallowed
  const [localError, setLocalError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      data-testid="x-dm-cap-form"
      onSubmit={(e) => {
        e.preventDefault();
        const v = parseCap(String(new FormData(e.currentTarget).get("cap") ?? ""));
        setLocalError(v === null ? CAP_RANGE_ERROR : null);
        if (v !== null) onCap(v);
      }}
    >
      <label className="text-xs text-muted-foreground">
        {X_DM_COPY.limitLabel}
        <Input name="cap" inputMode="numeric" defaultValue={String(status.monthlyCap)} className="mt-1 w-32" disabled={busy} aria-describedby="x-dm-cap-help" />
      </label>
      <Button size="sm" type="submit" variant="outline" disabled={busy}>
        {X_DM_COPY.saveLimit}
      </Button>
      <span id="x-dm-cap-help" className={`text-xs ${localError ? "text-destructive" : "text-muted-foreground"}`} role={localError ? "alert" : undefined}>
        {localError ?? CAP_RANGE_ERROR}
      </span>
    </form>
  );
}

/** The panel, as a pure view of the api's status. */
export function XDmConnectView({ status, busy, error, onGrant, onSwitch, onCap }: ViewProps) {
  const price = priceLine(status.pricePerMessage);
  const on = status.state === "on" || status.state === "cap_reached";
  return (
    <Card data-testid="x-dm-connect">
      <CardHeader>
        <CardTitle>{X_DM_COPY.title}</CardTitle>
        <CardDescription>{X_DM_COPY.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!status.connected ? <p className="text-sm text-muted-foreground">{X_DM_COPY.connectFirst}</p> : null}
        {status.connected && status.state === "needs_reconnect" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <p className="text-sm">{X_DM_COPY.grantWhy}</p>
            <Button size="sm" disabled={busy} onClick={onGrant}>
              {X_DM_COPY.grant}
            </Button>
          </div>
        ) : null}
        {status.connected && status.state !== "needs_reconnect" ? (
          <div className="flex flex-wrap items-center justify-between gap-2" data-testid="x-dm-switch">
            <div className="flex items-center gap-2">
              <Badge variant={on ? "default" : "outline"}>{on ? X_DM_COPY.on : X_DM_COPY.off}</Badge>
              {price ? <span className="text-sm">{price}</span> : <span className="text-sm text-muted-foreground">{X_DM_COPY.noPrice}</span>}
            </div>
            {on ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onSwitch(false)}>
                {X_DM_COPY.turnOff}
              </Button>
            ) : (
              <Button size="sm" disabled={busy || status.pricePerMessage === null} onClick={() => onSwitch(true)}>
                {X_DM_COPY.turnOn}
              </Button>
            )}
          </div>
        ) : null}
        {status.state === "cap_reached" ? (
          <p role="status" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm" data-testid="x-dm-cap-reached">
            {capReachedLine(status)}
          </p>
        ) : null}
        {status.connected && status.state !== "needs_reconnect" ? <p className="text-sm text-muted-foreground">{usageLine(status)}</p> : null}
        {status.connected && status.state !== "needs_reconnect" ? <CapForm key={status.monthlyCap} status={status} busy={busy} onCap={onCap} /> : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="x-dm-error">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{X_DM_COPY.zeroCredits}</p>
      </CardContent>
    </Card>
  );
}

/**
 * The container. It renders NOTHING unless the api says X messages are released: the status route is a 404 while the platform
 * switch is off, and any failed read also hides the panel rather than show a half-working one. Every change is confirmed by
 * re-reading the status.
 */
export function XDmConnect() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => api.get<XDmStatus>("/v1/x/dm/status"),
    // a 404 is the answer "not released" and is never retried; anything else gets one more try
    retry: (count, err) => !isNotReleased(err) && count < 1,
    staleTime: 30_000,
  });
  // Nothing while loading and nothing when the api says X messages are off (a 404): no skeleton, so a merchant with the feature off
  // sees no flash and no layout jump. ANY OTHER failure is said, with a way to try again, and is never mistaken for "off".
  if (!query.data) {
    if (query.isError && !isNotReleased(query.error)) {
      return (
        <Card data-testid="x-dm-load-error">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <p role="alert" className="text-sm text-destructive">
              {LOAD_FAILED}
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
  // "unavailable" is the api's word for off: nothing to show
  if (query.data.state === "unavailable") return null;

  async function run(call: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await call();
    } catch (err) {
      setError(xDmErrorMessage(err));
    } finally {
      // re-read BEFORE the controls come back, so the next click sees what the api now says
      await queryClient.invalidateQueries({ queryKey: STATUS_KEY }).catch(() => undefined);
      // a re-read that failed leaves the old answer on screen: say so instead of showing a state that is no longer true
      if (queryClient.getQueryState(STATUS_KEY)?.status === "error") setError((prev) => prev ?? REFRESH_FAILED);
      setBusy(false);
    }
  }

  return (
    <XDmConnectView
      status={query.data}
      busy={busy}
      error={error}
      onGrant={() => {
        if (busy) return;
        window.location.href = xMessagesAuthorizeUrl();
      }}
      onSwitch={(on) => void run(() => api.post(on ? "/v1/x/dm/enable" : "/v1/x/dm/disable", {}))}
      onCap={(cap) => void run(() => api.put("/v1/x/dm/cap", { monthlyCap: cap }))}
    />
  );
}
