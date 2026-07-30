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
};

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
   * A POLITICAL declaration is on record. READ-ONLY here: political
   * advertising carries obligations Peakhour does not support, so this surface
   * must neither claim it is handled nor offer a checkbox that would overwrite
   * a legal statement in one click. Points the user at Campaign Manager.
   */
  | { kind: "political"; declaredAt: string; declaredByName?: string }
  /** Declared under the wording currently in force. */
  | { kind: "declared"; declaredAt: string; declaredByName?: string }
  /**
   * Declared, but against wording that has since changed. Rendered as
   * needs-re-confirming, NOT as active — the api already treats it as
   * NOT_DECLARED, and showing it as active would overstate our coverage.
   */
  | { kind: "superseded"; declaredAt: string; declaredByName?: string }
  /**
   * The settings read failed, so we don't know. Deliberately distinct from
   * `undeclared`: a false "not declared" is safe (it only over-warns), a
   * false "declared" is not. Never collapse this into either.
   */
  | { kind: "unknown" };

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
  if (input.failed) return { kind: "unknown" };

  // No current version to compare against means we cannot tell active from
  // stale, and no notice text for it means we cannot honestly ASK. Both are
  // "we don't know" rather than "not declared" — checked before the
  // declaration itself so an undeclared business can't be shown a Save button
  // that would record consent to wording we don't hold.
  if (!input.currentNoticeVersion) return { kind: "unknown" };
  if (!noticeTextFor(input.currentNoticeVersion)) return { kind: "unknown" };

  const d = input.declaration;
  const declaredByName = input.declaredByName ?? undefined;

  // A POLITICAL record gets its own read-only state. Rendering it as
  // undeclared would both misreport it (the api sends POLITICAL through) and
  // put a one-click overwrite of a legal statement on screen.
  if (d?.politicalIntent === "POLITICAL") {
    return {
      kind: "political",
      declaredAt: d.declaredAt,
      ...(declaredByName ? { declaredByName } : {}),
    };
  }
  if (!d || d.politicalIntent !== "NOT_POLITICAL") return { kind: "undeclared" };

  if (d.noticeVersion !== input.currentNoticeVersion) {
    return { kind: "superseded", declaredAt: d.declaredAt, ...(declaredByName ? { declaredByName } : {}) };
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
