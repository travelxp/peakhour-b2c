import type { Metadata } from "next";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { ReviewPoster } from "@/components/presence/review-poster";

export const metadata: Metadata = {
  title: "Review poster",
};

/** The printable A4 review poster. Gated on `presence.nav` like the rest of Presence. */
export default function ReviewPosterPage() {
  return (
    <FeatureGate feature="presence.nav" featureName="Presence" mode="hide">
      <ReviewPoster />
    </FeatureGate>
  );
}
