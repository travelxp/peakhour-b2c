import type { SignupCta } from "@/lib/catalog";

/**
 * Content model for /shopify ("Peakhour for Shopify"), kept as data in the
 * same way lib/pillars.ts is, so the page stays a thin template and the copy
 * tests can read every sentence without rendering.
 *
 * Nothing here states a price, a trial length or a credit allowance. Those
 * come from the pricing catalog and are passed into the functions below, so a
 * catalog change cannot leave this file saying something else.
 *
 * Copy rules (owner, 2026-11-03): plain words, active voice, no promise that
 * the AI is never wrong, no stats or ratings, nothing described that is not
 * built. Two store writes (discounts, orders) are released by the owner in the
 * CMS at launch, so those sentences read correctly whether or not they are on.
 */

export interface ShopifyFeature {
  id: string;
  title: string;
  /** What it does. */
  does: string;
  /** How the merchant benefits. */
  benefit: string;
  /** Three short steps, in the order a merchant does them. */
  steps: [string, string, string];
}

export interface ShopifyGroup {
  id: string;
  name: string;
  /** One sentence under the group heading. */
  blurb: string;
  features: ShopifyFeature[];
}

export const SHOPIFY_GROUPS: ShopifyGroup[] = [
  {
    id: "sell",
    name: "Sell more, 24/7",
    blurb: "An assistant that answers your shoppers on your storefront and on WhatsApp, and tells you what they could not find.",
    features: [
      {
        id: "storefront-assistant",
        title: "Storefront assistant",
        does: "A chat on your product and collection pages that answers from your products, prices and stock, in the shopper's language.",
        benefit: "Shoppers get an answer at midnight, and you get fewer “is this in stock?” messages. You can preview it before you pick a plan.",
        steps: [
          "Open Peakhour in your Shopify admin and preview the assistant.",
          "Add the assistant to your theme from the theme editor.",
          "Watch what shoppers ask in Conversations.",
        ],
      },
      {
        id: "ask-your-assistant",
        title: "Ask your assistant",
        does: "A box in your admin where you type a shopper's question and see the answer a shopper would get.",
        benefit: "You check the answers before your shoppers see them, and spot a product page that needs more detail.",
        steps: [
          "Type a question a shopper might ask.",
          "Read the answer and the products it points to.",
          "Fix the product page or add to Knowledge if something is missing.",
        ],
      },
      {
        id: "knowledge",
        title: "Knowledge",
        does: "A place to add what your product pages do not say: shipping, returns, sizing, care and store policies.",
        benefit: "The assistant answers the questions your product pages leave open, in your words.",
        steps: [
          "Open Knowledge and add a policy or an FAQ.",
          "Save it.",
          "Ask your assistant to see how it answers.",
        ],
      },
      {
        id: "shopper-asks",
        title: "What shoppers ask for",
        does: "A list of what shoppers asked for and could not find, with a weekly email that sums it up.",
        benefit: "You see which products to add, restock or describe better, from real questions.",
        steps: [
          "Open What shoppers ask for to see the requests.",
          "Act on one: restock, add a size or fix a description.",
          "Read the weekly email to catch up.",
        ],
      },
      {
        id: "added-to-cart",
        title: "Added to cart, and a test",
        does: "Counts the carts that started with an assistant answer, and can run a test that holds the assistant back for a share of shoppers.",
        benefit: "You see what the assistant adds to carts, and the test shows how much of that would have happened anyway.",
        steps: [
          "Open Results to see added-to-cart numbers.",
          "Start the test when you want a firmer answer.",
          "Read the result, labelled Measured or Estimated.",
        ],
      },
      {
        id: "whatsapp-assistant",
        title: "WhatsApp assistant on your own number",
        does: "The same assistant answers on WhatsApp, from the number you already use with customers.",
        benefit: "Shoppers who message you get an answer at once. Meta bills its WhatsApp fees to you directly, and Peakhour adds no markup. The WhatsApp button on your storefront needs your number added in the theme editor.",
        steps: [
          "Connect your WhatsApp Business number.",
          "Add the same number to the WhatsApp button in the theme editor.",
          "Reply yourself from Conversations whenever you want to step in.",
        ],
      },
      {
        id: "conversations",
        title: "Conversations",
        does: "Every chat in one list, where you can read it, reply, and export it.",
        benefit: "You step in when a shopper needs a person. Conversations are deleted 180 days after the last message, and a legal hold pauses that deletion when one is needed.",
        steps: [
          "Open Conversations and pick a chat.",
          "Reply or export it.",
          "Leave the rest: old chats delete on their own.",
        ],
      },
    ],
  },
  {
    id: "shelves",
    name: "Shelves that sell",
    blurb: "Product shelves that Peakhour builds and refreshes for you, each pick with a reason.",
    features: [
      {
        id: "smart-rails",
        title: "Smart Rails",
        does: "Product shelves such as “popular now” or “you may also like”, with a plain reason next to each pick. You set rules and a schedule, and Peakhour refreshes them daily.",
        benefit: "Shoppers find more of your range, and you can read why each product is on the shelf.",
        steps: [
          "Create a shelf and choose its rules.",
          "Pick when it should refresh.",
          "Add the shelf to your theme from the theme editor.",
        ],
      },
      {
        id: "shelf-results",
        title: "Results and A/B tests",
        does: "Shows how each shelf performs, and lets you run two versions against each other.",
        benefit: "You keep the shelf that works and drop the one that does not.",
        steps: [
          "Open a shelf's results.",
          "Start an A/B test with a second version.",
          "Keep the winner.",
        ],
      },
      {
        id: "buy-together",
        title: "Buy together and save",
        does: "Offers a bundle of products that sell well together, with a saving of 5% to 30% that stays within the limit you set.",
        benefit: "Bigger baskets, without a discount deeper than you allow.",
        steps: [
          "Set the most you will give off a bundle.",
          "Review the bundles Peakhour suggests.",
          "Switch on the ones you like.",
        ],
      },
      {
        id: "cart-thank-you",
        title: "Cart and thank-you shelf",
        does: "Shows a shelf in the cart and on the order confirmation page.",
        benefit: "Shoppers see a relevant next product at the moment they are most likely to buy.",
        steps: [
          "Open the cart and thank-you shelf settings.",
          "Choose which shelf to show.",
          "Add it from the theme editor.",
        ],
      },
    ],
  },
  {
    id: "run",
    name: "Run the shop",
    blurb: "Suggestions for campaigns, restocks and markdowns, and COD orders confirmed for you.",
    features: [
      {
        id: "campaigns",
        title: "Campaign suggestions and discounts",
        does: "Suggests a campaign for a product that is ready to push, with the offer and the reason. Discounts are created in your store only once you switch that on; until then you get the suggestion to act on yourself.",
        benefit: "You get ideas grounded in your own sales, and you decide what goes live.",
        steps: [
          "Read the suggestion and its reason.",
          "Approve it or skip it.",
          "If discounts are on, Peakhour creates the discount for you.",
        ],
      },
      {
        id: "inventory-supply",
        title: "Inventory and supply",
        does: "Shows what is running low or not selling, and prepares a printable purchase order for your supplier.",
        benefit: "You reorder before you run out, and you have the order ready to send.",
        steps: [
          "Open Inventory to see what needs attention.",
          "Choose the products to reorder.",
          "Print the purchase order.",
        ],
      },
      {
        id: "markdowns",
        title: "Markdowns",
        does: "Suggests lower prices for slow stock. After you switch markdowns on in Autopilot, Peakhour applies them for you, and you can Undo each one.",
        benefit: "Slow stock moves, and every price change can be reversed.",
        steps: [
          "Switch on markdowns in Autopilot.",
          "Review what Peakhour changes in the activity feed.",
          "Undo any change you do not want.",
        ],
      },
      {
        id: "cod-confirmation",
        title: "COD confirmation on WhatsApp",
        does: "Messages the shopper on WhatsApp to confirm a cash-on-delivery order, and puts the parcel on hold until they reply. It needs WhatsApp connected.",
        benefit: "Fewer parcels go out to people who never meant to take them.",
        steps: [
          "Connect WhatsApp.",
          "Switch on COD confirmation.",
          "See each confirmation in your activity feed.",
        ],
      },
    ],
  },
  {
    id: "catalogue",
    name: "Catalogue and search",
    blurb: "Product pages that read well to shoppers and to Google.",
    features: [
      {
        id: "catalogue-health",
        title: "Catalogue health",
        does: "Checks your products for missing titles, descriptions, images and other gaps.",
        benefit: "You see what to fix first.",
        steps: [
          "Open Catalogue health.",
          "Sort by what matters most.",
          "Open a product to fix it.",
        ],
      },
      {
        id: "fix-with-ai",
        title: "Fix with AI",
        does: "Writes a better title or description for a product. You review the change, apply it, and can undo it.",
        benefit: "Faster product pages, with you in charge of what is saved.",
        steps: [
          "Choose Fix with AI on a product.",
          "Review the new text.",
          "Apply it, or undo it later.",
        ],
      },
      {
        id: "product-page-card",
        title: "Product-page card",
        does: "A card in the Shopify product page that shows what Peakhour found for that product.",
        benefit: "You see the fix without leaving the page you are editing.",
        steps: [
          "Open a product in Shopify.",
          "Read the Peakhour card.",
          "Apply a fix from the card.",
        ],
      },
      {
        id: "writing-profile",
        title: "Writing profile",
        does: "Learns how your store sounds, so new text matches.",
        benefit: "Descriptions and articles read like your brand.",
        steps: [
          "Review your writing profile.",
          "Edit anything that is off.",
          "New text follows it.",
        ],
      },
      {
        id: "google-visibility",
        title: "Google search visibility",
        does: "Shows how your pages appear in Google search, and what to change.",
        benefit: "You find pages that Google cannot read well.",
        steps: [
          "Connect Google.",
          "Open the visibility report.",
          "Fix the pages it points to.",
        ],
      },
      {
        id: "ranking-tracking",
        title: "Ranking and AI assistant tracking",
        does: "Tracks where your pages rank in search and whether AI assistants mention your store.",
        benefit: "You see whether the changes you make move your ranking.",
        steps: [
          "Add the searches you care about.",
          "Check the ranking over time.",
          "Compare it with your fixes.",
        ],
      },
    ],
  },
  {
    id: "content",
    name: "Content",
    blurb: "Blog posts and page fixes that bring search visitors to your store.",
    features: [
      {
        id: "blog",
        title: "Blog ideas and articles in your voice",
        does: "Suggests blog topics, writes the article in your voice, and publishes it to your Shopify blog when you approve.",
        benefit: "A steady blog without a blank page.",
        steps: [
          "Pick an idea.",
          "Read and edit the draft.",
          "Publish to your Shopify blog.",
        ],
      },
      {
        id: "pages-to-fix",
        title: "Pages to fix",
        does: "Lists pages with weak titles or descriptions, with a fix for each. You can Undo any fix.",
        benefit: "Quick wins on pages you already have.",
        steps: [
          "Open Pages to fix.",
          "Review a suggestion.",
          "Apply it, or Undo it later.",
        ],
      },
      {
        id: "site-check",
        title: "Site check and AI shopping readiness",
        does: "Checks your store for problems that stop search engines and AI shopping assistants from reading it.",
        benefit: "You know what to fix so your products can be found.",
        steps: [
          "Run the site check.",
          "Read the list of problems.",
          "Fix the first one.",
        ],
      },
    ],
  },
  {
    id: "control",
    name: "You stay in charge",
    blurb: "You choose what Peakhour may change, see what it did, and stop it at any time.",
    features: [
      {
        id: "autopilot",
        title: "Autopilot and the activity feed",
        does: "Switch Peakhour on task by task. Everything it changes appears in the activity feed with an Undo.",
        benefit: "You hand over the jobs you trust, and keep the rest.",
        steps: [
          "Open Autopilot and switch on a task.",
          "Check the activity feed.",
          "Undo anything you do not want.",
        ],
      },
      {
        id: "emergency-stop",
        title: "Emergency stop",
        does: "One button that stops Peakhour from making changes in your store.",
        benefit: "You can pause everything in a second.",
        steps: [
          "Press Emergency stop.",
          "Peakhour stops making changes.",
          "Switch it back on when you are ready.",
        ],
      },
      {
        id: "results",
        title: "Results, Measured or Estimated",
        does: "Every result is labelled Measured, counted from your store, or Estimated, worked out from a model.",
        benefit: "You know which numbers to trust and which to treat as a guide.",
        steps: [
          "Open Results.",
          "Read the label on each number.",
          "Use Measured numbers for decisions.",
        ],
      },
      {
        id: "benchmarks",
        title: "Benchmarks",
        does: "Compares your store with similar stores, once at least 50 similar stores have shared. You opt in.",
        benefit: "You see how you compare, without sharing anything you did not agree to.",
        steps: [
          "Opt in to Benchmarks.",
          "Wait for enough similar stores.",
          "Read how you compare.",
        ],
      },
      {
        id: "several-stores",
        title: "Several stores",
        does: "Run more than one store from the same Peakhour account. Each store you add has its own Peakhour Suite charge and no trial.",
        benefit: "One login for all your stores, with each store's results kept apart.",
        steps: [
          "Install Peakhour on the other store.",
          "Link it to your Peakhour account.",
          "Switch between stores in the admin.",
        ],
      },
      {
        id: "ai-credits",
        title: "AI credits (Peaks)",
        does: "Peakhour uses AI credits (Peaks) for writing, answering and analysing. Your plan includes a monthly amount, and you can buy more on peakhour.ai.",
        benefit: "You see what is left and are warned before you run out.",
        steps: [
          "Check your balance in the app.",
          "Buy a top-up on peakhour.ai if you need one.",
          "Credits renew every month.",
        ],
      },
    ],
  },
];

