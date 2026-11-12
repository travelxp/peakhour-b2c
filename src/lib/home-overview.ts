/**
 * The pure decisions behind the merchant Home page (/dashboard/overview):
 * which accounts are listed, which headline figures render, and what the one
 * setup list contains. Kept out of the page so each can be tested without
 * rendering anything.
 */
import { isRecoverableStatus } from "@/lib/integration-card-state";
import { flattenMetaIntegration, META_VIRTUAL_CARDS, isMetaVirtual, type MetaLoginInfo } from "@/lib/integrations-meta";

// ── Connected accounts ─────────────────────────────────────

/** The slice of a GET /v1/integrations row Home reads. */
export interface HomeIntegrationRow extends MetaLoginInfo {
  provider: string;
  name?: string;
  connected?: boolean;
  status?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account?: { name?: string; extra?: Record<string, any> };
}

export interface ConnectedAccount {
  provider: string;
  name: string;
  /** The account's own name (a store, a page), when the api knows it. */
  accountName?: string;
  state: "live" | "needs_reconnect";
}

/**
 * A Meta card a broken connection never had (no Page, no ad account, or the
 * capability switched off). Flatten copies the parent's status onto all four
 * cards, so without this a Pages-only connection that needs reconnecting
 * would list Meta Ads and WhatsApp as broken too.
 */
function metaCardNeverHeld(r: HomeIntegrationRow): boolean {
  if (!isMetaVirtual(r.provider)) return false;
  const card = META_VIRTUAL_CARDS.find((c) => c.virtualProvider === r.provider);
  const extra = r.account?.extra ?? {};
  return !card || !card.hasResources(extra) || extra.capabilities?.[card.capabilityKey]?.enabled === false;
}

/**
 * Accounts to list on Home: every integration the business holds a
 * connection for. A broken connection is listed too, flagged, because
 * hiding it would hide the one thing the merchant has to act on. Providers
 * the merchant never connected are not listed; the page shows one
 * "Connect more" link instead.
 *
 * Meta is one `facebook` connection that carries Pages, Instagram, Meta Ads
 * and WhatsApp. It is expanded into those four rows by the same helper the
 * Connected accounts page uses (`flattenMetaIntegration`), so Home lists
 * exactly the Meta accounts that page shows as connected, and flags the one
 * whose own login is broken.
 */
export function connectedAccounts(rows: readonly HomeIntegrationRow[] | undefined): ConnectedAccount[] {
  const out: ConnectedAccount[] = [];
  const flat = flattenMetaIntegration<HomeIntegrationRow>([...(rows ?? [])], (item, card) => ({
    name: card.name,
    account: { ...item.account, name: card.getResourceSummary(item.account?.extra || {}) || item.account?.name },
  }));
  for (const r of flat) {
    const live = r.connected === true;
    const broken = !live && isRecoverableStatus(r.status) && !metaCardNeverHeld(r);
    if (!live && !broken) continue;
    out.push({
      provider: r.provider,
      name: r.name || r.provider,
      accountName: r.account?.name || undefined,
      state: live ? "live" : "needs_reconnect",
    });
  }
  // Broken first (it needs the merchant), then alphabetical for a stable list.
  return out.sort(
    (a, b) =>
      Number(b.state === "needs_reconnect") - Number(a.state === "needs_reconnect") ||
      a.name.localeCompare(b.name),
  );
}

// ── Headline figures ───────────────────────────────────────

export interface HomeStatsSlice {
  content: { total: number; tagged: number; highPotential: number };
  campaigns: { active: number; total: number };
  connections: { linkedinAds: boolean };
}

export interface HomeSummarySlice {
  kpis: { publishedThisWeek: number; scheduledUpcoming: number };
  commerce: { connected: boolean; productCount: number | null } | null;
}

export type GlanceKey = "products" | "published" | "scheduled" | "content" | "adReady" | "campaigns";

export interface GlanceFigure {
  key: GlanceKey;
  label: string;
  value: number;
  meaning: string;
  action: string;
  href: string;
}

export const MAX_GLANCE_CARDS = 4;

/**
 * Headline figures that have a real data source, in priority order, capped at
 * four. A figure with no source for this business is omitted, never shown as
 * a dash: no store connected means no products card, no LinkedIn Ads
 * connection means no campaigns card, nothing in the library means no content
 * cards (the setup list already asks for it).
 */
