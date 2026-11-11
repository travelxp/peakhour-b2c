"use client";

/**
 * The business's one-time political-advertising declaration.
 *
 * WHY IT LIVES ON THE ADS PANEL AND NOT A GROWTH SCREEN: the declaration
 * governs EVERY campaign create, not just the engine's. The Growth screens are
 * gated on the engine, so a business entitled to ads but not the engine could
 * boost campaigns and never be able to declare — the exact hole this closes.
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

import dynamic from "next/dynamic";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { DeclaredReadOnly, PoliticalDeclarationReadOnly } from "@/components/ads/advertising-declaration-readonly";
import { DeclarationForm } from "@/components/ads/advertising-declaration-form";
import { ApiError } from "@/lib/api";
import { growthApi } from "@/lib/api/growth";
import {
  declarationState,
  selectedCategories,
  selectedCountries,
  parseCountryCodes,
  euPoliticalAdsVerdict,
  declarationBlockedBecause,
  metaCategoryAnswerMissing,
  declarationSavedMessage,
  declarationBlockedMessage,
  confirmationHolds,
  type DeclarationConfirmation,
  stampableNoticeText,
} from "@/lib/ads-copy";
import {
  buildDeclarationPatch,
  effectiveAnswer,
  saveErrorMessage,
  type DeclarationAnswer,
} from "@/lib/ads-declaration-form";

// Only mounted content once the merchant clicks Withdraw.
const WithdrawDeclarationDialog = dynamic(() =>
  import("@/components/ads/advertising-declaration-readonly").then((m) => m.WithdrawDeclarationDialog),
);

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
  /**
   * ⚠️★★★NOT A BOOLEAN, AND ROUND 2 IS WHY IT COULD NOT STAY ONE.
   *
   * A tick is consent to a SPECIFIC sentence. Round 2 cleared a boolean
   * `ticked` at every entry point and on every answer change, which closed the
   * routes a MERCHANT can take — and round 3 found the two the DATA takes,
   * because this card re-renders on every background refetch:
   *
   *   • a refetch can flip the record to SUPERSEDED mid-session, switching the
   *     form to the political wording under a tick given for the negative one;
   *   • a refetch can bring NEW wording, swapping the checkbox label under a
   *     tick given for the old version.
   *
   * ★Storing what the confirmation was FOR makes both impossible without
   * anybody remembering to clear anything — which is the part the boolean got
   * wrong twice. `confirmationHolds` is in ads-copy.ts, tested.
   */
  const [confirmed, setConfirmed] = useState<DeclarationConfirmation | null>(null);
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
  const [answer, setAnswer] = useState<DeclarationAnswer | null>(null);
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

  // Shares the cache key with the guardrails card, so declaring on either
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
    // The payload rules (what is sent, what is omitted and why) are in
    // buildDeclarationPatch, tested in lib/ads-declaration-form.test.ts.
    mutationFn: (declare: boolean) =>
      growthApi.updateSettings(
        buildDeclarationPatch({
          declare,
          answerInForce,
          categoryOptionCount: categoryOptions.length,
          selectedCategories: selected,
          countries,
        }),
      ),
    onSuccess: (res, declared) => {
      // PATCH returns the same envelope as GET (currentNoticeVersion +
      // declaredByName included), so writing it straight into the cache
      // cannot blank the version and flip this card to "unknown".
      queryClient.setQueryData(["growth-settings"], res);
      setConfirmed(null);
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
              effectiveAnswer(answerInForce),
              res.settings.advertisingDeclaration?.specialAdCategories !== undefined,
            )
          : "Declaration withdrawn.",
      );
    },
    onError: (err) =>
      toast.error(saveErrorMessage(err instanceof ApiError ? err.code : undefined)),
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
  // ⚠️★★AND NOT ONLY WHEN SUPERSEDED (review round 3). A STANDING political
  // record can be missing its special-ad-category answer too — the political
  // answer does not exempt a business from the other five categories — and
  // that state showed the warning with NO BUTTON to act on it, while the
  // `declared` branch has offered *Answer it* for the identical state since
  // M-03. A warning whose only remedy is on another branch is a warning the
  // merchant cannot take.
  //
  // ⏸Re-declaring a standing POLITICAL re-stamps `declaredAt` and
  // `declaredByUserId`, and that is correct rather than tolerated: the
  // merchant is making the declaration again, with the notice on screen, which
  // is exactly what the `amending` path already does for the negative answer —
  // *"answering the second half means re-affirming the first"*.
  const politicalNeedsCategories = metaCategoryAnswerMissing(
    settings.data?.settings.advertisingDeclaration,
  );
  const reconfirmingPolitical =
    reopen &&
    state.kind === "political" &&
    (state.superseded || politicalNeedsCategories);
  /**
   * ⚠️★A RE-CONFIRM IS NOT A CHOICE, so the radio is not offered during one.
   *
   * Re-confirming means *"you already said this; is it still true under the
   * current wording, and have you answered the rest?"* — the answer is on
   * record. Offering the radio would put a DOWNGRADE on screen (POLITICAL →
   * NOT_POLITICAL) inside a form labelled *confirm*.
   *
   * ⚠️★AND THE API WOULD ACCEPT IT, which a first draft of this comment had
   * backwards. It claimed the 409 made the downgrade harmless — but the api's
   * rule-0 guard is gated on `standing`, and a SUPERSEDED record is not
   * standing, so on the very state this form exists for the downgrade goes
   * straight through. ★So hiding the radio is not belt-and-braces over an api
   * refusal; **it is the only thing standing between a re-confirm and a
   * silent retraction.** A comment that credits a guard elsewhere is how a
   * real one here gets deleted as redundant.
   *
   * ★Withdrawal is still one click away, in the branch this one replaces, and
   * that is the deliberate route out — deliberate being the point.
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
    setConfirmed(null);
    setAnswer(null);
    setCountryText(null);
    // ⏸AND THE CATEGORIES (review round 3). `onSuccess` and Cancel reset all
    // four; this reset three. An abandoned draft of `[]` would seed the next
    // form and submit a SILENT ERASURE — the exact two-clicks-deep defect
    // `selectedCategories` was written to close, arriving through the one
    // reset site that did not list it.
    setCategories(null);
    setReopen(true);
  };

  const answerInForce: DeclarationAnswer | null = reconfirmingPolitical
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
  // ★DERIVED, NEVER STORED. A tick that was given for another answer or
  // another notice version simply stops holding — no effect, no cleanup, no
  // site to forget.
  const ticked = confirmationHolds(
    confirmed,
    answerInForce,
    settings.data?.currentNoticeVersion,
  );
  const blocked = declarationBlockedBecause({
    answer: answerInForce,
    confirmed: ticked,
    countries,
    invalidCountries: countryText === null ? [] : parsedCountries.invalid,
    noticeText: settings.data?.currentNoticeText,
  });

  return (
    <Card>
      <CardContent className="p-4">
        {/* ⏸`!reconfirmingPolitical` lets the form below take over for a
            superseded political record. Every other political state stays
            read-only: a standing declaration is withdrawn, not re-ticked. */}
        {state.kind === "political" && !reconfirmingPolitical ? (
          <PoliticalDeclarationReadOnly
            state={state}
            settingsData={settings.data}
            storedCountries={storedCountries}
            politicalNeedsCategories={politicalNeedsCategories}
            savePending={save.isPending}
            openForm={openForm}
            onWithdraw={() => setWithdrawOpen(true)}
          />
        ) : state.kind === "declared" && !amending ? (
          <DeclaredReadOnly
            state={state}
            settingsData={settings.data}
            categoryOptions={categoryOptions}
            storedCategories={storedCategories}
            storedCountries={storedCountries}
            savePending={save.isPending}
            openForm={openForm}
            onWithdraw={() => setWithdrawOpen(true)}
          />
        ) : (
          <DeclarationForm
            state={state}
            amending={amending}
            reconfirmingPolitical={reconfirmingPolitical}
            answer={answer}
            answerInForce={answerInForce}
            noticeText={noticeText}
            ticked={ticked}
            countryInput={countryInput}
            countries={countries}
            invalidCountries={parsedCountries.invalid}
            blocked={blocked}
            blockedMessage={declarationBlockedMessage(blocked)}
            euVerdict={euVerdict}
            euSince={euBan?.since}
            categoryOptions={categoryOptions}
            selected={selected}
            savePending={save.isPending}
            refetching={settings.isFetching}
            onAnswerChange={(v) => {
              setAnswer(v);
              // ⏸NO LONGER NEEDS TO DROP THE CONFIRMATION — it records
              // which answer it was given for, so it stops holding on its
              // own. Kept as a `setConfirmed(null)` anyway so a stale
              // record cannot linger in state and reappear if the
              // merchant switches back and forth.
              setConfirmed(null);
              // ⏸AND THE COUNTRY TEXT, which the radio HIDES rather than
              // unmounts-and-clears. Leaving it meant a merchant could
              // type `FR`, switch to NOT_POLITICAL, and save a
              // jurisdiction claim from a field that was no longer on
              // screen. ★The submit is gated on the answer as well —
              // this half cannot help with a list seeded from a STORED
              // declaration, which is why it is not the fix on its own.
              setCountryText(null);
            }}
            onConfirmChange={(checked) =>
              setConfirmed(
                checked && answerInForce && settings.data?.currentNoticeVersion
                  ? {
                      answer: answerInForce,
                      noticeVersion: settings.data.currentNoticeVersion,
                    }
                  : null,
              )
            }
            onCountryTextChange={setCountryText}
            onToggleCategory={(key, checked) =>
              setCategories((prev) => {
                // ★First touch starts from what is STORED, not from
                // `[]` — otherwise ticking one box silently drops
                // every other category the merchant had declared.
                const base = selectedCategories(prev, storedCategories);
                return checked
                  ? [...base, key]
                  : base.filter((c: string) => c !== key);
              })
            }
            onSubmit={() => save.mutate(true)}
            onRetry={() => void settings.refetch()}
            onCancel={() => {
              setReopen(false);
              setConfirmed(null);
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
          />
        )}
      </CardContent>

      <WithdrawDeclarationDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        onConfirm={() => {
          setWithdrawOpen(false);
          save.mutate(false);
        }}
      />
    </Card>
  );
}
