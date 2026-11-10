/**
 * ★THE ONE PLACE THE DASHBOARD NAVIGATION IS NAMED. Every sidebar pillar and
 * sub-link has a short merchant-readable label and a one-line description
 * (at most 80 characters) here, and nothing else in the app spells either out:
 * the sidebar, the pillar tabs, the mobile bar and the command menu all read
 * this file. `nav-copy.test.ts` fails when a nav href has no entry.
 *
 * Two maps rather than one because the same href is legitimately two things:
 * `/dashboard/content` is the Content pillar AND the Library sub-page inside
 * it. Routes, redirects and the OUTCOMES_HOME flag logic are NOT touched by
 * this file; it only supplies words.
 *
 * `aliases` are the names the screen used to carry. They stay searchable in the
 * command menu so a merchant (or a teammate) who still says "Ledger" finds it.
 */

export interface NavCopy {
  /** Short, plain-language name. */
  label: string;
  /** One line, at most {@link MAX_DESCRIPTION} characters. */
  description: string;
  /** Former or alternative names, searchable in the command menu. */
  aliases?: string[];
}

export const MAX_DESCRIPTION = 80;

/** Top-level sidebar items, keyed by href. */
export const PILLAR_COPY: Record<string, NavCopy> = {
  "/dashboard/overview": {
    label: "Home",
    description: "What happened today and what needs your attention.",
    aliases: ["Overview"],
  },
  "/dashboard/integrations": {
    label: "Connected accounts",
    description: "Link your store, Google, social and ad accounts.",
    aliases: ["Integrations"],
  },
  "/dashboard/inbox": {
    label: "Inbox",
    description: "Customer messages and replies in one place.",
  },
  "/dashboard/content": {
    label: "Content",
    description: "Posts, pages and the plan for what gets published.",
  },
  "/dashboard/growth": {
    label: "Growth",
    description: "Ads and growth actions, with your approval and your rules.",
  },
  "/dashboard/commerce": {
    label: "Commerce",
    description: "Run your online store: products, stock, prices and shoppers.",
  },
  "/dashboard/presence": {
    label: "Local presence",
    description: "Your Google Business Profile, listings and local reviews.",
    aliases: ["Presence", "Google Business Profile"],
  },
  "/dashboard/insights/analytics": {
    label: "Reports",
    description: "How your website and Google search are performing.",
    aliases: ["Insights"],
  },
  "/dashboard/ask": {
    label: "Ask Peakhour",
    description: "Ask a question or give an instruction in plain words.",
  },
  "/dashboard/tasks": {
    label: "Activity",
    description: "Work Peakhour is doing for you right now, and what finished.",
    aliases: ["Tasks"],
  },
  "/dashboard/drive": {
    label: "Drive",
    description: "Your images, videos, documents and brand kit.",
    aliases: ["Files"],
  },
  "/dashboard/peaks": {
    label: "Peaks",
    description: "Your credit balance, top-ups and what each action costs.",
  },
  "/dashboard/settings": {
    label: "Settings",
    description: "Your account, team, billing and preferences.",
  },
};

