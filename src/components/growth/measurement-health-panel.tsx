"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { growthApi, type HealthCheck } from "@/lib/api/growth";
import {
  fixFor,
  hasSomethingToSay,
  orderedChecks,
  passedLine,
  periodLine,
} from "@/lib/measurement-health";

/**
 * Can the numbers be believed? — shown where a merchant just connected.
 *
 * ★★IT CATCHES BAD MEASUREMENT BEFORE WE BUILD ADVICE ON IT. Every other growth
 * surface answers "what happened"; this one says whether the instruments that
 * produced those answers are pointed at the right thing. A property attributing
 * half its traffic to nothing, or two properties watching different websites,
 * makes every figure in the product confident and wrong — and every screen
 * still renders, which is why it has to be said out loud on the page a merchant
 * lands on after connecting.
 *
 * ★★AND IT NEVER RE-DECIDES A VERDICT. `ok`, `attention` and `unmeasurable` are
 * settled in the api so this app and the Shopify app cannot disagree. What is
 * added here is the fix: which product to open, and the two or three steps.
 *
 * ⏸IT FAILS SILENT. A panel that cannot load is not a finding about the
 * merchant's setup, and an error banner over the integrations page — where
 * somebody has just finished connecting something — reads as though the connect
 * failed. There is a page-level story for a broken API elsewhere; this is a
 * qualifier on other numbers, and a qualifier that cannot load says nothing.
 */

const STATE_STYLE: Record<
  string,
  { icon: typeof AlertTriangle; dot: string; tone: string; label: string }
> = {
  attention: {
    icon: AlertTriangle,
    dot: "bg-warning",
    tone: "text-warning",
    label: "Needs a look",
  },
  // ★★`unmeasurable` HAS ITS OWN GLYPH, NOT A GREEN ONE AND NOT A RED ONE.
  // Drawn as a pass it tells a business whose analytics we cannot read that
  // their analytics is healthy — the more expensive of the two mistakes,
  // because nobody goes looking for it. Drawn as a fault it invents one.
  unmeasurable: {
    icon: HelpCircle,
    dot: "bg-muted-foreground",
    tone: "text-muted-foreground",
    label: "Couldn't check",
  },
  ok: { icon: CheckCircle2, dot: "bg-success", tone: "text-success", label: "Fine" },
};

/** ⚠️THE FALLBACK IS THE UNCERTAIN ONE, not the green one. A state this build
 *  has never heard of is a state we cannot vouch for, and the icon that says so
 *  is the honest default. */
const UNKNOWN_STATE = STATE_STYLE.unmeasurable;

function CheckRow({ check }: { check: HealthCheck }) {
  const style = STATE_STYLE[check.state] ?? UNKNOWN_STATE;
  const Icon = style.icon;
  const fix = fixFor(check);

  return (
    <div className="flex gap-3 py-3">
      <Icon className={`mt-0.5 size-4 shrink-0 ${style.tone}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">
          <span className="sr-only">{style.label}: </span>
          {check.headline}
        </p>
        <p className="text-sm text-muted-foreground">{check.detail}</p>
        {/* ★★THE FIX APPEARS ONLY UNDER SOMETHING BROKEN, and `fixFor` is where
            that is decided. Steps under a green check are noise; steps under
            "we couldn't read your analytics" are worse, because the repair for
            that is usually the Reconnect button on this very page, and a link
            to Google sends somebody away from it. */}
        {fix && (
          <div className="mt-2 rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-medium">Fix it in {fix.where}</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              {fix.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <a
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              href={fix.link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {fix.link.label}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function MeasurementHealthPanel() {
  const { business } = useAuth();

  const health = useQuery({
    // Business in the key for the same reason every other business-scoped hook
    // pins it: the route is business-scoped server-side, and a key that does not
    // say which business is one cache clear away from showing another's.
    queryKey: ["measurement-health", business?._id ?? "none"],
    queryFn: () => growthApi.measurementHealth(),
    // ⏸LONGER THAN THE OTHER GROWTH QUERIES. Three live Google calls sit behind
    // this, and a measurement fault is a thing that takes days to appear and
    // days to fix — not a figure worth refetching on every navigation.
    staleTime: 30 * 60_000,
  });

  if (health.isLoading) {
    return <Skeleton className="h-28 w-full rounded-lg" />;
  }
  // ★NOTHING ON ERROR. See the file header: a qualifier that cannot load says
  // nothing, and a red banner here reads as a failed connection.
  if (health.isError || !health.data) return null;

  const data = health.data;
  // ★★A BUSINESS WITH NOTHING CONNECTED GETS NOTHING. Every check comes back
  // `unmeasurable`, and "we couldn't check your measurement setup" directly
  // above cards that already say "not connected" is an alarm about the state
  // this page exists to fix.
  if (!hasSomethingToSay(data)) return null;

  const checks = orderedChecks(data.checks);
  const passed = passedLine(data);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">{data.summary.headline}</h2>
          <p className="text-xs text-muted-foreground">{periodLine(data)}</p>
        </div>
        {passed && <p className="mt-1 text-sm text-muted-foreground">{passed}</p>}
        <div className="mt-2 divide-y">
          {checks.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
