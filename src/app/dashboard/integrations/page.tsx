"use client";

import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plug,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Unplug,
  Linkedin,
  Facebook,
  Instagram,
  Chrome,
  Mail,
  ShoppingBag,
  Rss,
  RefreshCw,
  Loader2,
  Download,
  Megaphone,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

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
    extra?: Record<string, any>;
  };
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
}

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  linkedin_content: Linkedin,
  linkedin_ads: Linkedin,
  facebook: Facebook,
  google_ads: Chrome,
  youtube: Chrome,
  beehiiv: Mail,
  substack: Mail,
  mailchimp: Mail,
  kit: Mail,
  shopify: ShoppingBag,
  wordpress: Rss,
  ghost: Rss,
  x: Rss,
};

const PROVIDER_COLORS: Record<string, string> = {
  linkedin_content: "bg-[#0A66C2]",
  linkedin_ads: "bg-[#0A66C2]",
  facebook: "bg-[#0668E1]",
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
};

// ── Meta capability definitions ──────────────────────────────

interface MetaCapabilityDef {
  key: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  resourceLabel: string;
  getResources: (extra: Record<string, any>) => Array<{ id: string; label: string }>;
  getActiveId: (extra: Record<string, any>) => string | undefined;
}

const META_CAPABILITIES: MetaCapabilityDef[] = [
  {
    key: "pages",
    label: "Facebook Pages",
    icon: Facebook,
    iconColor: "text-[#1877F2]",
    resourceLabel: "Active Page",
    getResources: (extra) =>
      (extra.pages || []).map((p: any) => ({ id: p.pageId, label: p.pageName })),
    getActiveId: (extra) => extra.primaryPageId,
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    iconColor: "text-[#E4405F]",
    resourceLabel: "Account",
    getResources: (extra) =>
      (extra.pages || [])
        .filter((p: any) => p.instagramAccountId)
        .map((p: any) => ({
          id: p.instagramAccountId,
          label: `@${p.instagramUsername}` + (p.instagramFollowers ? ` (${p.instagramFollowers})` : ""),
        })),
    getActiveId: (extra) => extra.instagramAccountId,
  },
  {
    key: "ads",
    label: "Ads Manager",
    icon: Megaphone,
    iconColor: "text-[#0668E1]",
    resourceLabel: "Ad Account",
    getResources: (extra) =>
      (extra.adAccounts || []).map((a: any) => ({
        id: a.id,
        label: `${a.name} (${a.currency})`,
      })),
    getActiveId: (extra) => extra.primaryAdAccountId,
  },
  {
    key: "whatsapp",
    label: "WhatsApp Business",
    icon: MessageSquare,
    iconColor: "text-[#25D366]",
    resourceLabel: "Phone Number",
    getResources: (extra) =>
      (extra.whatsappAccounts || []).flatMap((w: any) =>
        (w.phoneNumbers || []).map((p: any) => ({
          id: p.id,
          label: `${p.displayPhoneNumber} (${p.verifiedName})`,
        }))
      ),
    getActiveId: (extra) => extra.primaryWhatsAppId,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social Media",
  newsletter: "Newsletters & Email",
  advertising: "Advertising",
  ecommerce: "E-Commerce",
  cms: "Content Management",
  analytics: "Analytics",
};

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

  useEffect(() => {
    if (!org) return;
    loadIntegrations();
  }, [org?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadIntegrations() {
    try {
      const data = await api.get<{ integrations: Integration[] }>("/v1/integrations");
      setIntegrations(data.integrations);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider: string, authType: string) {
    if (authType === "oauth2") {
      window.location.href = `${API_BASE_URL}/v1/integrations/${provider}/authorize`;
    } else if (authType === "api_key") {
      setConnectModal(provider);
    }
  }

  async function handleApiKeyConnect(provider: string, apiKey: string, config: Record<string, string>) {
    const result = await api.post<{
      provider: string;
      status: string;
      account: { externalId: string; name: string };
    }>(`/v1/integrations/${provider}/connect`, { apiKey, config });

    // Refresh the full list to get updated state
    await loadIntegrations();
    setConnectModal(null);
    return result;
  }

  async function handleRefresh(provider: string) {
    setRefreshing(provider);
    setError("");
    try {
      const result = await api.post<{ account: Integration["account"] }>(
        `/v1/integrations/${provider}/refresh`,
        {}
      );
      setIntegrations((prev) =>
        prev.map((i) =>
          i.provider === provider ? { ...i, account: result.account } : i
        )
      );
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to refresh. Please try again.");
    } finally {
      setRefreshing(null);
    }
  }

  async function handleSync(provider: string) {
    setSyncing(provider);
    setError("");
    try {
      await api.post(`/v1/integrations/${provider}/sync`, {});
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

      // Auto-tag remaining posts in batches (5 at a time)
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
          // If tagging fails, stop gracefully — cron will catch up
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

  async function handleCapabilityToggle(
    provider: string,
    capability: string,
    enabled: boolean,
    activeResourceId?: string
  ) {
    try {
      await api.patch(`/v1/integrations/${provider}/capabilities`, {
        capability,
        enabled,
        activeResourceId,
      });
      await loadIntegrations();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to update capability");
    }
  }

  async function handleDisconnect(provider: string) {
    setDisconnecting(provider);
    try {
      await api.delete(`/v1/integrations/${provider}`);
      setIntegrations((prev) =>
        prev.map((i) =>
          i.provider === provider
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

  // Group by category
  const grouped = integrations.reduce<Record<string, Integration[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground mt-1">
          Connect your ad platforms, content sources, and social accounts
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="h-20 animate-pulse rounded-lg bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <IntegrationCard
                  key={item.provider}
                  integration={item}
                  onConnect={() => handleConnect(item.provider, item.authType)}
                  onDisconnect={() => handleDisconnect(item.provider)}
                  onRefresh={() => handleRefresh(item.provider)}
                  onSync={() => handleSync(item.provider)}
                  onCapabilityToggle={(capability, enabled, activeResourceId) =>
                    handleCapabilityToggle(item.provider, capability, enabled, activeResourceId)
                  }
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
  onConnect: (apiKey: string, publicationId: string) => Promise<any>;
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
              <Mail className="h-5 w-5" />
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
  onCapabilityToggle,
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
  onCapabilityToggle?: (capability: string, enabled: boolean, activeResourceId?: string) => Promise<void>;
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
    <Card className={`transition-shadow hover:shadow-md ${isComingSoon ? "opacity-60" : ""}`}>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base leading-snug">
            {integration.name}
            {integration.subLabel && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({integration.subLabel})
              </span>
            )}
          </CardTitle>
          {integration.description && (
            <CardDescription className="mt-0.5 text-xs line-clamp-2">
              {integration.description}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {integration.connected ? (
          <div className="space-y-3">
            {/* Account card */}
            {integration.account && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 border px-3 py-2.5">
                {integration.account.avatarUrl ? (
                  <img
                    src={integration.account.avatarUrl}
                    alt=""
                    className="h-9 w-9 rounded-full ring-2 ring-green-500/30 shrink-0"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-2 ring-green-500/30 shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {integration.account.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{integration.account.name}</p>
                  {integration.account.extra?.email && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {integration.account.extra.email}
                    </p>
                  )}
                </div>
                <Badge className="bg-green-600/90 gap-1 text-[10px] shrink-0">
                  <CheckCircle className="h-2.5 w-2.5" />
                  Live
                </Badge>
              </div>
            )}

            {/* Connected timestamp */}
            {integration.connectedAt && (
              <p className="text-[11px] text-muted-foreground">
                Connected {formatDate(integration.connectedAt, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}

            {/* LinkedIn Ads: show ad accounts or warning */}
            {integration.provider === "linkedin_ads" && integration.account?.extra && (
              <LinkedInAdAccounts
                extra={integration.account.extra}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            )}

            {/* Meta: show capability toggles + resource selectors */}
            {integration.provider === "facebook" && integration.account?.extra && onCapabilityToggle && (
              <MetaCapabilities
                extra={integration.account.extra}
                onToggle={onCapabilityToggle}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            )}

            {/* Sync controls for Beehiiv */}
            {integration.provider === "beehiiv" && (
              <div className="space-y-2">
                {integration.lastSyncAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Last synced {formatDateTime(integration.lastSyncAt)}
                  </p>
                )}

                {/* Backfill result banner */}
                {backfillResult && (
                  <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
                    backfillResult.hasErrors
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                  }`}>
                    {backfillResult.hasErrors ? (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {backfillResult.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={onSync}
                    disabled={syncing || backfilling}
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync new posts"}
                  </Button>
                  {onBackfillSync && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={onBackfillSync}
                      disabled={syncing || backfilling}
                    >
                      {backfilling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      {backfilling ? "Importing & tagging..." : "Import & tag all posts"}
                    </Button>
                  )}
                </div>
                {backfilling && (
                  <p className="text-[11px] text-muted-foreground">
                    This may take a minute for large newsletters. Please don&apos;t close this page.
                  </p>
                )}
              </div>
            )}

            {/* Last sync for non-beehiiv */}
            {integration.provider !== "beehiiv" && integration.lastSyncAt && (
              <p className="text-[11px] text-muted-foreground">
                Last synced {formatDate(integration.lastSyncAt)}
              </p>
            )}

            {integration.lastError && (
              <p className="text-xs text-destructive truncate">{integration.lastError}</p>
            )}

            <ConfirmDialog
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={disconnecting}
                >
                  <Unplug className="h-3.5 w-3.5" />
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              }
              title="Disconnect integration"
              description={`Are you sure you want to disconnect ${integration.name}? You'll need to reconnect to sync data again.`}
              confirmLabel="Disconnect"
              variant="destructive"
              onConfirm={onDisconnect}
            />
          </div>
        ) : isComingSoon ? (
          <Badge variant="outline" className="text-xs">Coming soon</Badge>
        ) : (
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={onConnect}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Meta Capabilities sub-component ─────────────────────────────────

function MetaCapabilities({
  extra,
  onToggle,
  onRefresh,
  refreshing,
}: {
  extra: Record<string, any>;
  onToggle: (capability: string, enabled: boolean, activeResourceId?: string) => Promise<void>;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [toggling, setToggling] = useState<string | null>(null);

  // Capability enabled state from backend config (default: enabled if resources exist)
  const capabilitiesConfig = (extra.capabilities || {}) as Record<
    string,
    { enabled?: boolean; activeResourceId?: string }
  >;

  function isCapabilityEnabled(key: string, hasResources: boolean): boolean {
    const cfg = capabilitiesConfig[key];
    // Default: enabled if resources exist and not explicitly disabled
    if (!cfg || cfg.enabled === undefined) return hasResources;
    return cfg.enabled;
  }

  function getActiveResourceId(key: string, fallbackId?: string): string | undefined {
    return capabilitiesConfig[key]?.activeResourceId || fallbackId;
  }

  async function handleToggle(capability: string, enabled: boolean) {
    setToggling(capability);
    try {
      await onToggle(capability, enabled);
    } finally {
      setToggling(null);
    }
  }

  async function handleResourceChange(capability: string, resourceId: string) {
    setToggling(capability);
    try {
      await onToggle(capability, true, resourceId);
    } finally {
      setToggling(null);
    }
  }

  const hasAnyResources = META_CAPABILITIES.some(
    (cap) => cap.getResources(extra).length > 0
  );

  return (
    <div className="space-y-2">
      {!hasAnyResources && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            No accounts found
          </div>
          <p className="leading-relaxed">
            No Facebook Pages, Instagram accounts, or Ad accounts were found.
            Make sure you have admin access to at least one Facebook Page, then refresh.
          </p>
        </div>
      )}

      {META_CAPABILITIES.map((cap) => {
        const resources = cap.getResources(extra);
        const hasResources = resources.length > 0;
        const enabled = isCapabilityEnabled(cap.key, hasResources);
        const activeId = getActiveResourceId(cap.key, cap.getActiveId(extra));
        const isToggling = toggling === cap.key;
        const CapIcon = cap.icon;

        return (
          <div
            key={cap.key}
            className={`rounded-lg border px-3 py-2.5 text-xs space-y-2 transition-opacity ${
              !enabled && hasResources ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CapIcon className={`h-3.5 w-3.5 shrink-0 ${cap.iconColor}`} />
                <span className="font-medium truncate">{cap.label}</span>
                {hasResources ? (
                  <Badge className="bg-green-600/90 text-[10px] gap-0.5 shrink-0">
                    {resources.length}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                    None
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isToggling && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                <Switch
                  checked={enabled}
                  disabled={!hasResources || isToggling}
                  onCheckedChange={(checked) => handleToggle(cap.key, checked)}
                  aria-label={`Toggle ${cap.label}`}
                  className="scale-75"
                />
              </div>
            </div>

            {/* Resource selector — show when enabled and multiple resources */}
            {enabled && hasResources && resources.length > 1 && (
              <Select
                value={activeId || resources[0]?.id}
                onValueChange={(value) => handleResourceChange(cap.key, value)}
                disabled={isToggling}
              >
                <SelectTrigger size="sm" className="w-full text-[11px] h-7">
                  <SelectValue placeholder={`Select ${cap.resourceLabel}`} />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Single resource — just show the name */}
            {enabled && hasResources && resources.length === 1 && (
              <p className="text-[11px] text-muted-foreground truncate pl-6">
                {resources[0].label}
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing..." : "Refresh accounts"}
      </button>
    </div>
  );
}

// ── LinkedIn Ad Accounts sub-component ─────────────────────────────

function LinkedInAdAccounts({
  extra,
  onRefresh,
  refreshing,
}: {
  extra: Record<string, any>;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (extra.adAccounts?.length > 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Ad Accounts ({extra.adAccounts.length})
        </p>
        {extra.adAccounts.map((acc: any) => {
          const serving = acc.servingStatuses || [];
          const isRunnable = serving.includes("RUNNABLE");
          const alert = !isRunnable ? getServingAlert(serving) : null;
          return (
            <div key={acc.id} className="rounded-lg border px-3 py-2 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{acc.name || acc.id}</span>
                {isRunnable ? (
                  <StatusBadge status="ready" dot className="text-[10px] shrink-0" />
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400 shrink-0">
                    Action needed
                  </Badge>
                )}
              </div>
              {alert && (
                <div className="rounded-md bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
                  <p className="font-medium">{alert.title}</p>
                  <p className="leading-relaxed">{alert.message}</p>
                  {alert.actionUrl && (
                    <a
                      href={alert.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
                    >
                      {alert.actionLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh status"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400 space-y-2">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        No Ad Account found
      </div>
      <p className="leading-relaxed">
        You need a LinkedIn Ad Account to run campaigns. Create one, then come back and refresh.
      </p>
      <div className="flex flex-col gap-2 pt-0.5">
        <a
          href="https://www.linkedin.com/campaignmanager/new-advertiser"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300 hover:opacity-80"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Step 1: Create Ad Account on LinkedIn
        </a>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300 hover:opacity-80 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Checking..." : "Step 2: I\u2019ve created it \u2014 Refresh"}
        </button>
      </div>
    </div>
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
