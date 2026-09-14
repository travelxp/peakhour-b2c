/**
 * Shared advertising-declaration copy and state logic.
 *
 * WHY THIS FILE EXISTS: the political-advertising notice is not our wording
 * to soften or paraphrase. LinkedIn's Advertising API contract requires an
 * app that creates ads to present this text and pass back what the
 * advertiser confirmed (`politicalIntent`), and it became a REQUIRED campaign
 * field with the EU's TTPA regulation. Two surfaces now show it — the Boost
 * dialog and the Ads-hub declaration card — and a second hand-edited copy is
 * how they drift apart, leaving one surface collecting consent to text the
 * other never showed.
 *
 * `declarationState` lives here too, because deciding "declared" vs "needs
 * re-confirming" is the part that is easy to get wrong in a way that MATTERS:
 * the api's `resolvePoliticalIntent` ignores a declaration whose
 * noticeVersion has been superseded, so a UI that showed a stale one as
 * active would claim protection the engine is not giving. It is pure so it
 * can be tested without rendering.
 */

/**
 * ⚠️★★THE NOTICE TEXT USED TO LIVE HERE, KEYED BY VERSION. IT DOES NOT NOW.
 *
 * The old comment argued the coupling was a feature: *"an unrecognised
 * version means we do not have the text the api is asking about, so
 * `declarationState` returns `unknown` and the card refuses to collect
 * consent rather than collecting the wrong consent. Add the new wording here
 * in the same PR that bumps the api."*
 *
 * The refusal was right. The premise was not. "Add it in the same PR" is not
 * something two repos can do — they deploy separately, and whichever order
 * they land in there is a window where declaring is impossible: api first and
 * the card has no wording to show; client first and it sends a shape the api
 * rejects. The file's own note called it "a DEPLOY problem, not a network
 * one", which is exactly right and was treated as unavoidable.
 *
 * It was avoidable. It was two copies of one string. **The api now serves
 * `currentNoticeText` beside `currentNoticeVersion`**, so a client cannot be
 * out of step with a string it is handed, and a bump needs no client deploy.
 * The refusal survives — `declarationState` still returns `unknown` when no
 * text arrives — it just cannot be triggered by an ordinary release any more.
 *
 * ★Same fix as mig 326 moving `USE_CASE_LABELS` onto the rows, and for the
 * same reason: one side owns it, the other reads it.
 */
/**
 * The FRAMING of Meta's category question — ours, and deliberately still here.
 *
 * ★THE PER-CATEGORY LABELS ARE SERVED (`specialAdCategoryOptions`) because a
 * local map goes stale the moment the api adds a category. These two are a
 * different thing: they are not a list that can drift out of step, they are
 * how this surface phrases a question, and there is nothing on the api side
 * for them to disagree with.
 */
export const SPECIAL_AD_CATEGORY_QUESTION =
  "Do any of your ads fall into one of these categories?";

/**
 * ★WHY TICKING NOTHING IS AN ANSWER, SAID TO THE USER.
 *
 * Meta has no "not answered" value for `special_ad_categories` — it takes a
 * category or an empty list. So submitting with none ticked is a positive
 * statement that none apply, and the form has to say so rather than letting it
 * read as a question the user skipped.
 */
export const SPECIAL_AD_CATEGORY_NONE_NOTE =
  "Leave them all unticked if none apply — that is an answer, and we record it as one.";

/**
 * The country half of the declaration, asked only of a POLITICAL advertiser.
 *
 * ── ★WHY ONLY THEM ───────────────────────────────────────────────────────
 *
 * Meta requires `special_ad_category_country` whenever any category is set,
 * and documents a tax-country fallback for HOUSING, EMPLOYMENT and
 * FINANCIAL_PRODUCTS_SERVICES. `ISSUES_ELECTIONS_POLITICS` has **no**
 * default, so it is the one answer that cannot be left out — and it is the
 * one this form has never been able to collect at all.
 *
 * ⏸Asking every declarant would also create a problem the api cannot express:
 * there is no way to CLEAR a stored country list (omitting it hits the
 * erase guard), so a field offered to everyone would be a field nobody could
 * empty. Asking only where it is mandatory keeps the only route out — an
 * explicit withdrawal, which unsets the whole record — sufficient.
 */
