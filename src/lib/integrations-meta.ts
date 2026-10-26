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
  /** The Meta login this card's actions run under (see "Purpose-specific Meta
   *  logins" below). Absent for WhatsApp, which uses Embedded Signup. */
  loginPurpose?: MetaLoginPurpose;
}

/** Which Meta login a card's actions run under. */
export type MetaLoginPurpose = "content" | "ads";

export const META_VIRTUAL_CARDS: MetaVirtualCard[] = [
  {
    virtualProvider: "facebook_pages",
    name: "Facebook Pages",
    description: "Publish posts, manage engagement, and track page insights",
    category: "social",
    capabilityKey: "pages",
    loginPurpose: "content",
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
    loginPurpose: "content",
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
    loginPurpose: "ads",
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

/** The Meta card whose `virtualProvider` is `provider`, if any. */
function metaCard(provider: string): MetaVirtualCard | undefined {
  return META_VIRTUAL_CARDS.find((c) => c.virtualProvider === provider);
}

export function metaLoginPurposeFor(provider: string): MetaLoginPurpose | undefined {
  return metaCard(provider)?.loginPurpose;
}

/**
 * What the api's `facebook` row says about the Meta logins: which purposes have
 * their own configuration in this environment (`metaLogin`), and which live
 * rows serve the cards (`metaConnections`; `purpose: null` is an all-purpose
 * row shared by Pages, Instagram and Ads). Both absent from an older api.
 */
export interface MetaLoginInfo {
  metaLogin?: { content?: boolean; ads?: boolean };
  metaConnections?: Array<{ purpose: MetaLoginPurpose | null; status?: string }>;
}

/** The row that serves a card — its own purpose row first, as in the api's
 *  resolver, then the shared all-purpose row — with that row's status. An
 *  ACTIVE row of a kind wins over a broken one of the same kind. An older api
 *  that sends no `metaConnections` has one shared row behind every card. */
function servingRow(
  info: MetaLoginInfo,
  provider: string,
): { kind: "purpose" | "shared" | "none"; status?: string } {
  if (!info.metaConnections) return { kind: "shared" };
  const purpose = metaLoginPurposeFor(provider);
  const pick = (rows: MetaLoginInfo["metaConnections"] & object) =>
    rows.find((r) => r.status === "active") ?? rows[0];
  const own = purpose ? info.metaConnections.filter((r) => r.purpose === purpose) : [];
  if (own.length) return { kind: "purpose", status: pick(own).status };
  const shared = info.metaConnections.filter((r) => r.purpose === null);
  if (shared.length) return { kind: "shared", status: pick(shared).status };
  return { kind: "none" };
}

/** Which kind of row serves a card: its own purpose row, the shared
 *  all-purpose row, or nothing. */
export function metaCardServedBy(info: MetaLoginInfo, provider: string): "purpose" | "shared" | "none" {
  return servingRow(info, provider).kind;
}

/**
 * The status of the row that serves this card, or undefined when the api did
 * not say. ★A card's Reconnect belongs to ITS row: with an active shared row
 * and a broken Growth row, Meta Ads needs reconnecting and Pages does not —
 * the merged facebook row has one status for both and cannot say so.
 */
export function metaCardStatus(info: MetaLoginInfo, provider: string): string | undefined {
  return servingRow(info, provider).status;
}

/**
 * The `?purpose=` a Meta card's action should send, or undefined for none.
 *
 * ★ONE EXCEPTION: reconnecting a card served by a BROKEN shared row. A
 * purpose-scoped connect writes a NEW purpose row and leaves the shared row's
 * dead token where it is — Pages would stay broken behind a "Reconnect" that
 * appeared to work. So that reconnect runs all-purpose and replaces the shared
 * row's token in place, as it always did.
 */
export function metaActionPurpose(info: MetaLoginInfo, provider: string): MetaLoginPurpose | undefined {
  const purpose = metaLoginPurposeFor(provider);
  if (!purpose) return undefined;
  const row = servingRow(info, provider);
  if (row.kind === "shared" && row.status !== undefined && row.status !== "active") return undefined;
  return purpose;
}

/** Set `purpose=` on an api path (relative or absolute), keeping its query and
 *  fragment. Unchanged when `purpose` is undefined. */
export function withMetaLoginPurpose(path: string, purpose: MetaLoginPurpose | undefined): string {
  if (!purpose) return path;
  const hashAt = path.indexOf("#");
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const queryAt = beforeHash.indexOf("?");
  const base = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : "");
  params.set("purpose", purpose);
  return `${base}?${params.toString()}${hash}`;
}

/**
 * What a connect from this card will ask Meta for — or null for a card with
 * nothing to say. A narrower grant is promised only when the api reports that
 * the card's purpose has its own Login for Business configuration here;
 * otherwise the connect is the combined dialog and the sentence says so.
 */
export function metaGrantNote(
  provider: string,
  metaLogin: MetaLoginInfo["metaLogin"],
  /** The purpose the card's button will actually send (`metaActionPurpose`).
   *  Undefined means the combined dialog, whatever is configured. Required,
   *  not defaulted: a default would turn that `undefined` back into the card's
   *  purpose. */
  actionPurpose: MetaLoginPurpose | undefined,
): string | null {
  const purpose = metaLoginPurposeFor(provider);
  if (!purpose) return null;
  if (!actionPurpose || !metaLogin?.[actionPurpose]) {
    return "Connecting asks Meta for Pages, Instagram and Ads access together.";
  }
  return purpose === "ads"
    ? "Connecting asks Meta only for ad account and Business Manager access, and to list your Pages — not to post to them."
    : "Connecting asks Meta only for Pages and Instagram access — not your ad accounts.";
}

/** Whether a shared all-purpose row exists (always assumed for an older api). */
function hasSharedRow(info: MetaLoginInfo): boolean {
  return !info.metaConnections || info.metaConnections.some((r) => r.purpose === null);
}

/**
 * The Meta cards a Disconnect from `provider` takes down.
 *
 *  - Served by the shared row: every card the shared row serves (each card
 *    whose purpose has no row of its own).
 *  - Served by its own purpose row: that purpose's cards — ★unless a shared
 *    row also exists, which the api falls back to: then the cards stay
 *    connected through it, and NOTHING goes.
 *  - Served by nothing: the card itself (there is nothing to take).
 *
 * WhatsApp is never included.
 */
export function metaCardsDisconnectedBy(info: MetaLoginInfo, provider: string): string[] {
  const served = metaCardServedBy(info, provider);
  const purpose = metaLoginPurposeFor(provider);
  const cards = META_VIRTUAL_CARDS.filter((c) => c.loginPurpose);
  if (served === "purpose") {
    if (hasSharedRow(info)) return [];
    return cards.filter((c) => c.loginPurpose === purpose).map((c) => c.virtualProvider);
  }
  if (served === "shared") {
    return cards.filter((c) => metaCardServedBy(info, c.virtualProvider) === "shared").map((c) => c.virtualProvider);
  }
  return [provider];
}

/**
 * The Disconnect confirmation for a Meta card: names exactly what goes, and
 * what stays only among the cards that are connected now (`connected`; all
 * Meta cards when omitted).
 */
export function metaDisconnectCopy(
  info: MetaLoginInfo,
  provider: string,
  connected: readonly string[] = META_VIRTUAL_CARDS.map((c) => c.virtualProvider),
): string {
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const nameOf = (keys: string[]) =>
    META_VIRTUAL_CARDS.filter((c) => keys.includes(c.virtualProvider)).map((c) => c.name);
  const purpose = metaLoginPurposeFor(provider);
  if (metaCardServedBy(info, provider) === "purpose" && hasSharedRow(info)) {
    const own = nameOf(META_VIRTUAL_CARDS.filter((c) => c.loginPurpose === purpose).map((c) => c.virtualProvider));
    return (
      `This disconnects the separate Meta login for ${list(own)}. ` +
      `${list(own)} ${own.length === 1 ? "stays" : "stay"} connected through the combined Meta login you connected earlier.`
    );
  }
  const going = metaCardsDisconnectedBy(info, provider);
  const names = nameOf(going);
  const staying = nameOf(META_VIRTUAL_CARDS.map((c) => c.virtualProvider).filter((k) => !going.includes(k) && connected.includes(k)));
  const shared = metaCardServedBy(info, provider) === "shared" && going.length > 1 ? ", which share one Meta login" : "";
  const rest = staying.length ? ` ${list(staying)} ${staying.length === 1 ? "stays" : "stay"} connected.` : "";
  return `This disconnects ${list(names)}${shared}.${rest}`;
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
