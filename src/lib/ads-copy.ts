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
