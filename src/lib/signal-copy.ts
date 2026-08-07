import type { Signal, SignalProvider, SignalRail } from "@/lib/api/signals";

/**
 * The words this surface is allowed to use about a signal.
 *
 * ★COPY IS THE PRODUCT HERE, AND MOST OF THE WAYS TO GET IT WRONG PRODUCE THE
 * SAME SYMPTOM: a confident sentence about the customer's website that we have
 * no evidence for. The rules, from
 * `peakhour-mongodb/docs/idea/linkedin-ads-engine-v2.md` §4.3:
 *
 *   - **The three absences stay distinct.** "Nobody set this up", "set up and
 *     never seen", and "seen before, not lately" are three different situations
 *     with three different next actions, and must never share a sentence.
 *   - **"We cannot tell" is its own answer**, and must never render as "we
 *     chose this". We cannot distinguish a tag that was REMOVED from a website
 *     nobody VISITED, so `not_seen_recently` never says "broken".
 *   - **Never a confident number we did not source.** There are no numbers on
 *     this surface at all: the collection stores no fire count on purpose,
 *     because a coalesced beacon counts observation windows rather than visits.
 *   - **★Copy written for one channel is not copy for another.** The `manual`
 *     rail has no plugin to blame and no serve to observe; the `wordpress` rail
 *     does. A single sentence covering both is wrong for one of them, which is
 *     why every function here takes the rail.
 */

/**
 * ★HOW TO CONFIRM IT, SAID ACCURATELY — because the obvious instruction does
 * not work.
 *
 * The snippet marks `sessionStorage` and beacons ONCE PER BROWSER SESSION, and
 * the server then coalesces to one write per signal per 15 minutes. So a
 * customer who already has the site open in that tab, or who re-checks within
 * the window, produces no new beacon and no change on this screen — after being
 * told that visiting the site is "the quickest way to find out". Two true
 * sentences that combine into a false one.
 */
const CONFIRM_HINT =
  "open your site in a NEW private window (the snippet only reports once per browser session) " +
  "and press Check again a minute later.";

/** " on www.example.com", or nothing when the beacon's origin was unreadable —
 *  which is a real state and must not become an empty pair of quotes. */
function hostClause(signal: Signal): string {
  const host = signal.verification?.lastFiredHost;
  return host ? ` on ${host}` : "";
}

export function providerLabel(provider: SignalProvider): string {
  switch (provider) {
    case "linkedin_insight":
      return "LinkedIn Insight Tag";
    default:
      return provider;
  }
}

export function railLabel(rail: SignalRail): string {
  return rail === "wordpress" ? "Through the WordPress plugin" : "Pasted into your site";
}

export type EvidenceStep = {
  label: string;
  /** `true` reached, `false` not reached, `null` NOT APPLICABLE on this rail —
   *  which is a third state on purpose. Rendering "not applicable" as "not
   *  reached" would show every `manual` signal permanently missing a step it
   *  can never have. */
  reached: boolean | null;
  detail: string;
};

/**
 * The three levels of evidence, as a chain the customer can read.
 *
 * ★THE MIDDLE ONE IS `null` ON THE `manual` RAIL. There is no server of ours in
 * that path, so nothing could ever observe a serve — its absence is a fact
 * about the rail, not a failure, and a tick-list that showed it unchecked would
 * be telling every copy-paste customer that something is wrong.
 */
