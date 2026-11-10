import { RulesScreen } from "@/components/growth-v2/rules-screen";
import { PageIntro } from "@/components/dashboard/page-intro";

export default function GrowthRulesPage() {
  return (
    <div className="grid gap-4">
      <PageIntro id="growth-rules" />
      <RulesScreen />
    </div>
  );
}