/** The trust strip under the hero. No reviews, ratings, logos or statistics. */
export const SHOPIFY_TRUST: string[] = [
  "Install from the Shopify App Store",
  "Billed through Shopify",
  "Lives in your admin and on your product pages",
  "Conversations deleted 180 days after the last message, with a legal hold when needed",
];

/** "Your plan covers more than your store". */
export const SHOPIFY_MORE: { href: string; title: string; body: string }[] = [
  {
    href: "/support",
    title: "Inbox",
    body: "Your WhatsApp and storefront conversations in one inbox, answered by AI or by you.",
  },
  {
    href: "/content",
    title: "Content",
    body: "Posts for LinkedIn and X, and newsletters on Beehiiv, written in your voice.",
  },
  {
    href: "/growth",
    title: "Growth",
    body: "Ads and LinkedIn growth, with Peakhour Summit to review the plan before you approve it.",
  },
  {
    href: "/presence",
    title: "Presence",
    body: "Connect your Google Business Profile and see how people find you.",
  },
];

export const SHOPIFY_SEO = {
  title: "Peakhour for Shopify — AI shopping assistant and store autopilot",
  description:
    "Answer shoppers from your real catalogue, build product shelves that sell, plan restocks and fix product pages for Google, all inside Shopify. Billed through Shopify.",
  path: "/shopify",
} as const;

