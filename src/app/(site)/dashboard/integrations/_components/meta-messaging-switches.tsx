"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import {
  DM_COPY,
  DM_STATUS_KEY,
  dmErrorMessage,
  dmStatusQuery,
  dmWhyNot,
  metaMessagingAuthorizeUrl,
  type DmChannel,
  type DmStatusPage,
} from "@/lib/meta-dm";

interface RowProps {
  page: DmStatusPage;
  channel: DmChannel;
  checked: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
}

function ChannelSwitch({ page, channel, checked, disabled, onToggle }: RowProps) {
  const why = dmWhyNot(page, channel);
  const label = channel === "messenger" ? DM_COPY.messenger : DM_COPY.instagram(page.instagramUsername);
  const id = `dm-switch-${page.pageId}-${channel}`;
  return (
    <div className="space-y-0.5" data-testid={`dm-row-${channel}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs">
          {label}
        </label>
        <Switch id={id} size="sm" checked={checked} disabled={disabled || (!checked && why !== null)} onCheckedChange={onToggle} />
      </div>
      {why && !checked ? (
        <p className="text-micro text-muted-foreground" data-testid={`dm-why-${channel}`}>
          {why.text}
          {why.reconnect ? (
            <>
              {" "}
              <a href={metaMessagingAuthorizeUrl()} className="underline underline-offset-2">
                {DM_COPY.reconnect}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The Messenger and Instagram message switches for the Page Peakhour uses (Facebook Pages card, under the Page picker).
 *
 * ★ONE READ: the Inbox's own status query. Nothing renders while it has no answer (a 404 means no channel is released), and a
 * channel the api has not released has no switch. Only the Page in `pageId` is shown; a Page the status does not list shows nothing.
 * The switch moves at once, rolls back when the api refuses, and the status is re-read after every change.
 */
export function MetaMessagingSwitches({ pageId }: { pageId?: string | null }) {
  const queryClient = useQueryClient();
  const query = useQuery(dmStatusQuery);
  const [busy, setBusy] = useState<DmChannel | null>(null);
  // optimistic value per channel while a change is in flight
  const [optimistic, setOptimistic] = useState<Partial<Record<DmChannel, boolean>>>({});
  const status = query.data;
  const page = status && pageId ? status.pages.find((p) => p.pageId === pageId) : undefined;
  if (!status || !page) return null;
  const channels = (["messenger", "instagram"] as const).filter((c) => status.channels[c]);
  if (channels.length === 0) return null;

  async function toggle(channel: DmChannel, on: boolean) {
    if (!page || busy) return;
    setBusy(channel);
    setOptimistic({ [channel]: on });
    try {
      await api.post(on ? "/v1/meta/dm/connect" : "/v1/meta/dm/disconnect", { pageId: page.pageId, channel, connectionId: page.connectionId });
    } catch (err) {
      toast.error(dmErrorMessage(err));
    } finally {
      // re-read BEFORE the switch is live again; the optimistic value then gives way to the api's answer (the old one after a failure)
      await queryClient.invalidateQueries({ queryKey: DM_STATUS_KEY }).catch(() => undefined);
      setOptimistic({});
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1.5" data-testid="meta-messaging-switches">
      {channels.map((c) => (
        <ChannelSwitch
          key={c}
          page={page}
          channel={c}
          checked={optimistic[c] ?? page[c].enabled}
          disabled={busy !== null}
          onToggle={(on) => void toggle(c, on)}
        />
      ))}
      <p className="text-micro text-muted-foreground">{DM_COPY.note}</p>
    </div>
  );
}
