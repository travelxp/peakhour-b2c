import { api } from "@/lib/api";

/**
 * /v1/peaks — the price of an act, before the merchant asks for it.
 *
 * ── ★★WHAT THIS CLOSES (§7.0.1 requirement 4) ─────────────────────────────
 *
 * *"The price is shown before the merchant asks for the task."* Of the four
 * transparency requirements it is the one §7.9 calls **the largest**, and it
 * was **NOT BUILT** on this side: `grep -rn "peaks/quote" src` returned
 * nothing, so every metered button on this client was pressed blind.
 *
 * §7.9 named the two things standing in the way, and neither was the endpoint:
 *
 *   1. *"The UI does not know which useCase a button triggers"* — the useCase
 *      is chosen deep inside an API handler. Fixed api-side by the action
 *      REGISTRY, which both sides now read; this client names an action key,
 *      not a useCase.
 *   2. *"A quoted price must be honoured"* — once a merchant is shown
 *      "40 Peaks" they must pay 40 even if ops edits the rate card between the
 *      quote and the act. That is what the TOKEN is: a signed receipt of the
 *      number they were shown.
 *
 * ── ⚠️★THE TOKEN IS THE RECORD OF *WHICH PRICE* WAS SHOWN ────────────────
 *
 * Not that a price was shown — WHICH one. It is the same shape as
 * `advertisingDeclaration.noticeVersion`, and for the same reason that field
 * exists: a boolean "they saw a price" cannot survive the rate card changing
 * underneath it, and a client that sent one would be asserting consent to a
 * number nobody can reconstruct. The api mints the token from the total it just
 * computed, so the figure on screen and the figure billed come from one
 * expression.
 *
 * ── ★TWO CALLS, DELIBERATELY ──────────────────────────────────────────────
 *
 * `GET /peaks/actions` prices a MENU and signs nothing. `GET /peaks/quote`
 * prices ONE act and signs it. The api's own note gives the reason, and it is
 * about the merchant rather than about cost: *"a TTL should start when the
 * merchant is about to act, not when a list was rendered"* — a token minted
 * with a list is already minutes old by the time they choose, and can lapse
 * while they read the confirmation it exists to make binding.
 */

/** One useCase inside a quote's total. */
export interface PeaksQuoteLine {
  useCase: string;
  label: string;
  peaks: number;
  free: boolean;
}

/** What an act costs, as the api computed it. */
export interface PeaksQuote {
  /** The registry key asked about, echoed back. */
  action: string;
  useCase: string;
  /** The merchant-facing name, from the rate-card row — never ours. */
  label: string;
  description: string | null;
  /**
   * The TOTAL across every useCase one press bills, not the price of one of
   * them.
   *
   * ⚠️★**0 WHEN `free`, AND A CLIENT MUST NOT RENDER THAT ZERO.** The api's
   * own field comment says so, and `RateCardUseCase.free` carried the identical
   * instruction before this — which **no caller branched on, because the field
   * was never added to any client type**, and five surfaces then rendered a
   * free act five different wrong ways (§7.0.1's correction box). It is on this
   * type from the first line for that reason.
   */
  peaks: number;
  /**
   * What the total is made of, one row per useCase.
   *
   * ★SHOWN, NOT INFERRED. A merchant asked to accept 40 Peaks for "an audience
   * proposal" can see that it is two acts at 20; a bare total invites the
   * support question this feature exists to prevent.
   */
  breakdown: PeaksQuoteLine[];
  /** ★RENDER "Free", NEVER "0 Peaks", and branch on THIS rather than on
   *  `peaks === 0`. See `peaksPrice` / `quoteCostSentence`. */
  free: boolean;
  source: "code" | "template";
}

/** A quote plus the signed receipt that makes it binding. */
export interface BindingPeaksQuote extends PeaksQuote {
  /**
   * The opaque receipt for THIS price. Handed back on the act as the
   * `x-peaks-quote` header; the api honours the number inside it.
   *
   * ⚠️Opaque on purpose — a client that parsed it would be deriving a price
   * from a signature, which is the second source of truth the token exists to
   * remove.
   */
  token: string;
  /** Epoch milliseconds. After this the api refuses the token and the act is
   *  charged at the live rate card — so a surface holding one must re-quote
   *  rather than send a lapsed receipt. */
  expiresAt: number;
}

/** The whole priced menu. `unpriced` is an operator problem, not a client one
 *  — an empty array is the healthy state. */
export interface PeaksActionMenu {
  actions: PeaksQuote[];
  unpriced: string[];
}

export const peaksApi = {
  /**
   * Every registered action, priced, in one read.
   *
   * For a surface rendering several metered buttons: ONE call, not one per
   * button. Nothing here is signed — see the header.
   */
  actions: () => api.get<PeaksActionMenu>("/v1/peaks/actions"),

  /**
   * The price of one act, signed.
   *
   * ⚠️★THE TWO FAILURES ARE DIFFERENT AND A CALLER MUST NOT COLLAPSE THEM.
   * `UNKNOWN_ACTION` (404) is OUR mistake — a typo or a stale key in this
   * client — and the fix is a deploy. `ACTION_NOT_PRICED` (502) is an OPERATOR
   * problem: the registry names a price nobody has seeded or somebody has
   * deactivated, and the merchant is right to be asking. Showing "something
   * went wrong" for both is how a seeding gap gets debugged as a client bug.
   */
  quote: (action: string) =>
    api.get<BindingPeaksQuote>(`/v1/peaks/quote?action=${encodeURIComponent(action)}`),
};

/**
 * The action keys this client quotes.
 *
 * ★NAMED HERE RATHER THAN INLINE AT THE BUTTON, because the api's registry
 * says renaming one is a breaking change for exactly this reason: a key typed
 * at a call site is a string nothing checks until a merchant presses the
 * button and gets a 404 where a price should be.
 *
 * ⏸ONE ENTRY TODAY, and that is the api's shape rather than a sketch:
 * `POST /v1/audiences/plan` is the only act wrapped in `quotedAction` so far.
 * A second entry is a second wrapped route, not a second button.
 */
export const PEAKS_ACTIONS = {
  proposeAudiences: "growth.propose_audiences",
} as const;

export type PeaksActionKey = (typeof PEAKS_ACTIONS)[keyof typeof PEAKS_ACTIONS];
