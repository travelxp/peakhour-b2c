"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { growthApi, type HealthCheck } from "@/lib/api/growth";
import {
  fixFor,
  hasSomethingToSay,
  orderedChecks,
  passedLine,
  periodLine,
  reconnectHref,
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

interface StateStyle {
  icon: typeof AlertTriangle;
  /** The icon's colour. There is no second colour: a dot beside the icon was
   *  the same fact twice, and every future state would have had to supply it. */
  tone: string;
  /** Read aloud before the headline, because the icon carries the state and a
   *  screen reader gets nothing from `aria-hidden`. */
  label: string;
}

/** ★★`unmeasurable` HAS ITS OWN GLYPH, NOT A GREEN ONE AND NOT A RED ONE. Drawn
 *  as a pass it tells a business whose analytics we cannot read that their
 *  analytics is healthy — the more expensive of the two mistakes, because
 *  nobody goes looking for it. Drawn as a fault it invents one. */
const UNKNOWN_STATE: StateStyle = {
  icon: HelpCircle,
  tone: "text-muted-foreground",
  label: "Couldn't check",
};

/** ⚠️A `Map`, for the reason `fixFor` records: an object literal keyed by a
 *  string off the wire answers `constructor` and `toString` from its prototype,
 *  so the `??` below would hand back a function instead of falling through. */
const STATE_STYLE: ReadonlyMap<string, StateStyle> = new Map<string, StateStyle>([
  ["attention", { icon: AlertTriangle, tone: "text-warning", label: "Needs a look" }],
  ["unmeasurable", UNKNOWN_STATE],
  ["ok", { icon: CheckCircle2, tone: "text-success", label: "Fine" }],
]);

function CheckRow({ check, manageHref }: { check: HealthCheck; manageHref: string | null }) {
  // ★THE FALLBACK IS THE UNCERTAIN ONE, not the green one. A state this build
  // has never heard of is a state we cannot vouch for, and the icon that says
  // so is the honest default.
  const style = STATE_STYLE.get(check.state) ?? UNKNOWN_STATE;
  const Icon = style.icon;
  const fix = fixFor(check);
  const reconnect = reconnectHref(check, manageHref);

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
            that is a connection rather than a setting in Google's admin. The
            link below is where that case goes instead. */}
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
        {/* ★★A CHECK WE COULD NOT RUN NEEDS SOMEWHERE TO GO, and only on a page
            that is not already the connections page. `reconnectHref` decides
            both halves; see its comment for why a "fix it in Google" link would
            be the wrong answer here. */}
        {reconnect && (
          <Link
            className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
            href={reconnect}
          >
            Check your connections
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * @param manageHref Where the connections live, when this panel is NOT standing
 *   on that page. Omitted on the integrations page, whose cards are the answer.
 */
export function MeasurementHealthPanel({ manageHref = null }: { manageHref?: string | null } = {}) {
  const { business } = useAuth();

  const health = useQuery({
    // Business in the key for the same reason every other business-scoped hook
    // pins it: the route is business-scoped server-side, and a key that does not
    // say which business is one cache clear away from showing another's.
    queryKey: ["measurement-health", business?._id ?? "none"],
    queryFn: () => growthApi.measurementHealth(),
    // ⚠️🚫★★NOT UNTIL THERE IS A BUSINESS TO ASK ABOUT. The dashboard shell
    // renders its children while the active business is still resolving, so
    // without this the query fires under the key `"none"`, 403s, and retries —
    // twice per page, on both pages, and a second time when the business
    // arrives. The route makes three live Google calls; it is the last one in
    // the product to enter speculatively.
    enabled: Boolean(business?._id),
    // ⏸LONGER THAN THE OTHER GROWTH QUERIES. Three live Google calls sit behind
    // this, and a measurement fault is a thing that takes days to appear and
    // days to fix — not a figure worth refetching on every navigation.
    staleTime: 30 * 60_000,
    // ⚠️AND `gcTime` HAS TO SAY SO TOO. It defaults to five minutes, so a
    // half-hour `staleTime` on its own buys nothing: leave the page for six
    // minutes, come back, and the entry has been collected — the three Google
    // calls run again on a cache that was documented as still warm.
    gcTime: 60 * 60_000,
  });

  // ⚠️🚫★★NO SKELETON, AND A FIRST VERSION HAD ONE. It sat ABOVE the two gates
  // below, so the panel that promises to render nothing for a business with
  // nothing connected instead rendered a placeholder for the length of three
  // live Google calls and then vanished, shifting the page under somebody who
  // had just finished connecting an account. A skeleton is a promise that
  // something is coming, and this panel cannot make that promise until it has
  // read the answer. It appears when it has something to say.
  //
  // ★NOTHING ON ERROR EITHER. See the file header: a qualifier that cannot load
  // says nothing, and a red banner here reads as a failed connection.
  if (health.isPending || health.isError || !health.data) return null;

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
            <CheckRow key={c.id} check={c} manageHref={manageHref} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
