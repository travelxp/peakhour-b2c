"use client";

/**
 * The form half of the advertising declaration card: shown for an
 * undeclared, superseded, amending or re-confirming business, and for the two
 * "we couldn't check" states.
 *
 * It owns no state. The card holds every draft value (the answer, the tick,
 * the country text, the categories) because the card's mutation, its
 * re-validation of `reopen` and its reset sites all read them, and a draft
 * kept in two places is how a stale tick reaches a different wording. Every
 * reason lives with the card; this file is the markup those reasons produce.
 */

import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import {
  POLITICAL_DECLARATION_POLICY_URL,
  POLITICAL_DECLARATION_CONSEQUENCE,
  formatDeclaredAt,
  SPECIAL_AD_CATEGORY_QUESTION,
  SPECIAL_AD_CATEGORY_NONE_NOTE,
  SPECIAL_AD_CATEGORY_COUNTRY_QUESTION,
  SPECIAL_AD_CATEGORY_COUNTRY_HELP,
  type DeclarationState,
  type euPoliticalAdsVerdict,
  type declarationBlockedBecause,
} from "@/lib/ads-copy";
import {
  formHeading,
  formMode,
  formSubmitLabel,
  type DeclarationAnswer,
  type FormMode,
} from "@/lib/ads-declaration-form";

