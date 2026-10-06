import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Content — AI writers in your voice | Peakhour.ai",
  description:
    "AI writers that publish in your brand voice — blogs, newsletters, socials — from your news desk to every channel. Included in Peakhour Suite — start with a free trial, no credit card.",
  path: "/content",
});

export default function ContentPillar() {
  return <PillarPage slug="content" />;
}
