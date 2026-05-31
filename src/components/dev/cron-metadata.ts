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

export interface CronMetadata {
  label: string;
  frequency: string;
  description: string;
  /** Maps the parsed cron `data` payload to a friendly one-line success
   *  message, or null to fall back to the generic toast. */
  summarize?: (data: unknown) => string | null;
}

export const CRON_METADATA: Record<string, CronMetadata> = {
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
      const d = data as { purged?: number } | null;
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
        return "Performance refreshed, but some platforms reported errors.";
      const run = num(overall.connectionsRun);
      if (run > 0)
        return `Performance refreshed across ${run} ${plural(run, "connection")}.`;
      // total > 0 but nothing ran → every connection was lock-skipped,
      // i.e. a refresh is already in progress (not "up to date").
      return "A performance refresh is already running — check back shortly.";
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
      if (num(d.synced) === 0 && num(d.failed) > 0)
        return "LinkedIn sync didn't complete — please reconnect and try again.";
      if (upserted > 0)
        return `${upserted} ${plural(upserted, "post")} synced successfully.`;
      if (fetched > 0) return "LinkedIn synced — your posts are already up to date.";
      return "LinkedIn synced — no new posts in range yet.";
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
      const enqueued = num(d.enqueued);
      if (num(d.businesses) === 0) return "No News Desk businesses are enabled yet.";
      return `Queued news classification for ${enqueued} ${plural(enqueued, "business")}.`;
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
export function summarizeCronBody(cron: string, body: string): string | null {
  const summarize = CRON_METADATA[cron]?.summarize;
  if (!summarize || !body) return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    const data = asRecord(parsed)?.data;
    return summarize(data);
  } catch {
    // Malformed / truncated body — defer to the generic toast.
    return null;
  }
}
