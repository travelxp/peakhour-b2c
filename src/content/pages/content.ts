import type { HubContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";
import { liveItem, soonItem } from "./hub-helpers";

/** /content. Every card is built from an approved claim in src/lib/seo/capabilities.ts (see hub-helpers). */
export const CONTENT: HubContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Content", href: pathFor("content") },
  ],
  eyebrow: "Content",
  directAnswer:
    "Peakhour Content learns how your brand writes from your existing posts, then drafts social posts, newsletters and Shopify blog articles in that voice. You approve each one, and it posts at the time you scheduled.",
  items: [
    liveItem("content.brand_voice.learns_your_voice", "web", "Brand voice", 0),
    liveItem("content.social_publishing.four_networks", "web", "Social posts", 0),
    liveItem("content.beehiiv_newsletter.draft_to_beehiiv", "web", "Newsletters on Beehiiv", 0),
    liveItem("content.ai_blog_writer.draft_then_publish", "shopify", "Blog articles for Shopify", 0),
    liveItem("content.ai_product_descriptions.write_missing", "shopify", "Product descriptions", 0),
    liveItem("content.ai_seo_fixes.tick_and_undo", "shopify", "SEO fixes for product pages", 0),
    soonItem("content.ai_blog_writer", "wordpress", "Publishing to WordPress", "Drafting and publishing blog articles straight into WordPress is built and not switched on yet."),
    soonItem("content.seo_content_optimization", "wordpress", "SEO suggestions in WordPress", "Per-post SEO suggestions, with internal links you insert yourself, are built and not switched on yet."),
  ],
  platforms: [],
  control: [
    "Nothing posts without an approved plan.",
    "Shopify blog articles land as hidden drafts unless you choose to publish.",
    "Product descriptions and SEO fixes are written only after you approve them, and each can be undone.",
    "Newsletters go to Beehiiv as drafts, and you click Send in Beehiiv.",
  ],
  comingSoonNote: "The WordPress plugin is built, and its release is on hold until it is ready for everyone.",
  faqs: [
    {
      q: "Which networks can it post to?",
      a: "LinkedIn (personal and company pages), X including threads, Facebook Pages and Instagram. Instagram posts need an image or a carousel of 2 to 10 images; there is no video, reels or text-only posting. Threads is not available.",
    },
    {
      q: "Can it write for WordPress?",
      a: "Not yet. The WordPress plugin is built, but it is not released, so articles go to your Shopify blog today.",
    },
    {
      q: "Which newsletter tools work?",
      a: "Beehiiv. Substack, Kit, Mailchimp and Ghost are not available.",
    },
    {
      q: "Can it invent a brand voice?",
      a: "No. A voice is learned from your real posts, and one cannot be created from nothing.",
    },
  ],
  related: [
    { label: "Growth", href: pathFor("growth"), note: "Put ad budget behind the posts that work." },
    { label: "Commerce", href: pathFor("commerce"), note: "Product answers and shelves for your store." },
    { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "Blog articles, descriptions and SEO fixes inside Shopify." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "How one layer connects your content to the rest." },
  ],
  closing: {
    headline: "Stop starting from a blank page.",
    body: "Draft in your own voice, approve in a tap, and post on your schedule.",
  },
};
