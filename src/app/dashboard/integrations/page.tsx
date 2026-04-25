"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
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

export default function IntegrationsPage() {
  const { org } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
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
                  backfillResult={item.provider === "beehiiv" ? backfillResult : null}
                  disconnecting={disconnecting === item.provider}
                  refreshing={refreshing === item.provider}
                  syncing={syncing === item.provider}
                  backfilling={item.provider === "beehiiv" ? backfilling : false}
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
    </div>
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
              <a
                href="https://app.beehiiv.com/settings/integrations/api"
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
                href="https://app.beehiiv.com/settings/general"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Open Beehiiv General Settings
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
  backfillResult,
  disconnecting,
  refreshing,
  syncing,
  backfilling,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onSync: () => void;
  onBackfillSync?: () => Promise<void>;
  backfillResult?: { message: string; hasErrors: boolean } | null;
  disconnecting: boolean;
  refreshing: boolean;
  syncing: boolean;
  backfilling: boolean;
}) {
  const { formatDate, formatDateTime } = useLocale();
  const Icon = PROVIDER_ICONS[integration.provider] || Plug;
  const colorClass = PROVIDER_COLORS[integration.provider] || "bg-muted";
  const isComingSoon = integration.availability === "coming_soon";

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
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold leading-snug">
              {integration.name}
            </CardTitle>
            {integration.connected && (
              <Badge className="bg-green-600/90 gap-0.5 text-[10px] px-1.5 py-0 shrink-0">
                <CheckCircle className="h-2.5 w-2.5" />
                Live
              </Badge>
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
            <Button
              size="sm"
              className="w-full gap-1.5 h-8 text-xs"
              onClick={onConnect}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isMetaVirtual(integration.provider) ? "Connect with Meta" : "Connect"}
            </Button>
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