export const SPECIAL_AD_CATEGORY_COUNTRY_QUESTION = "Which countries are these ads for?";

export const SPECIAL_AD_CATEGORY_COUNTRY_HELP =
  "Two-letter country codes, separated by commas — GB, IE, US. This is the " +
  "list Meta is told the declaration covers.";

/**
 * The EU prohibition, exactly as the api serves it.
 *
 * ⚠️★NOT DERIVED HERE, AND THE THREE-WAY SPLIT IS WHY. Meta says *"the EU and
 * associated territories"* and publishes no list; the api holds the EU 27 as a
 * fact of EU law and the EEA three as a READING, and a country in neither is
 * **not cleared** — Meta's phrase has a residue nobody has enumerated. A local
 * copy of those lists would state our interpretation as fact in one more
 * place, which is P-09's lesson, and the split is the part that would be
 * flattened first.
 */
export interface EuPoliticalAdsBan {
  bannedCountries?: string[];
  uncertainCountries?: string[];
  since?: string;
}

export const POLITICAL_DECLARATION_POLICY_URL =
  "https://www.linkedin.com/legal/ads-policy";

/**
 * What an undeclared business is actually risking. Stated once, because the
 * consequence is the reason the card exists: a human boosting from the UI
 * answers per campaign, but a campaign created from WhatsApp or by the
 * optimizer has no dialog to tick and falls back to NOT_DECLARED.
 */
export const POLITICAL_DECLARATION_CONSEQUENCE =
  "Campaigns created automatically — from WhatsApp, or by the optimizer — " +
  "can't declare on your behalf, so LinkedIn may hold them from EU audiences " +
  "until you do.";

/** What withdrawing costs, shown in the confirm rather than after the fact. */
export const POLITICAL_DECLARATION_WITHDRAW_WARNING =
  "Future automatic campaigns will fall back to no declaration, and LinkedIn " +
  "may hold them from EU audiences. Campaigns already running are unaffected.";

export interface AdvertisingDeclaration {
  politicalIntent: "POLITICAL" | "NOT_POLITICAL" | "NOT_DECLARED";
  declaredAt: string;
  declaredByUserId: string;
  noticeVersion: string;
  /**
   * Meta's special ad categories, as the merchant answered them.
   *
   * ⚠️★ABSENT IS NOT `[]`, AND THE DIFFERENCE IS THE FIELD'S WHOLE POINT.
   * `[]` is *"I was asked and none of these apply"* — a statement only the
   * advertiser can make. Absent means this record PREDATES the question, and
   * the api reports that as undeclared rather than as an empty list. Meta
   * offers no way to express the difference, so it has to be expressed here.
   *
   * ★It is what SEEDS the boxes on a re-confirm. Rendering them unticked for
   * a merchant who had declared HOUSING and CREDIT, then submitting, sends an
   * explicit `[]` the api cannot refuse — an erasure two clicks deep.
   */
  specialAdCategories?: string[];
  /**
   * The countries the declaration covers — Meta's
   * `special_ad_category_country` (M-17).
   *
   * ⚠️★ABSENT AND `[]` ARE **NOT** TWO ANSWERS HERE, WHICH INVERTS THE FIELD
   * ONE LINE UP. There is no advertising in no countries: an empty list is
   * not a statement a merchant can make, it is a list that cannot be sent,
   * and the database refuses it (`minItems: 1`). A reader carrying the
   * sibling's rule across one line gets this backwards.
   */
  specialAdCategoryCountries?: string[];
}

