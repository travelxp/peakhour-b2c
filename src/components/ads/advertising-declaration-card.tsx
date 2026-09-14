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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { ApiError } from "@/lib/api";
import { growthApi } from "@/lib/api/growth";
import {
  POLITICAL_DECLARATION_POLICY_URL,
  POLITICAL_DECLARATION_CONSEQUENCE,
  POLITICAL_DECLARATION_WITHDRAW_WARNING,
  declarationState,
  formatDeclaredAt,
  SPECIAL_AD_CATEGORY_QUESTION,
  SPECIAL_AD_CATEGORY_NONE_NOTE,
  SPECIAL_AD_CATEGORY_COUNTRY_QUESTION,
  SPECIAL_AD_CATEGORY_COUNTRY_HELP,
  selectedCategories,
  selectedCountries,
  parseCountryCodes,
  euPoliticalAdsVerdict,
  declarationBlockedBecause,
  metaCategoryAnswerMissing,
  declarationSavedMessage,
  declarationBlockedMessage,
  stampableNoticeText,
} from "@/lib/ads-copy";

export function AdvertisingDeclarationCard() {
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  // ★★THE CATEGORY QUESTION HAS TO BE REACHABLE AFTER DECLARING, and it was
  // not. The form lives in the not-yet-declared branch only, so a business
  // that declared through the LinkedIn boost dialog — which never asks about
  // Meta categories — landed in the read-only `declared` branch with no way
  // to answer. `resolveSpecialAdCategories` then reports `never_declared`,
  // every Meta create refuses, and the card says *"automatic campaigns carry
  // this declaration"* while Meta campaigns cannot run at all.
  //
  // ⏸It re-opens the WHOLE form rather than adding a categories-only one: the
  // api refuses categories without an intent (DECLARATION_INCOMPLETE) so that
  // a record cannot have halves consented under different wordings. One
  // notice, one moment, one submission — so answering the second half means
  // re-affirming the first, with the notice on screen.
  const [reopen, setReopen] = useState(false);
  const [ticked, setTicked] = useState(false);
  /**
   * ⚠️★★M-17: THE ANSWER IS NOW A CHOICE, NOT A TICK.
   *
   * This card's own comment used to read *"b2c does not OFFER POLITICAL —
   * Peakhour does not support the obligations it carries"*, and the effect was
   * that a political advertiser could not tell the truth here: they ticked
   * *"this is not political advertising"*, or they left the record absent and
   * every autonomous campaign sent NOT_DECLARED. Neither is a declaration.
   *
   * ★Declaring it does NOT mean we take on the obligations. It means the
   * category reaches Meta, the platforms' political-ads rules apply, and we
   * tell them where the ads cannot run. The affirmative notice says exactly
   * that, and it is the api's wording rather than ours to soften.
   *
   * ⏸A RADIO RATHER THAN A SECOND CHECKBOX. Two checkboxes have a state where
   * both are ticked, and the thing being recorded is one answer to one
   * question. `null` is *"not chosen"*, which is neither answer.
   */
  const [answer, setAnswer] = useState<"NOT_POLITICAL" | "POLITICAL" | null>(null);
  /**
   * ★RAW TEXT, PARSED ON EVERY RENDER rather than parsed into state.
   *
   * Holding the parsed codes in state would fight the input: a merchant midway
   * through typing `IE` has written `I`, which is not a code, and a
   * parse-on-change would either drop it or refuse it while they were still
   * typing. `null` means untouched, exactly as `categories` does, so a
   * superseded POLITICAL declaration re-confirms from what it stored rather
   * than from an empty box.
   */
  const [countryText, setCountryText] = useState<string | null>(null);
  // ★A SET, AND EMPTY IS A REAL VALUE. Submitting with nothing selected
  // sends `specialAdCategories: []` — Meta has no "not answered" value, so
  // "none of these apply" is a statement the merchant makes, not a field
  // they skipped. The copy says so beside the boxes.
  //
  // ⚠️★★`null` IS "THE MERCHANT HAS NOT TOUCHED THE BOXES", WHICH IS NOT `[]`.
  //
  // It was `[]` initially, and that quietly ERASED stored answers. The form
  // renders for a SUPERSEDED declaration too — re-confirm wording that
  // changed — and a merchant who had declared HOUSING and CREDIT saw the
  // boxes unticked, because nothing seeded them. Submitting the re-confirm
  // then sent an explicit `[]`, which the api CANNOT refuse: its erase guard
  // fires on an OMITTED field, and `[]` is a real answer that a real form can
  // legitimately produce. Two clicks turned a housing advertiser into one
  // who had declared that none of these apply.
  //
  // ★So the stored answer seeds the boxes, derived rather than copied into
  // state by an effect — this repo's lint forbids `setState` in an effect,
  // and an effect would also race the query's first resolve.
  const [categories, setCategories] = useState<string[] | null>(null);

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
              // ⚠️★M-17: WHICHEVER ANSWER WAS CHOSEN, not a hardcoded one.
              // The `declare` boolean used to mean NOT_POLITICAL because that
              // was the only answer this card could give.
              politicalIntent: (answerInForce ?? "NOT_POLITICAL") as
                | "NOT_POLITICAL"
                | "POLITICAL",
              // ★★ONLY WHEN THE QUESTION WAS ACTUALLY SHOWN. If the api
              // served no options the checkboxes never rendered, so sending
              // `[]` would record "none of these apply" from a form that
              // never asked — the compliance invention the api's
              // discriminated result exists to prevent. Omitting it leaves
              // the record undeclared, which is the honest state.
              ...(categoryOptions.length > 0
                ? { specialAdCategories: selected }
                : {}),
              // ⚠️★★AND THE COUNTRIES, WHICH ARE NEVER SENT EMPTY.
              //
              // The api's `.min(1)` refuses `[]` — there is no advertising in
              // no countries — so an empty list is OMITTED rather than sent,
              // and the Save button is already blocked in the one state where
              // that matters (`country_missing`). Sending `[]` here would turn
              // a blocked form into a 400 the merchant cannot act on.
              //
              // ⏸This is the exact INVERSE of the line above: `[]` is a real
              // answer for categories and must be sent; `[]` is not an answer
              // here and must not be.
              //
              // ⚠️★★AND GATED ON THE ANSWER, NOT ONLY ON THE LIST BEING
              // NON-EMPTY (review round 1). `countries` is seeded from the
              // STORED value and from a text box that the radio hides rather
              // than clears, so a merchant who typed `FR`, switched to
              // NOT_POLITICAL and saved sent a jurisdiction claim from a
              // hidden field — recording, on a not-political declaration,
              // where they run political ads. The api accepts it (countries
              // are optional for that answer) and its erase guard then
              // refuses every later write that does not repeat it.
              //
              // ★The field is asked of one answer, so it is sent for one
              // answer. Clearing the text box on change is done as well, and
              // is the weaker half: it cannot help with a STORED list.
              ...(answerInForce === "POLITICAL" && countries.length > 0
                ? { specialAdCategoryCountries: countries }
                : {}),
            }
          : { politicalIntent: null },
      ),
    onSuccess: (res, declared) => {
      // PATCH returns the same envelope as GET (currentNoticeVersion +
      // declaredByName included), so writing it straight into the cache
      // cannot blank the version and flip this card to "unknown".
      queryClient.setQueryData(["growth-settings"], res);
      setTicked(false);
      setCategories(null);
      setCountryText(null);
      setAnswer(null);
      setReopen(false);
      // ⚠️★★THE OLD MESSAGE WAS FALSE FOR META AND SAID SO IN THE ONE PLACE A
      // MERCHANT READS AFTER ACTING: *"automatic campaigns can now declare on
      // your behalf"*, unconditionally. For a record with no
      // special-ad-category answer that is true of LinkedIn and false of Meta,
      // and the boost dialog writes exactly that record. The wording now comes
      // from a tested function rather than a ternary in JSX.
      toast.success(
        declared
          ? declarationSavedMessage(
              (answerInForce ?? "NOT_POLITICAL") as "NOT_POLITICAL" | "POLITICAL",
              res.settings.advertisingDeclaration?.specialAdCategories !== undefined,
            )
          : "Declaration withdrawn.",
      );
    },
    onError: (err) =>
      toast.error(
        // ⚠️★"TRY AGAIN IN A MOMENT" IS A LIE FOR THE ONE ERROR THIS FORM CAN
        // CAUSE BY ITSELF. If the api serves no `specialAdCategoryOptions` the
        // boxes never render, so the PATCH omits the field — and the api
        // refuses an intent-only write that would ERASE a stored category
        // answer (DECLARATION_INCOMPLETE). Retrying re-sends exactly the same
        // request, forever. It is not a transient failure and must not be
        // dressed as one.
        // ⚠️★★DECLARATION_STANDING IS NEWLY REACHABLE FROM THIS CARD (review
        // round 1). The api 409s when a standing POLITICAL declaration is
        // asked to become anything else — rule 0: *"a checkbox does not
        // retract a legal statement"* — and until this change nothing here
        // could WRITE a POLITICAL record, so the branch was unreachable and
        // the error fell through to *"Try again in a moment"*. Retrying
        // re-sends the same request for ever, and the remedy is a different
        // action rather than a repeated one.
        err instanceof ApiError && err.code === "DECLARATION_STANDING"
          ? "This business is recorded as a political advertiser. That's a legal statement and " +
            "a checkbox doesn't retract it — withdraw it first, then declare again. Nothing " +
            "was changed."
          : err instanceof ApiError && err.code === "DECLARATION_INCOMPLETE"
          ? // ⚠️★NO REMEDY IS OFFERED, BECAUSE THERE ISN'T ONE THE MERCHANT CAN
            // TAKE. The first cut said *reload the page*, which is the same
            // dead-end-dressed-as-a-remedy this file refuses for the
            // `unsupported_notice` retry button: the trigger is an envelope
            // served WITHOUT `specialAdCategoryOptions`, and a reload fetches
            // the same envelope. It says what happened and what did NOT happen,
            // and stops there.
            "We can't show the Meta category question right now, and saving without it would " +
            "erase the answer you already gave. Nothing was changed — your existing declaration " +
            "still stands."
          : "Couldn't save your declaration. Try again in a moment — nothing was changed.",
      ),
  });

  // ⚠️★★`reopen` IS RE-VALIDATED AGAINST THE CURRENT STATE, because it is a
  // flag a merchant set once and this card re-renders on every background
  // refetch. Held raw, it OUTRANKED `state.kind`: a mid-session move to
  // `superseded` kept rendering *"Your declaration stays in force"* about a
  // record the api had already stopped honouring, and a move to `unknown`
  // left a heading with no notice, no checkboxes and no Save — a form with
  // nothing in it.
  //
  // ★It only ever meant *"amend the categories on a declaration that is
  // standing"*. Every other state already renders its own, more urgent,
  // version of the same form.
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

  const amending = reopen && state.kind === "declared";
  /**
   * ⚠️★★★A POLITICAL RECORD COULD NEVER BE RE-CONFIRMED (review round 1).
   *
   * The `political` branch is rendered FIRST and is read-only, so a POLITICAL
   * declaration whose notice had been superseded had exactly one route back:
   * withdraw the whole record and declare again. That is not a re-confirm —
   * it destroys the provenance of a legal statement in order to restate it —
   * and while it sat there, `resolvePoliticalIntent` was sending NOT_DECLARED
   * on every autonomous create, which the branch's own copy says out loud.
   *
   * ⏸It also made the *"re-confirms from what it stored"* argument for seeding
   * the country box describe a form nobody could open. The comment was true
   * about the code and false about the product.
   *
   * ★RE-VALIDATED AGAINST THE CURRENT STATE, exactly as `amending` is: this
   * is a flag a merchant set once, and the card re-renders on every background
   * refetch. Held raw it would outrank `state.kind` and keep a re-confirm form
   * open over a record that had stopped being superseded.
   */
  const reconfirmingPolitical =
    reopen && state.kind === "political" && state.superseded;
  /**
   * ⚠️★A RE-CONFIRM IS NOT A CHOICE, so the radio is not offered during one.
   *
   * Re-confirming means *"the wording changed; do you still say this?"* — the
   * answer is already on record. Offering the radio would put a DOWNGRADE on
   * screen (POLITICAL → NOT_POLITICAL), which the api refuses with a 409 by
   * design: *"a checkbox does not retract a legal statement"*. A control whose
   * only other setting is an error is not a choice, it is a trap.
   *
   * ★Withdrawal is still one click away, in the branch this one replaces, and
   * that is the deliberate route out.
   */
  /**
   * Open the form, from whichever affordance.
   *
   * ⚠️★★EVERY ENTRY POINT CLEARS THE DRAFT, and `setReopen(true)` on its own
   * did not (review round 2). `onSuccess` and Cancel both reset all three
   * fields; the two buttons that OPEN the form reset none, so a tick given
   * for the NOT_POLITICAL wording could carry into a POLITICAL re-confirm and
   * leave Save immediately live — consent to a sentence the merchant had not
   * been shown for the answer being recorded.
   *
   * ⏸It needs a mid-session change of state to reach, which is why it is worth
   * a function rather than a comment: the three resets were already written
   * twice and the third site is where they were forgotten.
   */
  const openForm = () => {
    setTicked(false);
    setAnswer(null);
    setCountryText(null);
    setReopen(true);
  };

  const answerInForce: "NOT_POLITICAL" | "POLITICAL" | null = reconfirmingPolitical
    ? "POLITICAL"
    : answer;

  // Not `isLoading`: that is pending AND fetching, so a paused/offline fetch
  // leaves it false with no data, and `declarationState` would then render a
  // confident "not declared" plus a Save button that hangs. Render nothing
  // until we have either data or a definite failure.
  if (!settings.data && !settings.isError) return null;

  // ★SERVED, NOT LOOKED UP. The api sends the wording its
  // `currentNoticeVersion` means, so this card cannot show one version's
  // text while stamping another's — and a notice bump needs no deploy here.
  //
  // ⚠️★★M-17: IT FOLLOWS THE CHOSEN ANSWER NOW. It was pinned to the negative
  // because that was the only answer this card could collect; with both on
  // offer, a fixed wording would show *"I confirm this is not political
  // advertising"* beside a radio that records POLITICAL — a consent record
  // whose text asserts the opposite of what it stores, which is the exact
  // defect `currentNoticeText` was split into two strings to prevent.
  //
  // ⏸Before an answer is chosen there is nothing to stamp, so nothing is
  // shown: `declarationBlockedBecause` returns `no_answer` and the Save button
  // is dead. A default of the negative would put a sentence on screen that the
  // merchant has not chosen and might not agree with.
  const noticeText = answerInForce
    ? stampableNoticeText(answerInForce, settings.data?.currentNoticeText)
    : undefined;
  // ★AND THE FORM ITSELF IS SERVED. A local label map would silently stop
  // offering any category the api adds (P-09: five surfaces, five wrong
  // answers, all derived locally).
  const categoryOptions = settings.data?.specialAdCategoryOptions ?? [];
  // ★THE STORED ANSWER SEEDS THE BOXES. Derived, not copied into state: an
  // effect would race the query's first resolve, and this repo's lint forbids
  // `setState` inside one. `null` means the merchant has not touched them, so
  // a re-confirm starts from what they previously said rather than from
  // nothing — which is what turned an explicit `[]` into a silent erasure.
  const storedCategories =
    settings.data?.settings.advertisingDeclaration?.specialAdCategories;
  const selected = selectedCategories(categories, storedCategories);

  // ── M-17 ────────────────────────────────────────────────────────────────
  //
  // ⏸The stored countries seed the box for the same reason the stored
  // categories seed the checkboxes: this form renders for a SUPERSEDED
  // declaration too, and a box that starts empty sends an answer the merchant
  // did not give. Here it would be worse than an erasure — the api refuses an
  // omitted country list on a record that has one, so the re-confirm would
  // simply 400.
  const storedCountries =
    settings.data?.settings.advertisingDeclaration?.specialAdCategoryCountries;
  const countryInput =
    countryText ?? (storedCountries ?? []).join(", ");
  const parsedCountries = parseCountryCodes(countryInput);
  const countries = selectedCountries(
    countryText === null ? null : parsedCountries.codes,
    storedCountries,
  );
  const euBan = settings.data?.euPoliticalAdsBan;
  // ⏸THE LIVE PREVIEW, while the merchant is still typing. The api serves
  // `politicalAdsRefused` for the declaration already on record; both read the
  // same served lists, so they cannot disagree about which bucket a country is
  // in.
  const euVerdict = euPoliticalAdsVerdict(countries, euBan);
  const blocked = declarationBlockedBecause({
    answer: answerInForce,
    confirmed: ticked,
    countries,
    invalidCountries: countryText === null ? [] : parsedCountries.invalid,
    noticeText: settings.data?.currentNoticeText,
  });

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
        {/* ⏸`!reconfirmingPolitical` lets the form below take over for a
            superseded political record. Every other political state stays
            read-only: a standing declaration is withdrawn, not re-ticked. */}
        {state.kind === "political" && !reconfirmingPolitical ? (
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
              {settings.data?.politicalAdsRefused?.banned.length ? (
                <p className="text-xs text-warning-on-tint">
                  Meta won&apos;t run political ads in{" "}
                  {settings.data.politicalAdsRefused.banned.join(", ")}.
                </p>
              ) : null}
              {settings.data?.politicalAdsRefused?.uncertain.length ? (
                <p className="text-xs text-muted-foreground">
                  We can&apos;t tell you whether Meta&apos;s EU ban covers{" "}
                  {settings.data.politicalAdsRefused.uncertain.join(", ")} —
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
                settings.data?.settings.advertisingDeclaration,
              ) ? (
                <p className="text-xs text-warning-on-tint">
                  Meta campaigns also need the special-ad-category answer, which
                  this declaration doesn&apos;t have — so they can&apos;t be
                  created until it is re-made with one. LinkedIn is unaffected.
                </p>
              ) : null}
              {/* ⚠️★★AND A WAY TO RE-CONFIRM, WHICH DID NOT EXIST. The copy
                  above already says autonomous campaigns are sending no
                  declaration at all under a superseded notice — and offered
                  nothing but Withdraw to fix it. Withdrawing to restate the
                  same thing destroys the provenance of a legal statement in
                  order to repeat it.

                  ⏸OFFERED ONLY WHEN SUPERSEDED. A standing declaration has
                  nothing to re-confirm, and a button suggesting otherwise
                  invites re-ticking a legal statement for no reason. */}
              {state.superseded ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={save.isPending}
                  onClick={openForm}
                >
                  Confirm the current wording
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
        ) : state.kind === "declared" && !amending ? (
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
                settings.data?.settings.advertisingDeclaration,
              ) ? (
                <div className="space-y-1 rounded-md border border-warning/30 bg-warning/15 p-2">
                  <p className="text-[11px] leading-relaxed text-warning-on-tint">
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
              {/* ⚠️★REOPEN IS NOT AN ALARM. The amber icon and the copy below
                  are written for a business with NO declaration in force;
                  shown to one that is amending a standing declaration they
                  contradict the line the merchant just clicked away from. */}
              {amending ? (
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-on-tint" />
              ) : state.kind === "unknown" ? (
                <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-on-tint" />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {reconfirmingPolitical
                    ? "Please confirm the current wording"
                    : amending
                      ? "Answer the Meta category question"
                      : state.kind === "superseded"
                      ? "Please confirm the current wording"
                      : state.kind === "unknown"
                        ? state.reason === "unsupported_notice"
                          ? "This notice has changed"
                          : "We couldn't check your advertising declaration"
                        : "Advertising declaration"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reconfirmingPolitical ? (
                    <>
                      The notice has been reworded since you declared
                      {state.kind === "political" && state.declaredAt &&
                      formatDeclaredAt(state.declaredAt)
                        ? ` on ${formatDeclaredAt(state.declaredAt)}`
                        : ""}
                      . Until you confirm it, automatic campaigns send no
                      declaration at all.
                    </>
                  ) : amending ? (
                    <>
                      Your declaration stays in force. Meta also needs the
                      special-ad-category answer, and the two are recorded
                      together as one declaration — so confirm the wording
                      again below and it will be saved in one go.
                    </>
                  ) : state.kind === "superseded" ? (
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

            {/* ── ⚠️★★M-17: THE ANSWER, AND THERE ARE TWO OF THEM ─────────
                This was a single checkbox reading *"I confirm this is not
                political advertising"*, so a political advertiser could not
                tell the truth on this surface at all — they ticked a sentence
                that was false, or left the record absent and every autonomous
                campaign sent NOT_DECLARED. Neither is a declaration.

                ★A RADIO, NOT A SECOND CHECKBOX: two checkboxes have a state
                where both are ticked, and this is one answer to one question.

                ⏸Nothing is preselected. A default would put an unchosen legal
                statement on screen with its notice text under it. */}
            {state.kind !== "unknown" ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                {/* ⏸REPLACED BY A STATEMENT DURING A RE-CONFIRM — see
                    `answerInForce`. The answer is already on record; the only
                    other setting the radio could offer is one the api refuses
                    with a 409. */}
                {reconfirmingPolitical ? (
                  <p className="text-xs">
                    You&apos;re re-confirming that your ads{" "}
                    <span className="font-medium">ARE</span> political,
                    electoral or about social issues. To say something else,
                    withdraw the declaration first.
                  </p>
                ) : (
                <RadioGroup
                  value={answer ?? ""}
                  onValueChange={(v) => {
                    setAnswer(v as "NOT_POLITICAL" | "POLITICAL");
                    // ★THE CONFIRMATION IS DROPPED WHEN THE ANSWER CHANGES.
                    // A tick carried across would be consent to the wording of
                    // the OTHER answer, which is the whole reason the api
                    // serves two texts rather than one.
                    setTicked(false);
                    // ⏸AND THE COUNTRY TEXT, which the radio HIDES rather than
                    // unmounts-and-clears. Leaving it meant a merchant could
                    // type `FR`, switch to NOT_POLITICAL, and save a
                    // jurisdiction claim from a field that was no longer on
                    // screen. ★The submit is gated on the answer as well —
                    // this half cannot help with a list seeded from a STORED
                    // declaration, which is why it is not the fix on its own.
                    setCountryText(null);
                  }}
                  disabled={save.isPending}
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem
                      value="NOT_POLITICAL"
                      id="ads-answer-not-political"
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="ads-answer-not-political"
                      className="text-xs font-normal leading-relaxed"
                    >
                      None of my ads are political, electoral or about social
                      issues.
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem
                      value="POLITICAL"
                      id="ads-answer-political"
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="ads-answer-political"
                      className="text-xs font-normal leading-relaxed"
                    >
                      My ads ARE political, electoral or about social issues.
                    </Label>
                  </div>
                </RadioGroup>
                )}

                {/* ⚠️★THE NOTICE FOLLOWS THE ANSWER. Rendering the negative
                    wording beside a radio that records POLITICAL would stamp a
                    consent record whose text asserts the opposite of what it
                    stores — the defect `currentNoticeText` was split in two to
                    prevent. Nothing is shown until an answer is chosen. */}
                {answerInForce && noticeText ? (
                  <div className="flex items-start gap-2 border-t pt-2">
                    <Checkbox
                      id="ads-confirm-notice"
                      checked={ticked}
                      onCheckedChange={(v) => setTicked(v === true)}
                      disabled={save.isPending}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="ads-confirm-notice"
                      className="text-[11px] font-normal leading-relaxed text-muted-foreground"
                    >
                      {notice}
                    </Label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ── ⚠️★★★M-17: THE COUNTRY, WITHOUT WHICH THIS CANNOT BE SENT ──
                Meta requires `special_ad_category_country` whenever a category
                is set, and documents a tax-country fallback for housing,
                employment and financial services ONLY.
                `ISSUES_ELECTIONS_POLITICS` gets no default — so a political
                declaration naming no country could never produce a campaign,
                and the api refuses to store one.

                ⏸ASKED ONLY OF THE POLITICAL ANSWER. For every other category
                Meta fills it in, and there is no way to CLEAR a stored country
                list once written (omitting it is an erase the api refuses) —
                so a field offered to everyone would be a field nobody could
                empty. */}
            {state.kind !== "unknown" && answerInForce === "POLITICAL" ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <Label
                  htmlFor="ads-sac-countries"
                  className="text-xs font-medium"
                >
                  {SPECIAL_AD_CATEGORY_COUNTRY_QUESTION}
                </Label>
                <Input
                  id="ads-sac-countries"
                  value={countryInput}
                  onChange={(e) => setCountryText(e.target.value)}
                  disabled={save.isPending}
                  placeholder="GB, IE"
                  className="h-8 text-xs"
                  autoComplete="off"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {SPECIAL_AD_CATEGORY_COUNTRY_HELP}
                </p>
                {/* ⚠️★WHAT DID NOT PARSE IS NAMED, not silently dropped.
                    Discarding "France" from `GB, France, IE` would record a
                    narrower declaration than the merchant wrote and tell them
                    nothing. */}
                {blocked === "country_invalid" ? (
                  <p className="text-[11px] leading-relaxed text-destructive">
                    {parsedCountries.invalid.join(", ")} — country codes are two
                    letters, like GB or IE.
                  </p>
                ) : null}
                {/* ── ★THE EU PROHIBITION, BEFORE THE TICK ─────────────────
                    Meta has not allowed political ads in the EU since
                    2025-10-06. A surface that collected this declaration
                    without saying so would collect consent for something we
                    already know cannot run. */}
                {euVerdict.banned.length > 0 ? (
                  <p className="text-[11px] leading-relaxed text-warning-on-tint">
                    Meta hasn&apos;t allowed political ads in the EU since{" "}
                    {euBan?.since ?? "October 2025"}, so campaigns for{" "}
                    {euVerdict.banned.join(", ")} won&apos;t run. You can still
                    record the declaration.
                  </p>
                ) : null}
                {/* ⚠️★★AND THE ONES WE CANNOT ANSWER FOR, SAID SEPARATELY.
                    Meta's phrase is *"the EU and associated territories"* and
                    it publishes no list; the EEA reading is ours. Folding
                    these into the line above would state our interpretation as
                    Meta's — and dropping them would under-warn on countries
                    Meta may well refuse. */}
                {euVerdict.uncertain.length > 0 ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Meta&apos;s ban covers &quot;the EU and associated
                    territories&quot; and it doesn&apos;t publish which those
                    are, so we can&apos;t tell you whether{" "}
                    {euVerdict.uncertain.join(", ")} counts. Check with Meta
                    before you spend.
                  </p>
                ) : null}
                {/* ⏸AND A COUNTRY IN NEITHER LIST IS NOT CLEARED. Nothing is
                    rendered for it: an all-clear is the one thing an absence
                    must never be read as, and there is no served list that
                    would justify one. */}
                {!euVerdict.known && countries.length > 0 ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    We can&apos;t check these against Meta&apos;s restrictions
                    right now.
                  </p>
                ) : null}
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
                  {categoryOptions.map(({ key, label, consequence }) => (
                    <div key={key} className="flex items-start gap-2">
                      <Checkbox
                        id={`sac-${key}`}
                        checked={selected.includes(key)}
                        disabled={save.isPending}
                        onCheckedChange={(v) =>
                          setCategories((prev) => {
                            // ★First touch starts from what is STORED, not from
                            // `[]` — otherwise ticking one box silently drops
                            // every other category the merchant had declared.
                            const base = selectedCategories(prev, storedCategories);
                            return v === true
                              ? [...base, key]
                              : base.filter((c: string) => c !== key);
                          })
                        }
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor={`sac-${key}`}
                          className="text-[11px] font-normal leading-relaxed text-muted-foreground"
                        >
                          {label}
                        </Label>
                        {/* ⚠️★★M-17: THE COST IS PER OPTION NOW, AND IT MOVED
                            HERE BECAUSE META VARIES IT BY CATEGORY.

                            One shared sentence sat under the whole group and
                            said *"no lookalikes, no exclusions, no sub-city
                            geo"*. Meta's restrictions guide names HOUSING,
                            EMPLOYMENT and FINANCIAL_PRODUCTS_SERVICES —
                            ONLINE_GAMBLING_AND_GAMING does not appear on it at
                            all. So the shared sentence asserted a restriction
                            with no source, beside the checkbox a merchant was
                            about to tick.

                            ⏸SHOWN ONLY FOR A TICKED OPTION. Five costs under
                            five unticked boxes is a wall nobody reads, and the
                            one that matters is the one they just chose. */}
                        {selected.includes(key) && consequence ? (
                          <p className="mt-1 text-[11px] leading-relaxed text-warning-on-tint">
                            {consequence}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {SPECIAL_AD_CATEGORY_NONE_NOTE}
                </p>
                {/* ⏸THE SHARED CONSEQUENCE PARAGRAPH IS GONE, and its guard
                    with it. It was gated on `selected.length > 0 &&
                    categoryConsequence` so a response serving options but no
                    consequence could not render an EMPTY amber paragraph — *"a
                    warning shape with no warning in it"*. That reasoning still
                    holds and now lives per option, where `consequence &&`
                    does the same job for the same reason. */}
              </div>
            ) : null}

            {/* ⚠️★★A DISABLED BUTTON WITH NO EXPLANATION IS A DEAD END, which
                this file already refuses for `unsupported_notice`. With two
                answers and a country field there are now four ways to be
                un-saveable, and `declarationBlockedBecause` names which —
                tested, because this repo cannot test JSX. */}
            {/* ⚠️★ONLY ONE REASON HAD COPY (review round 1), and the missing
                one is the only reason the merchant cannot act on:
                `no_notice_text` leaves the confirm checkbox unrendered —
                there is no wording to confirm — and the Save button dead,
                with nothing on screen explaining either. It is reachable on a
                real response, because `declarationState` gates on the
                NEGATIVE wording alone: an envelope serving `notPolitical` and
                not `political` renders this whole form and then silently
                refuses the political answer.

                ⏸`no_answer` and `not_confirmed` return null on purpose — the
                empty radio and the unticked box ARE the message. */}
            {state.kind !== "unknown" && declarationBlockedMessage(blocked) ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {declarationBlockedMessage(blocked)}
              </p>
            ) : null}
            {state.kind !== "unknown" ? (
              <Button
                type="button"
                size="sm"
                disabled={blocked !== null || save.isPending}
                onClick={() => save.mutate(true)}
              >
                {save.isPending ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : null}
                {/* ⏸A re-confirm is not a first declaration, and said *"Save
                    declaration"* (review round 2) — the same word the
                    superseded branch already avoids two lines down, for the
                    same reason. */}
                {reconfirmingPolitical
                  ? "Confirm"
                  : amending
                    ? "Save"
                    : state.kind === "superseded"
                      ? "Confirm"
                      : "Save declaration"}
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
            {/* ★A WAY BACK OUT. `reopen` was a one-way door: a merchant who
                clicked it to look, or clicked it by mistake, had no route back
                to the standing declaration short of reloading the page. A
                sibling rather than a branch, so it cannot disturb the
                `state.reason` narrowing the retry button above depends on.

                ⚠️★★AND THE POLITICAL RE-CONFIRM NEEDED IT MORE, NOT LESS
                (review round 2). That form REPLACES the read-only branch, so
                entering it takes the Withdraw button off screen as well —
                and it is the one form that can be un-saveable for a reason
                the merchant cannot fix (`no_notice_text`, or a
                DECLARATION_INCOMPLETE from an envelope with no category
                options). Gated on `amending` alone, that was a trap with no
                exit but a page reload. */}
            {amending || reconfirmingPolitical ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-2 text-muted-foreground"
                disabled={save.isPending}
                onClick={() => {
                  setReopen(false);
                  setTicked(false);
                  // ★The in-progress selection is discarded, not kept. Keeping
                  // it would leave the boxes showing an answer the merchant
                  // backed out of, the next time they opened this.
                  setCategories(null);
                  // ⏸AND THE TWO M-17 FIELDS. A retained `answer` is the worst
                  // of the three to leave behind: it is the legal statement,
                  // and re-opening the form pre-selected on a choice the
                  // merchant backed out of is how it gets made by accident.
                  setCountryText(null);
                  setAnswer(null);
                }}
              >
                Cancel
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
