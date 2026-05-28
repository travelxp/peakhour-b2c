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
import { useRef, useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getCronMetadata } from "./cron-metadata";

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

export function CronToolbar({ crons, onTriggered }: Props) {
  // Hooks must run unconditionally; the production gate decides what to
  // render below, not whether to mount.
  const [runningCron, setRunningCron] = useState<string | null>(null);
  // Synchronous re-entry guard. `runningCron` (useState) is async — between
  // a click handler firing setRunningCron and React committing the new
  // disabled state to the DOM, a rapid double-click on the same button
  // can call `trigger()` twice. Triggering tag-catchup twice burns real
  // AI spend, so we belt-and-suspender with a ref check that's
  // race-free at the JS-event level.
  const runningRef = useRef<string | null>(null);

  if (isProductionEnv() || crons.length === 0) return null;

  async function trigger(cron: string) {
    if (runningRef.current) return;
    runningRef.current = cron;
    setRunningCron(cron);
    const meta = getCronMetadata(cron);
    try {
      const res = await api.post<DevCronResult>(`/v1/dev/cron/${cron}`, {});
      if (res.ok) {
        toast.success(`${meta.label}: done in ${res.durationMs}ms`, {
          description: res.body
            ? `${res.body.slice(0, 200)}${res.truncated ? "…" : ""}`
            : "(no output)",
        });
        // Success-only callback — see Props.onTriggered jsdoc. A failed
        // cron run already surfaced via the toast.error branch; the host
        // page doesn't need to invalidate queries for a no-op or error.
        onTriggered?.(res);
      } else {
        toast.error(`${meta.label} failed: HTTP ${res.status}`, {
          description: res.body?.slice(0, 200) ?? "no body",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${meta.label} request failed`, { description: msg });
    } finally {
      runningRef.current = null;
      setRunningCron(null);
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
            const running = runningCron === cron;
            const disabled = runningCron !== null;
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
                  >
                    {running ? "Running…" : meta.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {meta.frequency}
                  </p>
                  <p className="text-xs mt-1">{meta.description}</p>
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
