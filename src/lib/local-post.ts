/**
 * Composing a Google Business Profile Local Post — what the merchant may send,
 * checked while they can still fix it.
 *
 * ★★WHY THIS EXISTS AT ALL, GIVEN THE API ALREADY REFUSES. A refusal on the
 * publish path is TERMINAL: `PublishError{kind:"validation"}` maps to
 * `permanent_error` and the scheduled item ends at `failed`. So a merchant who
 * schedules an offer with the end date before the start date finds out tomorrow,
 * on a row that will never publish, with no way to correct it in place. Every
 * rule here exists to move that moment forward to the compose screen.
 *
 * ⚠️AND THIS IS A SECOND COPY OF RULES THAT LIVE IN peakhour-api. The authority
 * is `src/v1/helpers/gbp-local-post.ts`; this file mirrors it, and the two must
 * move together. That is a real cost and it is recorded rather than hidden —
 * the same duplication the measurement-health repair table carries between this
 * repo and peakhour-shopify. ⏸The proper fix is the same in both cases: have
 * the api serve the constraint set rather than each surface restating it.
 * ★What makes the duplication survivable meanwhile is the direction of failure:
 * this file can only be STRICTER or LOOSER than the api, and looser is caught
 * by the api at dispatch. A rule missing here costs a scheduled item; a rule
 * missing THERE costs a post on a public storefront.
 *
 * ★NOTHING HAS EVER BEEN PUBLISHED THROUGH THIS CHANNEL. `prs_listings` holds
 * zero rows in every environment, so the first merchant to use this screen is
 * also the first to exercise the whole path.
 */

/** Google's cap on the post body. Mirrors `GBP_SUMMARY_MAX_LENGTH` in the api. */
export const LISTING_SUMMARY_MAX = 1500;

/** How many images one Local Post carries. Mirrors `GBP_MAX_MEDIA`. */
export const LISTING_MAX_MEDIA = 1;

/** What a Local Post can be. ALERT is absent for the same reason as in the api:
 *  the only alert type Google ever defined (COVID_19) is retired. */
export const LISTING_TOPIC_TYPES = [
  { value: "STANDARD", label: "Update", blurb: "News, an announcement, a change of hours" },
  { value: "EVENT", label: "Event", blurb: "Something happening on a date" },
  { value: "OFFER", label: "Offer", blurb: "A discount or promotion, with a window" },
] as const;

export type ListingTopicType = (typeof LISTING_TOPIC_TYPES)[number]["value"];

/** The call-to-action buttons Google renders. `CALL` uses the listing's own
 *  phone number and takes no URL — the one that behaves differently. */
export const LISTING_ACTION_TYPES = [
  { value: "LEARN_MORE", label: "Learn more" },
  { value: "BOOK", label: "Book" },
  { value: "ORDER", label: "Order online" },
  { value: "SHOP", label: "Shop" },
  { value: "SIGN_UP", label: "Sign up" },
  { value: "CALL", label: "Call" },
] as const;

export type ListingActionType = (typeof LISTING_ACTION_TYPES)[number]["value"];

/** The action type that carries no URL. */
export const LISTING_ACTION_WITHOUT_URL: ListingActionType = "CALL";

/** What the panel holds. Every field is a string because every field is an
 *  input; emptiness means "not filled in", never "invalid". */
export interface ListingDraft {
  summary: string;
  topicType: ListingTopicType;
  actionType: ListingActionType | "";
  actionUrl: string;
  eventTitle: string;
  eventStartDate: string;
  eventEndDate: string;
  couponCode: string;
  redeemOnlineUrl: string;
  termsConditions: string;
  mediaUrls: string[];
}

export function emptyListingDraft(summary = ""): ListingDraft {
  return {
    summary,
    topicType: "STANDARD",
    actionType: "",
    actionUrl: "",
    eventTitle: "",
    eventStartDate: "",
    eventEndDate: "",
    couponCode: "",
    redeemOnlineUrl: "",
    termsConditions: "",
    mediaUrls: [],
  };
}

/** Which field an error belongs to, so the panel can put it under the input. */
export type ListingField =
  | "summary"
  | "actionType"
  | "actionUrl"
  | "eventTitle"
  | "eventStartDate"
  | "eventEndDate"
  | "redeemOnlineUrl"
  | "media";

export interface ListingProblem {
  field: ListingField;
  message: string;
}

