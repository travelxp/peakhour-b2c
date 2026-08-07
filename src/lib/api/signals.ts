import { api } from "@/lib/api";

/**
 * Website signals — the tracking tags a business has on its OWN site, and the
 * evidence they fire.
 *
 * `peakhour-mongodb/docs/idea/linkedin-ads-engine-v2.md` §5 item 1. This is the
 * first item in that sequence because two of the three default audience sets
 * depend on it: a retargeting audience IS website visitors.
 *
 * ── ★THE ONE THING THIS CLIENT MUST NOT DO ────────────────────────────────
 *
 * §6 asks how "installed" is VERIFIED rather than asserted. The api answers by
 * keeping THREE LEVELS OF EVIDENCE apart, and every one of them arrives here
 * separately so the UI cannot quietly promote one into another:
 *
 *   declared — somebody chose a rail and a partner id. A saved setting.
 *   served   — a rail we control fetched the snippet. Only `wordpress` can
 *              reach this; on `manual` there is no server of ours in the path,
 *              so `lastServedAt: null` there is a FACT ABOUT THE RAIL and must
 *              never be rendered as a problem.
 *   fired    — a browser loaded the provider's script and called our beacon.
 *              The only level that is evidence.
 *
 * `evidence` and `state` are different questions — "has this ever been
 * proven?" and "is it proven today?" — and a tag that fired last year is
 * `fired` + `not_seen_recently`. Rendering one and dropping the other loses a
 * fact whichever way it goes.
 */

export type SignalProvider = "linkedin_insight";
export type SignalRail = "wordpress" | "manual";

/** The highest level of evidence ever reached. Not a status. */
export type SignalEvidence = "declared" | "served" | "fired";

/**
 * Where a signal stands right now.
 *
 * ★`not_seen_recently` IS NOT "BROKEN", and copy must never say it is. Nobody
 * can distinguish a tag that was removed from a website nobody visited, so the
 * surface shows `lastFiredAt` — a fact — and lets the customer judge. "We
 * cannot tell" is its own answer and must not render as a diagnosis.
 */
export type SignalState = "never_fired" | "firing" | "not_seen_recently";

export interface Signal {
  provider: SignalProvider;
  partnerId: string;
  /** The public key in the snippet. Not a secret — it is in the page source of
   *  every page carrying the tag — and the surface cannot render the snippet
   *  without it. */
  siteKey: string;
  delivery: {
    rail: SignalRail;
    chosenAt: string;
    /** Level 2. `null` on the `manual` rail BY DEFINITION — see the header. */
    lastServedAt: string | null;
  };
  /** Level 3, and `null` means NEVER FIRED — the ordinary first state of a
   *  signal configured a minute ago, and the alarming state of one configured a
   *  month ago. The difference is `delivery.chosenAt`, not a flag. */
  verification: {
    firstFiredAt: string;
    lastFiredAt: string;
    /** `null` when the beacon's origin could not be read. Distinct from
     *  `verification` itself being null. */
    lastFiredHost: string | null;
    /** `firstFiredAt === lastFiredAt` — one observation window has ever
     *  reported. The collection stores no fire count on purpose (a coalesced
     *  beacon counts windows, not visits), so this is the only thing near a
     *  count that exists, and it is a boolean rather than a number for exactly
     *  that reason. ★NOTHING HERE MAY BE RENDERED AS TRAFFIC. */
    seenOnceOnly: boolean;
  } | null;
  evidence: SignalEvidence;
  state: SignalState;
  /** How long `firing` lasts without a new beacon. Read from the api rather
   *  than hardcoded, so the copy cannot drift from the rule. */
  freshWindowDays: number;
}

export interface SignalsResponse {
  signals: Signal[];
  availableProviders: SignalProvider[];
  availableRails: SignalRail[];
}

export interface SnippetResponse {
  provider: SignalProvider;
  siteKey: string;
  rail: SignalRail;
  snippet: string;
  placement: string;
}

export const signalsApi = {
  list: () => api.get<SignalsResponse>("/v1/signals"),

  /** Configure a signal. 409 SIGNAL_EXISTS when one already exists for the
   *  provider — the unique index winning a double-click, which the api turns
   *  into the same answer the sequential path gives. */
  create: (body: { provider: SignalProvider; partnerId: string; rail: SignalRail }) =>
    api.post<Signal>("/v1/signals", body),

  /**
   * ★CHANGING THE PARTNER ID CLEARS THE VERIFICATION, and the UI has to say so
   * BEFORE the click. The beacon is keyed by `siteKey`, not by the partner id,
   * so a published page would keep reporting "firing" for a tag pointing at an
   * account the customer no longer uses. The response comes back
   * `never_fired`, which is the truth and looks like a regression if nobody
   * was warned.
   */
  update: (provider: SignalProvider, patch: { partnerId?: string; rail?: SignalRail }) =>
    api.patch<Signal>(`/v1/signals/${provider}`, patch),

  /** Removes OUR record, not their page: on the `manual` rail the tag keeps
   *  loading and its beacons become no-ops, which is what
   *  `snippetMayRemainOnSite` is for. */
  remove: (provider: SignalProvider) =>
    api.delete<{ deleted: true; provider: SignalProvider; snippetMayRemainOnSite: boolean }>(
      `/v1/signals/${provider}`,
    ),

  snippet: (provider: SignalProvider) =>
    api.get<SnippetResponse>(`/v1/signals/${provider}/snippet`),
};
