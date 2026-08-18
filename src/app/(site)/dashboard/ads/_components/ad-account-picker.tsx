"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { linkedInAdsApi } from "@/lib/api/linkedin-ads";
import { LINKEDIN_PAGE_SCOPED_QUERY_KEYS } from "@/lib/linkedin-cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Where a business goes to make an ad account when they have none. */
const CAMPAIGN_MANAGER_URL = "https://www.linkedin.com/campaignmanager/accounts";

/**
 * The explicit Page → ad-account mapping, and the empty state for having none.
 *
 * ★THIS IS THE SURFACE THAT REPLACES A GUESS. Growth used to resolve "the first
 * ad account on the connection" for every Page, so a business administering two
 * brands saw whichever account LinkedIn listed first — a shared test account, in
 * the report that prompted this. There is nothing to auto-match on: LinkedIn
 * publishes no link between a Page and an ad account, and one advertiser
 * legitimately runs several. So the answer is asked for, once, and remembered.
 *
 * ★AN UNSET MAPPING IS A PROMPT, NOT AN ERROR. It is the ordinary state for
 * every business until someone answers, and rendering it as a failure would
 * make a setup step look like a broken integration.
 */
export function AdAccountPicker() {
  const queryClient = useQueryClient();

  const state = useQuery({
    queryKey: ["linkedin-page-ad-account"],
    queryFn: () => linkedInAdsApi.pageAdAccount(),
    retry: (failureCount, err) => {
      // Not connected is an answer, not a transient failure — the ads panel
      // above renders its own connect CTA for it.
      if (err instanceof ApiError && (err.status === 400 || err.status === 403)) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: ({ pageId, adAccountId }: { pageId: string; adAccountId: string | null }) =>
      linkedInAdsApi.setPageAdAccount(pageId, adAccountId),
    onSuccess: () => {
      // ★REMOVED, NOT INVALIDATED, for the reason `linkedin-cache.ts` records
      // about the Page switcher: a mounted panel goes on RENDERING cached rows
      // through an invalidation, so the campaign list directly below this card
      // would spend the refetch window showing the previous account's campaigns
      // under a card that now names the new one. Changing the mapping changes
      // which campaigns and forms exist as far as the product is concerned.
      for (const queryKey of LINKEDIN_PAGE_SCOPED_QUERY_KEYS) {
        queryClient.removeQueries({ queryKey });
      }
      toast.success("Ad account saved for this Page.");
    },
    onError: (err) => {
      // ★A 4xx HERE ALWAYS NAMES SOMETHING THE USER CAN DO, so collapsing them
      // into "try again in a moment" gives an instruction that can never
      // succeed. `PAGE_NOT_ENABLED` is genuinely reachable: this card's state
      // is a minute stale, and a Page toggled off under /dashboard/integrations
      // in that window lands here. The sibling panels already surface `message`
      // for 4xx; only a 5xx or a dead network is worth a retry.
      if (err instanceof ApiError && err.code === "AD_ACCOUNT_NOT_FOUND") {
        toast.error("That ad account is no longer available on this LinkedIn connection.");
        return;
      }
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        toast.error(err.message);
        return;
      }
      toast.error("Couldn't save the ad account. Try again in a moment.");
    },
  });

  // ★A FAILED LOOKUP IS NOT NOTHING. The lists below can already be saying
  // "choose the ad account this Page spends from" — rendering nothing here
  // leaves that instruction on screen with no control anywhere to follow it.
  // Distinguished from the loading and not-connected paths, which are silent
  // for good reasons of their own.
  if (state.isError && state.error instanceof ApiError && state.error.status >= 500) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            Couldn&apos;t load this Page&apos;s ad account. Campaign and lead-form lists
            below may be incomplete until it loads.
          </p>
          <Button variant="outline" size="sm" onClick={() => void state.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ★Absent `activePageId` means an API deploy that does not scope yet. Showing
  // a picker whose writes nothing reads would let someone "fix" this and see no
  // change — the failure mode the whole report is made of.
  if (state.isLoading || !state.data || state.data.activePageId === undefined) return null;

  const { activePageId, adAccountId, accounts } = state.data;

  // A pageless (personal-feed) connection has no Page to map an account to,
  // and its Growth surfaces keep the connection-level account they always had.
  if (!activePageId) return null;

  const hasAccounts = accounts.length > 0;

  return (
    <Card className={adAccountId ? undefined : "border-warning/40 bg-warning/5"}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CreditCard className="size-4 shrink-0" />
            {adAccountId ? "Ad account for this Page" : "Connect or create an ad account"}
          </p>
          <p className="text-xs text-muted-foreground">
            {adAccountId
              ? "Campaigns, Lead Gen Forms and audiences below all belong to this account."
              : hasAccounts
                ? "Pick which account this Page spends from. Until you do, we won't show another Page's campaigns here."
                : "This LinkedIn connection administers no ad accounts. Create one in Campaign Manager, then reconnect to pick it."}
          </p>
        </div>

        {hasAccounts ? (
          <div className="flex items-center gap-2">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {/* ★FULLY CONTROLLED, INCLUDING WHILE UNMAPPED. `value={undefined}`
                hands the Select back to Radix's internal state, so a REJECTED
                write — a stale Page, an account revoked since the card
                loaded — left the trigger displaying an account that was never
                saved, directly beside a card still saying "pick which account
                this Page spends from". Showing the in-flight choice while
                pending and the server's answer otherwise means a refusal
                reverts the control by itself. */}
            <Select
              value={
                save.isPending && save.variables
                  ? (save.variables.adAccountId ?? undefined)
                  : (adAccountId ?? undefined)
              }
              disabled={save.isPending}
              onValueChange={(next) => save.mutate({ pageId: activePageId, adAccountId: next })}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Choose an ad account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {/* The id is shown alongside the name deliberately: two ad
                        accounts with similar names is the ordinary case for an
                        agency, and the id is the only thing that distinguishes
                        them in Campaign Manager. */}
                    {a.name ?? `Account ${a.id}`}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {a.id}
                      {a.currency ? ` · ${a.currency}` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={CAMPAIGN_MANAGER_URL} target="_blank" rel="noopener noreferrer">
              Open Campaign Manager
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
        {/* The Select is disabled mid-write, so a screen-reader user gets no
            feedback from the control itself. Mounted unconditionally: a live
            region inserted together with its text is announced by nobody. */}
        <span className="sr-only" aria-live="polite">
          {save.isPending ? "Saving ad account" : ""}
        </span>
      </CardContent>
    </Card>
  );
}

/**
 * What a Growth list renders instead of rows when the Page has no ad account.
 *
 * ★"NOTHING YET" AND "WE CANNOT TELL YOU" MUST NOT LOOK THE SAME. An empty
 * campaign list under a Page with no mapped account is not a report that the
 * Page has no campaigns — it is us declining to show another brand's. Saying so
 * is the difference between a state the user can resolve and one they will
 * report as a bug.
 */
export function NoAdAccountState({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm font-medium">No ad account for this Page yet</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        Choose the ad account this Page spends from and your {what} will appear here.
        We won&apos;t show another Page&apos;s in the meantime.
      </p>
    </div>
  );
}