export type DeclarationState =
  /** Nobody has declared. The default for every business. */
  | { kind: "undeclared" }
  /**
   * A POLITICAL declaration is on record. READ-ONLY apart from withdrawal:
   * political advertising carries obligations Peakhour does not support, so
   * this surface must neither claim it is handled nor offer a checkbox that
   * would overwrite a legal statement in one click.
   *
   * `superseded` matters even here. The api ignores ANY declaration whose
   * wording has changed — intent included — so a POLITICAL record under stale
   * wording means autonomous creates are sending NOT_DECLARED right now. The
   * card must say that rather than implying the record is in force.
   */
  | {
      kind: "political";
      declaredAt: string;
      declaredByName?: string;
      superseded: boolean;
    }
  /** Declared under the wording currently in force. */
  | { kind: "declared"; declaredAt: string; declaredByName?: string }
  /**
   * Declared, but against wording that has since changed. Rendered as
   * needs-re-confirming, NOT as active — the api already treats it as
   * NOT_DECLARED, and showing it as active would overstate our coverage.
   */
  | { kind: "superseded"; declaredAt: string; declaredByName?: string }
  /**
   * We cannot state the declaration, for one of two DIFFERENT reasons that
   * need different copy and different remedies:
   *
   *   read_failed        — the settings request failed. Retrying may help.
   *   unsupported_notice — the read SUCCEEDED, but the api is on a notice
   *                        version whose wording this app doesn't hold. There
   *                        is nothing to retry: it needs a deploy. And it is
   *                        not benign — every stored declaration is superseded
   *                        under that version, so autonomous creates are
   *                        falling back to NOT_DECLARED.
   *
   * Distinct from `undeclared` either way: a false "not declared" only
   * over-warns, a false "declared" is a claim we cannot support.
   */
  | { kind: "unknown"; reason: "read_failed" | "unsupported_notice" };

/**
 * Resolve which of the four states to render.
 *
 * `currentNoticeVersion` comes from the api response, never a local
 * constant — a hardcoded copy here would drift from
 * `CURRENT_NOTICE_VERSION` in the api and silently mis-state every
 * business's status in one direction or the other.
 */
/**
 * The two wordings the api serves, one per answer.
 */
export interface NoticeText {
  notPolitical?: string | null;
  political?: string | null;
}

/**
 * The wording a surface is about to STAMP, chosen by the answer it collects.
 *
 * ⚠️★A ONE-LINE PROPERTY ACCESS IN JSX IS NOT TESTABLE HERE. This repo has no
 * component-test stack at all — no testing-library, no jsdom, not one
 * `.test.tsx` — so `{noticeText.political}` beside a checkbox that records
 * NOT_POLITICAL would render a sentence the merchant is not agreeing to, and
 * nothing in the suite could tell. Mutating exactly that survived every test
 * on this branch.
 *
 * ⚠️★AND IT IS NOT CALLED `noticeTextFor`, which is a RETIRED name this file
 * has a test forbidding. That one was a local version→text MAP — a second copy
 * of a string the api owns, and keeping the two in step across two deploys is
 * what made an ordinary notice bump an outage. This holds no copy of anything:
 * it picks between two strings the api just served. Same neighbourhood,
 * opposite defect, so it does not get to borrow the banned name.
 *
 * ★So the choice is a function, in the file the tests already cover. Getting
 * it wrong is now a unit-test failure rather than a screenshot nobody takes.
 */
/**
 * Which categories the form should show as ticked, and submit.
 *
 * ⚠️★★THIS IS THE ERASURE FIX, AND IT IS HERE BECAUSE IT HAD TO BE TESTABLE.
 *
 * The form renders for a SUPERSEDED declaration too — re-confirm wording that
 * changed — and the boxes started empty because nothing seeded them. A
 * merchant who had declared HOUSING and CREDIT saw them unticked, and
 * submitting the re-confirm sent an explicit `[]`.
 *
 * ★The api CANNOT refuse that. Its erasure guard fires on an OMITTED field,
 * and `[]` is a real answer a real form can legitimately produce — *"I was
 * asked and none of these apply"*. Two clicks turned a housing advertiser
 * into one who had declared that none of these apply, with a 200 and no
 * signal anywhere.
 *
 * `touched` is `null` until the merchant changes something, which is NOT the
 * same as `[]`: one means they have not answered, the other that they have
 * answered *none*.
 */
export function selectedCategories(
  touched: string[] | null,
  stored: string[] | undefined,
): string[] {
  return touched ?? stored ?? [];
}
/**
 * Turn what a merchant typed into country codes, and say what did not parse.
 *
 * ★IT RETURNS BOTH HALVES rather than dropping the bad ones. Silently
 * discarding *"France"* from `GB, France, IE` would record a narrower
 * declaration than the merchant wrote and tell them nothing — on a field
 * whose whole purpose is to say which jurisdictions they are advertising in.
 *
 * ★UPPERCASED AND DE-DUPLICATED, because the api's uniqueness check runs on
 * the NORMALISED values: `gb, GB` is one country typed twice, and sending it
 * would be a 400 that reads as a validation bug rather than a typo.
 */
