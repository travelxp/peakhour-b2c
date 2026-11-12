"use client";

/**
 * The read-only faces of the advertising declaration card (a political
 * record, a "not political" record) and the withdraw confirmation. Moved out
 * of advertising-declaration-card.tsx unchanged so the card file stays
 * readable and the withdraw dialog can load on demand.
 */

import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
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
import type { GrowthSettingsResponse } from "@/lib/api/growth";
import {
  POLITICAL_DECLARATION_WITHDRAW_WARNING,
  formatDeclaredAt,
  metaCategoryAnswerMissing,
  type DeclarationState,
} from "@/lib/ads-copy";

export function PoliticalDeclarationReadOnly({
  state,
  settingsData,
  storedCountries,
  politicalNeedsCategories,
  savePending,
  openForm,
  onWithdraw,
}: {
  state: Extract<DeclarationState, { kind: "political" }>;
  settingsData: GrowthSettingsResponse | undefined;
  storedCountries: string[] | undefined;
  politicalNeedsCategories: boolean;
  savePending: boolean;
  openForm: () => void;
  onWithdraw: () => void;
}) {
  return (
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
        {/* ⚠️★★M-17 CHANGED WHY THIS IS READ-ONLY, AND THE OLD REASON
            WAS NO LONGER TRUE. It said *"Peakhour doesn't support the
            extra obligations political advertising carries"* — written
            when this card could not RECORD the answer either. It can
            now, so the sentence read as a refusal to serve rather than
            as what it is: a legal statement is not retracted by
            re-ticking a box. */}
        <p className="text-xs text-muted-foreground">
          A declaration like this isn&apos;t changed by re-ticking a box —
          withdraw it and declare again. The platforms&apos; political
          advertising rules apply to these campaigns, and meeting them
          is between you and the platform.
          {state.superseded ? (
            <>
              {" "}
              LinkedIn has also updated its notice since this was
              recorded, so automatic campaigns are currently sending no
              declaration at all.
            </>
          ) : null}
        </p>
        {/* ── ★★THE VERDICT, FROM THE API RATHER THAN COMPUTED HERE ──
            This one is about the declaration ON RECORD, so the server
            answers it: `politicalAdsRefused` is absent when there is
            nothing to judge, which is why there is no empty state under
            it. The live preview in the form above reads the same served
            lists, so the two cannot disagree. */}
        {storedCountries && storedCountries.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Countries: {storedCountries.join(", ")}
          </p>
        ) : null}
        {settingsData?.politicalAdsRefused?.banned.length ? (
          <p className="text-xs text-warning-on-tint">
            Meta won&apos;t run political ads in{" "}
            {settingsData.politicalAdsRefused.banned.join(", ")}.
          </p>
        ) : null}
        {settingsData?.politicalAdsRefused?.uncertain.length ? (
          <p className="text-xs text-muted-foreground">
            We can&apos;t tell you whether Meta&apos;s EU ban covers{" "}
            {settingsData.politicalAdsRefused.uncertain.join(", ")} —
            Meta doesn&apos;t publish which territories it counts.
          </p>
        ) : null}
        {/* ⚠️★★THE SAME MISSING-CATEGORY WARNING AS THE `declared`
            BRANCH, AND IT WAS ONLY THERE (review round 1). A POLITICAL
            declaration stored without a special-ad-category answer —
            which this card can now produce, if the api served no options
            when it was made — resolves `never_declared` and blocks every
            Meta create, silently, on the one branch that never warned
            about it. The political answer does not exempt a business
            from the OTHER five categories. */}
        {metaCategoryAnswerMissing(
          settingsData?.settings.advertisingDeclaration,
        ) ? (
          <p className="text-xs text-warning-on-tint">
            Meta campaigns also need the special-ad-category answer, which
            this declaration doesn&apos;t have — so they can&apos;t be
            created until it is re-made with one. LinkedIn is unaffected.
          </p>
        ) : null}
        {/* ⚠️★★AND A WAY BACK INTO THE FORM, WHICH DID NOT EXIST. The
            copy above already says autonomous campaigns are sending no
            declaration at all under a superseded notice — and offered
            nothing but Withdraw to fix it. Withdrawing to restate the
            same thing destroys the provenance of a legal statement in
            order to repeat it.

            ⏸TWO REASONS TO OFFER IT, and they need different words: the
            wording changed, or the Meta category half was never
            answered. A standing declaration with both in order has
            nothing to re-confirm, and a button suggesting otherwise
            invites re-ticking a legal statement for no reason. */}
        {state.superseded || politicalNeedsCategories ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={savePending}
            onClick={openForm}
          >
            {state.superseded
              ? "Confirm the current wording"
              : "Answer the Meta category question"}
          </Button>
        ) : null}
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
          disabled={savePending}
          onClick={onWithdraw}
        >
          {savePending ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : null}
          Withdraw
        </Button>
      </div>
    </div>
  );
}

