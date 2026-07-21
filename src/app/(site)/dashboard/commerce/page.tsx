import type { Metadata } from "next";
import { CommandCenter } from "@/components/commerce/command-center";

export const metadata: Metadata = {
  title: "Command Center · Commerce",
};

/**
 * Commerce → Command Center (Phase 0). The outcome home of the Commerce pillar:
 * honest, catalog+inventory-grounded outcomes with order-derived metrics shown
 * as "Switching on" until order access lands. Gated on `commerce.command_center`
 * inside the component (FeatureGate).
 */
export default function CommerceCommandCenterPage() {
  return <CommandCenter />;
}
