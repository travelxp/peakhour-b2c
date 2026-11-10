"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { invalidateLinkedInContentQueries } from "@/lib/linkedin-cache";
import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";
import { OAuthConnectResult } from "@/components/integrations/oauth-connect-result";
import { MetaDmConnect } from "@/components/integrations/meta-dm-connect";
import { XDmConnect } from "@/components/integrations/x-dm-connect";
import { WordPressConnectModal } from "@/components/integrations/wordpress-connect-modal";
import { MeasurementHealthPanel } from "@/components/growth/measurement-health-panel";
import { affectsMeasurementHealth } from "@/lib/measurement-health";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Search } from "lucide-react";
import { flattenMetaIntegration as flattenMetaIntegrationBase, resolveProvider, isMetaVirtual, metaActionPurpose, metaCardServedBy, metaCardStatus, metaCardsDisconnectedBy, metaGrantNote, metaLoginPurposeFor, withMetaLoginPurpose, type MetaLoginInfo } from "@/lib/integrations-meta";
import { Integration } from "./_components/shared";
import { BeehiivConnectModal, WhatsAppConnectModal } from "./_components/connect-modals";
import { IntegrationCard } from "./_components/integration-card";

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social Media",
  newsletter: "Newsletters & Email",
  advertising: "Advertising",
  ecommerce: "E-Commerce",
  cms: "Content Management",
  analytics: "Analytics",
  messaging: "Messaging & Chat",
};

const CATEGORY_ORDER = ["social", "advertising", "newsletter", "cms", "ecommerce", "analytics", "messaging"];

// Meta capability flattening lives in src/lib/integrations-meta.ts so the
// channels hub at /dashboard/content shares the same logic.

function flattenMetaIntegration(integrations: Integration[]): Integration[] {
  const flat = flattenMetaIntegrationBase<Integration>(integrations, (item, card) => {
    const extra = item.account?.extra || {};
    const info: MetaLoginInfo = { metaLogin: item.metaLogin, metaConnections: item.metaConnections };
    // ★The card's OWN row decides whether it needs reconnecting: the merged
    // facebook row prefers an active row, so a broken Growth row beside a
    // working shared row would otherwise show Meta Ads as connected.
    const rowStatus = card.loginPurpose ? metaCardStatus(info, card.virtualProvider) : undefined;
    const ownRowBroken = rowStatus !== undefined && rowStatus !== "active";
    // And a card NO row serves (the api said so) is not connected, whatever
    // the merged extras of another purpose's row contain.
    const unserved =
      card.loginPurpose !== undefined &&
      item.metaConnections !== undefined &&
      metaCardServedBy(info, card.virtualProvider) === "none";
    return {
      name: card.name,
      description: card.description,
      grantNote: metaGrantNote(card.virtualProvider, item.metaLogin, metaActionPurpose(info, card.virtualProvider)),
      ...(ownRowBroken ? { connected: false, status: rowStatus } : {}),
      ...(unserved ? { connected: false } : {}),
      category: card.category,
      account: item.connected
        ? {
            ...item.account!,
            name: card.getResourceSummary(extra) || item.account!.name,
          }
        : undefined,
      group: "meta",
      groupDisplayName: "Meta",
      subLabel: null,
    } as Partial<Integration>;
  });
  // Each Meta card's Disconnect copy names what STAYS connected, so it needs
  // the other Meta cards' state — known only once all four are flattened.
  const connectedMeta = flat.filter((i) => isMetaVirtual(i.provider) && i.connected).map((i) => i.provider);
  return flat.map((i) => (isMetaVirtual(i.provider) ? { ...i, metaConnectedCards: connectedMeta } : i));
}

type ConnectionTab = "all" | "connected" | "disconnected";

/**
 * Translate a structured ApiError from /v1/integrations/:provider/repair-webhook
 * into user-actionable copy. The api's raw messages ("X returned no
 * webhook config — check provider logs") are ops-speak — users can't
 * "check provider logs" and "missing something — check logs / Dismiss"
 * leaves them stranded. Codes are stable per the route's fail() returns
 * in peakhour-api src/v1/integrations/routes.ts.
 *
 * The translation always names the concrete next step the user CAN take.
 * For most repair-failed cases that's "disconnect + reconnect" — the
 * underlying problem is almost always a stale credential or a
 * provider-side revocation, both of which the OAuth reconnect path
 * fixes cleanly.
 */