export function evidenceChain(signal: Signal): EvidenceStep[] {
  const served = signal.delivery.lastServedAt;
  return [
    {
      label: "Set up",
      reached: true,
      detail: `${railLabel(signal.delivery.rail)}, ${formatWhen(signal.delivery.chosenAt)}.`,
    },
    {
      label: "Sent to your site",
      reached: signal.delivery.rail === "wordpress" ? !!served : null,
      detail:
        signal.delivery.rail !== "wordpress"
          ? "Not something we can see when you paste the snippet yourself — there's no step of ours in between."
          : served
            ? `Your WordPress plugin last picked it up ${formatWhen(served)}.`
            : // ★NO PROMISE OF A SYNC, BECAUSE THERE ISN'T ONE. An earlier draft
              // said "it asks for this when it next syncs" — telling the customer
              // to wait for something that does not exist. Nothing writes
              // `lastServedAt` today: there is no plugin-facing snippet endpoint
              // and the plugin has no signals code, which is why `wordpress` is
              // not offered as a choice. A stored row can still carry it (an
              // older row, or a later api enabling the rail), so this branch
              // stays — saying what is true.
              "The plugin can't deliver this yet. Add the snippet to your site by hand for now.",
    },
    {
      label: "Seen working",
      reached: !!signal.verification,
      detail: signal.verification
        ? `A browser loaded LinkedIn's tag ${formatWhen(signal.verification.lastFiredAt)}${
            signal.verification.lastFiredHost ? ` on ${signal.verification.lastFiredHost}` : ""
          }.`
        : "No browser has loaded LinkedIn's tag yet.",
    },
  ];
}

/**
 * The headline for a signal's current state, and the next thing to do about it.
 *
 * ★NOTHING HERE SAYS "BROKEN", AND `not_seen_recently` IS WHY. A quiet tag and
 * a removed tag look identical from where we stand, so the copy states the fact
 * (when we last saw it) and offers the check, rather than a diagnosis we cannot
 * support.
 */
export function stateCopy(signal: Signal): { title: string; body: string; tone: "ok" | "waiting" | "attention" } {
  const provider = providerLabel(signal.provider);
  switch (signal.state) {
    case "firing":
      return {
        title: "Working",
        // ★"WE'VE SEEN IT LOAD ON <HOST>", NOT "IT'S INSTALLED". A beacon proves
        // a browser SOMEWHERE ran the snippet — the site key is in the page
        // source of every page carrying it — and the single-fire case is most
        // often the customer testing on staging or localhost, which is exactly
        // where "that's enough to know it's installed" would be wrong. The host
        // we heard from is named, so the customer can judge it, and is the
        // reason the api stores it at all.
        body: signal.verification?.seenOnceOnly
          ? `We've seen your ${provider} load once${hostClause(signal)}. That's one browser, in one session — worth checking the address above is the site you meant.`
          : `We've seen your ${provider} load on a real visit${hostClause(signal)} in the last ${signal.freshWindowDays} days.`,
        tone: "ok",
      };
    case "never_fired":
      return {
        title: "Not seen yet",
        body:
          signal.delivery.rail === "wordpress"
            ? // No promise of a sync — see `evidenceChain`. Nothing delivers this
              // rail yet, so "wait" would be advice that can never come good.
              `Set up, but nothing has put it on your site yet. Add the snippet by hand for now, then ${CONFIRM_HINT}`
            : `Set up, but no browser has loaded it yet. Add the snippet to your site if you haven't — then ${CONFIRM_HINT}`,
        tone: "waiting",
      };
    case "not_seen_recently":
      return {
        title: "Quiet",
        body:
          `We last saw your ${provider} load ${formatWhen(signal.verification?.lastFiredAt)}, and nothing since. ` +
          `That can mean the tag was removed, or simply that nobody has visited — we can't tell which from here. ` +
          `To check: ${CONFIRM_HINT}`,
        tone: "attention",
      };
    default:
      return { title: "Unknown", body: "", tone: "waiting" };
  }
}

/**
 * ★WHAT CHANGING THE PARTNER ID COSTS, SAID BEFORE THE CLICK.
 *
 * The api clears `verification` when the partner id changes, because the beacon
 * is keyed by the site key rather than by the partner id — so a page still
 * carrying the old snippet would go on reporting "working" for a tag pointing
 * at an account the customer no longer uses. The result is a signal that reads
 * "Not seen yet" immediately afterwards, which looks like a regression to
 * anybody who was not told.
 */
export const PARTNER_ID_CHANGE_WARNING =
  "Changing the Partner ID means the snippet on your site is out of date, so we stop counting it as verified until we see the new one load. You'll need to republish the snippet.";

export function formatWhen(iso: string | undefined): string {
  if (!iso) return "at an unknown time";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "at an unknown time";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString();
}
