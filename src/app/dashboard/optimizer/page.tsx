import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/molecules/empty-state";

export default function OptimizerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Optimizer</h2>
        <p className="text-muted-foreground">
          The AI continuously improves your marketing performance
        </p>
      </div>

      <EmptyState
        icon={Sparkles}
        title="Coming Soon"
        description="Think of it as a marketing team member who never sleeps — always testing, learning, and optimizing to get you more customers for less money."
      />
    </div>
  );
}