export function parseCountryCodes(input: string): { codes: string[]; invalid: string[] } {
  const codes: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.split(/[,\s]+/)) {
    const token = raw.trim();
    if (!token) continue;
    if (!/^[A-Za-z]{2}$/.test(token)) {
      invalid.push(token);
      continue;
    }
    const code = token.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return { codes, invalid };
}

/**
 * Which of the countries a merchant is about to declare are refused, and
 * which we cannot tell them about.
 *
 * ⚠️★THIS IS THE LIVE PREVIEW, NOT THE AUTHORITATIVE ANSWER. The api serves
 * `politicalAdsRefused` for the declaration already ON RECORD; this one runs
 * while the merchant is still typing, where a round trip per keystroke is not
 * a design. Both read the SAME served lists, so they cannot disagree about
 * which countries are in which bucket.
 *
 * ★A COUNTRY IN NEITHER BUCKET IS NOT CLEARED, and there is no third array
 * saying it is. The caller has to render that as *"we have no reason to think
 * so"* rather than as an all-clear — Meta's phrase has a residue nobody has
 * enumerated.
 *
 * ⏸Returns empty buckets when the api served no lists, which reads as *"we
 * cannot tell you"* rather than as *"nothing is banned"* — and the caller
 * renders the difference.
 */
export function euPoliticalAdsVerdict(
  codes: readonly string[],
  ban: EuPoliticalAdsBan | null | undefined,
): { banned: string[]; uncertain: string[]; known: boolean } {
  const bannedList = ban?.bannedCountries ?? [];
  const uncertainList = ban?.uncertainCountries ?? [];
  // ⚠️★DERIVED FROM **EITHER** LIST (review round 1). It read
  // `bannedList.length > 0`, so an envelope carrying the EEA list and no EU
  // one rendered the uncertain warning AND *"we can't check these right
  // now"* — at the same time, about the same country. A flag that says we
  // know nothing, beside a sentence proving we know something.
  const known = bannedList.length > 0 || uncertainList.length > 0;
  const banned: string[] = [];
  const uncertain: string[] = [];
  for (const code of codes) {
    if (bannedList.includes(code)) banned.push(code);
    else if (uncertainList.includes(code)) uncertain.push(code);
  }
  return { banned, uncertain, known };
}

/**
 * Which countries the form should show, and submit.
 *
 * ★THE SIBLING OF `selectedCategories`, AND IT INHERITS THE ERASURE FIX: the
 * form renders for a SUPERSEDED declaration too, and boxes that start empty
 * send an answer the merchant did not give. `null` means *"not touched"*,
 * which is not the same as an empty list.
 *
 * ⚠️AND THE EMPTY CASE MEANS SOMETHING DIFFERENT HERE. For categories, `[]` is
 * *"asked, none apply"* and IS submitted. An empty country list cannot be
 * submitted at all — the api's `.min(1)` refuses it — so the caller must treat
 * empty as *"not answered yet"* and block the save. `declarationBlockedBecause`
 * is where that lives.
 */
export function selectedCountries(
  touched: string[] | null,
  stored: string[] | undefined,
): string[] {
  return touched ?? stored ?? [];
}

/**
 * Why the Save button cannot be pressed yet, or `null` when it can.
 *
 * ★A REASON RATHER THAN A BOOLEAN, because the card has to SAY which thing is
 * missing. A disabled button with no explanation is the shape this file
 * already refuses for `unsupported_notice`: a dead end the user cannot act on.
 *
 * ⚠️★AND IT IS HERE RATHER THAN IN JSX BECAUSE THIS REPO CANNOT TEST JSX. No
 * testing-library, no jsdom, not one `.test.tsx` — the same reason
 * `stampableNoticeText` exists. A `disabled={...}` expression assembled inline
 * would let a POLITICAL declaration be submitted with no country, which the
 * api refuses with a 400 the merchant cannot act on, and nothing in the suite
 * could tell.
 */
export type DeclarationBlocker =
  /** No answer chosen yet. */
  | "no_answer"
  /** The notice for the chosen answer was not served — we cannot ask. */
  | "no_notice_text"
  /** Chosen, but the notice has not been confirmed. */
  | "not_confirmed"
  /** POLITICAL with no country. Meta gives that category no default, so the
   *  declaration could never produce a campaign and the api refuses it. */
  | "country_missing"
  /** Something in the country box is not a two-letter code. */
  | "country_invalid";

