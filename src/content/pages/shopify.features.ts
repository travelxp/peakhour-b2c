import type { DirectoryContent, DirectoryGroup, DirectoryItem } from "@/components/marketing/seo/content-types";
import { getPage } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import { SHOPIFY_GROUPS, type ShopifyFeature } from "@/lib/shopify-features";
import type { Surface } from "@/lib/seo/types";
import { capabilityFacts, firstSentence, PRICING_LINK, SHOPIFY_HOME_LINK } from "./shopify-feature-kit";

/*
 * The directory lists EVERY Shopify app feature, in the groups the /shopify page uses (SHOPIFY_GROUPS), so a merchant finds
 * the same feature under the same heading on both. Nothing here is invented: a card is either an entry of SHOPIFY_GROUPS
 * or a capability record that SHOPIFY_GROUPS does not name (Find my match, Frequently bought together, Peakhour Summit,
 * AI product descriptions), and its status chip is the record's, read at render.
 *
 * A card opens, in this order of preference: its own feature page (when that page is publishable, at `anchor` when the
 * feature is a section of it), a public page elsewhere on the site (`href`), or its place on /shopify (every SHOPIFY_GROUPS
 * entry has an anchor there). A feature whose record is not live or beta has no link: it is a card with a Coming soon chip. A shipped feature always has one.
 */

export type Source = {
  /** An id of SHOPIFY_GROUPS, or a card that SHOPIFY_GROUPS does not carry (then `title` and `body` are set). */
  id: string;
  title?: string;
  /** The card's sentence, when the first sentence of the feature's /shopify copy would say more than the record does. */
  body?: string;
  capabilityId?: string;
  surface?: Surface;
  pageId?: string;
  /** A section of the feature page: `#id` on its own page. */
  anchor?: string;
  /** A public page that is not a Shopify feature page. */
  href?: { pageId: string };
  /** For a card SHOPIFY_GROUPS does not carry: the SHOPIFY_GROUPS entry on /shopify it falls back to when its own page is not publishable. */
  fallbackId?: string;
};

const ASSISTANT = "commerce.ai_shopping_assistant";

