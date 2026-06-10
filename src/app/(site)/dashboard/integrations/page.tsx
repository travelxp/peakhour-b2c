"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useLocale } from "@/hooks/use-locale";
import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/molecules/status-badge";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plug,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Unplug,
  Mail,
  RefreshCw,
  Loader2,
  Download,
  Megaphone,
  Search,
  Settings2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LinkedinIcon,
  FacebookIcon,
  InstagramIcon,
  GoogleIcon,
  YoutubeIcon,
  BeehiivIcon,
  SubstackIcon,
  MailchimpIcon,
  ShopifyIcon,
  WordPressIcon,
  GhostIcon,
  TwitterIcon,
  WhatsAppIcon,
  SlackIcon,
  DiscordIcon,
  TelegramIcon,
  TeamsIcon,
} from "@/components/ui/brand-icons";

interface Integration {
  provider: string;
  name: string;
  category: string;
  authType: string;
  availability: string;
  description?: string;
  group?: string | null;
  groupDisplayName?: string | null;
  subLabel?: string | null;
  connected: boolean;
  status?: string;
  account?: {
    externalId: string;
    name: string;
    profileUrl?: string;
    avatarUrl?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: Record<string, any>; // TODO: type provider-specific extras (pages, adAccounts, capabilities, etc.)
  };
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  /** Per-connection webhook health (cron-written; beehiiv-only today).
   *  Absent when integration doesn't use webhooks OR cron hasn't run
   *  on a new connection yet. See peakhour-api integrations/webhook-health.ts */
  webhookHealth?: {
    band: "grey" | "green" | "yellow" | "red";
    computedAt: string;
    postsLast30dViaCron: number;
    postsLast30dViaWebhook: number;
    registeredOnProvider: boolean;
    lastWebhookAt?: string;
    lastWebhookOutcome?: "success" | "signature_invalid" | "parse_error";
    redReason?: "not_registered_on_provider" | "signature_invalid" | "reconciliation_gap";
  };
}

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin_content: LinkedinIcon,
  linkedin_ads: LinkedinIcon,
  facebook: FacebookIcon,
  // Meta virtual providers (flattened from single facebook connection)
  facebook_pages: FacebookIcon,
  instagram: InstagramIcon,
  meta_ads: Megaphone,
  whatsapp: WhatsAppIcon,
  google_ads: GoogleIcon,
  google_analytics: GoogleIcon,
  google_search_console: GoogleIcon,
  google_business_profile: GoogleIcon,
  youtube: YoutubeIcon,
  beehiiv: BeehiivIcon,
  substack: SubstackIcon,
  mailchimp: MailchimpIcon,
  kit: Mail,
  shopify: ShopifyIcon,
  wordpress: WordPressIcon,
  ghost: GhostIcon,
  x: TwitterIcon,
  slack: SlackIcon,
  discord: DiscordIcon,
  telegram: TelegramIcon,
  teams: TeamsIcon,
};

const PROVIDER_COLORS: Record<string, string> = {
  linkedin_content: "bg-[#0A66C2]",
  linkedin_ads: "bg-[#0A66C2]",
  facebook: "bg-[#0668E1]",
  facebook_pages: "bg-[#1877F2]",
  instagram: "bg-[#E4405F]",
  meta_ads: "bg-[#0668E1]",
  whatsapp: "bg-[#25D366]",
  google_ads: "bg-[#4285F4]",
  google_analytics: "bg-[#E37400]",
  google_search_console: "bg-[#458CF7]",
  google_business_profile: "bg-[#34A853]",
  youtube: "bg-[#FF0000]",
  beehiiv: "bg-[#FFD100] text-black",
  substack: "bg-[#FF6719]",
  mailchimp: "bg-[#FFE01B] text-black",
  kit: "bg-[#FB6970]",
  shopify: "bg-[#96BF48]",
  wordpress: "bg-[#21759B]",
  ghost: "bg-[#15171A]",
  x: "bg-black",
  slack: "bg-[#4A154B]",
  discord: "bg-[#5865F2]",
  telegram: "bg-[#26A5E4]",
  teams: "bg-[#6264A7]",
};

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
import {
  flattenMetaIntegration as flattenMetaIntegrationBase,
  resolveProvider,
  isMetaVirtual,
  type MetaVirtualCard,
} from "@/lib/integrations-meta";

