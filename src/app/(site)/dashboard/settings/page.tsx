"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { IntegrationFitAttention } from "@/components/integrations/integration-fit-attention";
import { RequestReviewButton } from "@/components/integrations/request-review-button";
import { CreateWorkspaceButton } from "@/components/integrations/create-workspace-button";
import { ContactSupportDialog } from "@/components/support/contact-support-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Plug,
  ArrowRight,
  Building2,
  Wallet,
  Shield,
  Tags,
  CheckCircle2,
  AlertCircle,
  Pencil,
  X,
  Check,
  Plus,
  Globe2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface OrgDetails {
  _id: string;
  name: string;
  slug: string;
  businessCategory?: string;
  businessType?: string;
  websiteUrl?: string;
  adPlatforms?: {
    linkedin?: {
      connected?: boolean;
      adAccountName?: string;
      linkedInProfileName?: string;
      connectedAt?: string;
    };
  };
  budget?: {
    monthly?: number;
    dailyCap?: number;
    currency?: string;
  };
  guardrails?: {
    maxDailySpend?: number;
    maxCAC?: number;
    minAIScore?: number;
  };
  billing?: {
    plan?: string;
  };
  taxonomy?: {
    sectors?: string[];
    generatedAt?: string;
  } | null;
  location?: {
    country?: string;
  } | null;
  onboarding?: {
    completed?: boolean;
  };
  createdAt?: string;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsLoading() {
  return (
    <div className="flex justify-center py-12" role="status" aria-label="Loading settings">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

function SettingsContent() {
  const { org } = useAuth();
  const { formatCurrency } = useLocale();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [justConnectedProvider, setJustConnectedProvider] = useState<string | null>(null);
  // Set when the OAuth callback flags a multi-page LinkedIn connect
  // (`select_page=1`): the connected member admins several Company
  // Pages, and the auto-seeded default needs human confirmation.
  const [selectPagePrompt, setSelectPagePrompt] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  // Raw context for a brand_mismatch block, so the user can dispute it ("request
  // a review"). Null unless the last connect was blocked as a wrong brand.
  const [mismatchContext, setMismatchContext] = useState<{
    provider: string;
    anchor: string | null;
    candidate: string | null;
  } | null>(null);

  // Edit state
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSectors, setEditSectors] = useState<string[]>([]);
  const [editCountry, setEditCountry] = useState("");

  async function handleRescanCatalog() {
    setRescanning(true);
    try {
      const r = await api.post<{
        grounded: boolean;
        reason?: string;
        businessCategory?: string;
        productCount?: number;
      }>("/v1/dashboard/reground-catalog");
      if (r.grounded) {
        const updated = await api.get<OrgDetails>("/v1/dashboard/org");
        setOrgDetails(updated);
        const cat = r.businessCategory ? ` — ${r.businessCategory.replace(/_/g, " ")}` : "";
        toast.success(`Updated from your ${r.productCount ?? ""} products${cat}`.replace("  ", " "));
      } else if (r.reason === "empty_catalog") {
        toast.error("No products synced yet. Sync your store first, then re-scan.");
      } else {
        toast.message("Nothing to update from your catalogue right now.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Re-scan failed. Please try again.");
    } finally {
      setRescanning(false);
    }
  }

  async function handleSaveBusinessDetails() {
    setSaving(true);
    setError("");
    try {
      const updates: Record<string, unknown> = {};
      if (editName && editName !== orgDetails?.name) updates.name = editName;
      if (editType !== (orgDetails?.businessType || "")) updates.businessType = editType;
      if (editUrl !== (orgDetails?.websiteUrl || "")) updates.websiteUrl = editUrl;
      if (JSON.stringify(editSectors) !== JSON.stringify(orgDetails?.taxonomy?.sectors || [])) {
        updates.taxonomy = { sectors: editSectors };
      }
      // Country drives onboarding's seasonal-pack lookup. Sending only
      // when changed avoids overwriting with the same value (the api
      // upper-cases before persistence, so a same-value send is a no-op
      // but still bumps updatedAt).
      const currentCountry = (orgDetails?.location?.country || "").toUpperCase();
      const nextCountry = editCountry.trim().toUpperCase();
      if (nextCountry && nextCountry !== currentCountry) {
        updates.countryCode = nextCountry;
      }

      if (Object.keys(updates).length === 0) {
        setEditingBusiness(false);
        return;
      }

      await api.put("/v1/dashboard/org", updates);
      const updated = await api.get<OrgDetails>("/v1/dashboard/org");
      setOrgDetails(updated);
      setEditingBusiness(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (searchParams?.get("integration") === "connected") {
      setJustConnectedProvider(searchParams.get("provider") ?? "");
      setSelectPagePrompt(searchParams.get("select_page") === "1");
      // Refetch integration status everywhere immediately after a successful
      // OAuth. Otherwise the content/composer pages keep their cached
      // pre-connect state and show a stale "Connect" CTA — which invites a
      // needless reconnect that revokes the token we just issued (the
      // LinkedIn reconnect loop). These keys cover the content-hub gate and
      // the LinkedIn identity/me read.
      queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-me"] });
    } else if (searchParams?.get("integration") === "error") {
      const provider = searchParams.get("provider");
      const msg = searchParams.get("msg");
      const anchor = searchParams.get("anchor");
      setConnectError(oauthErrorMessage(provider, msg, anchor));
      // Only a brand-mismatch block is disputable via "request a review".
      if (msg === "brand_mismatch" && provider) {
        setMismatchContext({ provider, anchor, candidate: searchParams.get("candidate") });
      } else {
        setMismatchContext(null);
      }
    }
  }, [searchParams, queryClient]);

  useEffect(() => {
    if (!org?._id) return;
    setLoading(true);
    setError("");
    api
      .get<OrgDetails>("/v1/dashboard/org")
      .then(setOrgDetails)
      .catch(() => setError("Failed to load settings. Please try again."))
      .finally(() => setLoading(false));
  }, [org?._id]);

  if (loading) {
    return <SettingsLoading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">General</h2>
          <p className="text-muted-foreground mt-1">
            Business details, budget, and connected accounts
          </p>
        </div>
        <ContactSupportDialog />
      </div>

      {justConnectedProvider !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {formatProviderName(justConnectedProvider)} connected successfully!
        </div>
      )}

      {selectPagePrompt && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Which Company Page belongs to this business?</p>
          <p>
            Your LinkedIn account manages several Company Pages. Posts publish
            as the page mapped to this business, so please confirm which page
            that should be.
          </p>
          <Link
            href="/dashboard/integrations?manage_pages=1"
            className="w-fit font-medium underline underline-offset-2 hover:no-underline"
          >
            Choose your Company Page
          </Link>
        </div>
      )}

      {connectError !== null && (
        <div className="flex flex-col gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {connectError}
          </div>
          {mismatchContext && (
            <div className="flex flex-wrap gap-2 pl-6">
              <CreateWorkspaceButton
                provider={mismatchContext.provider}
                suggestedName={mismatchContext.candidate}
              />
              <RequestReviewButton
                provider={mismatchContext.provider}
                anchor={mismatchContext.anchor}
                candidate={
                  mismatchContext.candidate
                    ? { displayName: mismatchContext.candidate }
                    : undefined
                }
                variant="outline"
                className="gap-1.5"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        {/* Wrong-brand integrations flagged by the fit-reconcile cron. Renders
            nothing when there's no pollution. */}
        <IntegrationFitAttention />
        {/* Business Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Business Details</CardTitle>
              </div>
              {!editingBusiness ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground"
                    disabled={rescanning}
                    title="Re-read your business details from your synced product catalogue"
                    onClick={handleRescanCatalog}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${rescanning ? "animate-spin" : ""}`} />
                    {rescanning ? "Scanning…" : "Re-scan my catalogue"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => {
                      setEditingBusiness(true);
                      setEditName(orgDetails?.name || "");
                      setEditType(orgDetails?.businessType || "");
                      setEditUrl(orgDetails?.websiteUrl || "");
                      setEditSectors(orgDetails?.taxonomy?.sectors || []);
                      setEditCountry(orgDetails?.location?.country || "");
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingBusiness(false)}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" className="gap-1.5" disabled={saving} onClick={handleSaveBusinessDetails}>
                    <Check className="h-3.5 w-3.5" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
            <CardDescription>Your business information used by the AI engine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingBusiness ? (
              <>
                <EditRow label="Business name" value={editName} onChange={setEditName} />
                <SettingRow label="Slug" value={orgDetails?.slug} />
                <SettingRow label="Category" value={orgDetails?.businessCategory} />
                <EditRow label="Type" value={editType} onChange={setEditType} />
                <EditRow label="Website" value={editUrl} onChange={setEditUrl} type="url" />
                <EditRow
                  label="Country (ISO-2)"
                  value={editCountry}
                  onChange={(v) => setEditCountry(v.toUpperCase())}
                />
                <SettingRow
                  label="Plan"
                  value={
                    <Badge variant="outline" className="capitalize">
                      {orgDetails?.billing?.plan || "free"}
                    </Badge>
                  }
                />
                <EditableSectors sectors={editSectors} onChange={setEditSectors} />
              </>
            ) : (
              <>
                <SettingRow label="Business name" value={orgDetails?.name} />
                <SettingRow label="Slug" value={orgDetails?.slug} />
                <SettingRow label="Category" value={orgDetails?.businessCategory} />
                <SettingRow label="Type" value={orgDetails?.businessType} />
                <SettingRow label="Website" value={orgDetails?.websiteUrl} />
                <SettingRow
                  label="Country"
                  value={
                    orgDetails?.location?.country ? (
                      <span className="flex items-center gap-1.5">
                        <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono">{orgDetails.location.country}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Not set — seasonal events will be limited until you pick a country
                      </span>
                    )
                  }
                />
                <SettingRow
                  label="Plan"
                  value={
                    <Badge variant="outline" className="capitalize">
                      {orgDetails?.billing?.plan || "free"}
                    </Badge>
                  }
                />
                {orgDetails?.taxonomy?.sectors && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">AI-discovered sectors</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {orgDetails.taxonomy.sectors.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Budget & Guardrails */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Budget & Guardrails</CardTitle>
            </div>
            <CardDescription>Your spending limits and AI safety controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orgDetails?.budget ? (
              <>
                <SettingRow
                  label="Monthly budget"
                  value={orgDetails.budget.monthly != null ? formatCurrency(orgDetails.budget.monthly) : "--"}
                />
                <SettingRow
                  label="Daily cap"
                  value={orgDetails.budget.dailyCap != null ? formatCurrency(orgDetails.budget.dailyCap) : "--"}
                />
                {orgDetails.guardrails && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-1.5 pt-1">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Guardrails</p>
                    </div>
                    <SettingRow
                      label="Max cost per customer"
                      value={
                        orgDetails.guardrails.maxCAC != null
                          ? `${orgDetails.budget.currency ?? "USD"} ${orgDetails.guardrails.maxCAC}`
                          : "--"
                      }
                    />
                    <SettingRow
                      label="Min AI quality score"
                      value={
                        orgDetails.guardrails.minAIScore != null
                          ? `${orgDetails.guardrails.minAIScore}/10`
                          : "--"
                      }
                    />
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No budget configured yet. Set your budget in the onboarding flow.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts link */}
        <Link href="/dashboard/integrations" className="block group">
          <Card className="border-primary/20 bg-linear-to-r from-primary/5 to-primary/10 transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-center justify-between py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connected Accounts</p>
                  <p className="text-xs text-muted-foreground">
                    Manage your ad platforms, content sources, and social accounts
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

// Display names for known provider slugs the OAuth callback can pass back via
// ?integration=connected&provider=<slug>. Unknown slugs fall through to a
// title-cased fallback so a brand-new provider doesn't render "undefined" —
// it just looks a bit raw until added here. Source of truth for the canonical
// labels is each provider's `displayName` in peakhour-api/src/v1/integrations/providers/*.
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  x: "X (Twitter)",
  x_ads: "X Ads",
  linkedin_content: "LinkedIn",
  linkedin_ads: "LinkedIn Ads",
  facebook: "Meta",
  meta_ads: "Meta Ads",
  instagram: "Instagram",
  youtube: "YouTube",
  beehiiv: "Beehiiv",
  substack: "Substack",
  kit: "Kit",
  mailchimp: "Mailchimp",
  ghost: "Ghost",
  wordpress: "WordPress",
  shopify: "Shopify",
  discord: "Discord",
  slack: "Slack",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics",
  google_search_console: "Google Search Console",
  google_business_profile: "Google Business Profile",
};

function formatProviderName(slug: string): string {
  if (!slug) return "Account";
  return (
    PROVIDER_DISPLAY_NAMES[slug] ??
    slug
      .split("_")
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}

// Friendly copy for the OAuth callback's ?integration=error&msg=<code>.
// Codes are emitted by peakhour-api integrations/routes.ts. Unknown codes
// fall through to a generic message so a new backend code never renders raw.
function oauthErrorMessage(provider: string | null, msg: string | null, anchor?: string | null): string {
  const name = formatProviderName(provider ?? "");
  switch (msg) {
    case "brand_mismatch":
      // The integration-fit guard blocked a different-brand account from
      // attaching to this workspace (one workspace = one business).
      return `That ${name} account looks like a different brand${anchor ? ` from ${anchor}` : ""}. To keep your content on-message, each workspace is one business — connect it to its own workspace instead.`;
    case "store_already_connected":
      return `That Shopify store is already connected to another business. Each store can be linked to one business at a time.`;
    case "invalid_shop":
      return `That doesn't look like a valid Shopify store domain. Use your permanent your-store.myshopify.com address.`;
    case "shop_mismatch":
      return `The store that approved the connection didn't match the one you entered. Please try connecting ${name} again.`;
    case "hmac_invalid":
    case "state_mismatch":
    case "state_expired":
    case "invalid_state":
      return `We couldn't verify that ${name} connection securely. Please try again.`;
    case "misconfigured":
      return `${name} isn't fully configured yet. Please contact support.`;
    default:
      return `We couldn't finish connecting ${name}. Please try again.`;
  }
}

function SettingRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground">--</span>}
      </p>
    </div>
  );
}

function EditRow({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground shrink-0">{label}</p>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="max-w-xs text-sm h-8" />
    </div>
  );
}

function EditableSectors({ sectors, onChange }: { sectors: string[]; onChange: (s: string[]) => void }) {
  const [newSector, setNewSector] = useState("");

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Tags className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">AI-discovered sectors</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {sectors.map((s, i) => (
          <Badge key={`${s}-${i}`} variant="secondary" className="text-xs gap-1 pr-1 cursor-pointer hover:bg-destructive/20">
            {s}
            <button type="button" onClick={() => onChange(sectors.filter((_, j) => j !== i))} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/30">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Add a sector..."
          value={newSector}
          onChange={(e) => setNewSector(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSector.trim()) {
              e.preventDefault();
              onChange([...sectors, newSector.trim()]);
              setNewSector("");
            }
          }}
          className="text-sm h-8 max-w-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          disabled={!newSector.trim()}
          onClick={() => { onChange([...sectors, newSector.trim()]); setNewSector(""); }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