export const SHOPIFY_HERO = {
  eyebrow: "PEAKHOUR FOR SHOPIFY",
  headline: "Your store's AI team,",
  accent: "right inside Shopify.",
  lede: "Peakhour answers your shoppers from your real catalogue, builds the product shelves that sell, confirms COD orders on WhatsApp, and fixes product pages so Google can find them. It suggests; you approve. Almost everything it changes can be undone.",
  install: "Install on Shopify",
  pricing: "See pricing",
} as const;

/**
 * The three ticks under the hero buttons; the trial one only with a trial.
 * ★While the connector is coming soon the visitor signs up on peakhour.ai, so
 * "Billed through Shopify" is left out until there is a Shopify install.
 */
export function shopifyHeroTicks(trialDays: number | null, comingSoon = false): string[] {
  return [
    ...(typeof trialDays === "number" && trialDays > 0
      ? [`${trialDays}-day free trial`]
      : []),
    ...(comingSoon ? [] : ["Billed through Shopify"]),
    "Nothing changes without your OK",
  ];
}

/** The trust strip; without an App Store install the first two claims go. */
export function shopifyTrust(comingSoon = false): string[] {
  return comingSoon ? SHOPIFY_TRUST.slice(2) : SHOPIFY_TRUST;
}

/**
 * What the install button does. While the catalog marks the Shopify connector
 * coming soon there is no listing to send a visitor to, so the page shows the
 * chip and the platform's own signup button instead (the same rule the
 * channels strip on /pricing runs). `signup` is `signupCta(...)`.
 */
