import { GrowthSubTabs } from "@/components/growth-v2/growth-sub-tabs";
import { RULES_TABS } from "@/lib/growth-v2-nav";

/** Rules, with Audiences and Your Business as tabs beside it. */
export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <GrowthSubTabs tabs={RULES_TABS} label="Rules" />
      {children}
    </div>
  );
}
