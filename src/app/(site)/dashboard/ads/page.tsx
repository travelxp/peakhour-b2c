import { Megaphone } from "lucide-react";

import { EmptyState } from "@/components/molecules/empty-state";

export default function AdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ad Campaigns</h2>
        <p className="text-muted-foreground">
          AI-generated ads reaching your ideal customers
        </p>
      </div>

      <EmptyState
        icon={Megaphone}
        title="Coming Soon"
        description="The AI will analyze your best content, generate ad creatives, and deploy them to your connected platforms — all automatically."
      />
    </div>
  );
}
