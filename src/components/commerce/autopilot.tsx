"use client";

import { FeatureGate } from "@/components/upgrade/feature-gate";
import { CommerceNeedsYou } from "@/components/commerce/needs-you-rail";
import { AutonomyBoard } from "@/components/commerce/autonomy-board";

/**
 * Commerce → Autopilot (Phase 0). The engine's cockpit: the approvals queue
 * (what needs your go-ahead) and — in P0.8b — the autonomy board (the consent
 * dial per agent × channel).
 *
 * P0.8a ships the page shell + the approvals section, reusing the same
 * CommerceNeedsYou rail as the Command Center (single source of the pending-
 * proposal list). Gated on `commerce.autopilot`.
 */
export function CommerceAutopilot() {
  return (
    <FeatureGate feature="commerce.autopilot" featureName="Commerce Autopilot">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Autopilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve what the engine proposes and set how much it can do on its
            own — channel by channel, at a pace you&apos;re comfortable with.
          </p>
        </header>

        <section aria-labelledby="approvals-heading">
          <h2 id="approvals-heading" className="mb-2 text-sm font-medium text-muted-foreground">
            Approvals
          </h2>
          <CommerceNeedsYou />
        </section>

        <section aria-labelledby="autonomy-heading" className="mt-8">
          <h2 id="autonomy-heading" className="sr-only">
            Autonomy
          </h2>
          <AutonomyBoard />
        </section>
      </div>
    </FeatureGate>
  );
}
