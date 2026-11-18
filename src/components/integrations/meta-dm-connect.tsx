"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DM_CHANNEL_LABEL,
  DM_COPY,
  DM_PANEL_ID,
  DM_STATUS_KEY,
  dmStatusQuery,
  dmErrorMessage,
  dmPageName,
  dmPointer,
  dmWhyNot,
  needsMetaStep,
  type DmChannel,
  type DmStatus,
  type DmStatusPage,
} from "@/lib/meta-dm";

const RETURN_TO = "/dashboard/integrations";

/** The Meta login with the messaging permissions asked in addition (the api adds only the released channels' permissions). */
export const metaMessagingAuthorizeUrl = (): string =>
  `${API_BASE_URL}/v1/integrations/facebook/authorize?messaging=1&returnTo=${encodeURIComponent(RETURN_TO)}`;

interface ViewProps {
  status: DmStatus;
  /** `${pageId}:${channel}` while a switch is in flight. EVERY switch is disabled until it has finished AND the status has been
   *  re-read, so a second click cannot act on state that is about to change. */
  busy: string | null;
  error: string | null;
  onMeta: () => void;
  onSwitch: (page: DmStatusPage, channel: DmChannel, on: boolean) => void;
}

function ChannelRow({ page, channel, busy, onSwitch }: { page: DmStatusPage; channel: DmChannel; busy: string | null; onSwitch: ViewProps["onSwitch"] }) {
  const state = page[channel];
  const note = dmWhyNot(page, channel);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid={`dm-row-${channel}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {DM_CHANNEL_LABEL[channel]}
          {channel === "instagram" && page.instagramUsername ? <span className="text-muted-foreground"> @{page.instagramUsername}</span> : null}
        </div>
        {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={state.enabled ? "default" : "outline"}>{state.enabled ? DM_COPY.onFor(dmPageName(page)) : DM_COPY.off}</Badge>
        {state.enabled ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => onSwitch(page, channel, false)}>
            {DM_COPY.turnOff}
          </Button>
        ) : (
          <Button size="sm" disabled={busy !== null || !state.available || note !== null} onClick={() => onSwitch(page, channel, true)}>
            {DM_COPY.turnOn}
          </Button>
        )}
      </div>
    </div>
  );
}

/** The panel, as a pure view of the api's status. */
export function MetaDmConnectView({ status, busy, error, onMeta, onSwitch }: ViewProps) {
  const step = needsMetaStep(status);
  const channels = (["messenger", "instagram"] as const).filter((c) => status.channels[c]);
  return (
    <Card id={DM_PANEL_ID} data-testid="meta-dm-connect">
      <CardHeader>
        <CardTitle>{DM_COPY.title}</CardTitle>
        <CardDescription>{DM_COPY.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {step ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <p className="text-sm">{step === "grant" ? DM_COPY.grantWhy : step === "reconnect" ? DM_COPY.reconnectWhy : DM_COPY.connectWhy}</p>
            <Button size="sm" onClick={onMeta}>
              {step === "grant" ? DM_COPY.grant : step === "reconnect" ? DM_COPY.reconnectMeta : DM_COPY.connectMeta}
            </Button>
          </div>
        ) : null}
        {status.connected && status.pages.length === 0 ? <p className="text-sm text-muted-foreground">{DM_COPY.noPages}</p> : null}
        {status.pages.map((page) => (
          <div key={page.pageId} className="rounded-md border px-3" data-testid={`dm-page-${page.pageId}`}>
            <div className="border-b py-2 text-sm font-semibold">{page.pageName ?? "Facebook Page"}</div>
            {channels.map((c) => (
              <ChannelRow key={c} page={page} channel={c} busy={busy} onSwitch={onSwitch} />
            ))}
          </div>
        ))}
        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="meta-dm-error">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{DM_COPY.window}</p>
      </CardContent>
    </Card>
  );
}

/** The pure line for the Facebook Pages card: where messages stand for the Page Peakhour uses, linking to the panel. */
export function MetaDmPointerView({ status, pageId }: { status: DmStatus; pageId?: string | null }) {
  const pointer = dmPointer(status, pageId);
  if (!pointer) return null;
  return (
    <a href={`#${DM_PANEL_ID}`} className="block text-micro text-muted-foreground underline-offset-2 hover:underline" data-testid="meta-dm-pointer" data-on={pointer.on ? "true" : "false"}>
      {pointer.text}
    </a>
  );
}

/** The pointer for the Facebook Pages card. Reads the SAME status as the panel (one request); renders nothing without an answer. */
export function MetaDmPointer({ pageId }: { pageId?: string | null }) {
  const query = useQuery(dmStatusQuery);
  return query.data ? <MetaDmPointerView status={query.data} pageId={pageId} /> : null;
}

/**
 * The container. It renders NOTHING unless the api says a channel is released: the status route is a 404 while both are off, and
 * any failed read also hides the panel rather than show a half-working one. Every change is confirmed by re-reading the status.
 */
export function MetaDmConnect() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery(dmStatusQuery);
  // Nothing while loading and nothing when there has never been an answer (a 404 means no channel is released): no skeleton, so a
  // merchant with the feature off sees no flash and no layout jump. ★A FAILED RE-READ KEEPS THE LAST ANSWER, so an error message
  // from a switch is not lost with the panel.
  if (!query.data) return null;

  async function onSwitch(page: DmStatusPage, channel: DmChannel, on: boolean) {
    if (busy) return;
    setBusy(`${page.pageId}:${channel}`);
    setError(null);
    try {
      await api.post(on ? "/v1/meta/dm/connect" : "/v1/meta/dm/disconnect", { pageId: page.pageId, channel, connectionId: page.connectionId });
    } catch (err) {
      setError(dmErrorMessage(err));
    } finally {
      // re-read BEFORE the buttons come back, so the next click sees what the api now says
      await queryClient.invalidateQueries({ queryKey: DM_STATUS_KEY }).catch(() => undefined);
      setBusy(null);
    }
  }

  return (
    <MetaDmConnectView
      status={query.data}
      busy={busy}
      error={error}
      onMeta={() => {
        window.location.href = metaMessagingAuthorizeUrl();
      }}
      onSwitch={(p, c, on) => void onSwitch(p, c, on)}
    />
  );
}
