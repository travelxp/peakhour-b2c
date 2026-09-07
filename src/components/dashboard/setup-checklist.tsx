"use client";

import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Set up your AI engine" — the three things Peakhour needs before it can work
 * on its own, and which one is next.
 *
 * ── ★★THE BUG THIS REPLACES, WHICH WAS NOT COSMETIC
 *
 * Step one used to link to `/onboarding/add-business`. For an org that had
 * already completed onboarding — which is EVERY org that can see this banner —
 * that flow ends at `POST /onboarding/confirm`, which gates on the plan's
 * Business capacity and answers `402 BUSINESS_LIMIT_REACHED`. So the dashboard
 * invited the owner to finish setting up their business, and the product
 * replied that they had to upgrade to add another one. Nothing was wrong with
 * their plan and nothing needed buying: the banner was pointing at "create a
 * NEW business" while its own label said "tell us about YOURS".
 *
 * ★The fix is the destination, not the copy. Step one now opens
 * `/dashboard/growth/business` — the surface that reads and CORRECTS the
 * profile for the business already in the session. That is the screen that
 * actually sets `valueProposition` and the taxonomy this step is measuring, so
 * following the step now changes the thing the step is checking.
 *
 * ── ★★AND IT REMEMBERS
 *
 * `nextIndex` is the FIRST incomplete step, not step one. An owner who
 * connected a channel last week and came back to finish should be taken to
 * what is left, not marched through what they already did. Every step also
 * stays clickable — the list is a map, not a wizard — because "Peakhour should
 * remember previously entered business information" also means not blocking the
 * way back to it.
 *
 * ── ★★AND IT LEAVES
 *
 * `allDone` returns null. The parent already hides on the persisted
 * `onboarding.completed` flag, but that flag goes stale: businesses that
 * finished before it existed, or whose onboarding cron hiccuped, carry it as
 * false forever. Without this guard those accounts keep a permanent "3 of 3
 * steps complete" bar with no CTA, which is pure furniture on the one screen
 * that should be about their business.
 */

export interface SetupStep {
  /** The label, phrased as the thing the owner does. */
  label: string;
  /** One line saying what it unlocks — the "what are these steps" answer. */
  detail: string;
  done: boolean;
  href: string;
}

export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);

  if (nextIndex === -1) return null;

  const next = steps[nextIndex];

  return (
    <Card className="overflow-hidden border-0 bg-linear-to-r from-brand/10 via-brand/4 to-transparent">
      <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15">
            <Sparkles className="size-5 text-brand-label" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <div>
              <p className="text-sm font-semibold">Set up your AI engine</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {doneCount} of {steps.length} done — these three are what Peakhour needs before it
                can work on its own.
              </p>
            </div>

            {/* ★NAMED STEPS, NOT DOTS. The bar used to show three anonymous
                bars and a count, so "1 of 3 complete" told the owner they were
                behind on something without saying what. Three short rows cost
                one line each and answer it outright. */}
            <ol className="space-y-1">
              {steps.map((step, i) => (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    className="group -mx-1 flex items-start gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-background/60"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        step.done
                          ? "border-transparent bg-success text-success-foreground"
                          : i === nextIndex
                            ? "border-brand-label text-brand-label"
                            : "border-muted-foreground/40 text-muted-foreground",
                      )}
                    >
                      {step.done ? <Check className="size-2.5" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          step.done ? "text-muted-foreground line-through" : "text-foreground",
                        )}
                      >
                        {step.label}
                      </span>
                      {!step.done && (
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          {step.detail}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <Button asChild size="sm" className="shrink-0 gap-1.5 self-start lg:self-center">
          <Link href={next.href}>
            {next.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