/**
 * What a merchant actually confirmed, rather than THAT they confirmed.
 *
 * ── ⚠️★★★A BOOLEAN `ticked` CANNOT SURVIVE A BACKGROUND REFETCH ──────────
 *
 * Round 2 cleared the tick at every entry point to the form and on every
 * answer change, which closed the routes a MERCHANT can take. Review round 3
 * found the two the DATA takes, and this card re-renders on every refetch:
 *
 *   1. `reconfirmingPolitical` turns true when a refetch reveals the notice
 *      was superseded — mid-session, with `reopen` already set — so a tick
 *      given for the NOT_POLITICAL wording is still set when the form
 *      switches to the POLITICAL one. Save is live, and stamps consent to a
 *      sentence the merchant never saw. ⏸Reachable: the win dialog calls
 *      `invalidateQueries(["growth-settings"])`.
 *   2. A refetch that brings NEW wording swaps the checkbox label underneath
 *      a tick that was given for the old one, and Save stamps the new
 *      `noticeVersion` as confirmed.
 *
 * ★Both are the same defect: **a tick is consent to a specific sentence, and
 * a boolean does not record which sentence.** So the card stores what the
 * confirmation was FOR, and this decides whether it still holds. Nothing has
 * to remember to clear it, which is what made the boolean fail twice.
 *
 * ⏸`noticeVersion` rather than the text itself: the version IS the identity of
 * the wording — that is the whole reason the field exists and the reason a
 * bump re-prompts. Comparing the strings would re-prompt on a whitespace edit
 * the api never versioned.
 */
export interface DeclarationConfirmation {
  answer: "NOT_POLITICAL" | "POLITICAL";
  noticeVersion: string;
}

export function confirmationHolds(
  confirmed: DeclarationConfirmation | null,
  answer: "NOT_POLITICAL" | "POLITICAL" | null,
  noticeVersion: string | null | undefined,
): boolean {
  // ⏸ONLY THE NULL-SAFETY CHECK. A first cut also tested `!answer` and
  // `!noticeVersion`, and the mutation suite proved both redundant by refusing
  // to die when they were removed: the equality comparisons below already
  // return false for a null answer or an absent version. Defensive code that
  // nothing can reach is the shape this programme keeps deleting, so it is
  // deleted rather than explained — the cases it was written for are still
  // pinned, through the comparison that actually decides them.
  if (!confirmed) return false;
  return confirmed.answer === answer && confirmed.noticeVersion === noticeVersion;
}

export function declarationBlockedBecause(input: {
  answer: "NOT_POLITICAL" | "POLITICAL" | null;
  confirmed: boolean;
  countries: readonly string[];
  invalidCountries: readonly string[];
  noticeText?: NoticeText | null;
}): DeclarationBlocker | null {
  if (!input.answer) return "no_answer";
  if (!stampableNoticeText(input.answer, input.noticeText)) return "no_notice_text";
  // ⚠️★THE COUNTRY CHECKS COME BEFORE THE CONFIRMATION TICK, and the order is
  // deliberate: a merchant who ticks the notice and then finds the button
  // still dead has been told nothing. Naming the missing field while they are
  // still filling the form is the point of returning a reason at all.
  if (input.answer === "POLITICAL") {
    if (input.invalidCountries.length > 0) return "country_invalid";
    if (input.countries.length === 0) return "country_missing";
  }
  if (!input.confirmed) return "not_confirmed";
  return null;
}

/**
 * Whether the Meta half of a standing declaration is still unanswered.
 *
 * ⚠️★NOT GATED ON THE SERVED OPTION LIST, and it was. The card's amber
 * *"Meta campaigns also need the special-ad-category answer"* banner rendered
 * only when `specialAdCategoryOptions` arrived — so on any response that did
 * not carry them, the warning vanished while the reassuring line above it
 * (*"automatic campaigns carry this declaration"*) stayed. The merchant was
 * told they were covered, in the one state where they are not.
 *
 * ★The WARNING is about the record; the *Answer it* BUTTON is about the form.
 * Only the button needs the options, because only the button leads somewhere
 * that requires them.
 */