/** `YYYY-MM-DD` → a comparable key, or undefined when it is not a real date. */
function dateKey(value: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // ★THE REGEX ALONE ACCEPTS 2026-02-30. A date input cannot produce one, but
  // this function is also the thing that would catch a pasted or restored
  // value, and Google answers a 400 that names no field.
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  if (
    asUtc.getUTCFullYear() !== year ||
    asUtc.getUTCMonth() !== month - 1 ||
    asUtc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return year * 10000 + month * 100 + day;
}

/** True only for a parseable absolute `https:` URL — Google fetches media and
 *  follows buttons from its own network, so `http:` and `blob:` are no use. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Everything wrong with this draft, in the order the fields appear.
 *
 * ★EVERY PROBLEM AT ONCE, NOT THE FIRST ONE. The api returns a single refusal
 * because it only ever has to explain why it stopped; a form that surfaces one
 * error at a time makes the merchant submit four times to find four mistakes.
 */
export function listingProblems(draft: ListingDraft): ListingProblem[] {
  const out: ListingProblem[] = [];

  const summary = draft.summary.trim();
  if (!summary) {
    out.push({ field: "summary", message: "Write the post before scheduling it." });
  } else if (summary.length > LISTING_SUMMARY_MAX) {
    // ★THE COUNT, NOT JUST THE CAP. "Too long" without a number is a puzzle.
    out.push({
      field: "summary",
      message: `${summary.length} characters — Google's limit is ${LISTING_SUMMARY_MAX}. Shorten it by ${
        summary.length - LISTING_SUMMARY_MAX
      }.`,
    });
  }

  // ── The window EVENT and OFFER share ──────────────────────────────────────
  // ★AN OFFER CARRIES ITS DATES IN THE EVENT FIELDS TOO. Google gave offers no
  // schedule of their own, so this is one rule covering both rather than two
  // that happen to look alike.
  const needsWindow = draft.topicType === "EVENT" || draft.topicType === "OFFER";
  if (needsWindow) {
    const noun = draft.topicType === "OFFER" ? "offer" : "event";
    if (!draft.eventTitle.trim()) {
      out.push({ field: "eventTitle", message: `Give the ${noun} a title.` });
    }
    const start = draft.eventStartDate.trim();
    if (!start) {
      out.push({ field: "eventStartDate", message: `Say when the ${noun} starts.` });
    } else if (dateKey(start) === undefined) {
      out.push({ field: "eventStartDate", message: "That is not a real date." });
    }
    const end = draft.eventEndDate.trim();
    if (end) {
      const endKey = dateKey(end);
      const startKey = dateKey(start);
      if (endKey === undefined) {
        out.push({ field: "eventEndDate", message: "That is not a real date." });
      } else if (startKey !== undefined && endKey < startKey) {
        // ★A BACKWARDS WINDOW IS AN OFFER NOBODY CAN REDEEM. Google accepts the
        // pair without complaint and the post simply never shows.
        out.push({
          field: "eventEndDate",
          message: "The end is before the start, so the post would never appear.",
        });
      }
    }
  }

  if (draft.topicType === "OFFER") {
    const redeem = draft.redeemOnlineUrl.trim();
    if (redeem && !isHttpsUrl(redeem)) {
      out.push({
        field: "redeemOnlineUrl",
        message: "Needs to be a full https:// link Google can reach.",
      });
    }
  }

  // ── The button ────────────────────────────────────────────────────────────
  const actionUrl = draft.actionUrl.trim();
  if (draft.actionType === LISTING_ACTION_WITHOUT_URL) {
    // ★CALL TAKES NO URL. The panel hides the field, so a value here means the
    // merchant typed one and then switched — surfacing it beats dropping it.
    if (actionUrl) {
      out.push({
        field: "actionUrl",
        message: "A Call button uses your listing's phone number — remove the link.",
      });
    }
  } else if (draft.actionType) {
    if (!actionUrl) {
      out.push({ field: "actionUrl", message: "A button needs somewhere to go." });
    } else if (!isHttpsUrl(actionUrl)) {
      out.push({ field: "actionUrl", message: "Needs to be a full https:// link." });
    }
  } else if (actionUrl) {
    // ★NOT INFERRED. Guessing "Learn more" would publish a button the merchant
    // never chose, and hide the fact that they picked no button at all.
    out.push({ field: "actionType", message: "Pick a button, or clear the link." });
  }

  // ── Media ─────────────────────────────────────────────────────────────────
  const media = draft.mediaUrls.map((u) => u.trim()).filter(Boolean);
  if (media.length > LISTING_MAX_MEDIA) {
    out.push({
      field: "media",
      message: `A listing post carries ${LISTING_MAX_MEDIA} image. Remove ${
        media.length - LISTING_MAX_MEDIA
      }.`,
    });
  } else if (media.some((u) => !isHttpsUrl(u))) {
    // ★REFUSE, RATHER THAN PUBLISH WITHOUT IT. Dropping the unreachable image
    // puts a post on a public listing missing the picture the merchant chose,
    // with nothing saying so.
    out.push({ field: "media", message: "That image needs a public https:// address." });
  }

  return out;
}

/** Convenience for the submit button. */
export const listingDraftReady = (draft: ListingDraft): boolean =>
  listingProblems(draft).length === 0;

/**
 * The `channelOptions` the api's publisher adapter reads, built from a draft
 * that has already passed `listingProblems`.
 *
 * ★ONLY WHAT WAS FILLED IN. Every field here is optional on the api side and an
 * empty string is not the same as an absent one — sending `actionType: ""`
 * fails a post over a button nobody asked for.
 */
export function buildListingChannelOptions(draft: ListingDraft): Record<string, unknown> {
  const opts: Record<string, unknown> = { topicType: draft.topicType };

  if (draft.actionType) {
    opts.actionType = draft.actionType;
    // CALL carries no URL, and sending one is a refusal.
    if (draft.actionType !== LISTING_ACTION_WITHOUT_URL && draft.actionUrl.trim()) {
      opts.actionUrl = draft.actionUrl.trim();
    }
  }

  if (draft.topicType === "EVENT" || draft.topicType === "OFFER") {
    const event: Record<string, string> = {
      title: draft.eventTitle.trim(),
      startDate: draft.eventStartDate.trim(),
    };
    if (draft.eventEndDate.trim()) event.endDate = draft.eventEndDate.trim();
    opts.event = event;
  }

  if (draft.topicType === "OFFER") {
    const offer: Record<string, string> = {};
    if (draft.couponCode.trim()) offer.couponCode = draft.couponCode.trim();
    if (draft.redeemOnlineUrl.trim()) offer.redeemOnlineUrl = draft.redeemOnlineUrl.trim();
    if (draft.termsConditions.trim()) offer.termsConditions = draft.termsConditions.trim();
    if (Object.keys(offer).length > 0) opts.offer = offer;
  }

  return opts;
}
