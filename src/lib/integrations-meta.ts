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

// ── Purpose-specific Meta logins ─────────────────────────────────────────
//
// The api runs one Facebook Login for Business configuration per product
// (api `helpers/meta-login-purpose.ts`): Content for Pages + Instagram, Growth
// for Meta Ads, and WhatsApp's own Embedded Signup. Each connect, disconnect and
// refresh from a Meta card says which product it is for with `?purpose=`, so
// the merchant grants only what that product needs and "Disconnect" on the
// Meta Ads card leaves their Pages connected.

/** Which Meta login a card's actions run under. WhatsApp has none: it uses
 *  Embedded Signup on its own routes. */
export type MetaLoginPurpose = "content" | "ads";

const PURPOSE_BY_VIRTUAL: Record<string, MetaLoginPurpose> = {
  facebook_pages: "content",
  instagram: "content",
  meta_ads: "ads",
};

export function metaLoginPurposeFor(provider: string): MetaLoginPurpose | undefined {
  return PURPOSE_BY_VIRTUAL[provider];
}

/** Append `purpose=` to an api path for a Meta card; any other card's path is
 *  returned unchanged. */
export function withMetaLoginPurpose(path: string, provider: string): string {
  const purpose = metaLoginPurposeFor(provider);
  if (!purpose) return path;
  return `${path}${path.includes("?") ? "&" : "?"}purpose=${purpose}`;
}

/**
 * What a connect from this card will ask Meta for — or null for a card with
 * nothing to say. `dedicated` is the api's `metaLogin` flag for the card's
 * purpose: whether that purpose has its own Login for Business configuration
 * in this environment. Without one, the connect is the combined dialog, and
 * the sentence says so rather than promising a narrower grant.
 */
export function metaGrantNote(provider: string, dedicated: boolean | undefined): string | null {
  const purpose = metaLoginPurposeFor(provider);
  if (!purpose) return null;
  if (!dedicated) return "Connecting asks Meta for Pages, Instagram and Ads access together.";
  return purpose === "ads"
    ? "Connecting asks Meta only for ad account and Business Manager access, and to list your Pages — not to post to them."
    : "Connecting asks Meta only for Pages and Instagram access — not your ad accounts.";
}

/**
 * The Disconnect confirmation for a Meta card. ★Conditional on purpose, because
 * the card cannot see which row serves it: a merchant who connected before
 * purposes existed (or while a configuration id was unset) holds ONE
 * connection for Pages, Instagram and Ads, and disconnecting it from any of
 * those cards takes all three. WhatsApp is never part of it.
 */
export function metaDisconnectCopy(provider: string): string {
  const purpose = metaLoginPurposeFor(provider);
  if (purpose === "ads") {
    return "This disconnects Meta Ads. If you connected Meta Ads together with Facebook Pages and Instagram in one login, those disconnect too. WhatsApp stays connected.";
  }
  if (purpose === "content") {
    return "This disconnects Facebook Pages and Instagram. If you connected them together with Meta Ads in one login, Meta Ads disconnects too. WhatsApp stays connected.";
  }
  return "This disconnects this Meta service. You'll need to reconnect to sync data again.";
}

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