/**
 * What to tell a merchant about a Save button that will not move, or `null`
 * when the form itself already says it.
 *
 * ⚠️★ONLY ONE REASON HAD COPY (review round 1), and the one that was missing
 * is the only one the merchant cannot fix: `no_notice_text` leaves the
 * confirm checkbox unrendered — because there is no wording to confirm — and
 * the Save button dead, with **nothing on screen explaining either**. It is
 * reachable on a real response: `declarationState` gates on the NEGATIVE
 * wording alone, so an envelope serving `notPolitical` and not `political`
 * renders the whole form and then silently refuses the political answer.
 *
 * ⏸`no_answer` and `not_confirmed` return `null` DELIBERATELY. The radio with
 * nothing selected and the unticked box are the message; a line of text
 * saying *"choose an answer"* under an unanswered question is noise, and this
 * card already refuses a *"reload the page"* remedy for the same reason —
 * a message that tells the reader what they can already see is not help.
 */
export function declarationBlockedMessage(
  blocked: DeclarationBlocker | null,
): string | null {
  switch (blocked) {
    case "country_missing":
      return (
        "Add at least one country. Meta gives political ads no default, so a declaration " +
        "without one can't create a campaign."
      );
    case "no_notice_text":
      // ★NO REMEDY OFFERED, because there is none the merchant can take —
      // the same honesty the `unsupported_notice` state already shows, where
      // a retry button would re-fetch the same envelope.
      return (
        "We can't show the wording for that answer right now, so we can't ask you to confirm " +
        "it. Nothing has been changed. Contact support if this persists."
      );
    case "country_invalid":
      // ⏸The card names the offending tokens beside the input, which is more
      // use than a generic line here would be.
      return null;
    default:
      return null;
  }
}

export function metaCategoryAnswerMissing(
  declaration: AdvertisingDeclaration | null | undefined,
): boolean {
  if (!declaration) return false;
  if (declaration.politicalIntent === "NOT_DECLARED") return false;
  return declaration.specialAdCategories === undefined;
}

/**
 * What to say after a declaration saves.
 *
 * ⚠️★★THE OLD MESSAGE WAS FALSE FOR META, AND SAID SO IN THE ONE PLACE A
 * MERCHANT READS AFTER ACTING. It was *"Declaration recorded — automatic
 * campaigns can now declare on your behalf"*, unconditionally. For a record
 * with no special-ad-category answer that is true of LinkedIn and false of
 * Meta: `resolveSpecialAdCategories` reports `never_declared` and every Meta
 * create refuses. The boost dialog writes exactly that record, so the toast
 * has been wrong on that path since M-03.
 *
 * ★And a POLITICAL declaration gets its own, because *"can now declare on your
 * behalf"* reads as an all-clear on the one answer that carries restrictions.
 */
export function declarationSavedMessage(
  intent: "NOT_POLITICAL" | "POLITICAL",
  hasCategoryAnswer: boolean,
): string {
  // ⚠️★★THE CATEGORY HALF IS CHECKED FOR **BOTH** ANSWERS (review round 2).
  // The political branch returned before consulting `hasCategoryAnswer`, so a
  // POLITICAL declaration saved without one was told *"we'll tell you where
  // they can't run"* — a sentence about which campaigns work — while
  // `resolveSpecialAdCategories` reported `never_declared` and NONE of them
  // could be created. The card's own warning contradicted it one render later.
  //
  // ★The political answer does not exempt a business from the other five
  // categories, and the message has no business implying it does.
  if (!hasCategoryAnswer) {
    return (
      "Declaration recorded for LinkedIn. Meta campaigns still need the special-ad-category " +
      "answer before they can be created."
    );
  }
  if (intent === "POLITICAL") {
    return (
      "Recorded. Your campaigns will carry the political category, and we'll tell you " +
      "where they can't run."
    );
  }
  // ⏸NO TERNARY HERE ANY MORE. Hoisting the missing-category case above the
  // political one left `hasCategoryAnswer ? … : …` with an UNREACHABLE false
  // branch — the early return has already taken it. The mutation suite is what
  // said so: replacing the condition with `true` stopped killing anything,
  // which is the signature of a branch nothing can reach.
  return "Declaration recorded — automatic campaigns can now declare on your behalf.";
}