/** Sub-links inside a pillar, keyed by href. */
export const SUB_COPY: Record<string, NavCopy> = {
  // Content
  "/dashboard/content/autopilot": {
    label: "Auto-publish",
    description: "Content Peakhour prepares and publishes on its own.",
    aliases: ["Autopilot"],
  },
  "/dashboard/content": {
    label: "All content",
    description: "Every post and draft, ready to review or edit.",
    aliases: ["Library", "Content Library"],
  },
  "/dashboard/pages": {
    label: "Web pages",
    description: "Pages on your website that Peakhour writes and keeps fresh.",
    aliases: ["Pages"],
  },
  "/dashboard/content/sources": {
    label: "Content sources",
    description: "Sites and feeds Peakhour reads to ground what it writes.",
    aliases: ["Sources"],
  },
  "/dashboard/content/news": {
    label: "Industry news",
    description: "News in your field that you can react to or write about.",
    aliases: ["News Desk"],
  },
  "/dashboard/strategist": {
    label: "Content plan",
    description: "The topics and angles Peakhour plans to cover next.",
    aliases: ["Strategist"],
  },
  "/dashboard/calendar": {
    label: "Publishing calendar",
    description: "What goes out, where and when.",
    aliases: ["Calendar"],
  },
  "/dashboard/content/ledger": {
    label: "Results",
    description: "What your published content earned: visits, leads and sales.",
    aliases: ["Ledger"],
  },
  "/dashboard/content/seasonal-events": {
    label: "Holidays & events",
    description: "Seasonal moments Peakhour should plan content around.",
    aliases: ["Seasonal Events"],
  },

  // Growth
  "/dashboard/growth": {
    label: "Growth overview",
    description: "Is your growth working? The short answer, first.",
    aliases: ["Growth home"],
  },
  "/dashboard/growth/decisions": {
    label: "Suggested actions",
    description: "Changes Peakhour proposes. Approve, edit or decline each.",
    aliases: ["Decisions"],
  },
  "/dashboard/growth/channels": {
    label: "Ad channels & budget",
    description: "Where your ads run and how much can be spent.",
    aliases: ["Channels & money", "Ads"],
  },
  "/dashboard/growth/learning": {
    label: "What's working",
    description: "What Peakhour has learned from your results so far.",
    aliases: ["Learning"],
  },
  "/dashboard/growth/rules": {
    label: "Guardrails",
    description: "The limits and preferences Peakhour must follow.",
    aliases: ["Rules"],
  },
  "/dashboard/growth/start": {
    label: "Get started",
    description: "Set your goals and limits so Growth can begin.",
    aliases: ["First run"],
  },

  // Commerce
  "/dashboard/commerce": {
    label: "Store overview",
    description: "Your store at a glance and what Peakhour did for it.",
    aliases: ["Command Center", "Commerce Command Center"],
  },
  "/dashboard/commerce/channels": {
    label: "Sales channels",
    description: "The storefronts and marketplaces connected to Peakhour.",
    aliases: ["Channels"],
  },
  "/dashboard/commerce/autopilot": {
    label: "Auto-merchandising",
    description: "Let Peakhour reorder, retitle and promote products for you.",
    aliases: ["Autopilot", "Commerce Autopilot"],
  },
  "/dashboard/commerce/catalog": {
    label: "Products",
    description: "Your product listings, titles and descriptions.",
    aliases: ["Catalog"],
  },
  "/dashboard/commerce/inventory": {
    label: "Stock",
    description: "What is in stock, what is low and what is running out.",
    aliases: ["Inventory"],
  },
  "/dashboard/commerce/pricing": {
    label: "Pricing",
    description: "Prices and discounts, with suggestions you can approve.",
  },
  "/dashboard/commerce/reviews": {
    label: "Reviews",
    description: "Customer reviews to read, answer and show off.",
  },
  "/dashboard/commerce/assistant": {
    label: "Shopper assistant",
    description: "The chat helper that answers shoppers on your store.",
    aliases: ["Assistant"],
  },
  "/dashboard/commerce/knowledge": {
    label: "Assistant answers",
    description: "Facts and policies the shopper assistant answers from.",
    aliases: ["Knowledge base"],
  },
  "/dashboard/commerce/win-back": {
    label: "Abandoned carts",
    description: "Follow up with shoppers who left without buying.",
    aliases: ["Win back carts", "Win-back"],
  },
  "/dashboard/commerce/broadcasts": {
    label: "Promo messages",
    description: "Send an offer or announcement to your customers.",
    aliases: ["Broadcasts"],
  },

  // Insights
  "/dashboard/insights/analytics": {
    label: "Website traffic",
    description: "Visitors, where they came from and what they did.",
    aliases: ["Web Analytics", "Google Analytics"],
  },
  "/dashboard/insights/search-console": {
    label: "Google search",
    description: "How your site appears in Google results and which queries.",
    aliases: ["Search Console"],
  },

  // Settings
  "/dashboard/settings": {
    label: "General",
    description: "Business name, brand and the basics of your account.",
  },
  "/dashboard/settings/preferences": {
    label: "Preferences",
    description: "Notifications, language and how Peakhour behaves for you.",
  },
  "/dashboard/settings/team": {
    label: "Team",
    description: "Invite teammates and choose what each can do.",
  },
  "/dashboard/settings/whatsapp": {
    label: "Peakhour on WhatsApp",
    description: "Chat with Peakhour yourself on WhatsApp.",
  },
  "/dashboard/settings/billing": {
    label: "Billing",
    description: "Your plan, invoices and payment method.",
  },
  "/dashboard/settings/tickets": {
    label: "Support tickets",
    description: "Questions and bug reports you sent us, and our replies.",
    aliases: ["Tickets"],
  },
};

/** Pillar label, or `fallback` for an href with no entry. */
export function pillarLabel(href: string, fallback: string): string {
  return PILLAR_COPY[href]?.label ?? fallback;
}

/** Sub-link label, or `fallback` for an href with no entry. */
export function subLabel(href: string, fallback: string): string {
  return SUB_COPY[href]?.label ?? fallback;
}

/**
 * The copy for any nav destination, pillar first, then sub-link. Surfaces
 * outside the sidebar (error pages, the 404, page intros) read names from
 * here, so a page is never called one thing in the nav and another on its
 * own error screen.
 */
export function navCopy(href: string): NavCopy | undefined {
  return PILLAR_COPY[href] ?? SUB_COPY[href];
}

/** Merchant-facing name for a nav destination. Throws for an unknown href,
 *  so an error page or link cannot ship with an invented name. */
export function navLabel(href: string): string {
  const copy = navCopy(href);
  if (!copy) throw new Error(`nav-copy has no entry for ${href}`);
  return copy.label;
}
