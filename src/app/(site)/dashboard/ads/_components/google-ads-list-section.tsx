"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { googleAdsApi, type GoogleAd, type GoogleAdStatus, type GoogleCampaign } from "@/lib/api/google-ads";
import { googleAdsErrorMessage } from "@/lib/google-ads-view";
import { googleAdActions, googleAdSavedSentence, googleAdStatusLabel, googleAdSummary } from "@/lib/google-management-view";

/**
 * ★★G14c — a Google campaign's ad group, by its name, and its ads (RMF C.190,
 * M.130), read live (`GET …/ad-groups`). Each ad can be paused, enabled or
 * removed (`PATCH …/ads/:adId/status`); a remove is confirmed first, because
 * Google never brings a removed ad back. Removed ads stay listed, said so.
 * Not for Performance Max, which has no ad group (the dialog does not mount it).
 */
export function GoogleAdsListSection({ campaign, campaignOpen }: { campaign: GoogleCampaign; campaignOpen: boolean }) {
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const queryKey = ["google-ads-ad-groups", business?._id ?? "none", campaign.id];
  const read = useQuery({
    queryKey,
    queryFn: () => googleAdsApi.getAdGroups(campaign.id),
    enabled: !!business,
    retry: false,
    staleTime: 0,
  });
  const [removing, setRemoving] = useState<GoogleAd | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: (v: { adId: string; status: GoogleAdStatus }) => googleAdsApi.setAdStatus(campaign.id, v.adId, v.status),
    onMutate: (v) => setPendingId(v.adId),
    onSuccess: (res) => toast.success(googleAdSavedSentence(res.status, res.changed)),
    onError: (err) => toast.error(googleAdsErrorMessage(err, "Google Ads didn't take that change to the ad. Try again in a moment.")),
    // Whatever happened, read the ads again: a change Google did not confirm may have landed.
    onSettled: () => {
      setPendingId(null);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // No data and no error: loading, or waiting for the session (a paused query is not `isLoading`).
  if (!read.data && !read.isError) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (read.isError) {
    return (
      <p className="text-sm text-destructive-on-tint">
        {googleAdsErrorMessage(read.error, "We couldn't read this campaign's ads from Google Ads.")}{" "}
        <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void read.refetch()} disabled={read.isFetching}>
          Try again
        </Button>
      </p>
    );
  }
  const groups = read.data?.adGroups ?? [];
  const ads = read.data?.ads ?? [];
  return (
    <div className="space-y-3">
      {groups.length === 0 ? <p className="text-sm text-muted-foreground">Google Ads has no ad group on this campaign.</p> : null}
      {groups.map((g) => {
        const own = ads.filter((a) => a.adGroupId === g.id);
        return (
          <div key={g.id} className="space-y-2">
            <p className="text-sm">
              Ad group: <span className="font-medium">{g.name || "(no name)"}</span>{" "}
              <Badge variant="outline">{g.status === "ENABLED" ? "On" : g.status === "PAUSED" ? "Paused" : g.status}</Badge>
            </p>
            {own.length === 0 ? <p className="text-xs text-muted-foreground">No ads in this ad group.</p> : null}
            <ul className="space-y-2">
              {own.map((ad) => {
                const actions = googleAdActions(ad.status, campaignOpen);
                const busy = pendingId === ad.id;
                return (
                  <li key={ad.id} className="flex items-start justify-between gap-3 rounded-md border p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{googleAdSummary(ad)}</p>
                      {ad.finalUrls[0] ? <p className="truncate text-xs text-muted-foreground">{ad.finalUrls[0]}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">{busy ? "Updating…" : googleAdStatusLabel(ad.status)}</Badge>
                      {actions.map((a) => (
                        <Button
                          key={a.status}
                          size="sm"
                          variant={a.status === "REMOVED" ? "ghost" : "outline"}
                          disabled={busy || change.isPending}
                          onClick={() => (a.status === "REMOVED" ? setRemoving(ad) : change.mutate({ adId: ad.id, status: a.status }))}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <AlertDialog open={removing !== null} onOpenChange={(o) => (o ? null : setRemoving(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this ad?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{removing ? googleAdSummary(removing) : ""}&rdquo; stops showing, and Google Ads never brings a removed ad back. To stop it for now, pause it
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) change.mutate({ adId: removing.id, status: "REMOVED" });
                setRemoving(null);
              }}
            >
              Remove the ad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
