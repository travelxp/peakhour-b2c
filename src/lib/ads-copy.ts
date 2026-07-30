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

/** LinkedIn's notice, verbatim. Do not edit for tone. */
export const POLITICAL_DECLARATION_NOTICE =
  "I confirm this is not political advertising. None of my ads qualify as " +
  "political advertising under the law of the targeted countries, including " +
  "EU law for ads targeted to the EU. Advertisers must comply with " +
  "LinkedIn's policies and regulatory requirements.";

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

  const d = input.declaration;
  // Only NOT_POLITICAL is a declaration this UI can represent. POLITICAL
  // advertising carries obligations Peakhour doesn't support, so a business
  // that somehow holds one is shown as undeclared here rather than being
  // offered a tick-box that would silently overwrite it.
  if (!d || d.politicalIntent !== "NOT_POLITICAL") return { kind: "undeclared" };

  const declaredByName = input.declaredByName ?? undefined;

  // No current version to compare against means we cannot tell active from
  // stale. Treat as unknown rather than assuming it is still valid — that
  // assumption is the one that overstates coverage.
  if (!input.currentNoticeVersion) return { kind: "unknown" };

  if (d.noticeVersion !== input.currentNoticeVersion) {
    return { kind: "superseded", declaredAt: d.declaredAt, ...(declaredByName ? { declaredByName } : {}) };
  }
  return { kind: "declared", declaredAt: d.declaredAt, ...(declaredByName ? { declaredByName } : {}) };
}

/** "30 Jul 2026" — locale-formatted, never a hardcoded month array. */
export function formatDeclaredAt(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