export function stampableNoticeText(
  answer: "NOT_POLITICAL" | "POLITICAL",
  served: NoticeText | null | undefined,
): string | undefined {
  const text = answer === "POLITICAL" ? served?.political : served?.notPolitical;
  // ★`""` IS NOT A WORDING. It is falsy and would render as a blank consent
  // box with a Save button beside it — worse than showing nothing, because it
  // looks like a form that is simply short.
  return text ? text : undefined;
}
export function declarationState(input: {
  declaration?: AdvertisingDeclaration | null;
  currentNoticeVersion?: string | null;
  /**
   * ★THE WORDING, AS THE API SERVED IT. Was resolved here from a local
   * version->text map; that map was a second copy of a string the api owns,
   * and keeping the two in step across two deploys is what made an ordinary
   * notice bump an outage. The guard below is unchanged — only its cause is.
   *
   * ⚠️★AND IT IS TWO STRINGS, BECAUSE THERE ARE TWO ANSWERS. A single text
   * was right while the only thing a merchant could say was *no*. M-03 made
   * the affirmative declarable, and the one served text read *"I confirm this
   * is not political advertising"* — so a POLITICAL record was stamped with a
   * `noticeVersion` whose wording asserts the opposite of what it records.
   * A consent record that names text contradicting its own answer is worse
   * than none: it is evidence FOR the wrong thing.
   */
  currentNoticeText?: NoticeText | null;
  declaredByName?: string | null;
  failed?: boolean;
}): DeclarationState {
  if (input.failed) return { kind: "unknown", reason: "read_failed" };

  // No current version to compare against means we cannot tell active from
  // stale, and no notice text for it means we cannot honestly ASK. Both are
  // "we don't know" rather than "not declared" — checked before the
  // declaration itself so an undeclared business can't be shown a Save button
  // that would record consent to wording we don't hold.
  // No version at all is indistinguishable from a failed read — we have no
  // response to reason about.
  if (!input.currentNoticeVersion)
    return { kind: "unknown", reason: "read_failed" };
  // ★A version that arrives WITHOUT its wording. This used to mean "the api
  // bumped and this client has not deployed" — an ordinary, expected state
  // that took the feature down every time. Now the text travels with the
  // version, so reaching here means a genuinely broken or ancient response,
  // and refusing is right for the original reason: we cannot honestly ask
  // someone to confirm wording we cannot show them.
  // ⏸THE NEGATIVE IS THE ONE THIS CARD NEEDS. It is the wording behind the
  // only answer this surface collects; the affirmative is served for the
  // surface that asks for it, and its absence must not take this one down.
  if (!stampableNoticeText("NOT_POLITICAL", input.currentNoticeText)) {
    return { kind: "unknown", reason: "unsupported_notice" };
  }

  const d = input.declaration;
  const declaredByName = input.declaredByName ?? undefined;
  // Computed BEFORE the intent branches: the api ignores a superseded
  // declaration whatever its intent, so every branch below needs this.
  const superseded = !!d && d.noticeVersion !== input.currentNoticeVersion;

  // A POLITICAL record gets its own read-only state. Rendering it as
  // undeclared would both misreport it (the api sends POLITICAL through) and
  // put a one-click overwrite of a legal statement on screen.
  if (d?.politicalIntent === "POLITICAL") {
    return {
      kind: "political",
      declaredAt: d.declaredAt,
      superseded,
      ...(declaredByName ? { declaredByName } : {}),
    };
  }
  if (!d || d.politicalIntent !== "NOT_POLITICAL")
    return { kind: "undeclared" };

  if (superseded) {
    return {
      kind: "superseded",
      declaredAt: d.declaredAt,
      ...(declaredByName ? { declaredByName } : {}),
    };
  }
  return {
    kind: "declared",
    declaredAt: d.declaredAt,
    ...(declaredByName ? { declaredByName } : {}),
  };
}

/**
 * "30 Jul 2026" — locale-formatted, never a hardcoded month array.
 *
 * Pinned to UTC, matching the convention the optimizer board already sets. The
 * stamp is a UTC instant, so rendering it in the viewer's zone would show the
 * previous day for anyone west of UTC — and "declared on the 29th" against a
 * record that says the 30th is the kind of discrepancy that matters on a
 * compliance record.
 */
export function formatDeclaredAt(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
