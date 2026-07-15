"use client";

import { Store } from "lucide-react";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { EmptyState } from "@/components/molecules/empty-state";
import { CommerceNeedsYou } from "@/components/commerce/needs-you-rail";
import { AutonomyBoard } from "@/components/commerce/autonomy-board";
import { useCommerceSummary } from "@/hooks/use-commerce-summary";

/**
 * Commerce → Autopilot (Phase 0). The engine's cockpit: the approvals queue
 * (what needs your go-ahead) and the autonomy board (the consent dial per
 * agent × channel). Reuses the same CommerceNeedsYou rail as the Command Center.
 * Gated on `commerce.autopilot`.
 */
export function CommerceAutopilot() {
  return (
    <FeatureGate feature="commerce.autopilot" featureName="Commerce Autopilot">
      <CommerceAutopilotBody />
    </FeatureGate>
  );
}

function CommerceAutopilotBody() {
  // commerce.autopilot is granted by plan, not by store connection — so a
  // pre-connect merchant can reach here. The summary query 4xxs when no store
  // is connected; use that as the connect signal (shared cache with Command
  // Center, so no extra fetch when navigating from there).
  const { isError: noStore } = useCommerceSummary();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Autopilot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve what the engine proposes and set how much it can do on its
          own — channel by channel, at a pace you&apos;re comfortable with.
        </p>
      </header>

      {noStore ? (
        <EmptyState
          icon={Store}
          title="Connect a store to get started"
          description="Autopilot lights up once a Shopify or WooCommerce store is connected to this business."
          action={{ label: "Connect a store", href: "/dashboard/integrations" }}
        />
      ) : (
        <>
          <section aria-labelledby="approvals-heading">
            <h2
              id="approvals-heading"
              className="mb-2 text-sm font-medium text-muted-foreground"
            >
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
        </>
      )}
    </div>
  );
}
