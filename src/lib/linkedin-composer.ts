/**
 * Pure rules behind the LinkedIn post composer (post-composer.tsx).
 *
 * Split out so the decisions a merchant's post depends on (who it posts as,
 * what the publish body carries, which buttons are live) are testable without
 * rendering the composer.
 */

import type {
  LinkedInAuthor,
  LinkedInIdentity,
  LinkedInPollInput,
  LinkedInVisibility,
  PublishLinkedInPostInput,
} from "@/lib/api/linkedin-content";

export const MAX_LEN = 3000;

/** A carousel splits the text into slides, so it needs a few sentences of
 *  substance — mirrors the server's `newsletterText` min of 50 chars. */
export const CAROUSEL_MIN_CHARS = 50;

export const HAS_ORG_SCOPE = "w_organization_social";

export interface AuthorOption {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * Author picker options — "org:<id>" is a company page, "person" is the
 * user's personal feed. Pages come FIRST and are the default: the business
 * publishes as its Company Page. The personal feed is only offered when the
 * server says it's allowed (pageless fallback — /me's personalPostingAllowed;
 * the publish routes enforce the same policy server-side) or when no page
 * option could be built at all (missing org scope → the reconnect hint guides
 * the user).
 */
export function buildAuthorOptions(
  identity: Pick<LinkedInIdentity, "scopes" | "pages" | "personalPostingAllowed" | "person">,
): AuthorOption[] {
  const opts: AuthorOption[] = [];
  const canPostAsOrg = identity.scopes.includes(HAS_ORG_SCOPE);
  if (canPostAsOrg) {
    for (const page of identity.pages) {
      opts.push({
        value: `org:${page.id}`,
        label: page.name || `Page ${page.id}`,
        sublabel: "Company page",
      });
    }
  }
  if ((identity.personalPostingAllowed ?? true) || opts.length === 0) {
    opts.push({
      value: "person",
      label: identity.person.name ?? "My personal feed",
      sublabel: "Personal feed",
    });
  }
  return opts;
}

export function isOrgAuthorKey(authorKey: string): boolean {
  return authorKey.startsWith("org:");
}

export function authorFromKey(authorKey: string): LinkedInAuthor {
  return isOrgAuthorKey(authorKey)
    ? { type: "org", pageId: authorKey.slice("org:".length) }
    : { type: "person" };
}

/** LinkedIn rejects non-PUBLIC visibility on org posts, so a page forces
 *  PUBLIC and the submit never surfaces the raw API error. */
export function effectiveVisibilityFor(
  authorKey: string,
  visibility: LinkedInVisibility,
): LinkedInVisibility {
  return isOrgAuthorKey(authorKey) ? "PUBLIC" : visibility;
}

/**
 * Replace the hook with the picked variant, preserving any body below the
 * first blank-line boundary.
 */
export function applyHookVariant(text: string, hook: string): string {
  const [, ...rest] = text.split(/\n\s*\n/);
  return rest.length > 0 ? `${hook}\n\n${rest.join("\n\n")}` : hook;
}

/** The first non-blank line, capped at 120 chars — the scheduler's title. */
export function scheduleTitleFor(text: string): string | undefined {
  const firstLine = text.trim().split(/\r?\n/).find((l) => l.trim().length > 0);
  return firstLine ? firstLine.slice(0, 120).trim() : undefined;
}

export interface ComposerGateInput {
  text: string;
  showLink: boolean;
  linkUrl: string;
  /** Whether a poll is on the composer. */
  pollActive: boolean;
  /** Whether the poll (if any) is complete; ignored when there is none. */
  pollValid: boolean;
  anyPending: boolean;
  /** Result of the url check on `linkUrl`. */
  linkLooksLikeUrl: boolean;
}

export interface ComposerGates {
  empty: boolean;
  tooLong: boolean;
  linkInvalid: boolean;
  publishDisabled: boolean;
  scheduleDisabled: boolean;
  carouselTooShort: boolean;
  carouselDisabled: boolean;
}

