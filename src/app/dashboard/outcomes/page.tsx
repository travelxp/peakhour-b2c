import { TrendingUp } from "lucide-react";

import { EmptyState } from "@/components/molecules/empty-state";

export default function OutcomesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Outcomes</h2>
        <p className="text-muted-foreground">
          Track real business results, not vanity metrics
        </p>
      </div>

      <EmptyState
        icon={TrendingUp}
        title="Coming Soon"
        description={'No more confusing dashboards with CTR and ROAS. We\'ll show you "23 new customers this week at $12 each" \u2014 numbers that make sense.'}
      />
    </div>
  );
}