function friendlyRepairWebhookError(err: ApiError, providerLabel: string): string {
  switch (err.code) {
    case "REPAIR_NOT_SUPPORTED":
      return `${providerLabel} doesn't support automatic webhook repair. Please contact support.`;
    case "PROVIDER_NOT_FOUND":
      return `We don't recognise the ${providerLabel} integration. Please refresh the page and try again.`;
    case "NOT_CONNECTED":
      return `${providerLabel} isn't connected. Connect it from this page first.`;
    case "NO_CREDENTIALS":
      return `${providerLabel}'s credentials are missing. Disconnect and reconnect ${providerLabel} to restore access.`;
    case "REPAIR_FAILED":
      return `We couldn't re-register the ${providerLabel} webhook automatically. Disconnect and reconnect ${providerLabel} — that usually fixes it.`;
    default:
      // Fall back to the api's message, but lead with the providerLabel
      // so the user knows what failed.
      return `${providerLabel} webhook repair failed: ${err.message}`;
  }
}

/**
 * Post-connect landing for OAuth started from THIS page. Passed to the api
 * as `?returnTo=` and honoured by the callback, which otherwise dumps every
 * provider on /dashboard/settings — the redirect that made "reconnect
 * LinkedIn Ads" end two clicks away from the ads surface that needed it.
 *
 * A surface that sends the user here to reconnect (the Boost dialog, the
 * LinkedIn ads panel) passes its OWN path as `?returnTo=`; we forward that
 * so the round trip ends where the user actually was. Validated, not
 * trusted: the api re-checks it too, but a bad value should never make it
 * into an authorize URL in the first place.
 */
const DEFAULT_RETURN_TO = "/dashboard/integrations";

function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_RETURN_TO;
  const value = raw.trim();
  if (
    value.length === 0 ||
    value.length > 256 ||
    !value.startsWith("/dashboard/") ||
    value.includes("\\") ||
    value.includes("://") ||
    value.includes("#")
  ) {
    return DEFAULT_RETURN_TO;
  }
  // Kept in step with the api's safeReturnToPath ON PURPOSE. Anything the
  // api rejects but we forward gets silently dropped there, and the user
  // lands on /dashboard/settings — the exact behaviour this whole feature
  // exists to remove, with no diagnostic anywhere. Two rules matter here:
  //   • printable ASCII only — a non-Latin-1 code point makes the api's
  // Location header an invalid ByteString, which throws AFTER the
  // connection is written and reports a success as an error;
  //   • no dot segments — "/dashboard/../x" passes a prefix check and then
  // resolves out of /dashboard/ in the browser.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x21 || code > 0x7e) return DEFAULT_RETURN_TO;
  }
  const pathname = value.split("?", 1)[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return DEFAULT_RETURN_TO;
  }
  if (decoded.split("/").some((seg) => seg === "." || seg === "..")) {
    return DEFAULT_RETURN_TO;
  }
  return value;
}

