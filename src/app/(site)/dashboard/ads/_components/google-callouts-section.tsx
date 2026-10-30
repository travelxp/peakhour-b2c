"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { googleAdsApi, type GoogleAdAccount, type GoogleCallout, type GoogleCalloutAdded } from "@/lib/api/google-ads";
import {
  GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE,
  GOOGLE_CALLOUTS_INTRO,
  GOOGLE_CALLOUT_CHECK_NOTE,
  GOOGLE_CALLOUT_LENGTH_HINT,
  GOOGLE_CALLOUT_ONE_LINE,
  googleCalloutAddedByGoogle,
  googleCalloutAddedSentence,
  googleCalloutErrorMessage,
  googleCalloutLength,
  googleCalloutMayHaveBeenAdded,
  googleCalloutNeedsReconnect,
  googleCalloutPolicyWarning,
  googleCalloutRemoveConfirmation,
  googleCalloutStatusIsProblem,
  googleCalloutStatusLabel,
  googleCalloutsState,
} from "@/lib/google-callouts-view";

/**
 * ★★G-14e — account-level callouts on the Google panel (RMF C.75): list,
 * add and remove the `CALLOUT` assets linked to the Google Ads account.
 *
 * ★THE POLICY CHECK SPEAKS BEFORE ANYTHING IS ADDED. The api checks the text
 * against Google's ad policies first: a block is said and nothing is created;
 * a warning is said, and "Add anyway" sends it again with the merchant's
 * acceptance. The same text twice is one callout (the api answers the one
 * there).
 *
 * ★ACCOUNT LEVEL ONLY: the copy says where campaign callouts live.
 *
 * Its own file so the panel only mounts it (G14b mounts into the same panel).
 */

const STALE_MS = 60_000;

