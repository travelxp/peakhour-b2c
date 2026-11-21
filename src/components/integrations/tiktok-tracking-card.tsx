"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { useOrgMembers } from "@/hooks/use-control-plane";
import { formatDate } from "@/lib/locale";
import { memberNameLookup } from "@/lib/wa-inbox-reply";
import {
  TIKTOK_TRACKING_COPY as COPY,
  needsReconnect,
  saveErrorMessage,
  tiktokTrackingApi,
  type TikTokPixelStatus,
  type TikTokAdvertiser,
} from "@/lib/tiktok-tracking";
import { TikTokCatalogFeed } from "./tiktok-catalog-feed";

export const TIKTOK_PIXEL_KEY = ["tiktok-pixel"] as const;

const SELECT_CLASS = "h-9 w-80 max-w-full rounded-md border bg-background px-3 text-sm";

const SELECTED_KEY = [...TIKTOK_PIXEL_KEY, "selected"] as const;

/** A missing permission, an expired grant or no connection: all fixed by reconnecting. Anything else gets a plain retry sentence. */
function PermissionNotice({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="space-y-2" data-testid="tiktok-permission">
      <p role="alert" className="text-sm">
        {COPY.permission}
      </p>
      <Button size="sm" variant="outline" onClick={onReconnect}>
        {COPY.reconnect}
      </Button>
    </div>
  );
}

function PixelPicker({
  advertisers,
  initialAdvertiserId,
  onSaved,
  onCancel,
  onReconnect,
}: {
  advertisers: TikTokAdvertiser[];
  initialAdvertiserId?: string;
  onSaved: () => void;
  onCancel: () => void;
  onReconnect: () => void;
}) {
  const queryClient = useQueryClient();
  const [advertiserId, setAdvertiserId] = useState(
    advertisers.find((a) => a.id === initialAdvertiserId)?.id ?? advertisers[0]?.id ?? "",
  );
  const [code, setCode] = useState("");

  const pixels = useQuery({
    queryKey: [...TIKTOK_PIXEL_KEY, "list", advertiserId],
    queryFn: () => tiktokTrackingApi.listPixels(advertiserId),
    enabled: advertiserId !== "",
    retry: false,
  });
  const save = useMutation({
    mutationFn: () => tiktokTrackingApi.select(advertiserId, code),
    onSuccess: async (result) => {
      // The PUT answers with the new status: show it now, then re-read that one key. The pixel list is not stale.
      queryClient.setQueryData(SELECTED_KEY, result);
      await queryClient.invalidateQueries({ queryKey: SELECTED_KEY });
      onSaved();
    },
  });

  if (advertisers.length === 0) {
    return <p className="text-sm text-muted-foreground">{COPY.noAdvertisers}</p>;
  }
  const options = pixels.data?.pixels ?? [];
  const error = pixels.error ?? save.error;

  return (
    <div className="space-y-2" data-testid="tiktok-pixel-picker">
      {advertisers.length > 1 ? (
        <select
          aria-label="TikTok advertiser"
          className={SELECT_CLASS}
          value={advertiserId}
          onChange={(e) => {
            setAdvertiserId(e.target.value);
            setCode("");
            save.reset();
          }}
        >
          {advertisers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      ) : null}
      {pixels.isLoading ? (
        <Skeleton className="h-9 w-80" />
      ) : needsReconnect(error) ? (
        <PermissionNotice onReconnect={onReconnect} />
      ) : pixels.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {COPY.listFailed}
        </p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{COPY.noPixels}</p>
      ) : (
        <>
          <select aria-label="TikTok pixel" className={SELECT_CLASS} value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">Choose a pixel</option>
            {options.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name ? `${p.name} (${p.code})` : p.code}
              </option>
            ))}
          </select>
          {pixels.data?.truncated ? <p className="text-xs text-muted-foreground">{COPY.moreThanListed}</p> : null}
        </>
      )}
      {save.isError && !needsReconnect(save.error) ? (
        <p role="alert" className="text-sm text-destructive" data-testid="tiktok-save-error">
          {saveErrorMessage(save.error)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={code === "" || save.isPending} onClick={() => save.mutate()}>
          {COPY.save}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {COPY.cancel}
        </Button>
      </div>
    </div>
  );
}

/**
 * The TikTok tracking card (TT-PX): which pixel receives the business's orders, and the catalog feed URL. Self-contained so the
 * TikTok ads panel (T-11) can host it too: the caller passes the advertisers on the grant and the reconnect action.
 */
export function TikTokTrackingCard({
  advertisers,
  advertisersTruncated = false,
  onReconnect,
}: {
  advertisers: TikTokAdvertiser[];
  /** `account.extra.adAccountsTruncated`: the grant had more accounts than were stored. */
  advertisersTruncated?: boolean;
  onReconnect: () => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const status = useQuery<TikTokPixelStatus>({
    queryKey: SELECTED_KEY,
    queryFn: () => tiktokTrackingApi.getSelected(),
    retry: false,
  });
  const members = useOrgMembers();

  const data = status.data;
  const chosenBy = data?.pixel?.selectedBy;
  const who = chosenBy ? (memberNameLookup(members.data)(chosenBy) ?? "a team member") : null;
  const when = data?.pixel?.selectedAt ? formatDate(data.pixel.selectedAt, user?.preferences ?? null) : null;
  const canChooseAgain = data?.reason === "pixel_advertiser_gone" || data?.reason === "pixel_refused";

  return (
    <Card data-testid="tiktok-tracking-card">
      <CardHeader>
        <CardTitle>{COPY.title}</CardTitle>
        <CardDescription>{COPY.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading ? (
          <Skeleton className="h-5 w-64" />
        ) : needsReconnect(status.error) ? (
          <PermissionNotice onReconnect={onReconnect} />
        ) : status.isError || !data ? (
          <p role="alert" className="text-sm text-destructive">
            {COPY.loadFailed}
          </p>
        ) : data.sending ? (
          <p className="text-sm" data-testid="tiktok-sending">
            Sending orders to <span className="font-medium">{data.pixel?.name ?? data.pixel?.code}</span>
            {who || when ? (
              <span className="text-muted-foreground">
                {" "}
                · chosen{who ? ` by ${who}` : ""}
                {when ? ` on ${when}` : ""}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="tiktok-not-sending">
            {data.message}
          </p>
        )}

        {justSaved && !editing ? (
          <p role="status" className="text-sm" data-testid="tiktok-saved">
            {COPY.saved}
          </p>
        ) : null}
        {advertisersTruncated ? (
          <p className="text-xs text-muted-foreground" data-testid="tiktok-truncated">
            {COPY.truncatedAccounts}
          </p>
        ) : null}

        {data && !editing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setJustSaved(false);
              setEditing(true);
            }}
          >
            {canChooseAgain ? COPY.chooseAgain : data.sending ? COPY.change : COPY.choose}
          </Button>
        ) : null}
        {editing ? (
          <PixelPicker
            advertisers={advertisers}
            initialAdvertiserId={data?.pixel?.advertiserId}
            onSaved={() => {
              setEditing(false);
              setJustSaved(true);
            }}
            onCancel={() => setEditing(false)}
            onReconnect={onReconnect}
          />
        ) : null}

        <TikTokCatalogFeed />
      </CardContent>
    </Card>
  );
}
