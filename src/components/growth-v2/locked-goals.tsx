"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { DraftLockedGoal } from "@/lib/api/growth-v2";
import { distinctNeeds, needHref, needIsExternal } from "@/lib/growth-v2-locked";

/**
 * Goals Peakhour cannot measure for this business yet (FR). Dimmed cards after the offered ones, each with the first thing that would
 * unlock it and a link. ★NOT BUTTONS: a locked goal is never a choice (the api refuses it as it always has), so a card is a `div` with no
 * pressed state and nothing to click but its own link.
 */

function NeedLink({ need }: { need: DraftLockedGoal["needs"][number] }) {
  const href = needHref(need);
  const external = needIsExternal(need);
  return external ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
      How to
    </a>
  ) : (
    <Link href={href} className="underline underline-offset-2">
      Fix this
    </Link>
  );
}

export function LockedGoalCards({ locked }: { locked: readonly DraftLockedGoal[] }) {
  // an older api answers without `locked`, and a goal with no needs has nothing to say
  const shown = (locked ?? []).filter((l) => l.needs?.length > 0);
  if (shown.length === 0) return null;
  return (
    <div className="grid gap-2" data-testid="locked-goals">
      <p className="text-xs text-muted-foreground">Not available yet. Connect what each one needs and it will appear above.</p>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {shown.map((l) => {
          const first = l.needs[0]!; // filtered above
          return (
            <li key={l.kind}>
              <div role="group" aria-label={`${l.label}, not available yet`} aria-disabled="true" className="grid gap-1 rounded-xl border border-dashed bg-muted/30 p-3 text-left opacity-70" data-locked-kind={l.kind}>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Lock aria-hidden className="size-3.5" />
                  {l.label}
                </span>
                <span className="text-xs text-muted-foreground">{first.sentence}</span>
                <span className="text-xs">
                  <NeedLink need={first} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The zero-offer message: it names what each missing goal needs, once each, each with its link. */
export function NothingMeasurable({ locked, subject = "this business" }: { locked: readonly DraftLockedGoal[]; subject?: string }) {
  const needs = distinctNeeds((locked ?? []).filter((l) => l.needs?.length > 0));
  if (needs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing can be measured for {subject} yet. Connect your shop, your inbox or your analytics in{" "}
        <Link href="/dashboard/integrations" className="underline underline-offset-2">Connected accounts</Link>, then come back.
      </p>
    );
  }
  return (
    <div className="grid gap-2 text-sm text-muted-foreground">
      <p>Nothing can be measured for {subject} yet. Here is what each goal needs, then come back.</p>
      <ul className="grid gap-1.5">
        {needs.map((n) => (
          <li key={n.need} className="flex flex-wrap items-baseline gap-x-2">
            <span>{n.sentence}</span>
            <NeedLink need={n} />
          </li>
        ))}
      </ul>
    </div>
  );
}
