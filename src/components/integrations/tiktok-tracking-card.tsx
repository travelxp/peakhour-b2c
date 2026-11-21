"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTeamMembers } from "@/lib/auth";
import { memberNameLookup } from "@/lib/wa-inbox-reply";
import {
  TIKTOK_TRACKING_COPY as COPY,
  pixelChosenBy,
  tiktokErrorCode,
  tiktokTrackingApi,
  type TikTokAdvertiser,
} from "@/lib/tiktok-tracking";
import { TikTokCatalogFeed } from "./tiktok-catalog-feed";

export const TIKTOK_PIXEL_KEY = ["tiktok-pixel"] as const;

const SELECT_CLASS = "h-9 w-80 max-w-full rounded-md border bg-background px-3 text-sm";

function isPermission(err: unknown): boolean {
  return tiktokErrorCode(err) === "TIKTOK_PERMISSION";
}

/** Permission refusal: the one error with its own action. Anything else gets a plain retry sentence. */
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
  onCancel,
  onReconnect,
}: {
  advertisers: TikTokAdvertiser[];
  initialAdvertiserId?: string;
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TIKTOK_PIXEL_KEY });
      onCancel();
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
      ) : isPermission(error) ? (
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
      {save.isError && !isPermission(save.error) ? (
        <p role="alert" className="text-sm text-destructive" data-testid="tiktok-save-error">
          {/* The api's own sentence for a refused save (PIXEL_NOT_FOUND, PIXEL_VERIFY_INCOMPLETE) is plain; fall back to ours. */}
          {(save.error as Error).message || COPY.saveFailed}
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
export function TikTokTrackingCard({ advertisers, onReconnect }: { advertisers: TikTokAdvertiser[]; onReconnect: () => void }) {
  const [editing, setEditing] = useState(false);
  const status = useQuery({
    queryKey: [...TIKTOK_PIXEL_KEY, "selected"],
    queryFn: () => tiktokTrackingApi.getSelected(),
    retry: false,
  });
  const members = useQuery({ queryKey: ["team-members"], queryFn: getTeamMembers, retry: false, staleTime: 5 * 60_000 });

  const data = status.data;
  const chosen = data ? pixelChosenBy(data) : {};
  const who = chosen.userId ? (memberNameLookup(members.data?.members)(chosen.userId) ?? "a team member") : null;
  const when = chosen.at ? chosen.at.slice(0, 10) : null;
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
        ) : isPermission(status.error) ? (
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

        {data && !editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {canChooseAgain ? COPY.chooseAgain : data.sending ? COPY.change : COPY.choose}
          </Button>
        ) : null}
        {editing ? (
          <PixelPicker
            advertisers={advertisers}
            initialAdvertiserId={data?.pixel?.advertiserId}
            onCancel={() => setEditing(false)}
            onReconnect={onReconnect}
          />
        ) : null}

        <TikTokCatalogFeed />
      </CardContent>
    </Card>
  );
}
