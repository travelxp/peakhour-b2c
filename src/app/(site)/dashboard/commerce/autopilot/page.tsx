import type { Metadata } from "next";
import { CommerceAutopilot } from "@/components/commerce/autopilot";

export const metadata: Metadata = {
  title: "Autopilot · Commerce",
};

/**
 * Commerce → Autopilot. The engine's cockpit — approvals queue + (P0.8b) the
 * autonomy consent dial. Gated on `commerce.autopilot` inside the component.
 */
export default function CommerceAutopilotPage() {
  return <CommerceAutopilot />;
}
