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
 * LinkedIn's notice text, KEYED BY THE VERSION IT IS.
 *
 * The text lives here but the version in force is decided by the api
 * (`CURRENT_NOTICE_VERSION`), and nothing used to couple them. That gap was a
 * real hazard, not a tidiness point: bump the version server-side and deploy
 * before the b2c ships the new wording, and the card would tell the user "the
 * notice has been updated, please confirm the current wording" while showing
 * them the OLD text — then stamp the NEW version against it. The record would
 * claim consent to wording the user never saw, which is the one thing this
 * whole feature exists to prevent.
 *
 * Keying the text by version closes it: an unrecognised version means we do
 * not have the text the api is asking about, so `declarationState` returns
 * `unknown` and the card refuses to collect consent rather than collecting the
 * wrong consent. Add the new wording here in the same PR that bumps the api.
 *
 * Verbatim. Not our wording to soften — LinkedIn's Advertising API contract
 * requires an app that creates ads to present this text and pass back what the
 * advertiser confirmed.
 */
export const POLITICAL_DECLARATION_NOTICES: Record<string, string> = {
  "linkedin-ttpa-2025-10":
    "I confirm this is not political advertising. None of my ads qualify as " +
    "political advertising under the law of the targeted countries, including " +
    "EU law for ads targeted to the EU. Advertisers must comply with " +
    "LinkedIn's policies and regulatory requirements.",
  /**
   * ★THE WORDING IS UNCHANGED, AND THE VERSION STILL MOVED. Worth stating,
   * because "the text is identical so why re-prompt" is the reasonable-sounding
   * mistake that would break this.
   *
   * `noticeVersion` identifies **the declaration form**, not this paragraph.
   * The api's form now also asks about Meta's special ad categories
   * (`specialAdCategories`), so a business that consented to
   * `linkedin-ttpa-2025-10` answered strictly fewer questions than this version
   * asks. Re-prompting is correct even though LinkedIn's sentence did not move.
   *
   * ⚠️AND THE TWO PARTS ARE NOT CONCATENATED INTO ONE STRING. This text is
   * LinkedIn's, verbatim, and not ours to extend — see the header. Meta's
   * category question is separate copy (`SPECIAL_AD_CATEGORY_*` below) shown
   * beside it, consented to in the same submission.
   */
  "ads-declaration-2026-09":
    "I confirm this is not political advertising. None of my ads qualify as " +
    "political advertising under the law of the targeted countries, including " +
    "EU law for ads targeted to the EU. Advertisers must comply with " +
    "LinkedIn's policies and regulatory requirements.",
};

/**
 * Meta's special ad categories, as a merchant reads them.
 *
 * ── ★WHY THIS IS OUR WORDING WHERE THE NOTICE ABOVE IS NOT ────────────────
 *
 * LinkedIn's contract requires its notice presented verbatim. Meta's
 * requirement is different in kind: the advertiser must **self-identify** the
 * category, and Meta publishes the category NAMES rather than a sentence we
 * must recite. So these labels are ours to make legible — and they must be,
 * because `FINANCIAL_PRODUCTS_SERVICES` is not a question anybody can answer.
 *
 * ⚠️`ISSUES_ELECTIONS_POLITICS` IS NOT HERE. It is the same fact as the
 * political declaration above, derived server-side from `politicalIntent`.
 * Offering it as a sixth checkbox would let one business answer the same
 * question twice, two different ways, in one form.
 *
 * Keys match the api's `DECLARABLE_SPECIAL_AD_CATEGORIES` exactly; a key that
 * drifts is rejected by the PATCH rather than silently dropped.
 */
export const SPECIAL_AD_CATEGORY_LABELS: Record<string, string> = {
  HOUSING: "Housing — property for sale or rent, mortgages, or housing services",
  EMPLOYMENT: "Employment — job ads, recruitment, or career services",
  CREDIT: "Credit — credit cards, loans, financing, or car leasing",
  FINANCIAL_PRODUCTS_SERVICES:
    "Financial products and services — banking, insurance, investments, or savings",
  ONLINE_GAMBLING_AND_GAMING:
    "Online gambling and gaming — betting, casino, lottery, or real-money games",
};

/** The order they are shown in. A `Record` has no guaranteed order to rely on. */
export const SPECIAL_AD_CATEGORY_ORDER = [
  "HOUSING",
  "EMPLOYMENT",
  "CREDIT",
  "FINANCIAL_PRODUCTS_SERVICES",
  "ONLINE_GAMBLING_AND_GAMING",
] as const;

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
 * ⚠️What declaring a category COSTS, stated before the tick rather than
 * discovered afterwards.
 *
 * Meta removes targeting tools for these campaigns (plan §2.1): no lookalike
 * audiences, no saved audiences, no exclusions, no sub-city geography, and age
 * is forced to 18-65+ across all genders with a minimum 15-mile radius. A
 * merchant who ticks one and then finds their audiences refused deserves to
 * have been told first.
 */
export const SPECIAL_AD_CATEGORY_CONSEQUENCE =
  "Meta limits targeting for these campaigns — no lookalike audiences, saved " +
  "audiences or exclusions, no targeting below city level, and ages are set to " +
  "18-65+ for everyone. We'll tell you when a suggested audience can't be used.";

/**
 * The most recent wording we hold, for surfaces that must show SOMETHING.
 *
 * Only the Boost dialog uses this, and only for its per-campaign answer —
 * which is passed straight to LinkedIn and never recorded against a version,
 * so a deploy-skew mismatch has no lasting effect. Anything that STAMPS a
 * version must use `noticeTextFor` and refuse when it returns undefined.
 */
export const LATEST_POLITICAL_DECLARATION_NOTICE =
  POLITICAL_DECLARATION_NOTICES["linkedin-ttpa-2025-10"];

/** The notice for a version, or undefined when we don't hold that wording. */
export function noticeTextFor(version?: string | null): string | undefined {
  return version ? POLITICAL_DECLARATION_NOTICES[version] : undefined;
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
export function declarationState(input: {
  declaration?: AdvertisingDeclaration | null;
  currentNoticeVersion?: string | null;
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
  if (!input.currentNoticeVersion) return { kind: "unknown", reason: "read_failed" };
  // A version we don't hold text for is a DEPLOY problem, not a network one.
  if (!noticeTextFor(input.currentNoticeVersion)) {
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
  if (!d || d.politicalIntent !== "NOT_POLITICAL") return { kind: "undeclared" };

  if (superseded) {
    return {
      kind: "superseded",
      declaredAt: d.declaredAt,
      ...(declaredByName ? { declaredByName } : {}),
    };
  }
  return { kind: "declared", declaredAt: d.declaredAt, ...(declaredByName ? { declaredByName } : {}) };
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
