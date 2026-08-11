/**
 * Centralised, non-technical metadata for the cron handlers triggerable
 * via /v1/dev/cron/:name. Two consumers read this:
 *
 *   1. <CronToolbar/> — the always-visible cron row on pages whose data
 *      depends on a cron. Renders the friendly label as the button
 *      text and the description + frequency as the hover tooltip.
 *   2. /cms/crons — the central hub. Uses the same metadata so labels
 *      stay consistent across surfaces.
 *
 * The keys (cron names) MUST match peakhour-api's DEV_TRIGGERABLE_CRONS
 * whitelist (src/v1/routes/dev/index.ts) and the routes registered in
 * vercel.json. When a new cron ships in the api, add it here so the UI
 * can surface a friendly button for it.
 *
 * Each entry:
 *   - label       — non-technical action verb the user sees on the button
 *   - frequency   — human-readable schedule (NOT a cron expression)
 *   - description — one-sentence plain-English explanation of what fires
 *                   when the cron runs. Avoids implementation jargon.
 *   - summarize   — OPTIONAL. Turns the cron's response payload (the
 *                   `data` object the handler returns) into a clean,
 *                   user-facing success sentence — e.g. "12 posts synced
 *                   successfully." Without it, <CronToolbar/> falls back
 *                   to a generic "<label> complete" message. NEVER let a
 *                   summarizer throw on an unexpected shape; return null
 *                   to defer to the generic fallback instead. The toolbar
 *                   already wraps the call in a try/catch, but defensive
 *                   reads keep the intent obvious.
 */

/** A summarizer may return a bare string (shown as a success toast) or an
 *  object that also carries a severity — use `level: "warning"` when the run
 *  technically succeeded (HTTP 2xx) but did nothing useful, e.g. a sync that
 *  skipped every connection because none is finished being set up. Without
 *  this a no-op reads as a green success, which is what made "sync ran, toast
 *  green, still no data" so confusing. */
export type CronSummary = string | { message: string; level?: "success" | "warning" };

export interface CronMetadata {
  label: string;
  frequency: string;
  description: string;
  /** Maps the parsed cron `data` payload to a friendly one-line message
   *  (optionally with a severity), or null to fall back to the generic toast. */
  summarize?: (data: unknown) => CronSummary | null;
}

