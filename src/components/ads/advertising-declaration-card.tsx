"use client";

/**
 * The business's one-time political-advertising declaration.
 *
 * WHY IT LIVES ON THE ADS PANEL AND NOT THE OPTIMIZER PAGE: the declaration
 * governs EVERY campaign create, not just the optimizer's. /dashboard/optimizer
 * is wrapped in FeatureGate on `growth.optimizer`, so a business entitled to
 * ads but not the optimizer could boost campaigns and never be able to declare
 * — the exact hole this closes.
 *
 * WHY IT MOUNTS ABOVE THE CONNECTION GATE: a business can declare before or
 * after connecting, and the gate renders an EmptyState that would otherwise
 * hide this entirely. Same reasoning as SpendAlarmBanner directly above it.
 *
 * The four states come from `declarationState` (pure, tested in
 * lib/ads-copy.test.ts). The one that matters most is `superseded`: the api's
 * resolvePoliticalIntent IGNORES a declaration made against wording that has
 * since changed, so rendering it as active would claim protection the engine
 * is not giving.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { growthApi } from "@/lib/api/growth";
import {
  POLITICAL_DECLARATION_NOTICE,
  POLITICAL_DECLARATION_POLICY_URL,
  POLITICAL_DECLARATION_CONSEQUENCE,
  POLITICAL_DECLARATION_WITHDRAW_WARNING,
  declarationState,
  formatDeclaredAt,
} from "@/lib/ads-copy";

export function AdvertisingDeclarationCard() {
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [ticked, setTicked] = useState(false);

  // Shares the cache key with the optimizer board, so declaring on either
  // surface updates both without a refetch.
  const settings = useQuery({
    queryKey: ["growth-settings"],
    queryFn: () => growthApi.settings(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const save = useMutation({
    mutationFn: (notPolitical: boolean) => growthApi.updateSettings({ notPolitical }),
    onSuccess: (res, notPolitical) => {
      // PATCH returns the same envelope as GET (currentNoticeVersion +
      // declaredByName included), so writing it straight into the cache
      // cannot blank the version and flip this card to "unknown".
      queryClient.setQueryData(["growth-settings"], res);
      setTicked(false);
      toast.success(
        notPolitical
          ? "Declaration recorded — automatic campaigns can now declare on your behalf."
          : "Declaration withdrawn.",
      );
    },
    onError: () =>
      toast.error("Couldn't save your declaration. Try again in a moment — nothing was changed."),
  });

  const state = declarationState({
    declaration: settings.data?.settings.advertisingDeclaration,
    currentNoticeVersion: settings.data?.currentNoticeVersion,
    declaredByName: settings.data?.declaredByName,
    failed: settings.isError,
  });

  if (settings.isLoading) return null;

  const notice = (
    <>
      {POLITICAL_DECLARATION_NOTICE}{" "}
      <a
        href={POLITICAL_DECLARATION_POLICY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        Learn more
      </a>
    </>
  );

  return (
    <Card>
      <CardContent className="p-4">
        {state.kind === "declared" ? (
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm">
                Declared not political advertising
                {state.declaredByName ? (
                  <>
                    {" "}
                    by <span className="font-medium">{state.declaredByName}</span>
                  </>
                ) : null}
                {formatDeclaredAt(state.declaredAt) ? (
                  <> on {formatDeclaredAt(state.declaredAt)}</>
                ) : null}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Automatic campaigns — from WhatsApp, or the optimizer — carry this
                declaration.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                disabled={save.isPending}
                onClick={() => setWithdrawOpen(true)}
              >
                Withdraw
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {state.kind === "unknown" ? (
                <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {state.kind === "superseded"
                    ? "Please confirm the current wording"
                    : state.kind === "unknown"
                      ? "We couldn't check your advertising declaration"
                      : "Advertising declaration"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state.kind === "superseded" ? (
                    <>
                      LinkedIn has updated this notice since you declared
                      {state.declaredAt && formatDeclaredAt(state.declaredAt)
                        ? ` on ${formatDeclaredAt(state.declaredAt)}`
                        : ""}
                      . Until you confirm the current wording, automatic campaigns
                      fall back to no declaration.
                    </>
                  ) : state.kind === "unknown" ? (
                    // Honest about not knowing rather than showing a confident
                    // "not declared": a false "not declared" only over-warns,
                    // but a false "declared" would be a claim we can't support.
                    <>
                      The state shown here may be wrong. Refresh in a moment — your
                      campaigns are unaffected.
                    </>
                  ) : (
                    POLITICAL_DECLARATION_CONSEQUENCE
                  )}
                </p>
              </div>
            </div>

            {state.kind !== "unknown" ? (
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
                <Checkbox
                  id="ads-not-political"
                  checked={ticked}
                  onCheckedChange={(v) => setTicked(v === true)}
                  disabled={save.isPending}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="ads-not-political"
                  className="text-[11px] font-normal leading-relaxed text-muted-foreground"
                >
                  {notice}
                </Label>
              </div>
            ) : null}

            {state.kind !== "unknown" ? (
              <Button
                type="button"
                size="sm"
                disabled={!ticked || save.isPending}
                onClick={() => save.mutate(true)}
              >
                {save.isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                {state.kind === "superseded" ? "Confirm" : "Save declaration"}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>

      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw your declaration?</AlertDialogTitle>
            {/* Says what it costs BEFORE the click, not after. */}
            <AlertDialogDescription>
              {POLITICAL_DECLARATION_WITHDRAW_WARNING}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setWithdrawOpen(false);
                save.mutate(false);
              }}
            >
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
