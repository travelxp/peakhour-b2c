"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { googleAdsApi, type GoogleAdAccount, type GoogleCampaign, type GoogleSettingsInput } from "@/lib/api/google-ads";
import { googleAdsErrorMessage, googleCampaignSettable, googleChannelTypeLabel, localIsoDay } from "@/lib/google-ads-view";
import {
  GOOGLE_REMOVE_WARNING,
  googleNetworkSentence,
  googleRemoveConfirmed,
  googleSettingsChangeOf,
  googleSettingsDraftOf,
  googleSettingsProblem,
  googleSettingsSavedSentence,
  googleSettingsSentence,
  type GoogleSettingsDraft,
} from "@/lib/google-management-view";
import { GoogleAdsListSection } from "./google-ads-list-section";

/**
 * ★★G14c — manage one Google campaign (RMF M.10, M.110, M.130, C.190), opened
 * from its row in `google-ads-panel.tsx`:
 *  - its settings, read live (`GET …/settings`) and edited directly (`PUT …/settings`):
 *    name, daily budget, end date and, for Search, search partners and the
 *    Google Display Network. Only what changed is sent. Under the kill switch
 *    the api lets through only a change that lowers spend.
 *  - its ad group, by name, and its ads (`google-ads-list-section.tsx`).
 *  - ★REMOVE, which cannot be undone: the campaign's name is typed to confirm,
 *    and the api checks it again (`POST …/remove`).
 */
export function GoogleCampaignManageDialog({
  campaign,
  account,
  open,
  onOpenChange,
}: {
  campaign: GoogleCampaign;
  account: GoogleAdAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const queryKey = ["google-ads-settings", business?._id ?? "none", campaign.id];
  const removed = !!campaign.removedAt;
  // Settings are edited only while the campaign can still run (the api refuses a finished one).
  const editable = googleCampaignSettable(campaign) && !removed;
  const read = useQuery({
    queryKey,
    queryFn: () => googleAdsApi.getSettings(campaign.id),
    enabled: open && !!business,
    retry: false,
    staleTime: 0,
  });
  const settings = read.data?.settings;
  const [edits, setEdits] = useState<GoogleSettingsDraft | null>(null);
  const draft = edits ?? (settings ? googleSettingsDraftOf(settings) : null);
  const set = <K extends keyof GoogleSettingsDraft>(k: K, v: GoogleSettingsDraft[K]) => draft && setEdits({ ...draft, [k]: v });
  const today = localIsoDay(new Date());
  const problem = draft ? googleSettingsProblem(draft, today) : null;
  const change = settings && draft && !problem ? googleSettingsChangeOf(settings, draft) : null;

  const refreshList = () => void queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
  const save = useMutation({
    mutationFn: (input: GoogleSettingsInput) => googleAdsApi.setSettings(campaign.id, input),
    onSuccess: async (res) => {
      toast.success(googleSettingsSavedSentence(res.changed));
      refreshList();
      await queryClient.invalidateQueries({ queryKey });
      if (queryClient.getQueryState(queryKey)?.status === "success") setEdits(null);
    },
    onError: (err) => {
      toast.error(googleAdsErrorMessage(err, "Google Ads didn't take that change. Try again in a moment."));
      // A change Google did not confirm may have landed: re-read, keeping the merchant's edits on screen.
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const [confirmText, setConfirmText] = useState("");
  const remove = useMutation({
    mutationFn: () => googleAdsApi.removeCampaign(campaign.id, confirmText),
    onSuccess: () => {
      toast.success("Campaign removed on Google Ads.");
      refreshList();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(googleAdsErrorMessage(err, "Google Ads didn't remove the campaign. Try again in a moment."));
      refreshList();
    },
  });

  const busy = save.isPending || remove.isPending;
  const close = () => {
    if (busy) return;
    setEdits(null);
    setConfirmText("");
    onOpenChange(false);
  };
  const channelType = read.data?.channelType ?? campaign.channelType;
  const currency = settings?.budget.currencyCode ?? campaign.currency ?? account.currencyCode ?? "";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage — {campaign.name}</DialogTitle>
          <DialogDescription>
            {googleChannelTypeLabel(channelType)}.{" "}
            {removed ? "This campaign was removed on Google Ads and can't be changed." : "Changes go to Google Ads as soon as you save them."}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Settings</h3>
          {read.isError ? (
            <p className="text-sm text-destructive-on-tint">
              {googleAdsErrorMessage(read.error, "We couldn't read this campaign's settings from Google Ads.")}{" "}
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void read.refetch()} disabled={read.isFetching}>
                Try again
              </Button>
            </p>
          ) : !settings || !draft ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <p className="text-sm">Now: {googleSettingsSentence(settings)}</p>
              {settings.network ? <p className="text-xs text-muted-foreground">{googleNetworkSentence(settings.network)}</p> : null}
              {editable ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Campaign name</Label>
                    <Input value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={200} disabled={busy} />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Daily budget ({currency})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.budget}
                        onChange={(e) => set("budget", e.target.value)}
                        className="w-40"
                        disabled={busy || settings.budget.shared}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">End date (optional)</Label>
                      <div className="flex items-center gap-2">
                        <Input type="date" min={today} value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} className="w-44" disabled={busy} />
                        {draft.endDate ? (
                          <Button variant="ghost" size="sm" onClick={() => set("endDate", "")} disabled={busy}>
                            No end date
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {settings.network ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Where it shows besides Google Search</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={draft.searchPartners} onCheckedChange={(v) => set("searchPartners", v === true)} disabled={busy} />
                        <span>Search partners — other sites that show Google search results</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={draft.displayNetwork} onCheckedChange={(v) => set("displayNetwork", v === true)} disabled={busy} />
                        <span>Google Display Network — sites and apps that show Google ads</span>
                      </label>
                    </div>
                  ) : null}
                  {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
                  <div className="flex justify-end">
                    <Button onClick={() => change && save.mutate(change)} disabled={!change || busy}>
                      {save.isPending ? "Saving…" : "Save settings"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        {channelType !== "PERFORMANCE_MAX" && campaign.platformCampaignId ? (
          <>
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium">Ad group and ads</h3>
              <GoogleAdsListSection campaign={campaign} campaignOpen={editable} />
            </section>
          </>
        ) : null}

        {!removed && campaign.platformCampaignId ? (
          <>
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-destructive-on-tint">Remove this campaign</h3>
              <p className="text-sm text-muted-foreground">{GOOGLE_REMOVE_WARNING}</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type the campaign&apos;s name, {campaign.name}, to confirm</Label>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} disabled={busy} autoComplete="off" />
              </div>
              <div className="flex justify-end">
                <Button variant="destructive" onClick={() => remove.mutate()} disabled={!googleRemoveConfirmed(campaign.name, confirmText) || busy}>
                  {remove.isPending ? "Removing…" : "Remove for good"}
                </Button>
              </div>
            </section>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
