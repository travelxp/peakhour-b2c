import { GrowthSubTabs } from "@/components/growth-v2/growth-sub-tabs";
import { LEARNING_TABS } from "@/lib/growth-v2-nav";

/** Learning, with Ad creatives and Signals as tabs beside it. */
export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <GrowthSubTabs tabs={LEARNING_TABS} label="Learning" />
      {children}
    </div>
  );
}
