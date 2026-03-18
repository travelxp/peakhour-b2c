"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plug,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Unplug,
  Linkedin,
  Facebook,
  Chrome,
  Mail,
  ShoppingBag,
  Rss,
  RefreshCw,
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
  instagram: Facebook,
  google_ads: Chrome,
  youtube: Chrome,
  beehiiv: Mail,
  substack: Mail,
  mailchimp: Mail,
  shopify: ShoppingBag,
  wordpress: Rss,
  ghost: Rss,
  x: Rss,
};

const PROVIDER_COLORS: Record<string, string> = {
  linkedin_content: "bg-[#0A66C2]",
  linkedin_ads: "bg-[#0A66C2]",
  facebook: "bg-[#1877F2]",
  instagram: "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
  google_ads: "bg-[#4285F4]",
  youtube: "bg-[#FF0000]",
  beehiiv: "bg-[#FFD100] text-black",
  substack: "bg-[#FF6719]",
  mailchimp: "bg-[#FFE01B] text-black",
  shopify: "bg-[#96BF48]",
  wordpress: "bg-[#21759B]",
  ghost: "bg-[#15171A]",
  x: "bg-black",
};

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
    }
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
                  disconnecting={disconnecting === item.provider}
                  refreshing={refreshing === item.provider}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onRefresh,
  disconnecting,
  refreshing,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  disconnecting: boolean;
  refreshing: boolean;
}) {
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
                Connected {new Date(integration.connectedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}

            {/* LinkedIn Ads: show ad accounts or warning */}
            {integration.provider === "linkedin_ads" && integration.account?.extra && (
              <>
                {integration.account.extra.adAccounts?.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Ad Accounts ({integration.account.extra.adAccounts.length})
                    </p>
                    {integration.account.extra.adAccounts.map((acc: any) => {
                      const serving = acc.servingStatuses || [];
                      const isRunnable = serving.includes("RUNNABLE");
                      const alert = !isRunnable ? getServingAlert(serving) : null;
                      return (
                        <div key={acc.id} className="rounded-lg border px-3 py-2 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{acc.name || acc.id}</span>
                            {isRunnable ? (
                              <Badge className="bg-green-600/90 text-[10px] gap-1 shrink-0">
                                <CheckCircle className="h-2.5 w-2.5" />
                                Ready
                              </Badge>
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
                ) : (
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
                )}
              </>
            )}

            {integration.lastSyncAt && (
              <p className="text-[11px] text-muted-foreground">
                Last synced {new Date(integration.lastSyncAt).toLocaleDateString()}
              </p>
            )}
            {integration.lastError && (
              <p className="text-xs text-destructive truncate">{integration.lastError}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDisconnect}
              disabled={disconnecting}
            >
              <Unplug className="h-3.5 w-3.5" />
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
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
