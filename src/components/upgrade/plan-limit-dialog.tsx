"use client";

import Link from "next/link";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * PlanLimitDialog — what the user sees when they reach for something their plan
 * sizes rather than something it omits.
 *
 * ★A DIFFERENT SURFACE FROM UpgradeDrawer, AND THE DIFFERENCE IS THE ASK.
 * UpgradeDrawer answers "this feature is not in your plan" with a waitlist
 * signup — the right shape for a pillar that is not sold yet. These limits are
 * not that: a second Business and a second LinkedIn Page are both purchasable
 * today, as quantity on an existing subscription. Sending someone who wants to
 * buy one to a waiting list is the wrong answer to a question they already know
 * the answer to, so this points at Billing instead.
 *
 * ★IT ALSO NAMES THE THING. "You've reached your plan's limit" makes the user
 * work out which limit and what they just lost; "Quests Travel is not on your
 * plan" does not. Callers pass the specific noun.
 */
export function PlanLimitDialog({
  open,
  onOpenChange,
  title,
  description,
  /** What buying more actually gets them, in the user's terms. */
  benefit,
  /** Where the purchase happens. Defaults to Billing. */
  href = "/dashboard/settings/billing",
  ctaLabel = "See plans and add-ons",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  benefit?: string;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-soft dark:bg-brand/15">
            <Lock className="size-5 text-brand-label" aria-hidden />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {benefit && (
          <p className="flex items-start gap-2 rounded-xl border bg-muted/40 px-3.5 py-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-label" aria-hidden />
            <span className="text-muted-foreground">{benefit}</span>
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            {/* Closing on click matters: the dialog is rendered by the sidebar,
                which does NOT unmount on navigation, so without this it would
                still be open over the Billing page it just sent the user to. */}
            <Link href={href} onClick={() => onOpenChange(false)}>
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