const LAYOUT: { groupId: string; entries: Source[] }[] = [
  {
    groupId: "sell",
    entries: [
      { id: "storefront-assistant", capabilityId: ASSISTANT, pageId: "shopify.features.ai.shopping.assistant" },
      { id: "find-my-match", title: "Find my match", body: "Shoppers answer a few quick questions and get a shortlist from your own store.", capabilityId: "commerce.find_my_match", pageId: "shopify.features.product.finder", fallbackId: "storefront-assistant" },
      { id: "ask-your-assistant", capabilityId: ASSISTANT },
      { id: "knowledge", capabilityId: ASSISTANT },
      { id: "suggested-answers", capabilityId: ASSISTANT, body: "Drafts answers to what the assistant could not answer, for you to approve." },
      {
        id: "shopper-asks",
        capabilityId: "support.conversation_insights",
        pageId: "shopify.features.customer.conversation.insights",
        body: "What several shoppers asked that your assistant could not answer, and what to do next.",
      },
      { id: "added-to-cart", capabilityId: ASSISTANT },
      { id: "whatsapp-assistant", capabilityId: "commerce.whatsapp_shopping", surface: "whatsapp", pageId: "shopify.features.whatsapp.ai.shopping" },
      { id: "conversations", capabilityId: ASSISTANT },
    ],
  },
  {
    groupId: "shelves",
    entries: [
      { id: "smart-rails", capabilityId: "commerce.product_recommendations", pageId: "shopify.features.product.recommendations" },
      {
        id: "frequently-bought-together",
        title: "Frequently bought together",
        body: "Pairs worked out from your own orders every night, shown as a shelf on the product page.",
        capabilityId: "commerce.frequently_bought_together",
        pageId: "shopify.features.frequently.bought.together",
        fallbackId: "smart-rails",
      },
      { id: "shelf-results", capabilityId: "commerce.rail_ab_testing", pageId: "shopify.features.merchandising.ab.testing" },
      {
        id: "buy-together",
        capabilityId: "commerce.buy_together_bundles",
        pageId: "shopify.features.bundles",
        body: "A saving of 5 to 30 percent on a product's usual companions when they are bought together.",
      },
      {
        id: "cart-thank-you",
        capabilityId: "commerce.cart_upsells",
        pageId: "shopify.features.cart.upsells",
        body: "Complete your cart suggestions, and You may also like links on the thank-you page.",
      },
    ],
  },
  {
    groupId: "run",
    entries: [
      { id: "campaigns", capabilityId: "growth.ai_growth_campaigns", pageId: "shopify.features.ai.growth.campaigns" },
      { id: "inventory-supply", capabilityId: "commerce.inventory_alerts", pageId: "shopify.features.inventory.alerts" },
      { id: "markdowns", title: "Markdown suggestions", capabilityId: "commerce.automatic_markdowns", pageId: "shopify.features.automatic.markdowns" },
      {
        id: "cod-confirmation",
        capabilityId: "commerce.cod_confirmation",
        pageId: "shopify.features.whatsapp.cod.confirmation",
        body: "Asks the shopper on WhatsApp to confirm or cancel each cash-on-delivery order.",
      },
      {
        id: "peakhour-summit",
        title: "Peakhour Summit",
        body: "Reviews a growth decision before you approve it: the case for, the case against, safety checks and a final call.",
        capabilityId: "growth.peakhour_summit",
        href: { pageId: "feature.peakhour.summit" },
        fallbackId: "campaigns",
      },
    ],
  },
  {
    groupId: "catalogue",
    entries: [
      { id: "catalogue-health", capabilityId: "content.seo_audit", pageId: "shopify.features.seo.audit" },
      { id: "fix-with-ai", capabilityId: "content.ai_seo_fixes", pageId: "shopify.features.ai.seo" },
      {
        id: "ai-product-descriptions",
        title: "AI product descriptions",
        body: "Writes descriptions for products that have none or very thin ones. You review each draft.",
        capabilityId: "content.ai_product_descriptions",
        pageId: "shopify.features.ai.product.descriptions",
        fallbackId: "fix-with-ai",
      },
      { id: "product-page-card", capabilityId: "content.ai_seo_fixes" },
      { id: "writing-profile", capabilityId: "content.brand_voice", href: { pageId: "features.brand.voice" } },
      { id: "google-visibility", capabilityId: "integration.google_search_console", surface: "web" },
      { id: "ranking-tracking", capabilityId: "growth.ai_search_visibility" },
    ],
  },
  {
    groupId: "content",
    entries: [
      {
        id: "blog",
        capabilityId: "content.ai_blog_writer",
        pageId: "shopify.features.ai.blog.generator",
        body: "Drafts articles for you to approve, and sends them to your Shopify blog as a hidden draft.",
      },
      { id: "pages-to-fix", capabilityId: "content.ai_seo_fixes" },
      { id: "site-check", capabilityId: "content.seo_audit", pageId: "shopify.features.seo.audit", anchor: "checks" },
    ],
  },
  {
    groupId: "control",
    entries: [{ id: "autopilot" }, { id: "emergency-stop" }, { id: "results" }, { id: "benchmarks" }, { id: "several-stores" }, { id: "ai-credits" }],
  },
];

/**
 * Every capability the directory lists, once, with the surface it is shown on, the directory group it sits in and the
 * page that owns it (its Shopify feature page, else the public page it points at). The comparison pages' "Peakhour
 * Suite gives more" block reads this, so it lists exactly what this directory lists.
 */
export type DirectoryCapability = { capabilityId: string; surface: Surface; groupId: string; pageId?: string };
export const DIRECTORY_CAPABILITIES: readonly DirectoryCapability[] = (() => {
  const seen = new Map<string, DirectoryCapability>();
  for (const { groupId, entries } of LAYOUT) {
    for (const e of entries) {
      if (!e.capabilityId) continue;
      const ownPage = e.pageId ?? e.href?.pageId;
      const prior = seen.get(e.capabilityId);
      if (!prior) seen.set(e.capabilityId, { capabilityId: e.capabilityId, surface: e.surface ?? "shopify", groupId, ...(ownPage ? { pageId: ownPage } : {}) });
      else if (!prior.pageId && ownPage) seen.set(e.capabilityId, { ...prior, pageId: ownPage });
    }
  }
  return [...seen.values()];
})();

