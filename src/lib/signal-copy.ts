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

/** " from www.example.com", or nothing when the beacon's origin was unreadable
 *  — a real state (the api UNSETS the host rather than leaving a stale one), and
 *  one that must never leave a dangling preposition behind. */
function hostClause(signal: Signal): string {
  const host = signal.verification?.lastFiredHost;
  return host ? ` from ${host}` : "";
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
export function evidenceChain(signal: Signal, railOffered = true): EvidenceStep[] {
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
            : // ★NO PROMISE IN THIS STEP — the step states a FACT, and the promise
              // lives in `stateCopy`, where it can be made conditional. A first
              // cut ended this line "Nothing to do — it will", which contradicted
              // step 3 on a signal that has already fired (delivery unobserved,
              // fire observed) and, worse, never expired: the api WITHDRAWS this
              // rail once the site stops checking in, and the card went on
              // promising a delivery the api had formally given up on, with the
              // paste escape hatch removed.
              railOffered
              ? "Your WordPress plugin hasn't picked this up yet — it checks in hourly."
              : "We haven't heard from your WordPress plugin recently.",
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
export function stateCopy(
  signal: Signal,
  railOffered = true,
): { title: string; body: string; tone: "ok" | "waiting" | "attention" } {
  const provider = providerLabel(signal.provider);
  // ★"NOTHING TO DO — IT WILL" IS ONLY SAYABLE WHILE THE API STILL OFFERS THIS
  // RAIL, and that is what makes it a sourced claim rather than a hope. The api
  // withdraws `wordpress` from `availableRails` once the site stops checking in,
  // so `railOffered` IS the evidence that the plugin is alive and will fetch.
  // Without it the promise never expired: a site whose plugin was deactivated
  // got "nothing to do" forever, with the paste escape hatch removed, while the
  // api had already concluded the delivery would never happen.
  const wpDelivering = signal.delivery.rail === "wordpress" && railOffered;
  const wpAbandoned = signal.delivery.rail === "wordpress" && !railOffered;
  // The one remedy that is always available and never double-installs: switch
  // the rail. Never "paste it as well" — that is the double-install this whole
  // change exists to prevent.
  const SWITCH_HINT =
    "Reactivate or update the plugin, or switch this signal to pasting the snippet in yourself.";
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
        // ★NO "THE ADDRESS ABOVE". An earlier draft said so, and there is no
        // address above: the host appears in this same sentence when we have
        // one, in the evidence step BELOW when we do, and NOWHERE when the
        // beacon's origin was unreadable — which is a real state the api
        // deliberately produces by unsetting the host. A sentence that points
        // at something that is not on the screen is worse than a vaguer one.
        body: signal.verification?.seenOnceOnly
          ? hostClause(signal)
            ? `We've seen your ${provider} load once, from ${signal.verification.lastFiredHost}. That's one browser in one session — check that address is the site you meant.`
            : `We've seen your ${provider} load once, though we couldn't tell which site from. That's one browser in one session.`
          : `We've seen your ${provider} load on a real visit${hostClause(signal)} within the last ${signal.freshWindowDays} days.`,
        tone: "ok",
      };
    case "never_fired":
      // ★NO PASTE INSTRUCTION ON THIS RAIL, IN ANY BRANCH. The plugin is putting
      // the tag on the page; telling the customer to add it by hand as well
      // installs it twice — two Insight Tags, two beacons. The api refuses to
      // serve a `manual` row over this rail for the same reason.
      if (wpAbandoned) {
        return {
          title: "Not seen yet",
          body: `Set up, but we haven't heard from your WordPress plugin recently, so nothing is putting the tag on your site. ${SWITCH_HINT}`,
          tone: "attention",
        };
      }
      return {
        title: "Not seen yet",
        body: wpDelivering
          ? // Which of the two waits they are in — the plugin fetching, or a
            // visitor arriving — is what the evidence chain distinguishes, and
            // the check hint belongs only in the second: before the plugin has
            // it, opening a private window cannot change anything.
            signal.delivery.lastServedAt
            ? `Your plugin has it, but no browser has loaded it yet. To check now, ${CONFIRM_HINT}`
            : "Set up. Your WordPress plugin checks in hourly and will put it on your site — nothing to do."
          : `Set up, but no browser has loaded it yet. Add the snippet to your site if you haven't — then ${CONFIRM_HINT}`,
        tone: "waiting",
      };
    case "not_seen_recently": {
      const since = `We last saw your ${provider} load ${formatWhen(signal.verification?.lastFiredAt)}, and nothing since. `;
      if (wpAbandoned) {
        return {
          title: "Quiet",
          body: `${since}We haven't heard from your WordPress plugin recently either, so it may have stopped putting the tag on your site. ${SWITCH_HINT}`,
          tone: "attention",
        };
      }
      // ★THE SAME RULE AS `never_fired`, WHICH A FIRST CUT APPLIED TO ONE STATE
      // AND NOT THE OTHER. On this rail we are not reduced to "we can't tell":
      // when the plugin has fetched, we KNOW the tag is being delivered, so the
      // unknown is narrower and the sentence should say the narrower thing. And
      // when it has not fetched, the check hint is busywork that cannot change
      // the state — exactly what the other branch was fixed for.
      if (wpDelivering) {
        return {
          title: "Quiet",
          body: signal.delivery.lastServedAt
            ? `${since}Your plugin is still putting it on your site, so it is being delivered — we just haven't seen a browser load it. That can mean nobody has visited, or something on the page is blocking it. To check: ${CONFIRM_HINT}`
            : `${since}Your plugin hasn't picked up the current snippet yet either — it checks in hourly.`,
          tone: "attention",
        };
      }
      return {
        title: "Quiet",
        body:
          `${since}That can mean the tag was removed, or simply that nobody has visited — we can't tell which from here. ` +
          `To check: ${CONFIRM_HINT}`,
        tone: "attention",
      };
    }
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