export default function IntegrationsPage() {
  const { org, business } = useAuth();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams?.get("returnTo"));
  /** Provider the incoming returnTo was about, if the CTA named one.
   *  Scoping matters: a user who came here to reconnect LinkedIn Ads and
   *  then also connects Instagram must not be sent to the LinkedIn Ads hub
   *  with "Instagram connected." */
  const returnFor = searchParams?.get("returnFor") ?? null;
  const queryClient = useQueryClient();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [repairingWebhook, setRepairingWebhook] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ message: string; hasErrors: boolean } | null>(null);
  const [connectModal, setConnectModal] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [connectionTab, setConnectionTab] = useState<ConnectionTab>("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // ★KEYED ON THE BUSINESS TOO, NOT JUST THE ORG. This list is per-business in
  // two ways now: connections have always been scoped (orgId, businessId), and
  // since the business-scoped invitation work `availability` is as well — an
  // integration can be invited to ONE business of an org. But the page holds
  // its list in useState behind a bare `api.get`, outside TanStack, so
  // `switchBusiness`'s blanket `queryClient.clear()` never reaches it; and the
  // only dependency was `org._id`, which a business switch does not change.
  // Switching A → B therefore left business A's answer on screen: a Connect
  // button on an integration B was never invited to, or "coming soon" on one
  // it was. Harmless while availability was org-derived; wrong the moment it
  // stopped being.
  useEffect(() => {
    if (!org) return;
    loadIntegrations();
  }, [org?._id, business?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Reload the cards AND drop the LinkedIn content caches.
   *
   * ★This page is the only place a Company Page is enabled or disabled, and it
   * holds its state in `useState` + a bare `api.get` — nothing TanStack knows
   * about. So a Page toggle used to leave every LinkedIn hub query serving the
   * previous Page's data, and the Library feed (staleTime 5m, refetchOnMount
   * false, refetchOnWindowFocus false) could not refresh at all short of a hard
   * reload. Wrong-brand content that looks exactly like a quiet week.
   *
   * Invalidating on EVERY reload, not only on the page toggle: connect,
   * reconnect, refresh and disconnect all change what the hub should show, and
   * an invalidate on a fresh cache costs nothing.
   */
  async function loadIntegrations() {
    invalidateLinkedInContentQueries(queryClient);
    try {
      const data = await api.get<{ integrations: Integration[] }>("/v1/integrations");
      setIntegrations(flattenMetaIntegration(data.integrations));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  /** The api's Meta login facts, as carried on a flattened Meta card. */
  function metaInfoFor(provider: string): MetaLoginInfo {
    const row = integrations.find((i) => i.provider === provider);
    return { metaLogin: row?.metaLogin, metaConnections: row?.metaConnections };
  }

  async function handleConnect(provider: string, authType: string) {
    const realProvider = resolveProvider(provider);
    // WhatsApp can ONLY be connected via Meta's Embedded Signup (the v4 flow
    // with a config_id + WhatsApp scopes + the WA_EMBEDDED_SIGNUP postMessage
    // that carries waba_id/phone_number_id). The generic facebook /authorize
    // OAuth this card would otherwise hit requests pages/instagram/ads scopes
    // and never populates whatsappAccounts, so it can't connect WhatsApp at
    // all. Intercept the virtual "whatsapp" card BEFORE the oauth2 redirect
    // and launch the same Embedded Signup component the /dashboard/content
    // /whatsapp page uses, hosted in a modal here for consistency.
    if (provider === "whatsapp") {
      setConnectModal("whatsapp");
      return;
    }
    // Shopify App Store requirement 2.3.1: installation must initiate from a
    // Shopify-owned surface (the App Store listing / Shopify admin) — apps
    // must NOT ask merchants to type their myshopify.com domain to start an
    // install. So instead of a domain-entry dialog, send the merchant to our
    // App Store listing; Shopify then drives the OAuth/install flow back to us.
    if (realProvider === "shopify") {
      window.open(
        process.env.NEXT_PUBLIC_SHOPIFY_APP_STORE_URL ?? "https://apps.shopify.com/",
        "_blank",
      );
      return;
    }
    if (authType === "oauth2") {
      // Compare against BOTH the card's own key and the resolved OAuth
      // provider. The Meta cards are virtual — `facebook_pages`,
      // `instagram`, `meta_ads` and `whatsapp` all resolve to `facebook` —
      // so matching only `realProvider` would drop the returnTo for a CTA
      // that named the exact card the user then clicked, which is the
      // inverse of what this scoping is for.
      const landing =
        !returnFor || returnFor === realProvider || returnFor === provider
          ? returnTo
          : DEFAULT_RETURN_TO;
      // A Meta card names its product (`purpose=content|ads`), so the api
      // opens that product's own Login for Business configuration — except a
      // reconnect of a broken shared row, which must replace that row's
      // token (metaActionPurpose).
      window.location.href = withMetaLoginPurpose(
        `${API_BASE_URL}/v1/integrations/${realProvider}/authorize` +
          `?returnTo=${encodeURIComponent(landing)}`,
        metaActionPurpose(metaInfoFor(provider), provider),
      );
    } else if (authType === "api_key") {
      setConnectModal(realProvider);
    }
  }

  async function handleApiKeyConnect(provider: string, apiKey: string, config: Record<string, string>) {
    const result = await api.post<{
      provider: string;
      status: string;
      account: { externalId: string; name: string };
    }>(`/v1/integrations/${provider}/connect`, { apiKey, config });
    await loadIntegrations();
    setConnectModal(null);
    return result;
  }

  async function handleRefresh(provider: string) {
    const realProvider = resolveProvider(provider);
    setRefreshing(provider);
    setError("");
    try {
      await api.post<{ account: Integration["account"] }>(
        withMetaLoginPurpose(`/v1/integrations/${realProvider}/refresh`, metaLoginPurposeFor(provider)),
        {}
      );
      // Reload all integrations so virtual Meta cards update correctly
      await loadIntegrations();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to refresh. Please try again.");
    } finally {
      setRefreshing(null);
    }
  }

  async function handleSync(provider: string) {
    const realProvider = resolveProvider(provider);
    setSyncing(provider);
    setError("");
    try {
      await api.post(`/v1/integrations/${realProvider}/sync`, {});
      await loadIntegrations();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Sync failed. Please try again.");
    } finally {
      setSyncing(null);
    }
  }

  async function handleRepairWebhook(provider: string) {
    const realProvider = resolveProvider(provider);
    const providerLabel =
      integrations.find((i) => i.provider === provider)?.name ?? provider;
    setRepairingWebhook(provider);
    setError("");
    try {
      await api.post(`/v1/integrations/${realProvider}/repair-webhook`, {});
      // Refetch so the chip reflects the post-repair state. The cron
      // will recompute webhookHealth on its next tick; in the meantime
      // the connection card still shows the prior band, which is
      // honest ("we re-registered; awaiting verification").
      await loadIntegrations();
    } catch (err) {
      // Translate the api's structured error codes into user-actionable
      // copy. The raw `err.message` from the api ("X returned no webhook
      // config — check provider logs") is ops-speak — a user can't
      // "check provider logs", and "missing something" leaves them
      // staring at a Dismiss button with nothing to do. Codes are
      // stable per the /v1/integrations/:provider/repair-webhook route
      // (fail(c, ..., CODE, ...) returns ApiError.code on the b2c side).
      if (err instanceof ApiError) {
        setError(friendlyRepairWebhookError(err, providerLabel));
      } else {
        setError(`Couldn't re-register the ${providerLabel} webhook. Please try again.`);
      }
    } finally {
      setRepairingWebhook(null);
    }
  }

  async function handleBackfillSync() {
    setBackfilling(true);
    setBackfillResult(null);
    setError("");
    try {
      const result = await api.post<{
        total: number;
        imported: number;
        updated: number;
        importErrors: number;
        tagged: number;
        tagErrors: number;
        remaining: number;
        message: string;
      }>("/v1/content/backfill-sync", {});

      let taggedSoFar = result.tagged;
      let tagRemaining = result.remaining;
      while (tagRemaining > 0) {
        setBackfillResult({
          message: `Imported ${result.imported} newsletters. AI tagging: ${taggedSoFar} done, ${tagRemaining} remaining...`,
          hasErrors: false,
        });
        try {
          const tagResult = await api.post<{
            total: number;
            tagged: number;
            remaining: number;
            done: boolean;
            message: string;
          }>("/v1/content/backfill-tags", {});
          taggedSoFar += tagResult.tagged;
          tagRemaining = tagResult.remaining;
          if (tagResult.done) break;
        } catch {
          break;
        }
      }

      setBackfillResult({
        message: tagRemaining === 0
          ? `${result.imported} newsletters imported, all ${taggedSoFar} tagged with AI insights.`
          : result.message,
        hasErrors: result.importErrors > 0 || result.tagErrors > 0,
      });
      await loadIntegrations();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Backfill sync failed. Please try again.");
    } finally {
      setBackfilling(false);
    }
  }

  async function handleDisconnect(provider: string) {
    // WhatsApp lives in its own int_connections row (keyed by WABA id) and has
    // a dedicated disconnect that removes ONLY that row + unsubscribes only the
    // WABA webhook. The generic facebook disconnect below revokes ALL Meta
    // permissions via Graph (DELETE /me/permissions), which would also drop
    // Facebook Pages, Instagram and Meta Ads — so route the WhatsApp card to
    // its own endpoint and leave the other Meta surfaces connected.
    if (provider === "whatsapp") {
      setDisconnecting(provider);
      try {
        await api.delete("/v1/meta/whatsapp/connection");
        // Refetch rather than optimistically flipping every facebook-backed
        // card — only the WhatsApp surface changed.
        await loadIntegrations();
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to disconnect WhatsApp. Please try again.");
      } finally {
        setDisconnecting(null);
      }
      return;
    }
    const realProvider = resolveProvider(provider);
    setDisconnecting(provider);
    try {
      await api.delete(withMetaLoginPurpose(`/v1/integrations/${realProvider}`, metaLoginPurposeFor(provider)));
      if (metaLoginPurposeFor(provider)) {
        // ★A Meta card disconnects the row that serves it, and only the cards
        // that row serves go with it — the Meta Ads card leaves a separately
        // connected Pages alone. Flipped at once, then confirmed by the api.
        const going = new Set(metaCardsDisconnectedBy(metaInfoFor(provider), provider));
        setIntegrations((prev) =>
          prev.map((i) =>
            going.has(i.provider)
              ? { ...i, connected: false, status: "disconnected", account: undefined }
              : i
          )
        );
        await loadIntegrations();
      } else {
        setIntegrations((prev) =>
          prev.map((i) =>
            resolveProvider(i.provider) === realProvider
              ? { ...i, connected: false, status: "disconnected", account: undefined }
              : i
          )
        );
      }
      // ★★AND THE HEALTH PANEL ABOVE HAS TO BE TOLD. It caches for half an hour,
      // so without this a merchant who disconnects Google Analytics keeps
      // reading green analytics verdicts directly above the card that now says
      // "not connected" — the panel contradicting the page it is printed on,
      // which is worse than either answer alone. Only for the providers the
      // check actually reads: three live Google calls sit behind a refetch.
      if (affectsMeasurementHealth(realProvider)) {
        queryClient.invalidateQueries({ queryKey: ["measurement-health"] });
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setDisconnecting(null);
    }
  }

  // ── Filtering logic ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = integrations;

    // Connection tab filter
    if (connectionTab === "connected") items = items.filter((i) => i.connected);
    if (connectionTab === "disconnected") items = items.filter((i) => !i.connected);

    // Category filter
    if (activeCategory !== "all") items = items.filter((i) => i.category === activeCategory);

    // Search filter (fuzzy on name, description, category, provider)
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.provider.toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q) ||
          (CATEGORY_LABELS[i.category] || i.category).toLowerCase().includes(q)
      );
    }

    return items;
  }, [integrations, connectionTab, activeCategory, search]);

  // Get categories present in current integrations (for chips)
  const availableCategories = useMemo(() => {
    const cats = new Set(integrations.map((i) => i.category));
    return CATEGORY_ORDER.filter((c) => cats.has(c));
  }, [integrations]);

  // Group filtered results by category
  const grouped = useMemo(() => {
    const groups: Record<string, Integration[]> = {};
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((i) => i.category === cat);
      if (items.length > 0) groups[cat] = items;
    }
    // Any categories not in CATEGORY_ORDER
    for (const item of filtered) {
      if (!CATEGORY_ORDER.includes(item.category)) {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
      }
    }
    return groups;
  }, [filtered]);

  const connectedCount = integrations.filter((i) => i.connected).length;
  const disconnectedCount = integrations.filter((i) => !i.connected).length;

  return (
    <PageShell width="standard">
      {/* Confirms an OAuth round trip that came back here (?returnTo=). The
          page's own fetch already shows the new state; this is the "it
          worked" the user is owed. */}
      <OAuthConnectResult />
      <PageHeader
        title="Connected accounts"
        description="Connect your platforms to power AI-driven content and ads"
      />

      {/* ★★CAN THE NUMBERS BE BELIEVED — HERE, BECAUSE THIS IS WHERE A MERCHANT
          LANDS AFTER CONNECTING. `returnTo` defaults to this page, so the panel
          is the first thing after "it worked": the moment a property is
          attached is the moment to say whether it is pointed at the right site,
          and every screen in the product renders whether it is or not.

          It renders nothing for a business with nothing connected, and nothing
          when it cannot load. */}
      <MeasurementHealthPanel />

      {/* Search + Tabs bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={connectionTab}
          onValueChange={(v) => setConnectionTab(v as ConnectionTab)}
        >
          <TabsList>
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-1.5 text-micro px-1.5 py-0">
                {integrations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="connected">
              Connected
              <Badge variant="secondary" className="ml-1.5 text-micro px-1.5 py-0 bg-success/15 text-success-on-tint">
                {connectedCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="disconnected">
              Available
              <Badge variant="secondary" className="ml-1.5 text-micro px-1.5 py-0">
                {disconnectedCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeCategory === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
          }`}
        >
          All Categories
        </button>
        {availableCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? "all" : cat)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        // Rhythm must match PageShell's, because the loaded branch below
        // spreads its category groups as DIRECT PageShell children while this
        // one nests them under a single wrapper. With a flat `space-y-6` here
        // the group-to-group gap jumped 24px -> 16px on mobile the moment
        // data landed.
        <div className="space-y-4 sm:space-y-6">
          {Array.from({ length: 2 }).map((_, gi) => (
            <div key={gi} className="space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/30" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No integrations found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-3">
              {/* h2, not h3: PageHeader emits the page's <h1>, so a category
                  heading at h3 would skip a level (axe `heading-order`). */}
              <h2 className="text-sm font-semibold text-foreground">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {items.filter((i) => i.connected).length}/{items.length} connected
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <IntegrationCard
                  key={item.provider}
                  integration={item}
                  onConnect={() => handleConnect(item.provider, item.authType)}
                  onDisconnect={() => handleDisconnect(item.provider)}
                  onRefresh={() => handleRefresh(item.provider)}
                  onSync={() => handleSync(item.provider)}
                  onBackfillSync={item.provider === "beehiiv" ? handleBackfillSync : undefined}
                  onRepairWebhook={() => handleRepairWebhook(item.provider)}
                  onChanged={loadIntegrations}
                  backfillResult={item.provider === "beehiiv" ? backfillResult : null}
                  disconnecting={disconnecting === item.provider}
                  refreshing={refreshing === item.provider}
                  syncing={syncing === item.provider}
                  backfilling={item.provider === "beehiiv" ? backfilling : false}
                  repairingWebhook={repairingWebhook === item.provider}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Messenger and Instagram messages (Inbox lane I3e): renders nothing until the api says a channel is released. */}
      <MetaDmConnect />

      {/* X messages (Inbox lane I3g): renders nothing until the api says they are released. */}
      <XDmConnect />

      {/* Beehiiv connect modal */}
      <BeehiivConnectModal
        open={connectModal === "beehiiv"}
        onClose={() => setConnectModal(null)}
        onConnect={(apiKey, publicationId) =>
          handleApiKeyConnect("beehiiv", apiKey, { publicationId })
        }
      />

      {/* WhatsApp — v4 Embedded Signup, the same flow as /dashboard/content/whatsapp */}
      <WhatsAppConnectModal
        open={connectModal === "whatsapp"}
        onClose={() => setConnectModal(null)}
        onConnected={loadIntegrations}
      />

      {/* WordPress / WooCommerce — generate a connection key for the plugin */}
      <WordPressConnectModal
        open={connectModal === "wordpress"}
        onClose={() => setConnectModal(null)}
      />
    </PageShell>
  );
}

// ── WhatsApp Connect Modal ─────────────────────────────────────────
// Hosts the shared v4 Embedded Signup component in a dialog so the
// Integrations page and the Content channels hub drive the identical
// flow (config_id popup → POST /v1/meta/whatsapp/embedded-signup).