export interface DeclarationFormProps {
  state: DeclarationState;
  amending: boolean;
  reconfirmingPolitical: boolean;
  answer: DeclarationAnswer | null;
  answerInForce: DeclarationAnswer | null;
  /** The wording the tick is consent to; undefined until an answer is chosen. */
  noticeText: string | undefined;
  ticked: boolean;
  countryInput: string;
  countries: string[];
  invalidCountries: string[];
  blocked: ReturnType<typeof declarationBlockedBecause>;
  blockedMessage: string | null;
  euVerdict: ReturnType<typeof euPoliticalAdsVerdict>;
  euSince: string | undefined;
  categoryOptions: Array<{ key: string; label: string; consequence?: string }>;
  selected: string[];
  savePending: boolean;
  refetching: boolean;
  onAnswerChange: (answer: DeclarationAnswer) => void;
  onConfirmChange: (checked: boolean) => void;
  onCountryTextChange: (text: string) => void;
  onToggleCategory: (key: string, checked: boolean) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

export function DeclarationForm({
  state,
  amending,
  reconfirmingPolitical,
  answer,
  answerInForce,
  noticeText,
  ticked,
  countryInput,
  countries,
  invalidCountries,
  blocked,
  blockedMessage,
  euVerdict,
  euSince,
  categoryOptions,
  selected,
  savePending,
  refetching,
  onAnswerChange,
  onConfirmChange,
  onCountryTextChange,
  onToggleCategory,
  onSubmit,
  onRetry,
  onCancel,
}: DeclarationFormProps) {
  const mode = formMode({ state, reconfirmingPolitical, amending });
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

  // ⏸THE DATE IS DROPPED, not guessed, when it cannot be formatted.
  const declaredOn =
    (state.kind === "political" || state.kind === "superseded") &&
    state.declaredAt &&
    formatDeclaredAt(state.declaredAt)
      ? ` on ${formatDeclaredAt(state.declaredAt)}`
      : "";

  /** The line under the heading. One branch per `FormMode`, so the heading,
   *  this line and the submit label cannot name different reasons. */
  const formBody = (m: FormMode) => {
    switch (m) {
      case "reconfirm_wording":
        return (
          <>
            The notice has been reworded since you declared{declaredOn}. Until
            you confirm it, automatic campaigns send no declaration at all.
          </>
        );
      case "answer_categories":
        return (
          <>
            Your declaration stays in force. Meta also needs the
            special-ad-category answer, and the two are recorded together as
            one declaration — so confirm the wording again below and it will be
            saved in one go.
          </>
        );
      case "superseded":
        return (
          <>
            LinkedIn has updated this notice since you declared{declaredOn}.
            Until you confirm the current wording, automatic campaigns fall
            back to no declaration.
          </>
        );
      // Honest about not knowing rather than showing a confident "not
      // declared": a false "not declared" only over-warns, but a false
      // "declared" would be a claim we can't support. The two causes need
      // different copy — saying "your campaigns are unaffected" would be FALSE
      // on a notice change, where every stored declaration is superseded.
      case "unsupported_notice":
        return (
          <>
            LinkedIn has updated this notice and Peakhour needs an update
            before you can confirm the new wording. Until then, automatic
            campaigns send no declaration — so LinkedIn may hold them from EU
            audiences. Contact support if this persists.
          </>
        );
      case "read_failed":
        return (
          <>
            The state shown here may be wrong. Try again in a moment — your
            campaigns are unaffected.
          </>
        );
      case "first_declaration":
        return POLITICAL_DECLARATION_CONSEQUENCE;
    }
  };

  return (
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
            <p className="text-sm font-medium">{formHeading(mode)}</p>
            <p className="text-xs text-muted-foreground">
              {formBody(mode)}
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
              onValueChange={(v) => onAnswerChange(v as DeclarationAnswer)}
              disabled={savePending}
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
                  onCheckedChange={(v) => onConfirmChange(v === true)}
                  disabled={savePending}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="ads-confirm-notice"
                  className="text-micro font-normal leading-relaxed text-muted-foreground"
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
              onChange={(e) => onCountryTextChange(e.target.value)}
              disabled={savePending}
              placeholder="GB, IE"
              className="h-8 text-xs"
              autoComplete="off"
            />
            <p className="text-micro leading-relaxed text-muted-foreground">
              {SPECIAL_AD_CATEGORY_COUNTRY_HELP}
            </p>
            {/* ⚠️★WHAT DID NOT PARSE IS NAMED, not silently dropped.
                Discarding "France" from `GB, France, IE` would record a
                narrower declaration than the merchant wrote and tell them
                nothing. */}
            {blocked === "country_invalid" ? (
              <p className="text-micro leading-relaxed text-destructive">
                {invalidCountries.join(", ")} — country codes are two
                letters, like GB or IE.
              </p>
            ) : null}
            {/* ── ★THE EU PROHIBITION, BEFORE THE TICK ─────────────────
                Meta has not allowed political ads in the EU since
                2025-10-06. A surface that collected this declaration
                without saying so would collect consent for something we
                already know cannot run. */}
            {euVerdict.banned.length > 0 ? (
              <p className="text-micro leading-relaxed text-warning-on-tint">
                {/* ⚠️★THE FALLBACK WAS A SECOND STATEMENT OF THE DATE
                    (review round 3). *"October 2025"* sat beside a served
                    `since`, so the sentence read one way or the other
                    depending on the envelope — the exact defect the api
                    half removed from the notice wording, reproduced in the
                    client that reads it.

                    ⏸AND THE DATE STAYS ISO rather than being formatted.
                    `toLocaleDateString` would render differently per
                    viewer, and this repo has been red on en-US CI for
                    exactly that. The clause is simply dropped when the api
                    serves no date: the ban is the fact, the date is
                    detail. */}
                Meta doesn&apos;t allow political ads in the EU
                {euSince ? ` (since ${euSince})` : ""}, so
                campaigns for {euVerdict.banned.join(", ")} won&apos;t run.
                You can still record the declaration.
              </p>
            ) : null}
            {/* ⚠️★★AND THE ONES WE CANNOT ANSWER FOR, SAID SEPARATELY.
                Meta's phrase is *"the EU and associated territories"* and
                it publishes no list; the EEA reading is ours. Folding
                these into the line above would state our interpretation as
                Meta's — and dropping them would under-warn on countries
                Meta may well refuse. */}
            {euVerdict.uncertain.length > 0 ? (
              <p className="text-micro leading-relaxed text-muted-foreground">
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
              <p className="text-micro leading-relaxed text-muted-foreground">
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
                    disabled={savePending}
                    onCheckedChange={(v) => onToggleCategory(key, v === true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={`sac-${key}`}
                      className="text-micro font-normal leading-relaxed text-muted-foreground"
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
                      <p className="mt-1 text-micro leading-relaxed text-warning-on-tint">
                        {consequence}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-micro leading-relaxed text-muted-foreground">
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
        {state.kind !== "unknown" && blockedMessage ? (
          <p className="text-micro leading-relaxed text-muted-foreground">
            {blockedMessage}
          </p>
        ) : null}
        {state.kind !== "unknown" ? (
          <Button
            type="button"
            size="sm"
            disabled={blocked !== null || savePending}
            onClick={onSubmit}
          >
            {savePending ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : null}
            {/* ⏸A re-confirm is not a first declaration, and said *"Save
                declaration"* (review round 2) — the same word the
                superseded branch already avoids, for the same reason. */}
              {formSubmitLabel(mode)}
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
            disabled={refetching}
            onClick={onRetry}
          >
            {refetching ? (
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
            disabled={savePending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
  );
}
