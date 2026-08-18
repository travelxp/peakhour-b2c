import type { Metadata } from "next";
import { PresenceHome } from "@/components/presence/presence-home";

export const metadata: Metadata = {
  title: "Presence",
};

/**
 * Presence pillar home. Gated on `presence.nav` inside the component
 * (FeatureGate). Surfaces render coming_soon until the Google Business Profile
 * connector flips live (post-approval); see peakhour-mongodb
 * docs/google-business-profile-setup.md.
 */
export default function PresencePage() {
  return <PresenceHome />;
}