function flattenMetaIntegration(integrations: Integration[]): Integration[] {
  return flattenMetaIntegrationBase<Integration>(integrations, (item, card) => {
    const extra = item.account?.extra || {};
    return {
      name: card.name,
      description: card.description,
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

export default function IntegrationsPage() {
  const { org } = useAuth();
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

  useEffect(() => {
    if (!org) return;
    loadIntegrations();
  }, [org?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadIntegrations() {
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

  async function handleConnect(provider: string, authType: string) {
    const realProvider = resolveProvider(provider);
    // Shopify is OAuth2 but its authorize host is per-store — collect the
    // shop domain in a dialog first, then redirect with ?shop=.
    if (realProvider === "shopify") {
      setConnectModal("shopify");
      return;
    }
    if (authType === "oauth2") {
      window.location.href = `${API_BASE_URL}/v1/integrations/${realProvider}/authorize`;
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
        `/v1/integrations/${realProvider}/refresh`,
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
    const realProvider = resolveProvider(provider);
    setDisconnecting(provider);
    try {
      await api.delete(`/v1/integrations/${realProvider}`);
      // Disconnecting facebook removes all virtual Meta cards too
      setIntegrations((prev) =>
        prev.map((i) =>
          resolveProvider(i.provider) === realProvider
            ? { ...i, connected: false, status: "disconnected", account: undefined }
            : i
        )
      );
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground mt-1">
          Connect your platforms to power AI-driven content and ads
        </p>
      </div>

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
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {integrations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="connected">
              Connected
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 bg-green-500/15 text-green-700 dark:text-green-400">
                {connectedCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="disconnected">
              Available
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
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
        <div className="space-y-6">
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
              <h3 className="text-sm font-semibold text-foreground">
                {CATEGORY_LABELS[category] || category}
              </h3>
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

      {/* Beehiiv connect modal */}
      <BeehiivConnectModal
        open={connectModal === "beehiiv"}
        onClose={() => setConnectModal(null)}
        onConnect={(apiKey, publicationId) =>
          handleApiKeyConnect("beehiiv", apiKey, { publicationId })
        }
      />

      {/* Shopify connect modal — collects the store domain, then redirects
          into the per-store OAuth authorize URL. */}
      <ShopifyConnectModal
        open={connectModal === "shopify"}
        onClose={() => setConnectModal(null)}
      />
    </div>
  );
}

// ── Shopify Connect Modal ──────────────────────────────────────────

/** Mirror of the server-side normalizeShopDomain — accepts "acme",
 *  "acme.myshopify.com", or a full URL and returns the canonical domain,
 *  or null if it can't be coerced into a valid myshopify domain. */
function normalizeShopDomain(input: string): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

function ShopifyConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setDomain("");
    setError("");
    setConnecting(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const shop = normalizeShopDomain(domain);
    if (!shop) {
      setError("Enter a valid store domain, e.g. your-store.myshopify.com");
      return;
    }
    setConnecting(true);
    // Redirect into the per-store OAuth authorize URL. The API validates
    // the shop again server-side and signs it into the OAuth state.
    window.location.href = `${API_BASE_URL}/v1/integrations/shopify/authorize?shop=${encodeURIComponent(shop)}`;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#96BF48] text-white">
              <ShopifyIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Connect Shopify</DialogTitle>
              <DialogDescription>
                Sync your catalog and orders to power your store assistant
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="shopify-domain">Store domain</Label>
            <Input
              id="shopify-domain"
              placeholder="your-store.myshopify.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={connecting}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Your permanent Shopify domain &mdash; find it in Shopify admin under
              {" "}<span className="font-medium">Settings &rarr; Domains</span>. You&rsquo;ll
              approve the connection on Shopify next.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={connecting}>
              Cancel
            </Button>
            <Button type="submit" disabled={connecting || !domain.trim()} className="gap-1.5">
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                "Continue to Shopify"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Beehiiv Connect Modal ──────────────────────────────────────────

function BeehiivConnectModal({
  open,
  onClose,
  onConnect,
}: {
  open: boolean;
  onClose: () => void;
  onConnect: (apiKey: string, publicationId: string) => Promise<unknown>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setApiKey("");
    setPublicationId("");
    setError("");
    setConnecting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !publicationId.trim()) return;

    setConnecting(true);
    setError("");

    try {
      await onConnect(apiKey.trim(), publicationId.trim());
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to connect. Please check your credentials and try again.");
      }
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFD100] text-black">
              <BeehiivIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Connect Beehiiv</DialogTitle>
              <DialogDescription>
                Import your newsletters for AI-powered tagging and ads
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="beehiiv-api-key">API Key</Label>
            <Input
              id="beehiiv-api-key"
              type="password"
              placeholder="pk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={connecting}
            />
            <p className="text-xs text-muted-foreground">
              {/* Beehiiv moved both the API-key list AND the publication
                * ID surface under /settings/workspace/api in their latest
                * dashboard rev — both connection inputs now deep-link to
                * the same place. Previously the API-key link pointed at
                * the older /settings/integrations/api URL (404 today) and
                * the publication-ID link pointed at /settings/general
                * (no longer shows the pub_ ID). User-reported. */}
              <a
                href="https://app.beehiiv.com/settings/workspace/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Open Beehiiv API Settings
                <ExternalLink className="h-3 w-3" />
              </a>
              {" "}&mdash; copy the key that starts with <code className="rounded bg-muted px-1 py-0.5">pk_</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beehiiv-pub-id">Publication ID</Label>
            <Input
              id="beehiiv-pub-id"
              placeholder="pub_..."
              value={publicationId}
              onChange={(e) => setPublicationId(e.target.value)}
              disabled={connecting}
            />
            <p className="text-xs text-muted-foreground">
              <a
                href="https://app.beehiiv.com/settings/workspace/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Open Beehiiv API Settings
                <ExternalLink className="h-3 w-3" />
              </a>
              {" "}&mdash; copy the ID that starts with <code className="rounded bg-muted px-1 py-0.5">pub_</code>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={connecting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={connecting || !apiKey.trim() || !publicationId.trim()}
              className="gap-1.5"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Integration Card ───────────────────────────────────────────────

function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onRefresh,
  onSync,
  onBackfillSync,
  onRepairWebhook,
  onChanged,
  backfillResult,
  disconnecting,
  refreshing,
  syncing,
  backfilling,
  repairingWebhook,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onSync: () => void;
  onBackfillSync?: () => Promise<void>;
  /** Called when the user clicks the "Re-register" action on a red
   *  webhook-health chip. The page handler calls
   *  POST /v1/integrations/:provider/repair-webhook and then refetches. */
  onRepairWebhook?: () => Promise<void>;
  /** Called after the Manage Pages dialog persists toggles, so the
   *  parent can refetch /v1/integrations and re-render with the new
   *  capabilities state. */
  onChanged?: () => void;
  backfillResult?: { message: string; hasErrors: boolean } | null;
  disconnecting: boolean;
  refreshing: boolean;
  syncing: boolean;
  backfilling: boolean;
  repairingWebhook: boolean;
}) {
  const { formatDate, formatDateTime } = useLocale();
  const Icon = PROVIDER_ICONS[integration.provider] || Plug;
  const colorClass = PROVIDER_COLORS[integration.provider] || "bg-muted";
  const isComingSoon = integration.availability === "coming_soon";
  // A connection that already has a token but isn't `active` (stale scope /
  // revoked / errored). Reconnecting it starts a fresh OAuth which makes
  // the provider issue a NEW token and invalidate the current one — so we
  // gate it behind a confirm to stop accidental token-killing reconnects
  // (the LinkedIn reconnect loop). A truly fresh/disconnected provider gets
  // the plain one-click Connect.
  const isRecoverable = ["needs_reauth", "expired", "error"].includes(
    integration.status ?? "",
  );

  return (
    <Card className={`group relative overflow-hidden transition-all hover:shadow-md ${
      isComingSoon ? "opacity-50" : ""
    } ${integration.connected ? "ring-1 ring-green-500/20" : ""}`}>
      {/* Connected indicator stripe */}
      {integration.connected && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-green-500" />
      )}

      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          {/* `flex-wrap` lets the webhook health chip drop to a second
              line instead of being clipped by the Card's overflow-hidden
              when the title + Live + Webhook-issue + (optional)
              Re-register button add up to more than the card's width.
              `gap-y-1` keeps the wrapped chip visually tied to the
              title row above. min-w-0 on CardTitle so the title can
              truncate before pushing other items off-screen. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <CardTitle className="min-w-0 truncate text-sm font-semibold leading-snug">
              {integration.name}
            </CardTitle>
            {integration.connected && (
              <Badge className="bg-green-600/90 gap-0.5 text-[10px] px-1.5 py-0 shrink-0">
                <CheckCircle className="h-2.5 w-2.5" />
                Live
              </Badge>
            )}
            {integration.connected && integration.webhookHealth && (
              <WebhookHealthChip
                health={integration.webhookHealth}
                onRepair={onRepairWebhook}
                repairing={repairingWebhook}
                formatDateTime={formatDateTime}
              />
            )}
            {isComingSoon && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                Soon
              </Badge>
            )}
          </div>
          {integration.description && (
            <CardDescription className="mt-0.5 text-[11px] leading-snug line-clamp-2">
              {integration.description}
            </CardDescription>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {integration.connected ? (
          <div className="space-y-2.5">
            {/* Account info — compact */}
            {integration.account && (
              <div className="flex items-center gap-2.5 rounded-md bg-muted/50 px-2.5 py-2">
                {integration.account.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={integration.account.avatarUrl}
                    alt=""
                    className="h-7 w-7 rounded-full ring-1 ring-green-500/30 shrink-0"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 ring-1 ring-green-500/30 shrink-0">
                    <span className="text-[10px] font-medium text-primary">
                      {integration.account.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{integration.account.name}</p>
                  {integration.account.extra?.email && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {integration.account.extra.email}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* LinkedIn Ads — compact status badge + detail dialog */}
            {integration.provider === "linkedin_ads" && integration.account?.extra && (
              <LinkedInAdsStatus
                extra={integration.account.extra}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            )}

            {/* LinkedIn Content — page list + refresh + Manage Pages dialog.
                The dialog sidesteps the disconnect-and-reconnect dance for
                choosing which admin Pages Peakhour can actually post to. */}
            {integration.provider === "linkedin_content" && integration.account?.extra && (
              <LinkedInContentPages
                extra={integration.account.extra}
                onRefresh={onRefresh}
                refreshing={refreshing}
                onChanged={onChanged}
              />
            )}

            {/* Beehiiv sync controls */}
            {integration.provider === "beehiiv" && (
              <BeehiivSyncControls
                integration={integration}
                onSync={onSync}
                onBackfillSync={onBackfillSync}
                backfillResult={backfillResult}
                syncing={syncing}
                backfilling={backfilling}
                formatDateTime={formatDateTime}
              />
            )}

            {/* Last sync for non-beehiiv */}
            {integration.provider !== "beehiiv" && integration.lastSyncAt && (
              <p className="text-[10px] text-muted-foreground">
                Synced {formatDate(integration.lastSyncAt, { month: "short", day: "numeric" })}
              </p>
            )}

            {integration.lastError && (
              <p className="text-[10px] text-destructive truncate">{integration.lastError}</p>
            )}

            {/* Disconnect */}
            <ConfirmDialog
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full gap-1.5 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7"
                  disabled={disconnecting}
                >
                  <Unplug className="h-3 w-3" />
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              }
              title={isMetaVirtual(integration.provider) ? "Disconnect Meta" : "Disconnect integration"}
              description={
                isMetaVirtual(integration.provider)
                  ? "This will disconnect all Meta services (Facebook Pages, Instagram, Meta Ads, WhatsApp). You'll need to reconnect to sync data again."
                  : `Are you sure you want to disconnect ${integration.name}? You'll need to reconnect to sync data again.`
              }
              confirmLabel="Disconnect"
              variant="destructive"
              onConfirm={onDisconnect}
            />
          </div>
        ) : isComingSoon ? (
          <p className="text-[11px] text-muted-foreground">Coming soon</p>
        ) : (
          <div className="space-y-1.5">
            {isRecoverable ? (
              <>
                <ConfirmDialog
                  trigger={
                    <Button size="sm" className="w-full gap-1.5 h-8 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Reconnect
                    </Button>
                  }
                  title={`Reconnect ${integration.name}?`}
                  description="This starts a fresh sign-in and replaces the current access token — the provider invalidates the previous one. Only reconnect if posting is actually failing; repeated reconnects are what break the connection."
                  confirmLabel="Reconnect"
                  onConfirm={onConnect}
                />
                {integration.lastError && (
                  <p className="text-[10px] text-destructive truncate">{integration.lastError}</p>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="w-full gap-1.5 h-8 text-xs"
                onClick={onConnect}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {isMetaVirtual(integration.provider) ? "Connect with Meta" : "Connect"}
              </Button>
            )}
            {isMetaVirtual(integration.provider) && (
              <p className="text-[10px] text-center text-muted-foreground">
                One login connects all Meta services
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Webhook Health Chip ─────────────────────────────────────────────
//
// Compact badge next to the "Live" indicator on connected integration
// cards. Reads `integration.webhookHealth` (cron-written; beehiiv-only
// today). Green is rendered as silence (no chip) so the card stays
// clean when everything's healthy; only grey / yellow / red show.
//
// Hover surfaces the reason in plain English. Red carries a
// "Re-register" action that hits POST /:provider/repair-webhook.
//
// All bands are user-readable explanations — no internal acronyms.

function WebhookHealthChip({
  health,
  onRepair,
  repairing,
  formatDateTime,
}: {
  health: NonNullable<Integration["webhookHealth"]>;
  onRepair?: () => Promise<void>;
  repairing: boolean;
  formatDateTime: (d: string) => string;
}) {
  // Healthy band: silent. Adding a green chip on every healthy card
  // is visual noise — the existing "Live" badge already signals
  // healthy. We surface ONLY when there's something to communicate.
  if (health.band === "green") return null;

  const missing = Math.max(
    0,
    health.postsLast30dViaCron - health.postsLast30dViaWebhook,
  );

  // Per-band copy + style.
  const label =
    health.band === "red"
      ? "Webhook issue"
      : health.band === "yellow"
        ? "Webhook lagging"
        : "Webhook not verified yet";

  const className =
    health.band === "red"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : health.band === "yellow"
        ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"
        : "bg-muted text-muted-foreground border-border";

  const longExplanation = (() => {
    if (health.band === "red") {
      switch (health.redReason) {
        case "not_registered_on_provider":
          return "The webhook is no longer registered on the provider's side — likely revoked in the provider's UI. Click Re-register to fix.";
        case "signature_invalid":
          return "Recent webhooks failed signature verification — usually means the signing secret is out of sync. Click Re-register to rotate.";
        case "reconciliation_gap":
          return `${missing} of your last ${health.postsLast30dViaCron} posts didn't arrive via webhook. The hourly sync rescued them, but real-time delivery is broken.`;
        default:
          return "Webhook delivery looks broken.";
      }
    }
    if (health.band === "yellow") {
      if (missing > 0) {
        return `${missing} of your last ${health.postsLast30dViaCron} posts missed the webhook. The hourly sync picked them up — investigate if this keeps happening.`;
      }
      return "An isolated webhook signature failure was recorded recently. Worth keeping an eye on but no action needed yet.";
    }
    // grey
    return "Not enough recent posts to verify the webhook end-to-end yet. The chip will turn green once you publish a post and the hourly sync confirms it arrived in real time.";
  })();

  // Red bands also render an inline "Re-register" button next to the
  // chip so the action is reachable on touch devices (Tooltip doesn't
  // open on tap) and by keyboard. Tooltip continues to show the long
  // explanation on hover/focus for desktop users.
  const showInlineRepair = health.band === "red" && Boolean(onRepair);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            tabIndex={0}
            className={`gap-0.5 text-[10px] px-1.5 py-0 shrink-0 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px] text-[11px] space-y-1.5">
          <p>{longExplanation}</p>
          {health.lastWebhookAt && (
            <p className="text-muted-foreground">
              Last webhook: {formatDateTime(health.lastWebhookAt)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
      {showInlineRepair && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-5 text-[10px] px-1.5 shrink-0"
          onClick={() => {
            void onRepair!();
          }}
          disabled={repairing}
        >
          {repairing ? "Re-registering…" : "Re-register"}
        </Button>
      )}
    </TooltipProvider>
  );
}

// ── Beehiiv Sync Controls ───────────────────────────────────────────

function BeehiivSyncControls({
  integration,
  onSync,
  onBackfillSync,
  backfillResult,
  syncing,
  backfilling,
  formatDateTime,
}: {
  integration: Integration;
  onSync: () => void;
  onBackfillSync?: () => Promise<void>;
  backfillResult?: { message: string; hasErrors: boolean } | null;
  syncing: boolean;
  backfilling: boolean;
  formatDateTime: (d: string) => string;
}) {
  return (
    <div className="space-y-2">
      {integration.lastSyncAt && (
        <p className="text-[10px] text-muted-foreground">
          Last synced {formatDateTime(integration.lastSyncAt)}
        </p>
      )}

      {backfillResult && (
        <div className={`rounded-md border px-2.5 py-1.5 text-[10px] flex items-center gap-1.5 ${
          backfillResult.hasErrors
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
        }`}>
          {backfillResult.hasErrors ? (
            <AlertCircle className="h-3 w-3 shrink-0" />
          ) : (
            <CheckCircle className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{backfillResult.message}</span>
        </div>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1 text-[10px] h-7"
          onClick={onSync}
          disabled={syncing || backfilling}
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </Button>
        {onBackfillSync && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1 text-[10px] h-7"
            onClick={onBackfillSync}
            disabled={syncing || backfilling}
          >
            {backfilling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {backfilling ? "Importing..." : "Import all"}
          </Button>
        )}
      </div>
      {backfilling && (
        <p className="text-[10px] text-muted-foreground">
          This may take a minute. Please don&apos;t close this page.
        </p>
      )}
    </div>
  );
}

// ── LinkedIn Content — Page list + refresh ──────────────────────────
//
// Replaces the "disconnect and reconnect to pick up new Pages" friction.
// Click Refresh → calls /v1/integrations/linkedin_content/refresh →
// peakhour-api re-runs getAccountInfo → fresh /organizationAcls + per-row
// /organizations/{id} hits → connection.account.extra.pages re-populated
// with any newly-admin'd Pages and updated names. Use case: a user gets
// promoted to Super Admin on a new client Page after their initial
// Connect; one click here picks it up without OAuth round-trip.

// Auto-poll cadence for the names-pending state: 10 sec between
// attempts, max ~8 attempts (~80 sec) before giving up. peakhour-api's
// linkedin_post_sync background job typically hydrates names within
// ~1 min of OAuth callback (depends on jobs-runner cron interval), so
// 80 sec gives us a comfortable margin.
const NAMES_POLL_INTERVAL_MS = 10_000;
const NAMES_POLL_MAX_ATTEMPTS = 8;

function LinkedInContentPages({
  extra,
  onRefresh,
  refreshing,
  onChanged,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onRefresh: () => void;
  refreshing: boolean;
  onChanged?: () => void;
}) {
  const pages = Array.isArray(extra?.pages) ? extra.pages : [];
  const [manageOpen, setManageOpen] = useState(false);

  // The OAuth callback skips per-Page name hydration to redirect fast
  // (peakhour-api PR #247). Names land within ~1 min via a background
  // job. Detect the "pages exist but all unnamed" state and:
  //   1. Show a "Fetching Page names from LinkedIn…" indicator so the
  //      user sees it's an in-progress operation, not a bug
  //   2. Auto-poll /refresh every 10 sec until names arrive (capped at
  //      ~80 sec to avoid hammering the API if the background job
  //      stalls — user can still click Refresh manually after that)
  const namesPending =
    pages.length > 0 &&
    pages.every(
      (p: { organizationName?: string }) => !p.organizationName,
    );
  const [attempts, setAttempts] = useState(0);

  // Latest-ref pattern: the parent passes a fresh `onRefresh` closure
  // on every render (it's an inline `() => handleRefresh(provider)`),
  // so depending on it directly would re-fire the effect on every
  // parent re-render and reset the polling timer forever. Hold the
  // latest ref and keep the effect depending only on real state.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    // Reset attempt count once names land — if the user later
    // disconnects + reconnects, the pending state re-opens with a
    // fresh budget.
    if (!namesPending) {
      if (attempts !== 0) setAttempts(0);
      return;
    }
    if (refreshing) return; // don't pile on while a refresh is in-flight
    if (attempts >= NAMES_POLL_MAX_ATTEMPTS) return;

    const id = setTimeout(() => {
      setAttempts((a) => a + 1);
      onRefreshRef.current();
    }, NAMES_POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [namesPending, refreshing, attempts]);

  const showPollGaveUp = namesPending && attempts >= NAMES_POLL_MAX_ATTEMPTS;

  return (
    <div className="space-y-1.5 rounded-md border border-border/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {pages.length === 0
            ? "No company pages found"
            : `${pages.length} company page${pages.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-1">
          {pages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setManageOpen(true)}
              className="h-6 gap-1 px-1.5 text-[10px]"
            >
              <Settings2 className="h-2.5 w-2.5" />
              Manage
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-6 gap-1 px-1.5 text-[10px]"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </div>

      <ManagePagesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        extra={extra}
        onChanged={onChanged}
      />

      {namesPending && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
        >
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          <span>
            {showPollGaveUp
              ? "Page names still loading — tap Refresh to retry."
              : "Fetching Page names from LinkedIn…"}
          </span>
        </div>
      )}

      {pages.length > 0 && (
        <ul className="space-y-0.5 text-[10px] text-muted-foreground">
          {pages.slice(0, 3).map((p: { organizationId: string; organizationName?: string }) => (
            <li key={p.organizationId} className="truncate">
              • {p.organizationName || `Page ${p.organizationId}`}
            </li>
          ))}
          {pages.length > 3 && (
            <li className="italic opacity-70">+ {pages.length - 3} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── LinkedIn Ads Status — compact badge + detail dialog ─────────────

function LinkedInAdsStatus({
  extra,
  onRefresh,
  refreshing,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>; // TODO: type LinkedIn ads extras
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adAccounts: any[] = extra.adAccounts || []; // TODO: type LinkedIn ad accounts

  // Compute issues
  const issues: Array<{
    accountName: string;
    alert: { title: string; message: string; actionUrl?: string; actionLabel?: string };
  }> = [];

  if (adAccounts.length === 0) {
    issues.push({
      accountName: "LinkedIn Ads",
      alert: {
        title: "No Ad Account found",
        message:
          "You need a LinkedIn Ad Account to run campaigns. Create one, then come back and refresh.",
        actionUrl: "https://www.linkedin.com/campaignmanager/new-advertiser",
        actionLabel: "Create Ad Account on LinkedIn",
      },
    });
  } else {
    for (const acc of adAccounts) {
      const serving = acc.servingStatuses || [];
      if (!serving.includes("RUNNABLE")) {
        const alert = getServingAlert(serving);
        if (alert) {
          issues.push({ accountName: acc.name || acc.id, alert });
        }
      }
    }
  }

  const readyCount = adAccounts.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => (a.servingStatuses || []).includes("RUNNABLE"),
  ).length;

  // All good — compact green summary
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-green-700 dark:text-green-400">
        <CheckCircle className="h-3 w-3 shrink-0" />
        <span>{adAccounts.length} ad account{adAccounts.length !== 1 ? "s" : ""} ready</span>
      </div>
    );
  }

  // Has issues — compact amber badge that opens dialog
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-700 dark:text-amber-400 transition-colors hover:bg-amber-500/20"
      >
        <AlertCircle className="h-3 w-3 shrink-0" />
        <span className="flex-1 text-left font-medium">
          {issues.length} issue{issues.length !== 1 ? "s" : ""} pending action
        </span>
        {readyCount > 0 && (
          <Badge className="bg-green-600/90 text-[9px] px-1 py-0 shrink-0">
            {readyCount} ready
          </Badge>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkedinIcon className="h-5 w-5 text-[#0A66C2]" />
              LinkedIn Ad Accounts
            </DialogTitle>
            <DialogDescription>
              {adAccounts.length} account{adAccounts.length !== 1 ? "s" : ""} found
              {issues.length > 0 && ` · ${issues.length} need${issues.length === 1 ? "s" : ""} attention`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* Ready accounts */}
            {adAccounts
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((a: any) => (a.servingStatuses || []).includes("RUNNABLE"))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((acc: any) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"
                >
                  <span className="font-medium truncate">{acc.name || acc.id}</span>
                  <StatusBadge status="ready" dot className="text-xs shrink-0" />
                </div>
              ))}

            {/* Issues */}
            {issues.map((issue, i) => (
              <div
                key={i}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{issue.accountName}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-amber-600 border-amber-400 px-1.5 py-0 shrink-0"
                  >
                    Action needed
                  </Badge>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <p className="font-medium">{issue.alert.title}</p>
                  <p className="leading-relaxed text-muted-foreground">
                    {issue.alert.message}
                  </p>
                  {issue.alert.actionUrl && (
                    <a
                      href={issue.alert.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
                    >
                      {issue.alert.actionLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onRefresh();
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh status"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getServingAlert(statuses: string[]): {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
} | null {
  if (statuses.includes("BILLING_HOLD")) {
    return {
      title: "Payment method needed",
      message: "Add a credit card or payment method to your LinkedIn Ad Account to start running campaigns.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Add payment on LinkedIn",
    };
  }
  if (statuses.includes("ACCOUNT_TOTAL_BUDGET_HOLD")) {
    return {
      title: "Budget limit reached",
      message: "Your ad account has reached its total budget limit. Increase the budget to resume campaigns.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Update budget on LinkedIn",
    };
  }
  if (statuses.includes("ACCOUNT_END_DATE_HOLD")) {
    return {
      title: "Account end date passed",
      message: "Your ad account's end date has passed. Extend the date to resume campaigns.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Update end date on LinkedIn",
    };
  }
  if (statuses.includes("STOPPED")) {
    return {
      title: "Account stopped",
      message: "This ad account has been manually stopped. Reactivate it in LinkedIn Campaign Manager to resume.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Reactivate on LinkedIn",
    };
  }
  if (statuses.includes("RESTRICTED_HOLD")) {
    return {
      title: "Account restricted",
      message: "LinkedIn has restricted this ad account. Contact LinkedIn support for more details.",
      actionUrl: "https://www.linkedin.com/help/lms",
      actionLabel: "Contact LinkedIn support",
    };
  }
  if (statuses.includes("INTERNAL_HOLD")) {
    return {
      title: "Temporarily on hold",
      message: "LinkedIn has placed a temporary hold on this account. This usually resolves automatically — try refreshing later.",
    };
  }
  return {
    title: "Not ready to serve",
    message: "This account isn't ready to run ads yet. Check LinkedIn Campaign Manager for details.",
    actionUrl: "https://www.linkedin.com/campaignmanager",
    actionLabel: "Check on LinkedIn",
  };
}

// ── Manage Pages dialog ────────────────────────────────────────────
//
// Per-page on/off switches backed by PATCH /v1/integrations/linkedin_content/pages.
// The endpoint enforces the org's plan cap server-side and returns 429
// PLAN_LIMIT_REACHED on toggle-on at the cap — we surface that as a
// disabled switch + tooltip pointing at /dashboard/settings/billing.
// Toggle-off is always allowed so legacy over-cap rows can trim down.

interface AdminPage {
  organizationId: string;
  organizationName?: string;
  role?: string;
}

function ManagePagesDialog({
  open,
  onOpenChange,
  extra,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onChanged?: () => void;
}) {
  const { entitlements } = useAuth();
  const pages: AdminPage[] = Array.isArray(extra?.pages) ? extra.pages : [];
  const cap = entitlements?.limits.maxLinkedInPagesPerBusiness;
  const planLabel = entitlements?.plan ?? "your";

  // Seed local state from the connection's persisted set. Missing
  // `enabledResourceIds` (legacy rows, fresh OAuth before the API
  // onConnect seeder ran) means "all admin pages enabled" — the b2c
  // mirror of the `/me` filter's legacy compat.
  const persistedIds: string[] | null = useMemo(() => {
    const caps = extra?.capabilities as
      | { pages?: { enabledResourceIds?: string[] } }
      | undefined;
    const ids = caps?.pages?.enabledResourceIds;
    return Array.isArray(ids) ? ids : null;
  }, [extra]);

  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => {
    if (persistedIds === null) return new Set(pages.map((p) => p.organizationId));
    return new Set(persistedIds);
  });

  // Re-seed when the dialog re-opens against a refreshed connection.
  // Without this, a Refresh of the integration tile (which fetches
  // updated `extra`) wouldn't propagate into the dialog's switches
  // until the user closed and reopened the dialog twice.
  useEffect(() => {
    if (!open) return;
    if (persistedIds === null) {
      setEnabledIds(new Set(pages.map((p) => p.organizationId)));
    } else {
      setEnabledIds(new Set(persistedIds));
    }
  }, [open, persistedIds, pages]);

  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const enabledCount = enabledIds.size;
  const atCap = typeof cap === "number" && enabledCount >= cap;
  const overCap = typeof cap === "number" && enabledCount > cap; // legacy state

  async function togglePage(pageId: string, next: boolean) {
    if (pending.has(pageId)) return;
    setError(null);

    // Optimistic — flip THIS pageId via the updater form so two rapid
    // clicks on DIFFERENT pages don't clobber each other (each click
    // would otherwise capture a stale `enabledIds` closure from before
    // the other's `setEnabledIds` committed). Rollback below uses the
    // same per-pageId updater form so a failed toggle only reverts its
    // own flip, leaving other concurrent successes intact.
    setEnabledIds((prev) => {
      const optimistic = new Set(prev);
      if (next) optimistic.add(pageId);
      else optimistic.delete(pageId);
      return optimistic;
    });

    setPending((p) => new Set(p).add(pageId));
    try {
      await api.patch("/v1/integrations/linkedin_content/pages", {
        pageId,
        enabled: next,
      });
      onChanged?.();
    } catch (err) {
      // Roll back this pageId only — never overwrite the whole set,
      // since other concurrent toggles may have landed in the meantime.
      setEnabledIds((prev) => {
        const reverted = new Set(prev);
        if (next) reverted.delete(pageId);
        else reverted.add(pageId);
        return reverted;
      });
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update page. Please try again.");
      }
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(pageId);
        return n;
      });
    }
  }

  const capLabel =
    typeof cap === "number"
      ? `${enabledCount} of ${cap} active on your ${planLabel} plan`
      : `${enabledCount} active · unlimited on your ${planLabel} plan`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A66C2] text-white">
              <LinkedinIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Manage LinkedIn pages</DialogTitle>
              <DialogDescription>{capLabel}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {overCap && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
            You have more pages enabled than your plan allows. They keep
            posting for now, but new toggles are blocked until you disable a
            page or upgrade.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            {error}
          </div>
        )}

        <TooltipProvider delayDuration={150}>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {pages.map((p) => {
              const isOn = enabledIds.has(p.organizationId);
              const isPending = pending.has(p.organizationId);
              // Disable toggle-on when at cap AND this page is currently
              // OFF. A page that's already ON keeps its switch active so
              // the user can turn it off (always allowed).
              const switchDisabled = isPending || (atCap && !isOn);
              const switchEl = (
                <Switch
                  checked={isOn}
                  disabled={switchDisabled}
                  onCheckedChange={(v) => togglePage(p.organizationId, v)}
                  aria-label={`Toggle ${p.organizationName || p.organizationId}`}
                />
              );
              return (
                <li
                  key={p.organizationId}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.organizationName || `Page ${p.organizationId}`}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {p.role && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                          {p.role}
                        </span>
                      )}
                      <a
                        href={`https://www.linkedin.com/company/${p.organizationId}/admin/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
                      >
                        Manage on LinkedIn
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                  {switchDisabled && atCap && !isOn ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>{switchEl}</span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px] text-[11px]">
                        Plan cap reached. Disable another page or upgrade your plan
                        to enable more.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    switchEl
                  )}
                </li>
              );
            })}
          </ul>
        </TooltipProvider>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {atCap ? (
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard/settings/billing">Upgrade plan</a>
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