export type ShopifyInstallCta =
  | { kind: "install"; label: string; href: string }
  | { kind: "soon"; signup: SignupCta };

export function shopifyInstallCta({
  comingSoon,
  installHref,
  signup,
}: {
  comingSoon: boolean;
  installHref: string;
  signup: SignupCta;
}): ShopifyInstallCta {
  return comingSoon
    ? { kind: "soon", signup }
    : { kind: "install", label: SHOPIFY_HERO.install, href: installHref };
}

/** The pricing card's trial line for the Shopify variant. */
export function shopifyTrialNote(trialDays: number): string | null {
  return trialDays > 0 ? `${trialDays}-day free trial · billed through Shopify` : null;
}

const BILLING_Q = "How am I billed?";

export function shopifyFaq({
  trialDays,
  peaksIncluded,
  comingSoon = false,
}: {
  trialDays: number | null;
  /** Suite's monthly allowance, formatted; null when the catalog gives none. */
  peaksIncluded: string | null;
  /** The connector is not open: no question about Shopify billing. */
  comingSoon?: boolean;
}): { q: string; a: string }[] {
  const trial =
    typeof trialDays === "number" && trialDays > 0
      ? `You can try it for ${trialDays} days first, and you can preview the storefront assistant before you pick a plan.`
      : "You can preview the storefront assistant before you pick a plan.";
  const faqs = [
    {
      q: "Is Peakhour free?",
      a: `No. There is one plan, Peakhour Suite, and it has everything. ${trial}`,
    },
    {
      q: BILLING_Q,
      a: "Through Shopify. Shopify bills you for Peakhour Suite.",
    },
    {
      q: "What are AI credits?",
      a: peaksIncluded
        ? `AI credits (Peaks) pay for the writing, answering and analysing Peakhour does. Peakhour Suite includes ${peaksIncluded} a month, and you can buy top-ups on peakhour.ai.`
        : "AI credits (Peaks) pay for the writing, answering and analysing Peakhour does. Peakhour Suite includes a monthly amount, and you can buy top-ups on peakhour.ai.",
    },
    {
      q: "Will Peakhour change my store without asking?",
      a: "It changes only what you switch on. Each change appears in your activity feed with an Undo, and the emergency stop pauses everything.",
    },
    {
      q: "What does WhatsApp cost?",
      a: "Meta bills its WhatsApp fees to you directly, and Peakhour adds no markup. COD confirmation and the WhatsApp assistant need your WhatsApp Business number connected.",
    },
    {
      q: "Which languages does it speak?",
      a: "The assistant replies in the language the shopper writes in. The Peakhour admin is in English.",
    },
    {
      q: "Do I need to change my theme code?",
      a: "No. You add the assistant and the shelves from the theme editor, with no code.",
    },
    {
      q: "How long do you keep conversations?",
      a: "We delete a conversation 180 days after its last message. When a legal hold applies, the deletion waits until the hold is lifted.",
    },
    {
      q: "Can I use it on more than one store?",
      a: "Yes. Each store you add has its own Peakhour Suite charge, and no trial.",
    },
    {
      q: "What else is in Peakhour?",
      a: "Your plan also covers an Inbox, content for LinkedIn, X and Beehiiv, Growth with Peakhour Summit, and Google Business Profile. They run in your peakhour.ai dashboard.",
    },
  ];
  return comingSoon ? faqs.filter((f) => f.q !== BILLING_Q) : faqs;
}

/**
 * The page's structured data: a FAQPage over the same answers the accordion
 * shows, and a SoftwareApplication. ★NO aggregateRating AND NO review: the
 * page has no ratings to report, and a rating that is not there is a claim
 * search engines can penalise.
 */
export function shopifyJsonLd({
  url,
  faqs,
  offer,
}: {
  url: string;
  faqs: { q: string; a: string }[];
  /** Suite's list price, when the catalog sells it. */
  offer: { price: number; currency: string } | null;
}): Record<string, unknown>[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Peakhour for Shopify",
      url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: SHOPIFY_SEO.description,
      ...(offer
        ? {
            offers: {
              "@type": "Offer",
              price: String(offer.price),
              priceCurrency: offer.currency,
            },
          }
        : {}),
    },
  ];
}
