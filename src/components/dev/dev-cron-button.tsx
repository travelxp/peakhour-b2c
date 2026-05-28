"use client";

/**
 * <DevCronButton> — dev-only button that manually fires a cron handler.
 *
 * Vercel Cron only runs on production deployments, so previews + local
 * dev have no way to exercise the cron paths. The button drops on
 * dashboard pages whose data depends on a cron (beehiiv tag-catchup,
 * jobs-runner, etc.) so the operator can trigger it inline.
 *
 * Visibility:
 *   - Renders nothing when NEXT_PUBLIC_VERCEL_ENV === "production".
 *     This is a UX-only gate — the api endpoint server-side-blocks
 *     production regardless, so even with the env var spoofed nothing
 *     fires.
 *   - On preview + local dev, renders a small ghost button with a
 *     Zap icon. Clicking calls POST /v1/dev/cron/:name and toasts the
 *     result (status + duration + first 200 chars of body).
 *
 * Usage:
 *   <DevCronButton cron="tag-catchup" label="Run tag-catchup now" />
 *
 * Pair with the page state the cron mutates — e.g. on the beehiiv
 * content page, the buttons for tag-catchup + beehiiv-sync + jobs-runner
 * sit in the header so the operator can re-fetch + re-tag without
 * leaving the page.
 */
import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface DevCronResult {
  cron: string;
  status: number;
  ok: boolean;
  durationMs: number;
  body: string;
  truncated: boolean;
}

interface Props {
  /** Cron name from /v1/dev/cron list (e.g. "tag-catchup"). */
  cron: string;
  /** Button label. Defaults to "Run {cron} now". */
  label?: string;
  /** Optional callback invoked AFTER a successful trigger. Pages use
   *  this to refetch queries whose data the cron just mutated. */
  onTriggered?: (result: DevCronResult) => void;
  /** Hide entirely (in addition to the env gate). Useful if a page wants
   *  to suppress the button under a flag that's not env-based. */
  hidden?: boolean;
}

/** True on production deployments. Read via NEXT_PUBLIC_* so it inlines
 *  at build time. The api endpoint enforces the real gate server-side. */
function isProductionEnv(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}

export function DevCronButton({ cron, label, onTriggered, hidden }: Props) {
  const [running, setRunning] = useState(false);

  if (isProductionEnv() || hidden) return null;

  async function trigger() {
    if (running) return;
    setRunning(true);
    try {
      const res = await api.post<DevCronResult>(`/v1/dev/cron/${cron}`, {});
      if (res.ok) {
        toast.success(`Cron ${cron}: ${res.status} in ${res.durationMs}ms`, {
          description: res.body
            ? `${res.body.slice(0, 200)}${res.truncated ? "…" : ""}`
            : "(empty response)",
        });
      } else {
        toast.error(`Cron ${cron} failed: HTTP ${res.status}`, {
          description: res.body?.slice(0, 200) ?? "no body",
        });
      }
      onTriggered?.(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Cron ${cron} request failed`, { description: msg });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 text-xs text-muted-foreground"
      onClick={(e) => {
        e.stopPropagation();
        trigger();
      }}
      disabled={running}
      title={`Dev-only — manually fire the ${cron} cron handler. Not available on production.`}
    >
      <Zap className="mr-1 size-3" />
      {running ? "Running…" : (label ?? `Run ${cron} now`)}
    </Button>
  );
}