const FEATURES = new Map<string, ShopifyFeature>(SHOPIFY_GROUPS.flatMap((g) => g.features.map((f) => [f.id, f] as const)));

/** Where a card with no page of its own goes: its place on /shopify, which anchors every SHOPIFY_GROUPS entry by id. */
const onShopifyPage = (id: string) => `${pathFor("shopify")}#${id}`;

export function itemFor(src: Source): DirectoryItem {
  const group = FEATURES.get(src.id);
  const title = src.title ?? group?.title;
  const body = src.body ?? (group ? firstSentence(group.does) : undefined);
  if (!title || !body) throw new Error(`Directory entry "${src.id}" has no title or sentence: it is neither a SHOPIFY_GROUPS entry nor given its own`);
  const status = src.capabilityId ? capabilityFacts(src.capabilityId, src.surface ?? "shopify").status : undefined;
  const shipped = status === undefined || status === "live" || status === "beta";
  const own = src.pageId && isPublishable(getPage(src.pageId)) ? pathFor(src.pageId) + (src.anchor ? `#${src.anchor}` : "") : undefined;
  const elsewhere = src.href && isPublishable(getPage(src.href.pageId)) ? pathFor(src.href.pageId) : undefined;
  // A card that is not shipped is plain text, even if /shopify describes it: a link would promise a thing a merchant cannot use.
  const fallback = group ? src.id : src.fallbackId;
  const href = !shipped ? undefined : (own ?? elsewhere ?? (fallback ? onShopifyPage(fallback) : undefined));
  // A shipped feature always opens somewhere: a card with a Live or Beta chip and no link is a bug, so it stops the build.
  if (shipped && !href) throw new Error(`Directory entry "${src.id}" is shipped but has no page, section or /shopify anchor to open`)
  return { title, body, ...(href ? { href } : {}), ...(status ? { status } : {}) };
}

const groups: DirectoryGroup[] = LAYOUT.map(({ groupId, entries }) => {
  const g = SHOPIFY_GROUPS.find((x) => x.id === groupId);
  if (!g) throw new Error(`Unknown SHOPIFY_GROUPS id "${groupId}"`);
  return { id: groupId, eyebrow: "Shopify app", title: g.name, blurb: g.blurb, items: entries.map(itemFor) };
});

export const CONTENT: DirectoryContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Shopify", href: pathFor("shopify") },
    { label: "Features", href: pathFor("shopify.features") },
  ],
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour for Shopify is an app that answers your shoppers, builds product shelves, flags low stock, confirms cash-on-delivery orders on WhatsApp and fixes your product pages for search. Here is every feature, grouped the way the app groups them, with its status.",
  groups,
  faqs: [
    {
      q: "Where does each feature run?",
      a: "Inside your Shopify store. Some sit in your theme, such as the chat and the product shelves, and some work from the Peakhour app in your Shopify admin, such as the audit and the SEO fixes.",
    },
    {
      q: "Does every feature need WhatsApp?",
      a: "No. Only the WhatsApp features do: the WhatsApp assistant, COD confirmation and stock-out alerts. They need your own WhatsApp Business number or a verified WhatsApp contact.",
    },
    {
      q: "Do I approve what Peakhour changes?",
      a: "Yes. Each page says what Peakhour asks for and what you approve. Changes the engine suggests wait for your approval, and fixes can be undone.",
    },
    {
      q: "What does Coming soon mean?",
      a: "That the feature is not available to stores yet. A Coming soon card has no link, so the page says so plainly instead of promising it.",
    },
  ],
  related: [SHOPIFY_HOME_LINK, PRICING_LINK, { label: "How Peakhour works", href: "/how-it-works", note: "Ask, approve, undo." }],
  closing: {
    headline: "See it on your own store.",
    body: "Install Peakhour from the Shopify App Store, or open the Shopify page to see where it stands today.",
  },
};
