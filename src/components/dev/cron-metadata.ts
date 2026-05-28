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
 */

export interface CronMetadata {
  label: string;
  frequency: string;
  description: string;
}

export const CRON_METADATA: Record<string, CronMetadata> = {
  "beehiiv-sync": {
    label: "Fetch newsletters",
    frequency: "Runs every hour",
    description:
      "Pulls your newest Beehiiv newsletter sends into Peakhour so they show up in the library.",
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
  },
  "linkedin-post-sync": {
    label: "Sync LinkedIn posts",
    frequency: "Runs at 6 AM and 6 PM UTC",
    description:
      "Refreshes engagement (likes, comments, reshares) on your recent LinkedIn posts.",
  },
  "linkedin-retention-cleanup": {
    label: "Clean LinkedIn data",
    frequency: "Runs daily",
    description:
      "Removes LinkedIn analytics rows past their retention window (compliance — keeps data scoped to what you actually need).",
  },
  "voice-card-refresh": {
    label: "Refresh brand voice",
    frequency: "Runs weekly (Sunday 5 AM UTC)",
    description:
      "Re-synthesises your business's brand voice from your recent published content.",
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
  "trial-expiry-sweep": {
    label: "Check trial expiries",
    frequency: "Runs daily",
    description:
      "Notifies businesses whose trial is ending soon and downgrades any that have lapsed.",
  },
  "publish-scheduled": {
    label: "Publish scheduled posts",
    frequency: "Runs frequently",
    description:
      "Sends any posts you've scheduled for the current time slot to the target platform.",
  },
  "publish-retry": {
    label: "Retry failed publishes",
    frequency: "Runs frequently",
    description:
      "Re-attempts any publish that failed (rate limit, transient API error) and is still within its retry budget.",
  },
  "recurring-spawn": {
    label: "Spawn recurring posts",
    frequency: "Runs daily",
    description:
      "Generates new posts from any recurring schedule rules you've set up.",
  },
  "outcome-backfill": {
    label: "Backfill post outcomes",
    frequency: "Runs daily",
    description:
      "Stamps engagement outcomes onto recent posts so the learning loop can score what worked.",
  },
  "pipeline-cost-rollup": {
    label: "Roll up AI costs",
    frequency: "Runs daily",
    description:
      "Aggregates AI spend by business + use-case for the /cms/ai-usage dashboard.",
  },
  "pipeline-run-janitor": {
    label: "Tidy pipeline runs",
    frequency: "Runs daily",
    description:
      "Trims old pipeline-run observability rows past their retention window.",
  },
  "per-stream-effectiveness-rollup": {
    label: "Roll up stream effectiveness",
    frequency: "Runs daily",
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
  },
  "x-mentions-sync": {
    label: "Sync X mentions",
    frequency: "Runs every 10 minutes",
    description:
      "Pulls new mentions of your account from X so the inbox stays current.",
  },
  "x-ads-metrics-sync": {
    label: "Sync X ad metrics",
    frequency: "Runs every hour",
    description: "Refreshes performance numbers on your active X ad campaigns.",
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
