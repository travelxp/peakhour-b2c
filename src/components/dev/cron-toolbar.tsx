"use client";

/**
 * <CronToolbar> — the always-visible "Dev cron triggers" row that sits
 * at the top of any dashboard page whose data depends on a cron.
 *
 * ARCHITECTURE REQUIREMENT (Prashant, 2026-05-28). Pages that surface
 * data populated by a Vercel Cron handler — beehiiv newsletters,
 * LinkedIn post engagement, X mentions, scheduled publish queue, etc.
 * — MUST render a <CronToolbar/> at the top with the relevant crons.
 * This is non-negotiable because:
 *
 *   1. Vercel Cron only fires on production deployments. Without the
 *      toolbar, every preview + local-dev user has to use the CLI
 *      (scripts/cron-trigger.ts) to exercise the path their page
 *      reflects.
 *   2. Each button has a hover tooltip with the FRIENDLY label and
 *      schedule (CRON_METADATA in ./cron-metadata.ts), so an operator
 *      can see what fires and how often without reading code.
 *   3. The component renders nothing when
 *      NEXT_PUBLIC_VERCEL_ENV === "production" — the api endpoint also
 *      server-side-blocks prod, so this is layered protection.
 *
 * SINCE 2026-08: outside production it is additionally OPT-IN, via `?dev=1`
 * (remembered per browser; `?dev=0` clears it). The requirement above is
 * unchanged — every cron-fed page still mounts the toolbar and every
 * engineer still gets it in one URL param. What changed is the default,
 * because env-only gating meant the preview links the team reviews the
 * product on always carried a row of buttons labelled `discovery-runner` /
 * `jobs-runner` above the content, and "why does this look like it's still
 * in development?" turned out to be largely that.
 *
 * Layout: a separate visual band (border-dashed, subtle bg) above the
 * page action buttons. Keeps cron triggers out of the primary action
 * row (was the source of the "Re-analyse 53 incomplete" header
 * distortion — too many buttons in one flex row).
 *
 * Usage:
 *   <CronToolbar
 *     crons={["beehiiv-sync", "jobs-runner", "tag-catchup"]}
 *     onTriggered={() => queryClient.invalidateQueries(...)}
 *   />
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  CRON_METADATA,
  getCronMetadata,
  hasSummarizer,
  summarizeCronBody,
} from "./cron-metadata";

interface DevCronResult {
  cron: string;
  status: number;
  ok: boolean;
  durationMs: number;
  body: string;
  truncated: boolean;
}

interface Props {
  /** Ordered list of cron names. The toolbar renders one button per name. */
  crons: readonly string[];
  /**
   * Crons the api refuses to fire without `{"confirm":"<name>"}` — its effects
   * leave our database (a customer email, an external tax portal, a payment
   * gateway). Comes from `GET /v1/dev/cron`; pass it through rather than
   * hardcoding, so the api stays the single source of truth for what is
   * dangerous.
   *
   * Omitted on the per-page toolbars, which list only everyday crons. A cron
   * that turns out to need confirmation without being named here still can't
   * fire by accident — the api refuses and the toast says exactly why.
   */
  requiresConfirmation?: readonly string[];
  /**
   * Crons a non-staff user cannot fire at all - the api answers `INTERNAL_ONLY`.
   *
   * ★SENT FOR THE SAME REASON AS `requiresConfirmation`, AND IGNORED UNTIL NOW.
   * Without it the toolbar renders a button whose only possible outcome is a
   * 403: a preview user confirms an irreversible-erasure prompt and is then
   * told "Please try again in a moment", which can never succeed.
   *
   * ★AND IT IS ALSO WHAT MAKES THE WARNING TRUE. The one fixed sentence this
   * chrome showed for every guarded cron - "effects outside Peakhour" - is
   * exactly backwards for `org-deletion-executor`, whose danger is INSIDE our
   * own database. The api's two sets are the only signal that tells them apart.
   */
  requiresInternalUser?: readonly string[];
  /** Optional callback fired ONLY when the cron handler responded 2xx
   *  (result.ok === true). Host pages typically use this to invalidate
   *  the React Query keys whose data the cron just mutated; invalidating
   *  on a known-failed cron run would be wasteful (and on a real error,
   *  the toast already surfaces the failure to the user). */
  onTriggered?: (result: DevCronResult) => void;
}

function isProductionEnv(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}

