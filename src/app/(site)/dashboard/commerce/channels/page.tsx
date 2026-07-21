import type { Metadata } from "next";
import { CommerceChannels } from "@/components/commerce/channels";

export const metadata: Metadata = {
  title: "Channels · Commerce",
};

/**
 * Commerce → Channels. The four channel archetypes (D2C live; Marketplace /
 * Quick Commerce / General Trade on the roadmap). Gated on `commerce.nav`.
 */
export default function CommerceChannelsPage() {
  return <CommerceChannels />;
}