export function GoogleCalloutsSection({ account }: { account: GoogleAdAccount }) {
  const queryClient = useQueryClient();
  const { business } = useAuth();
  // ★BUSINESS-SCOPED, as G-17b's card: a session that switches business must not see the last one's callouts.
  const queryKey = ["google-callouts", business?._id ?? "none", account.id];
  const query = useQuery({
    queryKey,
    queryFn: () => googleAdsApi.listCallouts(account.id),
    enabled: !!business,
    retry: false,
    staleTime: STALE_MS,
  });
  const state = googleCalloutsState({ data: query.data, isError: query.isError, fetchStatus: query.fetchStatus });

  const [text, setText] = useState("");
  // The warning the policy check gave for exactly this text; editing the text clears it.
  const [warning, setWarning] = useState<{ text: string; message: string } | null>(null);
  // ★`mayExist`: the api could not confirm the add (CALLOUT_UNCONFIRMED). Said as a warning, never a failure (review round 1).
  const [addError, setAddError] = useState<{ message: string; mayExist: boolean } | null>(null);
  // ★THE DIALOG'S OPEN STATE IS ITS OWN (review round 1): its text stays while it animates closed.
  const [removing, setRemoving] = useState<GoogleCallout | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // ★EVERY REMOVE IN FLIGHT, not only the latest (review round 1): a second removal must not re-enable the first's button.
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(() => new Set());
  const length = googleCalloutLength(text);

  // ★THE KEY RIDES WITH THE REQUEST (G-14f's rule): a business switched mid-request never caches into the new one's key.
  const add = useMutation<GoogleCalloutAdded, unknown, { key: readonly unknown[]; text: string; acceptWarning: boolean }>({
    mutationFn: (v) => googleAdsApi.addCallout(account.id, v.text, v.acceptWarning),
    onMutate: () => {
      setAddError(null);
    },
    onSuccess: (res, v) => {
      // ★ONLY THE TEXT THAT WAS SENT (review round 1): what the merchant typed while the check ran is kept.
      setText((now) => (now.trim() === v.text ? "" : now));
      setWarning(null);
      toast.success(googleCalloutAddedSentence(res));
    },
    onError: (err, v) => {
      const warned = googleCalloutPolicyWarning(err);
      if (warned) {
        setWarning({ text: v.text, message: warned });
        return;
      }
      // ★A FAILED "ADD ANYWAY" RETIRES THE OLD WARNING (review round 2): a block must not sit beside an active "Add anyway".
      setWarning(null);
      setAddError({
        message: googleCalloutErrorMessage(err, "We couldn't add that callout. Try again in a moment."),
        mayExist: googleCalloutMayHaveBeenAdded(err),
      });
    },
    onSettled: (_res, _err, v) => void queryClient.invalidateQueries({ queryKey: v.key }),
  });

  const remove = useMutation<{ removed: boolean }, unknown, { key: readonly unknown[]; callout: GoogleCallout }>({
    mutationFn: (v) => googleAdsApi.removeCallout(account.id, v.callout.assetId),
    onMutate: (v) => setRemovingIds((ids) => new Set(ids).add(v.callout.assetId)),
    onSuccess: (res, v) => toast.success(res.removed ? `Removed “${v.callout.text}”.` : `“${v.callout.text}” was already removed.`),
    onError: (err) => toast.error(googleCalloutErrorMessage(err, "We couldn't remove that callout. Try again in a moment.")),
    onSettled: (_res, _err, v) => {
      setRemovingIds((ids) => {
        const next = new Set(ids);
        next.delete(v.callout.assetId);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: v.key });
    },
  });

  const busy = add.isPending;
  const warnedHere = warning && warning.text === text.trim() ? warning : null;
  // ★NOT WHILE THIS TEXT'S WARNING IS SHOWN (review round 1): "Check and add" would re-run the check for the same answer; "Add anyway" is the way on.
  const canAdd =
    !busy && !warnedHere && !length.empty && !length.over && !length.multiline && state.kind !== "loading" && state.kind !== "error" && state.kind !== "offline";
  const removeConfirmation = removing ? googleCalloutRemoveConfirmation(removing.text) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Callouts</CardTitle>
        <CardDescription>{GOOGLE_CALLOUTS_INTRO}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE}</p>

        {state.kind === "loading" ? <Skeleton className="h-10 w-full" /> : null}
        {state.kind === "offline" ? <p className="text-sm text-muted-foreground">You&apos;re offline. We&apos;ll check when you&apos;re back.</p> : null}
        {state.kind === "error" ? (
          <p className="text-sm text-destructive-on-tint">
            {googleCalloutErrorMessage(query.error, "Google Ads didn't answer. Try again in a moment.")}{" "}
            {googleCalloutNeedsReconnect(query.error) ? (
              <Link href="/dashboard/integrations" className="font-medium underline underline-offset-4">
                Check connection
              </Link>
            ) : (
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
                Try again
              </Button>
            )}
          </p>
        ) : null}
        {/* ★A FAILED RE-READ IS SAID (G-14f's rule): data wins the state, so it would otherwise change nothing on screen. */}
        {query.isError && query.data ? (
          <p className="text-xs text-destructive-on-tint">
            {googleCalloutErrorMessage(query.error, "We couldn't check Google Ads again just now.")}{" "}
            <Button variant="link" className="h-auto p-0 text-xs" onClick={() => void query.refetch()} disabled={query.isFetching}>
              Try again
            </Button>
          </p>
        ) : null}
        {state.kind === "none" ? <p className="text-sm text-muted-foreground">This account has no callouts yet.</p> : null}
        {state.kind === "list" ? (
          <ul className="divide-y rounded-md border">
            {state.callouts.map((c) => (
              <li key={c.resourceName} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium break-words">{c.text}</p>
                  <p className={googleCalloutStatusIsProblem(c) ? "text-xs text-warning-on-tint" : "text-xs text-muted-foreground"}>
                    {googleCalloutStatusLabel(c)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {googleCalloutAddedByGoogle(c) ? <Badge variant="secondary">Added by Google</Badge> : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={removingIds.has(c.assetId)}
                    onClick={() => {
                      setRemoving(c);
                      setConfirmOpen(true);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canAdd) return;
            add.mutate({ key: queryKey, text: text.trim(), acceptWarning: false });
          }}
        >
          <Label htmlFor={`callout-${account.id}`}>New callout</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`callout-${account.id}`}
              className="w-72 max-w-full"
              value={text}
              placeholder="Free UK delivery"
              onChange={(e) => {
                setText(e.target.value);
                // ★EDITING CLEARS THE WARNING (review round 2), so typing the text back asks the check again.
                setWarning(null);
                setAddError(null);
              }}
              aria-describedby={`callout-${account.id}-hint`}
            />
            <Button type="submit" disabled={!canAdd}>
              {busy ? "Checking…" : "Check and add"}
            </Button>
          </div>
          <p id={`callout-${account.id}-hint`} className={length.over || length.multiline ? "text-xs text-destructive-on-tint" : "text-xs text-muted-foreground"}>
            {length.label}. {GOOGLE_CALLOUT_LENGTH_HINT}
          </p>
          {length.multiline ? <p className="text-xs text-destructive-on-tint">{GOOGLE_CALLOUT_ONE_LINE}</p> : null}
          <p className="text-xs text-muted-foreground">{GOOGLE_CALLOUT_CHECK_NOTE}</p>
          {addError ? <p className={addError.mayExist ? "text-sm text-warning-on-tint" : "text-sm text-destructive-on-tint"}>{addError.message}</p> : null}
          {warnedHere ? (
            <div className="space-y-2 rounded-md border border-warning/40 p-3">
              {/* ★The api's sentence alone (review round 2): its own fallback is this heading's words. */}
              <p className="text-sm font-medium text-warning-on-tint">Our policy check warns about this callout</p>
              <p className="text-sm text-warning-on-tint">{warnedHere.message}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => add.mutate({ key: queryKey, text: warnedHere.text, acceptWarning: true })}
                >
                  Add anyway
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setWarning(null)}>
                  Change it
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeConfirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{removeConfirmation?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) remove.mutate({ key: queryKey, callout: removing });
                setConfirmOpen(false);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