export function glanceFigures(
  stats: HomeStatsSlice | undefined,
  home: HomeSummarySlice | undefined,
): GlanceFigure[] {
  const cards: GlanceFigure[] = [];

  const products = home?.commerce?.connected ? home.commerce.productCount : null;
  if (products != null) {
    cards.push({
      key: "products",
      label: "Products in your store",
      value: products,
      meaning: products > 0 ? "Peakhour can write about and promote these" : "No products found in your store yet",
      action: "Open your store",
      href: "/dashboard/commerce",
    });
  }

  if (home) {
    const { publishedThisWeek, scheduledUpcoming } = home.kpis;
    cards.push({
      key: "published",
      label: "Published this week",
      value: publishedThisWeek,
      meaning:
        publishedThisWeek > 0
          ? "Posts that went out on your connected accounts"
          : "Nothing has gone out this week yet",
      action: publishedThisWeek > 0 ? "See your calendar" : "Create a post",
      href: publishedThisWeek > 0 ? "/dashboard/calendar" : "/dashboard/calendar?compose=1",
    });
    cards.push({
      key: "scheduled",
      label: "Coming up",
      value: scheduledUpcoming,
      meaning:
        scheduledUpcoming > 0 ? "Posts scheduled to go out next" : "Nothing is scheduled to go out",
      action: scheduledUpcoming > 0 ? "Review the schedule" : "Schedule a post",
      href: scheduledUpcoming > 0 ? "/dashboard/calendar" : "/dashboard/calendar?compose=1",
    });
  }

  if (stats && stats.content.total > 0) {
    cards.push({
      key: "content",
      label: "Content library",
      value: stats.content.total,
      meaning: stats.content.tagged
        ? `${stats.content.tagged} reviewed by AI and ready to reuse`
        : "Peakhour is reading these now. Results appear here automatically.",
      action: "Open library",
      href: "/dashboard/content",
    });
    if (stats.content.highPotential > 0) {
      cards.push({
        key: "adReady",
        label: "Strong ad candidates",
        value: stats.content.highPotential,
        meaning: "Your best-scoring pieces, the ones most worth putting budget behind",
        action: "Turn one into an ad",
        href: "/dashboard/content",
      });
    }
  }

  // The count is LinkedIn Ads only, so it is labelled as such and shown only
  // when that connection exists. A real zero is a true answer there.
  if (stats?.connections.linkedinAds) {
    cards.push({
      key: "campaigns",
      label: "LinkedIn campaigns running",
      value: stats.campaigns.active,
      meaning: stats.campaigns.total
        ? `${stats.campaigns.total} created in total`
        : "None yet. Your first can run off content you already have.",
      action: stats.campaigns.active ? "Review performance" : "Launch your first",
      href: "/dashboard/ads?channel=linkedin",
    });
  }

  return cards.slice(0, MAX_GLANCE_CARDS);
}

// ── One setup list ─────────────────────────────────────────

export interface HomeSetupStep {
  label: string;
  detail: string;
  done: boolean;
  href: string;
}

/**
 * The single setup list. It merges the old "Set up your AI engine" bar
 * (profile, channel, content) with the "AI engine" card (business analysed,
 * content imported, budget). Profile and content were in both, so they appear
 * once. The budget row is dropped: it only matters to a merchant running paid
 * ads, so as a Home step it kept every other merchant on an unfinishable list.
 *
 * `hasAccount` should come from the real integrations list when it has
 * loaded; pass the stats flag only as a fallback.
 */
export function setupSteps(input: {
  hasProfile: boolean;
  hasAccount: boolean;
  hasContent: boolean;
}): HomeSetupStep[] {
  return [
    {
      label: "Tell us about your business",
      detail: "What you sell and who for. Everything Peakhour writes is based on this.",
      done: input.hasProfile,
      href: "/dashboard/growth/rules/business",
    },
    {
      label: "Connect an account",
      detail: "Your store, website, Google Business Profile or social page. One is enough to start.",
      done: input.hasAccount,
      href: "/dashboard/integrations",
    },
    {
      label: "Bring in your content",
      detail: "Import or write your first piece so there is something to work with.",
      done: input.hasContent,
      href: "/dashboard/content",
    },
  ];
}

/** True while at least one step is outstanding. */
export function setupOutstanding(steps: readonly HomeSetupStep[]): boolean {
  return steps.some((s) => !s.done);
}
