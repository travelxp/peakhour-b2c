import type { Metadata } from "next";
import { CommerceAutopilot } from "@/components/commerce/autopilot";
import { PageIntro } from "@/components/dashboard/page-intro";

export const metadata: Metadata = {
  title: "Auto-merchandising · Commerce",
};

/**
 * Commerce → Autopilot. The engine's cockpit — approvals queue + (P0.8b) the
 * autonomy consent dial. Gated on `commerce.autopilot` inside the component.
 */
export default function CommerceAutopilotPage() {
  return (
    <div className="space-y-4">
      <PageIntro id="commerce-autopilot" />
      <CommerceAutopilot />
    </div>
  );
}