export function DeclaredReadOnly({
  state,
  settingsData,
  categoryOptions,
  storedCategories,
  storedCountries,
  savePending,
  openForm,
  onWithdraw,
}: {
  state: Extract<DeclarationState, { kind: "declared" }>;
  settingsData: GrowthSettingsResponse | undefined;
  categoryOptions: readonly unknown[];
  storedCategories: string[] | undefined;
  storedCountries: string[] | undefined;
  savePending: boolean;
  openForm: () => void;
  onWithdraw: () => void;
}) {
  return (
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
        {/* ⚠️★THE HALF THAT IS STILL MISSING, SAID PLAINLY. A declaration
            made through the boost dialog has no category answer, and
            without one every Meta create refuses — while the line above
            says automatic campaigns are covered. LinkedIn campaigns
            genuinely are, so this names the platform rather than
            contradicting it. */}
        {/* ⚠️★★★THE WARNING IS NOT GATED ON THE SERVED OPTION LIST, AND
            IT WAS. Both the banner and the *Answer it* button sat inside
            `categoryOptions.length > 0`, so on any response that did not
            carry the options — an api that predates the field, a partial
            envelope, a deploy gap — the warning VANISHED while the
            reassuring line above it (*"automatic campaigns carry this
            declaration"*) stayed. The merchant was told they were
            covered in the one state where they are not.

            ★The WARNING is about the RECORD; the BUTTON is about the
            FORM. Only the button needs the options, because only the
            button leads somewhere that requires them — and a button that
            opens a form with no checkboxes sends no categories, which
            the api refuses with an error the merchant cannot act on.

            ⏸`metaCategoryAnswerMissing` is in ads-copy.ts, tested. The
            condition it replaces was `storedCategories === undefined`
            inline, which is the same rule spelled one way in one file. */}
        {metaCategoryAnswerMissing(
          settingsData?.settings.advertisingDeclaration,
        ) ? (
          <div className="space-y-1 rounded-md border border-warning/30 bg-warning/15 p-2">
            <p className="text-micro leading-relaxed text-warning-on-tint">
              Meta campaigns also need the special-ad-category answer,
              which this declaration doesn&apos;t have yet. Until it does,
              Meta campaigns can&apos;t be created. LinkedIn is unaffected.
            </p>
            {categoryOptions.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={openForm}
              >
                Answer it
              </Button>
            ) : null}
          </div>
        ) : null}
        {categoryOptions.length > 0 && storedCategories !== undefined ? (
          (
            // ⚠️★AND AN ANSWER ALREADY GIVEN MUST BE AMENDABLE. Gating
            // the affordance on `undefined` left the only route to
            // changing it as WITHDRAWING the whole declaration — a
            // merchant who stops running credit ads should not have to
            // retract a legal statement to say so, and `[]` counts as
            // an answer here too.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={openForm}
            >
              {storedCategories.length > 0
                ? `Meta categories: ${storedCategories.length} declared — change`
                : "Meta categories: none declared — change"}
            </Button>
          )
        ) : null}
        {/* ⏸THE COUNTRIES THIS DECLARATION COVERS, when it has any.
            Shown read-only: the only route to changing them is the one
            that created them — a POLITICAL declaration — and the only
            route out of that is an explicit withdrawal. */}
        {storedCountries && storedCountries.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Countries: {storedCountries.join(", ")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={savePending}
          onClick={onWithdraw}
        >
          {savePending ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : null}
          Withdraw
        </Button>
      </div>
    </div>
  );
}

export function WithdrawDeclarationDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
<AlertDialog open={open} onOpenChange={onOpenChange}>
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
          onConfirm();
        }}
      >
        Withdraw
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
  );
}
