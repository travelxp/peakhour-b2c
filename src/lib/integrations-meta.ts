/**
 * Meta capability flattening — turns the single `facebook` connection
 * (which carries Pages, Instagram, Ads, and WhatsApp via capability
 * toggles) into 4 virtual cards so each surface looks like a first-class
 * integration in the UI.
 *
 * Used by both /dashboard/integrations (the connection-management page)
 * and /dashboard/content (the channels hub) so the two stay consistent.
 */

interface BaseIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
  lastSyncAt?: string;
  lastError?: string;
  account?: {
    externalId?: string;
    name?: string;
    profileUrl?: string;
    avatarUrl?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: Record<string, any>;
  };
}

export interface MetaVirtualCard {
  /** Synthetic provider key written to the flattened row */
  virtualProvider: string;
  name: string;
  description: string;
  category: string;
  /** Key into `account.extra.capabilities` */
  capabilityKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hasResources: (extra: Record<string, any>) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getResourceSummary: (extra: Record<string, any>) => string | null;
}

export const META_VIRTUAL_CARDS: MetaVirtualCard[] = [
  {
    virtualProvider: "facebook_pages",
    name: "Facebook Pages",
    description: "Publish posts, manage engagement, and track page insights",
    category: "social",
    capabilityKey: "pages",
    hasResources: (extra) => (extra?.pages || []).length > 0,
    getResourceSummary: (extra) => {
      const pages = extra?.pages || [];
      if (pages.length === 0) return null;
      return pages.length === 1 ? pages[0].pageName : `${pages.length} pages`;
    },
  },
  {
    virtualProvider: "instagram",
    name: "Instagram",
    description: "Business account, content publishing, and audience insights",
    category: "social",
    capabilityKey: "instagram",
    hasResources: (extra) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (extra?.pages || []).some((p: any) => p.instagramAccountId),
    getResourceSummary: (extra) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page = (extra?.pages || []).find((p: any) => p.instagramAccountId);
      return page ? `@${page.instagramUsername}` : null;
    },
  },
  {
    virtualProvider: "meta_ads",
    name: "Meta Ads",
    description: "Facebook & Instagram ad campaigns, audiences, and reporting",
    category: "advertising",
    capabilityKey: "ads",
    hasResources: (extra) => (extra?.adAccounts || []).length > 0,
    getResourceSummary: (extra) => {
      const accs = extra?.adAccounts || [];
      if (accs.length === 0) return null;
      return accs.length === 1 ? accs[0].name : `${accs.length} ad accounts`;
    },
  },
  {
    virtualProvider: "whatsapp",
    name: "WhatsApp Business",
    description: "Automated messaging, customer support, and notifications",
    category: "messaging",
    capabilityKey: "whatsapp",
    hasResources: (extra) => (extra?.whatsappAccounts || []).length > 0,
    getResourceSummary: (extra) => {
      const accs = extra?.whatsappAccounts || [];
      if (accs.length === 0) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phones = accs.flatMap((w: any) => w.phoneNumbers || []);
      return phones.length > 0 ? phones[0].displayPhoneNumber : accs[0].name;
    },
  },
];

const META_VIRTUAL_PROVIDERS = new Set(META_VIRTUAL_CARDS.map((c) => c.virtualProvider));

/** Resolve a virtual Meta provider back to "facebook" for API calls. */
export function resolveProvider(provider: string): string {
  return META_VIRTUAL_PROVIDERS.has(provider) ? "facebook" : provider;
}

/** Whether a provider key represents a virtual Meta sub-card. */
export function isMetaVirtual(provider: string): boolean {
  return META_VIRTUAL_PROVIDERS.has(provider);
}

/**
 * Expand a `facebook` row into 4 virtual rows (Pages / Instagram / Meta
 * Ads / WhatsApp). Non-Meta rows pass through unchanged.
 *
 * Generic over the integration shape so both the rich Integration type
 * (used by /dashboard/integrations) and the slim ApiIntegration shape
 * (used by the channels hub) work.
 */
export function flattenMetaIntegration<T extends BaseIntegration>(
  integrations: T[],
  /**
   * Optional builder for fields specific to the caller (e.g. the
   * /dashboard/integrations page injects `name`, `description`,
   * `category`, etc. on the virtual row). The hub doesn't need these
   * because it has its own channel registry — it only reads
   * `provider` / `connected` / `lastSyncAt` from the result.
   */
  decorate?: (base: T, card: MetaVirtualCard) => Partial<T>,
): T[] {
  const result: T[] = [];

  for (const item of integrations) {
    if (item.provider !== "facebook") {
      result.push(item);
      continue;
    }

    const extra = item.account?.extra || {};
    const capabilities = (extra.capabilities || {}) as Record<
      string,
      { enabled?: boolean }
    >;

    for (const card of META_VIRTUAL_CARDS) {
      const hasRes = item.connected === true && card.hasResources(extra);
      const capConfig = capabilities[card.capabilityKey];
      const isEnabled = capConfig?.enabled !== false; // default enabled

      const virtualRow = {
        ...item,
        provider: card.virtualProvider,
        connected: item.connected === true && hasRes && isEnabled,
        ...(decorate ? decorate(item, card) : {}),
      } as T;

      result.push(virtualRow);
    }
  }

  return result;
}
