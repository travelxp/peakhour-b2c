"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { googleAdsApi, type GoogleAdAccount, type GoogleBiddingChoice, type GoogleCampaign } from "@/lib/api/google-ads";
import { googleAdsErrorMessage, googleChannelTypeLabel } from "@/lib/google-ads-view";
import {
  googleBiddingChoiceOf,
  googleBiddingDraftOf,
  googleBiddingProblem,
  googleBiddingSavable,
  googleBiddingSavedSentence,
  googleBiddingSentence,
  googleBiddingWarning,
  type GoogleBiddingDraft,
} from "@/lib/google-bidding-view";
import { GoogleBiddingFields } from "./google-bidding-fields";

/**
 * ★★G-14b — a Google campaign's bidding (RMF M.96–M.98, and C.96–C.98 for a
 * campaign created without a choice), opened from its row in
 * `google-ads-panel.tsx`.
 *
 * ★READ LIVE, SENT AS CHOSEN. The dialog starts from what Google holds now
 * (`GET …/bidding`), and a save sends the merchant's strategy, form and target
 * (`PUT …/bidding`). A Portfolio strategy Peakhour made for this campaign has
 * its own target edited; any other Portfolio is left as it is, and the
 * campaign gets a new one.
 *
 * ★THE TARGET IS KEPT: fewer than 15 conversions in 30 days is said, under the
 * target, before and after the save.
 */
export function GoogleBiddingDialog({
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
  const queryKey = ["google-ads-bidding", business?._id ?? "none", campaign.id];
  const read = useQuery({
    queryKey,
    queryFn: () => googleAdsApi.getBidding(campaign.id),
    enabled: open && !!business,
    retry: false,
    staleTime: 0,
  });
  const channelType = read.data?.channelType ?? campaign.channelType;
  const currency = read.data?.currency ?? campaign.currency ?? account.currencyCode;
  // The merchant's unsaved choice, or null: with none, the control shows what Google holds.
  const [edits, setEdits] = useState<GoogleBiddingDraft | null>(null);
  const draft = edits ?? (read.data ? googleBiddingDraftOf(read.data.bidding) : null);

  const save = useMutation({
    mutationFn: (choice: GoogleBiddingChoice) => googleAdsApi.setBidding(campaign.id, choice),
    onSuccess: async (res) => {
      toast.success(googleBiddingSavedSentence(res.bidding, res.changed));
      // ★The warning again, after the save: the target went to Google as set.
      const warning = googleBiddingWarning(res.bidding.strategy, res.history);
      if (warning) toast.warning(warning);
      await queryClient.invalidateQueries({ queryKey });
      if (queryClient.getQueryState(queryKey)?.status === "success") setEdits(null);
    },
    onError: (err) => {
      toast.error(googleAdsErrorMessage(err, "Google Ads didn't take that bidding change. Try again in a moment."));
      // A change Google did not confirm may have landed: re-read, keeping the merchant's choice on screen.
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const close = () => {
    if (save.isPending) return;
    setEdits(null);
    onOpenChange(false);
  };

  const problem = draft ? googleBiddingProblem(channelType, draft, false) : null;
  const choice = draft && !problem ? googleBiddingChoiceOf(draft) : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bidding — {campaign.name}</DialogTitle>
          <DialogDescription>
            {googleChannelTypeLabel(channelType)}. How Google sets this campaign&apos;s bids. A new strategy restarts Google&apos;s learning for a few days.
          </DialogDescription>
        </DialogHeader>
        {read.isError ? (
          <p className="text-sm text-destructive-on-tint">
            {googleAdsErrorMessage(read.error, "We couldn't read this campaign's bidding from Google Ads.")}{" "}
            <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void read.refetch()} disabled={read.isFetching}>
              Try again
            </Button>
          </p>
        ) : null}
        {!draft ? (
          read.isError ? null : (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          )
        ) : (
          <div className="space-y-4">
            {read.data ? <p className="text-sm">Now: {googleBiddingSentence(read.data.bidding, currency)}</p> : null}
            <GoogleBiddingFields
              channelType={channelType}
              currency={currency}
              value={draft}
              onChange={(next) => setEdits(next)}
              history={read.data?.history}
              allowDefault={false}
              disabled={save.isPending}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={save.isPending}>
            Close
          </Button>
          <Button onClick={() => choice && save.mutate(choice)} disabled={!choice || save.isPending || !googleBiddingSavable(read.data?.bidding, edits !== null)}>
            {save.isPending ? "Saving…" : "Save bidding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
