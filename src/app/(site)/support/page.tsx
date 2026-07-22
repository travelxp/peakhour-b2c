import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Support — one AI inbox for every channel | Peakhour.ai",
  description:
    "WhatsApp, Instagram, email — one inbox. AI answers the routine and hands you what needs a human, with full context. Free plan included — no credit card.",
  path: "/support",
});

export default function SupportPillar() {
  return <PillarPage slug="support" />;
}