export const CRON_METADATA: Record<string, CronMetadata> = {
  "ad-campaign-monitor": {
    label: "Check ad campaigns",
    frequency: "Runs hourly (at :15 past)",
    description:
      "Refreshes ad campaigns' spend from the platform, pauses one that has reached the total budget you set, and stops one that has passed its end date. Up to 40 campaigns per run; X campaigns are handled by their own sync.",
    summarize: (data) => {
      const d = data as
        | {
            ticked?: number;
            refreshed?: number;
            autoPaused?: number;
            ended?: number;
            unmonitorable?: number;
            flightEndBlocked?: number;
            rowNotUpdated?: number;
            failed?: number;
            notFound?: number;
            unswept?: number;
            skippedUnreadable?: number;
            skippedOtherWriter?: number;
            truncated?: boolean;
          }
        | null;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
      if (typeof d?.ticked !== "number") return null;

      // ★ALL SIX MUTUALLY-EXCLUSIVE PER-ROW OUTCOMES. Reading the sweep's loop:
      // exactly one of {skippedUnreadable, skippedOtherWriter}, one of
      // {notFound, unmonitorable, ticked}, or `failed` increments per row. A
      // first cut summed five and omitted `skippedOtherWriter`, so a batch of
      // forty X campaigns reported "No campaigns needed checking." — and
      // swallowed `truncated` with it, because the empty-batch answer returns
      // before the truncation check.
      const batch =
        num(d.ticked) +
        num(d.unmonitorable) +
        num(d.failed) +
        num(d.notFound) +
        num(d.skippedUnreadable) +
        num(d.skippedOtherWriter);
      if (batch === 0) return "No campaigns needed checking.";

      const plural = (n: number) => (n === 1 ? "" : "s");

      // ★EVERY OUTCOME THAT MEANS "NOBODY IS WATCHING THIS CAMPAIGN" IS
      // COLLECTED, NOT JUST THE WORST ONE. Each of them otherwise hides inside a
      // green "40 campaigns checked." A first cut read two of the seven, so a
      // tick where every single row threw reported {ticked: 0, failed: 40} as
      // "0 campaigns checked." — a success toast over forty logged errors. A
      // later cut read all of them but returned on the FIRST, so thirty-five
      // errored rows went unmentioned beside one blocked flight end. Ordered
      // worst-first; all of them said.
      const problems: string[] = [];
      if (num(d.flightEndBlocked) > 0) {
        problems.push(
          `${d.flightEndBlocked} passed the end date and could NOT be stopped — check Campaign Manager`,
        );
      }
      if (num(d.failed) > 0) problems.push(`${d.failed} errored`);
      if (num(d.unmonitorable) > 0) problems.push(`${d.unmonitorable} could not be checked at all`);
      if (num(d.rowNotUpdated) > 0) {
        // The OPPOSITE failure: spend has stopped, our record has not caught up.
        problems.push(`${d.rowNotUpdated} stopped on the platform but not updated here`);
      }
      if (num(d.unswept) > 0) problems.push(`${d.unswept} in a status nothing monitors`);
      const unreadable = num(d.notFound) + num(d.skippedUnreadable);
      if (unreadable > 0) problems.push(`${unreadable} could not be read`);

      // ★`refreshed`, NOT `ticked`, IS THE NUMBER THAT MEANS ANYTHING: a tick
      // that returned early evaluated no budget at all. But zero refreshed is
      // NOT a fault on its own — a business whose campaigns are all drafts is
      // the normal newly-onboarded state, and `/boost` creates drafts. So it
      // reports rather than warns, and it does not lead when there is nothing
      // to report: "0 campaigns checked, 12 finished." is a sentence that
      // contradicts itself, and it is reachable — the rows the platform has
      // never heard of end without ever refreshing.
      const refreshed = num(d.refreshed);
      const done: string[] = [];
      if (refreshed > 0 || (num(d.ended) === 0 && num(d.autoPaused) === 0)) {
        done.push(`${refreshed} campaign${plural(refreshed)} checked`);
      }
      if (num(d.autoPaused) > 0) {
        done.push(
          `${d.autoPaused} paused at ${num(d.autoPaused) === 1 ? "its budget cap" : "their budget caps"}`,
        );
      }
      if (num(d.ended) > 0) done.push(`${d.ended} finished`);

      const tail = d.truncated ? " More remain — run again." : "";
      if (problems.length > 0) {
        return { message: `${problems.join("; ")}.${tail}`, level: "warning" as const };
      }
      const message = `${done.join(", ")}.${tail}`;
      // A capped tick is not hourly enforcement for the tail of the queue.
      return d.truncated ? { message, level: "warning" as const } : message;
    },
  },
  "media-cleanup-suggestions": {
    label: "Find cleanup suggestions",
    frequency: "Runs weekly (Sun 4:00 AM UTC)",
    description:
      "Scans your media library for unused, duplicate, oversized, or never-used AI images and flags them for the Smart Delete review (advisory only — nothing is deleted automatically).",
    summarize: (data) => {
      const d = data as { totalTagged?: number } | null;
      return typeof d?.totalTagged === "number"
        ? `${d.totalTagged} cleanup suggestion${d.totalTagged === 1 ? "" : "s"} found.`
        : null;
    },
  },
  "media-hard-delete": {
    label: "Purge expired deletions",
    frequency: "Runs nightly (3:00 AM UTC)",
    description:
      "Permanently removes media that has been in the trash past its 30-day recovery window, freeing the storage for good.",
    summarize: (data) => {
      const d = data as { purged?: number; skipped?: string } | null;
      // The handler early-returns `{success:true, skipped:"storage_not_configured",
      // purged:0}` when there is no object store. Now that flat bodies actually
      // reach this summarizer, that path would otherwise read as a healthy
      // "0 expired items purged." — a green toast for a cron that did nothing
      // because it CAN'T.
      if (d?.skipped) {
        return { message: "Nothing purged — media storage isn't configured.", level: "warning" };
      }
      return typeof d?.purged === "number" ? `${d.purged} expired item${d.purged === 1 ? "" : "s"} purged.` : null;
    },
  },
  "media-storage-reconcile": {
    label: "Reconcile storage usage",
    frequency: "Runs weekly (Sun 5:00 AM UTC)",
    description:
      "Recomputes each organisation's storage meter from the media library so the usage numbers stay exact.",
    summarize: (data) => {
      const d = data as { orgsReconciled?: number } | null;
      return typeof d?.orgsReconciled === "number" ? `${d.orgsReconciled} org meter(s) reconciled.` : null;
    },
  },
  "media-usage-scan": {
    label: "Scan media usage",
    frequency: "Runs daily (1:00 AM UTC)",
    description:
      "Refreshes which ideas each image is used in, so the cleanup suggestions know what's safe to remove.",
    summarize: (data) => {
      const d = data as { mediaUpdated?: number } | null;
      return typeof d?.mediaUpdated === "number" ? `Usage refreshed for ${d.mediaUpdated} asset(s).` : null;
    },
  },
  "beehiiv-sync": {
    label: "Fetch newsletters",
    frequency: "Runs every hour",
    description:
      "Pulls your newest Beehiiv newsletter sends into Peakhour so they show up in the library.",
    // The handler enqueues a background fetch job rather than fetching
    // inline, so there's no count to report yet — surface that the fetch
    // is on its way and the library will fill in shortly.
    summarize: () => "Fetching your latest newsletters — they'll appear in the library shortly.",
  },
  "tag-catchup": {
    label: "AI-tag newsletters",
    frequency: "Runs daily at 2:00 AM UTC",
    description:
      "Runs the AI tagger on any newsletters that are still waiting for analysis (sectors, audience, ad-potential, etc.).",
  },
  "jobs-runner": {
    label: "Process background jobs",
    frequency: "Runs every minute",
    description:
      "Advances any background analysis or re-analysis you've queued from the dashboard.",
  },
  "performance-sync": {
    label: "Refresh performance",
    frequency: "Runs every hour",
    description:
      "Pulls the latest engagement and impression numbers from every connected publishing platform.",
    summarize: (data) => {
      const overall = asRecord(asRecord(data)?.overall);
      if (!overall) return "Performance refreshed.";
      const total = num(overall.connectionsTotal);
      if (total === 0) return "Performance refreshed — no connected platforms yet.";
      if (num(overall.errors) > 0)
        return {
          message: "Performance refreshed, but some platforms reported errors.",
          level: "warning",
        };
      const notConfigured = num(overall.notConfigured);
      const run = num(overall.connectionsRun);
      // Ran but every connection that ran was incomplete (e.g. GA4 with no
      // property selected) — a 2xx no-op. Warn, and point at the fix, so this
      // stops masquerading as a healthy sync.
      if (notConfigured > 0 && notConfigured >= run) {
        return {
          message:
            "Nothing synced — pick a GA4 property (and connect Search Console) above, then refresh.",
          level: "warning",
        };
      }
      if (run > 0) {
        const base = `Performance refreshed across ${run} ${plural(run, "connection")}.`;
        return notConfigured > 0
          ? {
              message: `${base} ${notConfigured} still ${notConfigured === 1 ? "needs" : "need"} setup.`,
              level: "warning",
            }
          : base;
      }
      // total > 0 but nothing ran → every connection was lock-skipped,
      // i.e. a refresh is already in progress (not "up to date").
      return {
        message: "A performance refresh is already running — check back shortly.",
        level: "warning",
      };
    },
  },
  "linkedin-post-sync": {
    label: "Sync LinkedIn posts",
    frequency: "Runs at 6 AM and 6 PM UTC",
    description:
      "Refreshes engagement (likes, comments, reshares) on your recent LinkedIn posts.",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return null;
      if (num(d.scanned) === 0) return "No LinkedIn accounts connected yet.";
      const results = Array.isArray(d.results) ? d.results : [];
      let upserted = 0;
      let fetched = 0;
      for (const r of results) {
        const rr = asRecord(r);
        if (!rr) continue;
        upserted += num(rr.postsUpserted);
        fetched += num(rr.postsFetched);
      }
      const failed = num(d.failed);
      if (num(d.synced) === 0 && failed > 0)
        return "LinkedIn sync didn't complete — please reconnect and try again.";
      // A failed business among healthy ones (e.g. its token was
      // revoked) must not read as all-good.
      const failedSuffix =
        failed > 0
          ? ` ${failed} ${plural(failed, "account")} need${failed === 1 ? "s" : ""} reconnecting.`
          : "";
      if (upserted > 0)
        return `${upserted} ${plural(upserted, "post")} synced successfully.${failedSuffix}`;
      if (fetched > 0)
        return `LinkedIn synced — your posts are already up to date.${failedSuffix}`;
      return `LinkedIn synced — no new posts in range yet.${failedSuffix}`;
    },
  },
  "linkedin-retention-cleanup": {
    label: "Clean LinkedIn data",
    frequency: "Runs every 6 hours",
    description:
      "Removes LinkedIn analytics rows past their retention window (compliance — keeps data scoped to what you actually need).",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return "LinkedIn data cleaned successfully.";
      const total =
        num(d.engagersDeleted) +
        num(d.personPostsDeleted) +
        num(d.orgPostsDeleted) +
        num(d.legacyPostsDeleted);
      if (total === 0) return "LinkedIn data cleaned — nothing to remove.";
      return `LinkedIn data cleaned — ${total} ${plural(total, "row")} removed.`;
    },
  },
  "voice-card-refresh": {
    label: "Refresh brand voice",
    frequency: "Runs weekly (Sunday 5 AM UTC)",
    description:
      "Re-synthesises your business's brand voice from your recent published content.",
  },
  "voice-card-learning": {
    label: "Learn from sent content",
    frequency: "Runs weekly (Monday 7 AM UTC)",
    description:
      "Scans recently-sent content vs. the AI draft and promotes phrases your team kept (signatures) or edited out (avoid) onto the matching voice card.",
  },
  "skill-tuning": {
    label: "Learn from what worked",
    frequency: "Runs weekly (Monday 8 AM UTC)",
    description:
      "Rescores each skill from the feedback and outcomes it collected, and writes back what it learned — the loop that stops the same suggestion being made twice.",
  },
  "sync-ai-models": {
    label: "Sync AI model catalog",
    frequency: "Runs daily at 3 AM UTC",
    description:
      "Refreshes pricing and capability info for every AI model the platform can route to.",
  },
  "discovery-runner": {
    label: "Run discovery pipeline",
    frequency: "Runs every minute",
    description:
      "Advances the onboarding source-discovery pipeline for any business in setup.",
  },
  "refresh-recommendations": {
    label: "Refresh recommendations",
    frequency: "Runs weekly (Monday 5 AM UTC)",
    description:
      "Re-scores recommended trusted sources for every business based on the past week's coverage.",
  },
  "source-fetch-scheduler": {
    label: "Schedule source fetches",
    frequency: "Runs every 15 minutes",
    description:
      "Decides which of your trusted sources are due for a refresh and queues their fetch.",
  },
  "news-classify": {
    label: "Classify breaking news",
    frequency: "Runs every 15 minutes",
    description:
      "For each News Desk business, queues classification of recently-fetched news (breaking status, urgency, topic, geography) so the corroboration gate can cluster the breaking items.",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return null;
      const businesses = num(d.businesses);
      if (businesses === 0) return "No News Desk businesses are enabled yet.";
      const jobs = num(d.enqueued);
      return `Queued news classification for ${businesses} ${plural(businesses, "business")} (${jobs} ${plural(jobs, "job")}).`;
    },
  },
  "news-corroborate": {
    label: "Corroborate breaking news",
    frequency: "Runs hourly",
    description:
      "For each News Desk business, queues the corroboration gate — clusters breaking items across independent sources, scores a confidence tier, and records which sources back each story. Records clusters only; it does not publish anything.",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return null;
      const businesses = num(d.businesses);
      if (businesses === 0) return "No News Desk businesses are enabled yet.";
      return `Queued news corroboration for ${businesses} ${plural(businesses, "business")}.`;
    },
  },
  "news-compose": {
    label: "Compose news drafts",
    frequency: "Runs hourly",
    description:
      "For each News Desk business, queues the Wire Desk — turns corroborated clusters into brand-voice news drafts (factual, plagiarism-checked via the originality gate) and adds them to the approval queue. Composes only; it never auto-publishes.",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return null;
      const businesses = num(d.businesses);
      if (businesses === 0) return "No News Desk businesses are enabled yet.";
      return `Queued news composition for ${businesses} ${plural(businesses, "business")}.`;
    },
  },
  "trial-expiry-sweep": {
    label: "Check trial expiries",
    frequency: "Runs daily at 3:30 AM UTC",
    description:
      "Notifies businesses whose trial is ending soon and downgrades any that have lapsed.",
  },
  "publish-scheduled": {
    label: "Publish scheduled posts",
    frequency: "Runs every minute",
    description:
      "Sends any posts you've scheduled for the current time slot to the target platform.",
  },
  "publish-retry": {
    label: "Retry failed publishes",
    frequency: "Runs every minute",
    description:
      "Re-attempts any publish that failed (rate limit, transient API error) and is still within its retry budget.",
  },
  "recurring-spawn": {
    label: "Spawn recurring posts",
    frequency: "Runs every 15 minutes",
    description:
      "Generates new posts from any recurring schedule rules you've set up.",
  },
  "growth-optimizer": {
    label: "Run weekly growth review",
    frequency: "Runs Mondays 03:00 UTC",
    description:
      "Reviews each opted-in business's week of posts and campaigns and proposes up to three small, evidence-backed adjustments for approval.",
    summarize: (data) => {
      const d = data as {
        businesses?: number; created?: number; skipped?: number; failed?: number; truncated?: boolean;
      } | null;
      if (!d || typeof d.businesses !== "number") return null;
      let msg = `${d.created ?? 0} review${(d.created ?? 0) === 1 ? "" : "s"} created across ${d.businesses} business${d.businesses === 1 ? "" : "es"} (${d.skipped ?? 0} already done, ${d.failed ?? 0} failed).`;
      if (d.truncated) msg += " More businesses pending — trigger again to continue.";
      return (d.failed ?? 0) > 0 || d.truncated ? { message: msg, level: "warning" } : msg;
    },
  },
  "outcome-backfill": {
    label: "Backfill post outcomes",
    frequency: "Runs every hour",
    description:
      "Stamps engagement outcomes onto recent posts so the learning loop can score what worked.",
  },
  "pipeline-cost-rollup": {
    label: "Roll up AI costs",
    frequency: "Runs every 5 minutes",
    description:
      "Aggregates AI spend by business + use-case for the /cms/ai-usage dashboard.",
  },
  "pipeline-run-janitor": {
    label: "Reap orphan pipeline runs",
    frequency: "Runs every hour",
    description:
      "Stamps endedAt + outcome=failed on orphan pipeline-run rows (older than 24h with no outcome) so they become eligible for the TTL index to evict.",
  },
  "per-stream-effectiveness-rollup": {
    label: "Roll up stream effectiveness",
    frequency: "Runs daily at 6 AM UTC",
    description:
      "Aggregates which content streams (trusted-grounded / library-gap / seasonal) produced the best results.",
  },
  "archetype-centroids": {
    label: "Refresh audience archetypes",
    frequency: "Runs every hour",
    description:
      "Recomputes the audience-archetype clusters your content is matched against.",
  },
  "tier-a-builder": {
    label: "Rebuild Tier-A cohorts",
    frequency: "Runs daily at 2:30 AM UTC",
    description:
      "Recomputes the Tier-A audience cohorts from recent signals.",
  },
  "x-metrics-sync": {
    label: "Sync X metrics",
    frequency: "Runs every 30 minutes",
    description: "Refreshes engagement metrics on your recent X (Twitter) posts.",
    summarize: (data) => {
      const synced = num(asRecord(data)?.synced);
      if (synced === 0) return "X metrics refreshed — no active accounts yet.";
      return `X metrics refreshed across ${synced} ${plural(synced, "account")}.`;
    },
  },
  "x-mentions-sync": {
    label: "Sync X mentions",
    frequency: "Runs every 10 minutes",
    description:
      "Pulls new mentions of your account from X so the inbox stays current.",
    summarize: (data) => {
      const synced = num(asRecord(data)?.synced);
      if (synced === 0) return "Mentions refreshed — no active accounts yet.";
      return "Mentions refreshed.";
    },
  },
  "x-ads-metrics-sync": {
    label: "Sync X ad metrics",
    frequency: "Runs every hour",
    description: "Refreshes performance numbers on your active X ad campaigns.",
    summarize: (data) => {
      const synced = num(asRecord(data)?.synced);
      if (synced === 0) return "X ad metrics refreshed — no active campaigns yet.";
      return "X ad metrics refreshed.";
    },
  },
  "ask-weekly-digest": {
    label: "Send weekly digest",
    frequency: "Runs weekly (Monday 6:00 AM UTC)",
    description:
      "Sends each business owner their weekly performance digest — plain-English headline, what moved, and one suggested next step — over WhatsApp, falling back to in-app.",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return null;
      const targets = num(d.targets);
      // targets counts businesses DUE a digest, so 0 covers two very different
      // cases: nobody has connected analytics, or everyone was digested inside
      // the 6-day guard window. Don't claim which.
      if (targets === 0) return "Nothing to send — no business is due a digest right now.";
      const sent = num(d.sent);
      const parts = [`${sent} ${plural(sent, "digest")} sent`];
      // skipped = connected but no metrics worth a brief yet (still syncing, or
      // no period comparison). It is NOT a re-send skip — businesses digested
      // inside the guard window are excluded by the query and never counted here.
      if (num(d.skipped) > 0) parts.push(`${num(d.skipped)} skipped`);
      if (num(d.errors) > 0) parts.push(`${num(d.errors)} failed`);
      // budgetHit means the run stopped early on wall-clock, not that it
      // finished the queue — say so, or the count reads as complete.
      const tail = d.budgetHit === true ? " Time budget reached — the rest roll over to the next run." : "";
      return `${parts.join(", ")}.${tail}`;
    },
  },
  "wa-outcome-billing": {
    label: "Bill resolved chats",
    frequency: "Runs every 3 hours",
    description:
      "Reviews WhatsApp conversations that have gone quiet, works out which ones actually reached an outcome (resolved, lead qualified, appointment booked), and charges Peaks once per outcome. Ongoing chat turns are always free.",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return null;
      const scanned = num(d.scanned);
      if (scanned === 0) return "No quiet conversations to review yet.";
      const billed = num(d.billed);
      const parts = [
        billed === 0
          ? `${scanned} ${plural(scanned, "conversation")} reviewed — none reached a billable outcome`
          : `${billed} of ${scanned} ${plural(scanned, "conversation")} billed`,
      ];
      if (num(d.humanTakeover) > 0) parts.push(`${num(d.humanTakeover)} handed to a human`);
      if (num(d.errors) > 0) parts.push(`${num(d.errors)} failed`);
      return `${parts.join(", ")}.`;
    },
  },

  // ── Billing + money ────────────────────────────────────────────────
  // Undocumented until now because none of them could be triggered at all
  // (peakhour-api#1017). Which of these need an explicit confirmation is NOT
  // recorded here — the api reports it via `requiresConfirmation` and the UI
  // marks them from that, so there is no second list to drift.
  "ai-credits-rollup": {
    label: "Charge Peaks used",
    frequency: "Runs every minute",
    description:
      "Turns AI work already done into Peaks charged against each plan's allowance. Until this runs, usage shows under 'Where your Peaks go' but no balance has moved. Only covers the last 6 hours, so it can't backfill older usage.",
    summarize: (data) => {
      const d = asRecord(data);
      if (!d) return null;
      const processed = num(d.processed);
      if (processed === 0) {
        return { message: "No new AI usage to charge.", level: "warning" };
      }
      const parts = [`${processed} AI ${plural(processed, "call")} charged`];
      if (num(d.topUpDebited) > 0) parts.push(`${num(d.topUpDebited)} Peaks drawn from top-ups`);
      if (num(d.failed) > 0) parts.push(`${num(d.failed)} failed`);
      return `${parts.join(", ")}.`;
    },
  },
  "billing-dunning": {
    label: "Enforce failed payments",
    frequency: "Runs hourly",
    description:
      "Ends the grace period for subscriptions whose payment failed, freezing access once the retry window has run out. Revokes entitlements from real organisations — dev has real stores on it.",
  },
  "billing-reconcile": {
    label: "Re-check card subscriptions",
    frequency: "Runs daily at 4am UTC",
    description:
      "Compares every Stripe/Razorpay subscription against what the gateway actually says, correcting anything a dropped webhook left stale — such as a cancellation that never arrived.",
  },
  "shopify-billing-reconcile": {
    label: "Re-check Shopify subscriptions",
    frequency: "Runs daily at 3:30am UTC",
    description:
      "The safety net for a dropped Shopify billing webhook. Re-reads each store's live subscription state so an uninstall or cancellation that never reached us stops granting access.",
  },
  "internal-settlement": {
    label: "Settle internal accounts",
    frequency: "Runs monthly (1st, 3:00 AM UTC)",
    description:
      "Produces the notional invoice and matching credit note for non-billable internal orgs, netting to zero. Never calls a payment gateway.",
  },
  "einvoice-register": {
    label: "Register GST e-invoices",
    frequency: "Runs every 2 hours",
    description:
      "Submits pending B2B GST invoices to the government IRP to obtain an IRN and signed QR code. Talks to a real external tax portal.",
  },

  // ── Site graph, analytics + integrations ───────────────────────────
  "site-graph-health": {
    label: "Check link health",
    frequency: "Runs every 6 hours",
    description:
      "Scans a batch of the least-recently-checked pages for broken links and redirects, so the site graph reflects what visitors actually hit.",
  },
  "site-graph-inspection": {
    label: "Sync URL inspection",
    frequency: "Runs daily at 4am UTC",
    description:
      "Asks Google Search Console how it sees a batch of your URLs — indexed, excluded, or blocked — and stores the verdict against each page.",
  },
  "site-graph-metrics": {
    label: "Sync page metrics",
    frequency: "Runs weekly (Mon 5:00 AM UTC)",
    description:
      "Pulls per-URL clicks and impressions from Search Console into the site graph so page-level performance is current.",
  },
  "pin-rollup": {
    label: "Roll up network insights",
    frequency: "Runs daily at 4am UTC",
    description:
      "Contributes anonymised, consent-gated catalog signals to the Insights Network and refreshes the benchmarks each business sees. Never carries a business identifier.",
  },
  "linkedin-conversion-stream": {
    label: "Send conversions to LinkedIn",
    frequency: "Runs daily at 5am UTC",
    description:
      "Streams matured lead attribution back to LinkedIn's Conversions API so ad reporting closes the loop on what actually converted.",
  },
  "integration-fit-reconcile": {
    label: "Flag mismatched connections",
    frequency: "Runs daily at 6:30am UTC",
    description:
      "Finds existing connections whose brand doesn't match the business that owns them — pollution the connect-time guard now prevents but can't retroactively clean.",
  },
  "support-sla-sweep": {
    label: "Flag overdue support",
    frequency: "Runs hourly",
    description:
      "Marks open inbox items whose first-response or resolution deadline has passed, so a breach surfaces instead of ageing quietly.",
  },
  "wp-autopilot": {
    label: "Run WordPress autopilot",
    frequency: "Runs hourly",
    description:
      "For each WordPress site with autopilot due, re-checks the site still holds a paid Content entitlement and then publishes the next scheduled piece. A lapsed subscription disables autopilot rather than publishing.",
  },
  "wp-identity-reconcile": {
    label: "Clean up WordPress shells",
    frequency: "Runs daily at 6am UTC",
    description:
      "Deletes leftover placeholder accounts from WordPress silent-connect that ended up with no site attached — after an interrupted claim, for example. Only ever removes a placeholder with zero connections, never a real account.",
  },

  // ── Already triggerable, never documented ──────────────────────────
  // Surfaced by the coverage test: these were on the api's allowlist all along
  // but had no entry here, so they rendered as "Run fx-rates" with no schedule.
  "fx-rates": {
    label: "Refresh exchange rates",
    frequency: "Runs daily at 4:30am UTC",
    description:
      "Pulls fresh USD-base currency rates so revenue reported in USD reflects today's rates rather than the day a sale happened to land.",
  },
  "trial-conversion-sweep": {
    label: "Convert finished trials",
    frequency: "Runs daily at 3:45am UTC",
    description:
      "Turns a trial that has run its course into a real billing line on the customer's live payment-gateway subscription, so the first charge lands on schedule. This changes what a real customer is billed.",
  },
  "shopify-deadstock-score": {
    label: "Score dead stock",
    frequency: "Runs daily at 2:15am UTC",
    description:
      "Scores each Shopify store's catalog for stock that isn't selling and writes the diagnosis the Commerce insights read from. Uses AI, so it costs Peaks.",
  },
  "media-overage-snapshot": {
    label: "Snapshot storage overage",
    frequency: "Runs monthly (1st, 6:00 AM UTC)",
    description:
      "Captures how much storage each organisation used beyond its plan for the month that just closed, which is what any overage is billed from.",
  },
  "meta-token-keepalive": {
    label: "Keep Meta tokens alive",
    frequency: "Runs daily at 4am UTC",
    description:
      "Refreshes long-lived Meta tokens for connections nothing has touched recently, so a dormant account doesn't quietly expire and need reconnecting.",
  },
  "commerce-order-pii-sweep": {
    label: "Erase expired shopper details",
    frequency: "Runs daily at 3:40am UTC",
    description:
      "Removes the shopper's phone and name from orders older than the retention window — they exist so a delivery can be confirmed, which is a purpose measured in days. The order itself stays: line items, totals and dates are the merchant's own records.",
    /**
     * ★`exhausted: false` IS NOT A SUCCESS, and without this it toasted as one.
     * It means the sweep hit its time budget with rows still due — shopper phone
     * numbers retained past the window we publish. The api logs a warning nobody
     * watching this button would see; a green "complete" over it is the worst
     * available answer.
     */
    summarize: (data) => {
      const d = data as { erased?: number; scanned?: number; exhausted?: boolean } | null;
      if (!d || typeof d.erased !== "number") return null;
      const erased = `${d.erased} order${d.erased === 1 ? "" : "s"} cleared`;
      // ★level: "warning", NOT A BARE STRING. A summarizer that returns a
      // string renders a GREEN toast whatever it says, so "PII is still
      // retained" would arrive dressed as a success.
      return d.exhausted === false
        ? {
            message: `${erased}, but the sweep ran out of time with more still due — run it again.`,
            level: "warning" as const,
          }
        : `${erased}. Nothing is left past the retention window.`;
    },
  },
  "org-deletion-executor": {
    label: "Close accounts that asked to be closed",
    frequency: "Runs daily at 3:50am UTC",
    description:
      "Carries out account and workspace closures whose promised date has arrived, erasing the tenant's data. It never brings a date forward — a request made under a 30-day promise keeps its 30 days.",
    /**
     * ★A TICK IS NOT THE SAME AS "EVERYONE WAS CLOSED". The handler answers 200
     * with counts, and `failed`, `refused` or an undrained backlog all mean a
     * customer has been promised an erasure that has not happened. That is the
     * one outcome this button must never render as a plain success.
     */
    summarize: (data) => {
      const d = data as
        | { completed?: number; failed?: number; refused?: number; deferred?: number; drained?: boolean }
        | null;
      if (!d || typeof d.completed !== "number") return null;
      const done = `${d.completed} closure${d.completed === 1 ? "" : "s"} carried out`;
      const stuck = [
        d.failed ? `${d.failed} failed` : "",
        d.refused ? `${d.refused} refused` : "",
        d.deferred ? `${d.deferred} deferred` : "",
      ].filter(Boolean);
      if (stuck.length) {
        return {
          message: `${done}, but ${stuck.join(", ")} — those customers are past their promised date.`,
          level: "warning" as const,
        };
      }
      return d.drained === false
        ? {
            message: `${done}, and more are still due — run it again.`,
            level: "warning" as const,
          }
        : `${done}. Nothing is past its promised date.`;
    },
  },
  "shopify-voice-card-learn": {
    label: "Learn store voice",
    frequency: "Runs daily at 3:45am UTC",
    description:
      "Feeds each merchant's approvals, edits and rejections of AI suggestions back into their voice card, so future suggestions sound more like them. Skips a store until it has enough new verdicts to learn from. Uses AI, so it costs Peaks.",
  },
};

