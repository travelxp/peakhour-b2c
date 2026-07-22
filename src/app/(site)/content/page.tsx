import type { Metadata } from "next";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata: Metadata = {
  title: "Content — AI writers in your voice | Peakhour.ai",
  description:
    "AI writers that publish in your brand voice — blogs, newsletters, socials — from your news desk to every channel. Free plan included — no credit card.",
};

export default function ContentPillar() {
  return <PillarPage slug="content" />;
}