/**
 * Explicit opt-in for the dev cron controls.
 *
 * Environment alone used to decide this, which meant every preview URL — the
 * ones the team reviews the product on — rendered a row of buttons labelled
 * `discovery-runner` / `jobs-runner` above the page content. Nothing else on
 * screen said "unfinished software" half as loudly, and it said it about a
 * build that was fine.
 *
 * The toolbar stays exactly as available to the people who need it (Vercel
 * Cron only fires on production, so previews genuinely cannot exercise these
 * paths without it) — it just has to be asked for now:
 *
 *   ?dev=1   turn on, and remember it for this browser
 *   ?dev=0   turn off again
 *
 * Production is still blocked outright, and the api route server-side blocks
 * prod as well, so this narrows the audience without weakening either layer.
 */
const DEV_TOOLS_KEY = "peakhour.dev-tools";
const DEV_TOOLS_EVENT = "peakhour:dev-tools";

/** Pure read — safe to call during render, writes nothing. */
function readDevToolsFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("dev") === "1") return true;
    return window.localStorage.getItem(DEV_TOOLS_KEY) === "1";
  } catch {
    // Storage can throw in locked-down browser modes. A dev affordance is
    // never worth breaking the page over.
    return false;
  }
}

function subscribeDevToolsFlag(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DEV_TOOLS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DEV_TOOLS_EVENT, onChange);
  };
}

function useDevToolsEnabled(): boolean {
  // Persisting the switch is a write, never a setState — so this stays clear
  // of the cascading-render rule the repo lints for.
  useEffect(() => {
    let param: string | null = null;
    try {
      param = new URLSearchParams(window.location.search).get("dev");
      if (param === "1") window.localStorage.setItem(DEV_TOOLS_KEY, "1");
      else if (param === "0") window.localStorage.removeItem(DEV_TOOLS_KEY);
    } catch {
      return;
    }
    if (param !== null) window.dispatchEvent(new Event(DEV_TOOLS_EVENT));
  }, []);

  return useSyncExternalStore(subscribeDevToolsFlag, readDevToolsFlag, () => false);
}

// Module-scoped re-entry guard. Per-instance refs would still race in
// rare double-mount scenarios (e.g. loading→loaded branch swap that
// remounts the toolbar mid-flight, or two toolbars on the same page
// sharing a cron). Triggering tag-catchup twice burns real AI spend, so
// the guard is hoisted to module scope and keyed by cron name — every
// in-flight cron registers itself here and unregisters in the finally.
const inFlightCrons = new Set<string>();

/**
 * The confirmation prompt for a cron whose effects leave our database.
 *
 * Leads with the cron's OWN description rather than one blanket sentence: an
 * earlier draft asserted these "email real merchants or call an external
 * provider", which is wrong for two of the five — internal-settlement never
 * calls a gateway and billing-dunning sends nothing, it freezes access.
 * Guessing at the danger is how you train people to click straight through.
 *
 * But `requiresConfirmation` is RUNTIME data from the api, so the newly
 * dangerous cron is precisely the one this build may have no metadata for — and
 * the fallback description is a note to a developer ("Add this cron to
 * cron-metadata.ts"), which tells the person clicking nothing at all. So the
 * consequence line is always appended; it is the only part guaranteed to be
 * true and useful for a cron we have never heard of.
 */
function confirmText(
  cron: string,
  meta: { label: string; description: string },
  internalOnly: boolean,
): string {
  const known = cron in CRON_METADATA;
  return [
    meta.label,
    "",
    known ? meta.description : `The "${cron}" cron.`,
    "",
    dangerSentence(internalOnly),
    "",
    "Run it now?",
  ].join("\n");
}

/**
 * What the warning actually means for THIS cron.
 *
 * ★ONE FIXED SENTENCE WAS WRONG FOR THE MOST DANGEROUS CRON WE HAVE. Every
 * guarded cron said "effects outside Peakhour - real customers or an external
 * provider", which is true of the billing and e-invoice ones and precisely
 * backwards for `org-deletion-executor`: its danger is inside our own database,
 * it erases every tenant past its closure date on this environment - other
 * people's dev orgs included - and nothing undoes it. Making that button
 * legible without making its warning true would have been the worse half of
 * the change that named it.
 *
 * Derived from the api's own two sets, so there is no third list to drift.
 */
export function dangerSentence(internalOnly: boolean): string {
  return internalOnly
    ? "This one erases data INSIDE Peakhour and cannot be undone. It acts on every tenant on this environment whose deletion date has passed, including other people's."
    : "This one has effects outside Peakhour - it can reach real customers or an external provider.";
}

