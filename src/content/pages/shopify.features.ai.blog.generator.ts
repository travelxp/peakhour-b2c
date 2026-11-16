import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { getPage } from "@/lib/seo/pages";
import { isLinkable } from "@/lib/seo/publish";
import { ADD_STORE_CLOSING, capabilityFacts, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.ai.blog.generator";

export const CLAIMS: PageClaims = ["content.ai_blog_writer.draft_then_publish", "content.brand_voice.learns_your_voice"];

const blog = capabilityFacts("content.ai_blog_writer");
const voice = capabilityFacts("content.brand_voice");

/** The global Brand voice page is the voice's own page; on Shopify there is no separate voice page (it would repeat it). */
const voiceLink = isLinkable(getPage("features.brand.voice"))
  ? [{ label: "Brand voice, on every channel", href: "/features/brand-voice", note: "How Peakhour learns your voice, and what it keeps adjusting from." }]
  : [];

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("AI blog writer", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour drafts blog articles for your Shopify store. After you approve one, it publishes the article to your Shopify blog as a hidden draft, unless you choose to publish it.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  status: blog.status,
  limitations: blog.limitations,
  verifiedAt: blog.verifiedAt,
  sections: [
    {
      id: "idea-to-article",
      eyebrow: "From idea to article",
      title: "A steady blog, without a blank page.",
      paragraphs: ["Peakhour suggests blog topics and writes the article for you to read, edit and approve. Nothing reaches your blog before you approve it."],
      items: [
        { title: "Ideas", body: "Pick a topic Peakhour suggests, or start from your own." },
        { title: "Your draft", body: "Read the article and edit anything you want to change." },
        { title: "Your Shopify blog", body: "After you approve it, the article goes to your Shopify blog as a hidden draft, unless you choose to publish it." },
      ],
    },
    {
      id: "your-voice",
      eyebrow: "In your voice",
      title: "It writes the way your brand writes.",
      paragraphs: [
        "Peakhour learns how your brand writes from your existing posts, per channel, uses that voice when drafting, and keeps adjusting from what you approve or reject.",
      ],
      limitations: voice.limitations.filter((l) => l.startsWith("On Shopify")),
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Pick an idea", body: "Open Content in the Peakhour app and choose a blog idea." },
    { title: "Read and edit the draft", body: "Edit the article until it says what you want, then approve it." },
    { title: "Publish from Shopify", body: "The article lands in your Shopify blog (News by default) as a hidden draft. Publish it there when you are ready, or choose to publish it from Peakhour." },
  ],
  permissions: [
    { name: "read_content", why: "To read your blogs, so Peakhour can find the one to publish to." },
    {
      name: "write_online_store_pages",
      why: "To create the article in your blog. Shopify accepts this or write_content for writing articles, and Peakhour asks for this one.",
    },
  ],
  globalPage: { label: "Peakhour Content", href: "/content" },
  faqs: [
    {
      q: "Will Peakhour publish an article without asking?",
      a: "No. An article goes to your blog only after you approve it, and it arrives as a hidden draft unless you choose to publish.",
    },
    {
      q: "Which blog does it publish to?",
      a: "One blog, News by default.",
    },
    {
      q: "Can I make a new voice for my store on Shopify?",
      a: "Not there. On Shopify you can edit the tone, phrases to avoid and sample lines of an existing voice, but not create one.",
    },
    {
      q: "Does it turn a blog post into social posts?",
      a: "Repurposing a blog post is off by default for most stores.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.ai.seo", "AI SEO for Shopify product pages", "Search text for the product pages the article links to."),
    ...siblingLink(ID, "shopify.features.seo.audit", "Shopify catalogue and SEO audit", "What to fix on your store, in order."),
    ...voiceLink,
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
