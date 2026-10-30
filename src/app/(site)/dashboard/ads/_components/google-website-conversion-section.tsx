"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { googleAdsApi, type GoogleAdAccount, type GoogleWebsiteConversionState, type GoogleWebsiteTagSnippet } from "@/lib/api/google-ads";
import { googleConversionMayHaveBeenCreated } from "@/lib/google-conversion-view";
import {
  GOOGLE_WEBSITE_CONVERSION_GONE,
  GOOGLE_WEBSITE_CONVERSION_INTRO,
  GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE,
  GOOGLE_WEBSITE_TAG_HOW_TO,
  GOOGLE_WEBSITE_TAG_NOT_READY,
  PEAKHOUR_WEBSITE_CONVERSION_LABEL,
  googleWebsiteConversionConfirmation,
  googleWebsiteConversionErrorMessage,
  googleWebsiteConversionGoalNote,
  googleWebsiteConversionNeedsReconnect,
  googleWebsiteConversionSavedSentence,
  googleWebsiteConversionState,
  googleWebsiteSnippetKey,
  googleWebsiteSnippetLabel,
} from "@/lib/google-website-conversion-view";

/**
 * ★★G-14f — the website conversion tag on the Google panel (RMF C.65): a
 * `WEBPAGE` conversion action, created SECONDARY, and the tag Google
 * generates for it, shown exactly as Google gives it for the merchant to copy.
 *
 * ★ONE CLICK, ONE ACTION. The api answers a second set-up with the action it
 * stored (or finds by name), never a second create; the section reads it back
 * on every open, so the tag on screen is Google's current one.
 *
 * Its own file so the panel only mounts it (G14b mounts into the same panel).
 */

const STALE_MS = 60_000;

export function GoogleWebsiteConversionSection({ account }: { account: GoogleAdAccount }) {
  const queryClient = useQueryClient();
  const { business } = useAuth();
  // ★BUSINESS-SCOPED, as G-17b's card: a session that switches business must not see the last one's tag.
  const queryKey = ["google-website-conversion", business?._id ?? "none", account.id];
  const query = useQuery({
    queryKey,
    queryFn: () => googleAdsApi.getWebsiteConversion(account.id),
    enabled: !!business,
    retry: false,
    staleTime: STALE_MS,
  });
  const state = googleWebsiteConversionState({ data: query.data, isError: query.isError, fetchStatus: query.fetchStatus });
  const [confirming, setConfirming] = useState(false);
  const confirmation = googleWebsiteConversionConfirmation(account.name);

  // ★THE KEY RIDES WITH THE REQUEST (review round 1): a business switched while
  //  the PUT is in flight must not have the old business's tag cached under its key.
  const setUp = useMutation({
    mutationFn: (_key: readonly unknown[]) => googleAdsApi.setUpWebsiteConversion(account.id),
    onSuccess: (res, key) => {
      // ★Show what the api answered now, so the tag is on screen even if the re-read fails.
      queryClient.setQueryData<GoogleWebsiteConversionState>(key, {
        conversionCustomerId: res.conversionCustomerId,
        action: res.action,
        storedNotLive: false,
      });
      toast.success(googleWebsiteConversionSavedSentence(res.created, res.action.name));
    },
    onError: (err) => {
      const message = googleWebsiteConversionErrorMessage(err, "We couldn't set that up. Try again in a moment.");
      if (googleConversionMayHaveBeenCreated(err)) toast.warning(message);
      else toast.error(message);
    },
    onSettled: (_res, _err, key) => void queryClient.invalidateQueries({ queryKey: key }),
  });
  const busy = setUp.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Website conversion tag</CardTitle>
        <CardDescription>{GOOGLE_WEBSITE_CONVERSION_INTRO}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.kind === "loading" ? <Skeleton className="h-10 w-full" /> : null}
        {state.kind === "offline" ? <p className="text-sm text-muted-foreground">You&apos;re offline. We&apos;ll check when you&apos;re back.</p> : null}
        {state.kind === "error" ? (
          <p className="text-sm text-destructive-on-tint">
            {googleWebsiteConversionErrorMessage(query.error, "Google Ads didn't answer. Try again in a moment.")}{" "}
            {googleWebsiteConversionNeedsReconnect(query.error) ? (
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
        {state.kind === "not_set_up" || state.kind === "gone" ? (
          <div className="space-y-2">
            {state.kind === "gone" ? <p className="text-sm text-destructive-on-tint">{GOOGLE_WEBSITE_CONVERSION_GONE}</p> : null}
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)}>
              Create &ldquo;{PEAKHOUR_WEBSITE_CONVERSION_LABEL}&rdquo; and get its tag
            </Button>
            <p className="text-xs text-muted-foreground">{GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE}</p>
          </div>
        ) : null}
        {state.kind === "no_snippet" ? (
          <div className="space-y-2">
            <p className="text-sm">
              Set up: &ldquo;{state.name}&rdquo;. {GOOGLE_WEBSITE_TAG_NOT_READY}
            </p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
              Check again
            </Button>
            <p className={state.primaryForGoal ? "text-xs text-warning-on-tint" : "text-xs text-muted-foreground"}>
              {googleWebsiteConversionGoalNote(state.primaryForGoal)}
            </p>
          </div>
        ) : null}
        {state.kind === "ready" ? <TagView name={state.name} primaryForGoal={state.primaryForGoal} snippets={state.snippets} /> : null}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                setUp.mutate(queryKey);
              }}
            >
              Add it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function TagView({ name, primaryForGoal, snippets }: { name: string; primaryForGoal: boolean; snippets: GoogleWebsiteTagSnippet[] }) {
  const [picked, setPicked] = useState<string | undefined>(undefined);
  // A pick Google no longer offers falls back to the first (page-load HTML when there is one).
  const index = Math.max(0, snippets.findIndex((s, i) => googleWebsiteSnippetKey(s, i) === picked));
  const snippet = snippets[index]!;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Conversion action: &ldquo;{name}&rdquo;. {GOOGLE_WEBSITE_TAG_HOW_TO}
      </p>
      <p className={primaryForGoal ? "text-xs text-warning-on-tint" : "text-xs text-muted-foreground"}>{googleWebsiteConversionGoalNote(primaryForGoal)}</p>
      {snippets.length > 1 ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Which tag</Label>
          <Select value={googleWebsiteSnippetKey(snippet, index)} onValueChange={setPicked}>
            <SelectTrigger className="w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {snippets.map((s, i) => (
                <SelectItem key={googleWebsiteSnippetKey(s, i)} value={googleWebsiteSnippetKey(s, i)}>
                  {googleWebsiteSnippetLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <CodeBlock label="Google tag — every page, once" text={snippet.globalSiteTag} />
      <CodeBlock label="Event snippet — order confirmation page only" text={snippet.eventSnippet} />
    </div>
  );
}

function CodeBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // ★A FAILED COPY IS NEVER SILENT (the signals page's lesson): no clipboard on an insecure origin, or a refusal.
            setFailed(null);
            const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
            if (!clipboard) {
              setFailed(text);
              return;
            }
            clipboard.writeText(text).then(
              () => setCopied(text),
              () => setFailed(text),
            );
          }}
        >
          {copied === text ? "Copied" : "Copy"}
        </Button>
      </div>
      {/* Google's text, verbatim: rendered as text, never as markup. */}
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted p-3 text-xs">
        <code>{text}</code>
      </pre>
      {failed === text ? <p className="text-sm text-destructive-on-tint">Your browser wouldn&apos;t let us copy that. Select the text above and copy it by hand.</p> : null}
    </div>
  );
}