export function CronToolbar({
  crons,
  requiresConfirmation,
  requiresInternalUser,
  onTriggered,
}: Props) {
  // Hooks must run unconditionally; the production gate decides what to
  // render below, not whether to mount.
  //
  // A SET, not a single slot. Parallel firing is the documented design (see the
  // per-button comment), but one `string | null` meant firing B overwrote A's
  // "Running…", and whichever finished FIRST re-enabled both buttons while the
  // other was still in flight. The module-scoped guard stopped a real
  // double-fire, so this was only ever confusing — but /cms/crons now renders
  // 56 buttons, which makes it easy to hit.
  const [runningCrons, setRunningCrons] = useState<ReadonlySet<string>>(new Set());
  // Opt-in switch — see useDevToolsEnabled. Called unconditionally, like the
  // state above, so the gate below decides rendering and never mounting.
  const devToolsEnabled = useDevToolsEnabled();
  const startRunning = (cron: string) =>
    setRunningCrons((prev) => new Set(prev).add(cron));
  const stopRunning = (cron: string) =>
    setRunningCrons((prev) => {
      const next = new Set(prev);
      next.delete(cron);
      return next;
    });

  if (isProductionEnv() || !devToolsEnabled || crons.length === 0) return null;

  /**
   * What to do with a dev-cron response, for EVERY path that gets one.
   *
   * Extracted because the confirmation-retry path grew its own copy and
   * immediately diverged: it toasted success without checking `ok`, so a cron
   * that 500'd inside the dev route's 200 envelope reported green with nothing
   * logged — on the retry path for the dangerous crons, of all places. Two
   * copies of this will always drift; one cannot.
   */
  function handleResult(cron: string, label: string, res: DevCronResult) {
    if (res.ok) {
      // Show a clean, user-facing line — never the raw cron JSON. The per-cron
      // summarizer turns the response payload into something like "12 posts
      // synced successfully."; absent one, we fall back to a generic "<label>
      // complete". A summarizer can flag `level:"warning"` for a 2xx run that
      // did nothing useful (e.g. a sync that skipped every connection because
      // none is configured) so a no-op stops reading as a green success. The
      // raw body + timing still go to the dev console for debugging.
      const summary = summarizeCronBody(cron, res.body);
      // ★A TRUNCATED BODY IS NOT A SUCCESS FOR A CRON THAT HAS A SUMMARIZER,
      // and it fails hardest on exactly the runs that matter. The api caps the
      // body at 4000 chars, so `org-deletion-executor` blows past it precisely
      // when several closures FAILED (each carries a long reason string) —
      // JSON.parse throws, the summary comes back null, and the toast reads
      // "Close accounts that asked to be closed complete" over customers still
      // waiting past their promised date. When we expected a summary and could
      // not have one, say that rather than assuming the best.
      const truncatedSummary =
        res.truncated && !summary && hasSummarizer(cron)
          ? `${label} ran, but the result was too long to read back — check the console before assuming it finished cleanly.`
          : null;
      if (summary?.level === "warning") {
        toast.warning(summary.message);
      } else if (truncatedSummary) {
        toast.warning(truncatedSummary);
      } else {
        toast.success(summary?.message ?? `${label} complete`);
      }
      if (res.body) {
        console.debug(`[CronToolbar] ${cron} ok in ${res.durationMs}ms:`, res.body);
      }
      // A truncated body can't be JSON.parsed, so the summary silently
      // disappears and the toast falls back to "<label> complete". Say so in
      // the console rather than leaving it looking like a missing summarizer.
      if (res.truncated) {
        console.debug(`[CronToolbar] ${cron} body was truncated — no summary available.`);
      }
      // Success-only callback — see Props.onTriggered jsdoc. A failed cron run
      // already surfaced via the toast.error branch; the host page doesn't need
      // to invalidate queries for a no-op or error.
      onTriggered?.(res);
    } else {
      // Keep the failure toast friendly too — the HTTP status + body are dev
      // detail, not something to surface verbatim. Log them instead.
      console.error(`[CronToolbar] ${cron} failed: HTTP ${res.status}`, res.body);
      toast.error(`${label} didn't complete`, {
        description: "Please try again in a moment.",
      });
    }
  }

  async function trigger(cron: string) {
    if (inFlightCrons.has(cron)) return;
    const meta = getCronMetadata(cron);
    // Ask BEFORE firing anything whose effects leave our database. Dev is a
    // separate tenant but has real stores on it, and these send real email /
    // hit a real tax portal — a one-click toolbar is the wrong shape for that.
    const needsConfirm = requiresConfirmation?.includes(cron) ?? false;
    const internalOnly = requiresInternalUser?.includes(cron) ?? false;
    if (needsConfirm && !window.confirm(confirmText(cron, meta, internalOnly))) {
      return;
    }
    inFlightCrons.add(cron);
    startRunning(cron);
    try {
      // The api requires the cron's own name as the confirmation token, so a
      // generic `{confirm:true}` is deliberately not enough.
      const res = await api.post<DevCronResult>(
        `/v1/dev/cron/${cron}`,
        needsConfirm ? { confirm: cron } : {},
      );
      handleResult(cron, meta.label, res);
    } catch (err) {
      console.error(`[CronToolbar] ${cron} request failed:`, err);
      // "Try again in a moment" is right for a flake and actively misleading
      // for a refusal that will never succeed on retry. These two codes are the
      // api telling us something actionable, so say it.
      const code = err instanceof ApiError ? err.code : null;
      if (code === "CONFIRMATION_REQUIRED" && !needsConfirm) {
        // Reachable when the api knows a cron is dangerous and this build
        // doesn't — an api deployed ahead of b2c, which is the normal order.
        // Telling the user to "run it from the Crons page" was the one thing
        // that could never help: /cms/crons is the only surface that passes
        // `requiresConfirmation`, so it is exactly where they already are.
        // Ask properly and retry once instead.
        if (window.confirm(confirmText(cron, meta, requiresInternalUser?.includes(cron) ?? false))) {
          try {
            const retry = await api.post<DevCronResult>(`/v1/dev/cron/${cron}`, { confirm: cron });
            handleResult(cron, meta.label, retry);
          } catch (retryErr) {
            console.error(`[CronToolbar] ${cron} retry failed:`, retryErr);
            toast.error(`${meta.label} couldn't run`, {
              description: "Please try again in a moment.",
            });
          }
        }
      } else if (code === "INTERNAL_ONLY") {
        // ★THE ONE REFUSAL A RETRY CANNOT FIX, and it arrives AFTER the user
        // has clicked through an irreversible-erasure confirmation. "Please try
        // again in a moment" is the worst possible thing to say there: it is
        // false, and it invites the click again.
        toast.error(`${meta.label} is staff-only`, {
          description: "Your account can't fire this cron. Nothing ran.",
        });
      } else if (code === "DEV_ONLY") {
        toast.error("Cron triggers are disabled here", {
          description: "This environment is treated as production.",
        });
      } else {
        toast.error(`${meta.label} couldn't run`, {
          description: "Please try again in a moment.",
        });
      }
    } finally {
      inFlightCrons.delete(cron);
      stopRunning(cron);
    }
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs"
        aria-label="Developer cron triggers (preview + local dev only)"
      >
        <span className="flex items-center gap-1 font-medium text-muted-foreground">
          <Zap className="size-3" />
          <span>Cron triggers</span>
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          dev only
        </span>
        <div className="flex flex-wrap gap-1">
          {crons.map((cron) => {
            const meta = getCronMetadata(cron);
            const running = runningCrons.has(cron);
            // Only disable the in-flight cron's button. Independent crons
            // can fire in parallel — strategist surfaces 5 of them and
            // serializing here would force a ~minute of waiting to
            // exercise the whole row.
            const disabled = running;
            // Marked from the API's own list rather than a hardcoded set here.
            // Baking the marker into the label would recreate the drift this
            // whole change exists to remove: the api would add a sixth
            // dangerous cron and b2c would render it unmarked.
            const guarded = requiresConfirmation?.includes(cron) ?? false;
            // ★THE API SAYS WHICH DANGER, and the two are opposite: outside our
            // database, or irreversibly inside it. One fixed sentence for both
            // was pointing the wrong way at the only cron that erases tenants.
            const internalOnly = requiresInternalUser?.includes(cron) ?? false;
            return (
              <Tooltip key={cron}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => trigger(cron)}
                    disabled={disabled}
                    aria-busy={running}
                  >
                    {running
                      ? "Running…"
                      : guarded || internalOnly
                        ? `⚠️ ${meta.label}`
                        : meta.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {meta.frequency}
                  </p>
                  <p className="text-xs mt-1">{meta.description}</p>
                  {/* Says what the ⚠️ MEANS. An unexplained emoji on a button
                      is a warning nobody can act on. */}
                  {/* ★`guarded || internalOnly`, NOT `guarded` ALONE. The api's two
                      sets are independent; a cron listed only in
                      `requiresInternalUser` rendered completely unmarked, which
                      is the drift the "derived from the api's own sets" claim
                      says cannot happen. */}
                  {guarded || internalOnly ? (
                    <p className="text-xs mt-1 font-medium">
                      {internalOnly
                        ? "⚠️ Erases data inside Peakhour, irreversibly, across every tenant on this environment. Staff only."
                        : "⚠️ Reaches outside Peakhour — asks before running."}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    cron: {cron}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