/** Fallback for a cron name not yet documented in CRON_METADATA. The UI
 *  still renders a button (the api accepts it), just without the
 *  friendly label / tooltip. Add an entry above when you see this. */
export function getCronMetadata(cron: string): CronMetadata {
  return (
    CRON_METADATA[cron] ?? {
      label: `Run ${cron}`,
      frequency: "(undocumented schedule)",
      description: `Triggers the ${cron} cron handler. Add this cron to cron-metadata.ts for a friendly description.`,
    }
  );
}

// ── Summary plumbing ──────────────────────────────────────────────────
// Shared by the per-cron `summarize` functions above and by
// summarizeCronBody() below. Kept defensive — the cron response shape is
// owned by peakhour-api and can drift, so every read narrows from unknown
// and tolerates missing/wrong-typed fields rather than throwing.

/** Narrow an unknown value to a plain object, or null. */
function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Read a numeric field, coercing absent / non-numeric values to 0. */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Naive singular/plural — every noun we pluralize here just takes -s. */
function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

/**
 * Turn a cron handler's raw HTTP response body into a clean, user-facing
 * success line. <CronToolbar/> calls this on a 2xx run instead of dumping
 * the raw JSON into the toast.
 *
 * The body is the cron's own envelope — `{ ok, data, meta }` — so we
 * parse it, hand the inner `data` to the cron's `summarize`, and return
 * whatever friendly string it produces. Returns null (→ caller shows a
 * generic "<label> complete") whenever there's no summarizer, the body
 * isn't parseable, or the summarizer opts out. Never throws.
 */
