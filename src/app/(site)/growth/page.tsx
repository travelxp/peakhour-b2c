import type { Metadata } from "next";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata: Metadata = {
  title: "Growth — ads & LinkedIn on autopilot | Peakhour.ai",
  description:
    "Campaigns drafted, leads captured, budgets optimized while you sleep. The Growth pillar runs acquisition for you. Free plan included — no credit card.",
};

export default function GrowthPillar() {
  return <PillarPage slug="growth" />;
}
