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
import {
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
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
  POLITICAL_DECLARATION_POLICY_URL,
  POLITICAL_DECLARATION_CONSEQUENCE,
  POLITICAL_DECLARATION_WITHDRAW_WARNING,
  declarationState,
  formatDeclaredAt,
  SPECIAL_AD_CATEGORY_QUESTION,
  SPECIAL_AD_CATEGORY_NONE_NOTE,
} from "@/lib/ads-copy";

export function AdvertisingDeclarationCard() {
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [ticked, setTicked] = useState(false);
  // ★A SET, AND EMPTY IS A REAL VALUE. Submitting with nothing selected
  // sends `specialAdCategories: []` — Meta has no "not answered" value, so
  // "none of these apply" is a statement the merchant makes, not a field
  // they skipped. The copy says so beside the boxes.
  const [categories, setCategories] = useState<string[]>([]);

  // Shares the cache key with the optimizer board, so declaring on either
  // surface updates both without a refetch.
  const settings = useQuery({
    queryKey: ["growth-settings"],
    queryFn: () => growthApi.settings(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const save = useMutation({
    // ★THE DECLARATION IS ONE SUBMISSION. The political answer and the
    // category answers are given against one notice at one moment, and the
    // api refuses them separately (DECLARATION_INCOMPLETE) precisely so a
    // record cannot end up with halves consented to under different wording.
    mutationFn: (declare: boolean) =>
      growthApi.updateSettings(
        declare
          ? {
              politicalIntent: "NOT_POLITICAL" as const,
              // ★★ONLY WHEN THE QUESTION WAS ACTUALLY SHOWN. If the api
              // served no options the checkboxes never rendered, so sending
              // `[]` would record "none of these apply" from a form that
              // never asked — the compliance invention the api's
              // discriminated result exists to prevent. Omitting it leaves
              // the record undeclared, which is the honest state.
              ...(categoryOptions.length > 0
                ? { specialAdCategories: categories }
                : {}),
            }
          : { politicalIntent: null },
      ),
    onSuccess: (res, notPolitical) => {
      // PATCH returns the same envelope as GET (currentNoticeVersion +
      // declaredByName included), so writing it straight into the cache
      // cannot blank the version and flip this card to "unknown".
      queryClient.setQueryData(["growth-settings"], res);
      setTicked(false);
      setCategories([]);
      toast.success(
        notPolitical
          ? "Declaration recorded — automatic campaigns can now declare on your behalf."
          : "Declaration withdrawn.",
      );
    },
    onError: () =>
      toast.error(
        "Couldn't save your declaration. Try again in a moment — nothing was changed.",
      ),
  });

  const state = declarationState({
    declaration: settings.data?.settings.advertisingDeclaration,
    currentNoticeVersion: settings.data?.currentNoticeVersion,
    currentNoticeText: settings.data?.currentNoticeText,
    declaredByName: settings.data?.declaredByName,
    // `isError` alone is wrong: a failed BACKGROUND refetch sets it while
    // `data` is retained, which would flip a business that has declared to
    // "we couldn't check" — and hide the checkbox, so they couldn't act
    // either. Only claim ignorance when we genuinely have nothing.
    failed: settings.isError && !settings.data,
  });

  // Not `isLoading`: that is pending AND fetching, so a paused/offline fetch
  // leaves it false with no data, and `declarationState` would then render a
  // confident "not declared" plus a Save button that hangs. Render nothing
  // until we have either data or a definite failure.
  if (!settings.data && !settings.isError) return null;

  // ★SERVED, NOT LOOKED UP. The api sends the wording its
  // `currentNoticeVersion` means, so this card cannot show one version's
  // text while stamping another's — and a notice bump needs no deploy here.
  const noticeText = settings.data?.currentNoticeText;
  // ★AND THE FORM ITSELF IS SERVED. A local label map would silently stop
  // offering any category the api adds (P-09: five surfaces, five wrong
  // answers, all derived locally).
  const categoryOptions = settings.data?.specialAdCategoryOptions ?? [];
  const categoryConsequence = settings.data?.specialAdCategoryConsequence;

  const notice = (
    <>
      {noticeText}{" "}
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
        {state.kind === "political" ? (
          // READ-ONLY. Political advertising carries obligations Peakhour does
          // not support, so this must not offer the tick-box that would
          // overwrite a legal statement in one click.
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-on-tint" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm">
                This business is recorded as running{" "}
                <span className="font-medium">political advertising</span>
                {state.declaredByName ? <> by {state.declaredByName}</> : null}
                {formatDeclaredAt(state.declaredAt) ? (
                  <> on {formatDeclaredAt(state.declaredAt)}</>
                ) : null}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Peakhour doesn&apos;t support the extra obligations political
                advertising carries, so this can&apos;t be changed here — only
                withdrawn.
                {state.superseded ? (
                  <>
                    {" "}
                    LinkedIn has also updated its notice since this was
                    recorded, so automatic campaigns are currently sending no
                    declaration at all.
                  </>
                ) : null}
              </p>
              {/* An exit, not a tick-box. Withdrawal UNSETS the record — a
                  retraction rather than a new legal claim — so it is the one
                  change this surface can safely offer. Without it a business
                  that ever acquires a POLITICAL record could never clear it,
                  and every autonomous create would keep sending POLITICAL. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                disabled={save.isPending}
                onClick={() => setWithdrawOpen(true)}
              >
                {save.isPending ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : null}
                Withdraw
              </Button>
            </div>
          </div>
        ) : state.kind === "declared" ? (
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-on-tint" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm">
                Declared not political advertising
                {state.declaredByName ? (
                  <>
                    {" "}
                    by{" "}
                    <span className="font-medium">{state.declaredByName}</span>
                  </>
                ) : null}
                {formatDeclaredAt(state.declaredAt) ? (
                  <> on {formatDeclaredAt(state.declaredAt)}</>
                ) : null}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Automatic campaigns — from WhatsApp, or the optimizer — carry
                this declaration.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                disabled={save.isPending}
                onClick={() => setWithdrawOpen(true)}
              >
                {save.isPending ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : null}
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
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-on-tint" />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {state.kind === "superseded"
                    ? "Please confirm the current wording"
                    : state.kind === "unknown"
                      ? state.reason === "unsupported_notice"
                        ? "This notice has changed"
                        : "We couldn't check your advertising declaration"
                      : "Advertising declaration"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state.kind === "superseded" ? (
                    <>
                      LinkedIn has updated this notice since you declared
                      {state.declaredAt && formatDeclaredAt(state.declaredAt)
                        ? ` on ${formatDeclaredAt(state.declaredAt)}`
                        : ""}
                      . Until you confirm the current wording, automatic
                      campaigns fall back to no declaration.
                    </>
                  ) : state.kind === "unknown" ? (
                    // Honest about not knowing rather than showing a confident
                    // "not declared": a false "not declared" only over-warns,
                    // but a false "declared" would be a claim we can't support.
                    // The two causes need different copy — saying "your
                    // campaigns are unaffected" would be FALSE on a notice
                    // change, where every stored declaration is superseded.
                    state.reason === "unsupported_notice" ? (
                      <>
                        LinkedIn has updated this notice and Peakhour needs an
                        update before you can confirm the new wording. Until
                        then, automatic campaigns send no declaration — so
                        LinkedIn may hold them from EU audiences. Contact
                        support if this persists.
                      </>
                    ) : (
                      <>
                        The state shown here may be wrong. Try again in a moment
                        — your campaigns are unaffected.
                      </>
                    )
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

            {/* ── Meta's special ad categories (M-03) ──────────────────
                ★SHOWN IN THE SAME FORM, SUBMITTED IN THE SAME CLICK. Two
                surfaces would mean two records with two timestamps, and
                nothing could then say which notice each half answered.

                ★AND THE COST IS STATED BEFORE THE TICK. Meta strips
                lookalikes, exclusions and sub-city geo from these
                campaigns; finding that out after declaring is finding out
                too late. */}
            {/* ★HIDDEN WHEN THE API SERVED NO OPTIONS. A heading with no
                checkboxes under it reads as a form that failed to load, and
                submitting then sends `[]` — a declaration nobody was asked
                for, which is the one thing this question must never do. */}
            {state.kind !== "unknown" && categoryOptions.length > 0 ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium">
                  {SPECIAL_AD_CATEGORY_QUESTION}
                </p>
                <div className="space-y-1.5">
                  {categoryOptions.map(({ key, label }) => (
                    <div key={key} className="flex items-start gap-2">
                      <Checkbox
                        id={`sac-${key}`}
                        checked={categories.includes(key)}
                        disabled={save.isPending}
                        onCheckedChange={(v) =>
                          setCategories((prev) =>
                            v === true
                              ? [...prev, key]
                              : prev.filter((c) => c !== key),
                          )
                        }
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`sac-${key}`}
                        className="text-[11px] font-normal leading-relaxed text-muted-foreground"
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {SPECIAL_AD_CATEGORY_NONE_NOTE}
                </p>
                {categories.length > 0 ? (
                  <p className="text-[11px] leading-relaxed text-warning-on-tint">
                    {categoryConsequence}
                  </p>
                ) : null}
              </div>
            ) : null}

            {state.kind !== "unknown" ? (
              <Button
                type="button"
                size="sm"
                disabled={!ticked || save.isPending}
                onClick={() => save.mutate(true)}
              >
                {save.isPending ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : null}
                {state.kind === "superseded" ? "Confirm" : "Save declaration"}
              </Button>
            ) : state.reason ===
              "unsupported_notice" ? // No retry: the read succeeded. Re-fetching returns the same
            // version we don't hold, so a button here would be a dead end
            // dressed as a remedy.
            null : (
              // "Try again in a moment" with no way to try is a dead end, and
              // refetchOnWindowFocus is off so tabbing away won't retry.
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={settings.isFetching}
                onClick={() => void settings.refetch()}
              >
                {settings.isFetching ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 size-3" />
                )}
                Try again
              </Button>
            )}
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