/** Which of the composer's buttons are live for the current draft. */
export function composerGates(i: ComposerGateInput): ComposerGates {
  const remaining = MAX_LEN - i.text.length;
  const tooLong = remaining < 0;
  const empty = i.text.trim().length === 0;
  const linkInvalid = i.showLink && i.linkUrl.trim().length > 0 && !i.linkLooksLikeUrl;
  // A poll, when active, must be complete before publish. The commentary
  // (text) is still required — it shows above the poll.
  const pollOk = !i.pollActive || i.pollValid;
  const publishDisabled = empty || tooLong || i.anyPending || linkInvalid || !pollOk;
  // Scheduling + carousel don't carry a poll, so they're unavailable while a
  // poll is active.
  const scheduleDisabled = empty || tooLong || linkInvalid || i.pollActive;
  // Carousel needs enough text to split into slides; a link card doesn't
  // apply to a carousel (it's a document post), so a pending/invalid link
  // doesn't block it — but the min-length + pending guards do.
  const carouselTooShort = i.text.trim().length < CAROUSEL_MIN_CHARS;
  const carouselDisabled = empty || tooLong || carouselTooShort || i.anyPending || i.pollActive;
  return {
    empty,
    tooLong,
    linkInvalid,
    publishDisabled,
    scheduleDisabled,
    carouselTooShort,
    carouselDisabled,
  };
}

export interface PollInputDraft {
  question: string;
  options: Array<{ text: string }>;
  duration: LinkedInPollInput["duration"];
}

export interface PublishBodyInput {
  authorKey: string;
  visibility: LinkedInVisibility;
  text: string;
  /** Commentary segments already built from the text + mentions, or null to
   *  send the raw string. Ignored for poll posts. */
  segments: PublishLinkedInPostInput["commentarySegments"] | null;
  poll: PollInputDraft | null;
  showLink: boolean;
  linkUrl: string;
  linkTitle: string;
}

/** The body the publish route receives. */
export function buildPublishBody(i: PublishBodyInput): PublishLinkedInPostInput {
  const body: PublishLinkedInPostInput = {
    author: authorFromKey(i.authorKey),
    visibility: effectiveVisibilityFor(i.authorKey, i.visibility),
  };

  // Structured commentary (CMA D4): when the user inserted org @mentions that
  // still appear in the text, send segments so the URNs link. Otherwise send
  // the raw string (which also lets LinkedIn auto-link plain #hashtags).
  // A poll's intro text is never segmented, whatever the caller built.
  const segments = i.poll ? null : i.segments;
  if (segments) {
    body.commentarySegments = segments;
  } else {
    body.commentary = i.text.trim();
  }

  if (i.poll) {
    // A poll is exclusive — never combine it with a link. Trim the question
    // and drop blank options (the server validates 2–4 / lengths too).
    body.poll = {
      question: i.poll.question.trim(),
      options: i.poll.options.map((o) => o.text.trim()).filter((o) => o.length > 0),
      duration: i.poll.duration,
    };
  } else if (i.showLink && i.linkUrl.trim()) {
    body.link = {
      url: i.linkUrl.trim(),
      title: i.linkTitle.trim() || undefined,
    };
  }
  return body;
}

export interface ScheduleChannelInput {
  authorKey: string;
  personUrn: string;
  /** The picker's value; a page forces PUBLIC, as it does for publish. */
  visibility: LinkedInVisibility;
  showLink: boolean;
  linkUrl: string;
  linkTitle: string;
  text: string;
}

/**
 * The scheduler payload. `channelOptions` carries the LinkedIn-specific
 * publish settings the scheduler's linkedin publisher adapter reads
 * (authorUrn / visibility / link) so a scheduled post fires with the SAME
 * author + visibility + link the user picked in the composer.
 *
 * NOTE: the scheduler adapter publishes the raw text only — it does not carry
 * commentary SEGMENTS, so org @mentions in a SCHEDULED post post as plain
 * `@Name` text (not linked). Immediate publish links them.
 */
export function buildScheduleChannels(i: ScheduleChannelInput) {
  const channelOptions: Record<string, unknown> = {
    authorUrn: isOrgAuthorKey(i.authorKey)
      ? `urn:li:organization:${i.authorKey.slice("org:".length)}`
      : i.personUrn,
    visibility: effectiveVisibilityFor(i.authorKey, i.visibility),
  };
  if (i.showLink && i.linkUrl.trim()) {
    channelOptions.link = {
      url: i.linkUrl.trim(),
      ...(i.linkTitle.trim() ? { title: i.linkTitle.trim() } : {}),
    };
  }
  return [
    {
      channel: "linkedin",
      payload: { text: i.text.trim(), channelOptions },
    },
  ];
}
