/**
 * Client-visible feature flags (inlined at build via NEXT_PUBLIC_*).
 */

/**
 * Ask Peakhour — the grounded assistant (FAB launcher + /dashboard/ask + nav).
 * Runs in parallel with the legacy ChatPanel until the PR-11 cutover; enable per
 * environment with NEXT_PUBLIC_ASK_ENABLED=true.
 */
export const ASK_ENABLED = process.env.NEXT_PUBLIC_ASK_ENABLED === "true";