/** Whether this cron has a summarizer at all.
 *
 *  ★"NO SUMMARY" AND "THE SUMMARY WAS LOST" ARE DIFFERENT, and the toast needs
 *  to tell them apart: most crons legitimately have no summarizer and a generic
 *  "complete" is right for them, while a cron that HAS one and returned an
 *  unreadable (truncated) body has hidden whatever it was going to say. */
export function hasSummarizer(cron: string): boolean {
  return typeof CRON_METADATA[cron]?.summarize === "function";
}

export function summarizeCronBody(
  cron: string,
  body: string,
): { message: string; level: "success" | "warning" } | null {
  const summarize = CRON_METADATA[cron]?.summarize;
  if (!summarize || !body) return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    const root = asRecord(parsed);
    // The api has THREE cron response conventions and always has:
    //   • `{ok, data:{…}}`            — most handlers
    //   • `{success, processed, …}`   — flat: ai-credits-rollup, every media-*
    //   • `{ok:true, ...result}`      — flat under `ok`: the site-graph-* trio,
    //                                   voice-card-learning
    // Reading only `.data` silently handed `undefined` to every summarizer in
    // the last two groups, so they returned null and fell back to "<label>
    // complete" — including, in the rollup's case, turning a run that charged
    // nothing into a green success, which is the exact outcome the warning
    // level exists to prevent. Falling back to the root covers all three.
    const data = root?.data !== undefined ? root.data : root;
    const result = summarize(data);
    if (result == null) return null;
    // Normalize the bare-string form to a success-level object.
    return typeof result === "string"
      ? { message: result, level: "success" }
      : { message: result.message, level: result.level ?? "success" };
  } catch {
    // Malformed / truncated body — defer to the generic toast.
    return null;
  }
}
