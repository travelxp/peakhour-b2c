"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { updateProfile, type UserPreferences } from "@/lib/auth";
import { useLocale } from "@/hooks/use-locale";
import { toast } from "sonner";
import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { TeamSection } from "@/components/dashboard/team-section";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Link2,
  Plug,
  ArrowRight,
  Building2,
  Wallet,
  Shield,
  Tags,
  CheckCircle2,
  Pencil,
  X,
  Check,
  Plus,
  Globe,
  CalendarDays,
} from "lucide-react";

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
  const { org, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkedInJustConnected, setLinkedInJustConnected] = useState(false);

  // Edit state
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSectors, setEditSectors] = useState<string[]>([]);

  async function handleSaveBusinessDetails() {
    setSaving(true);
    setError("");
    try {
      const updates: Record<string, any> = {};
      if (editName && editName !== orgDetails?.name) updates.name = editName;
      if (editType !== (orgDetails?.businessType || "")) updates.businessType = editType;
      if (editUrl !== (orgDetails?.websiteUrl || "")) updates.websiteUrl = editUrl;
      if (JSON.stringify(editSectors) !== JSON.stringify(orgDetails?.taxonomy?.sectors || [])) {
        updates.taxonomy = { sectors: editSectors };
      }

      if (Object.keys(updates).length === 0) {
        setEditingBusiness(false);
        return;
      }

      await api.put("/v1/dashboard/org", updates);

      // Refresh data
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
    if (searchParams?.get("linkedin") === "connected" || searchParams?.get("integration") === "connected") {
      setLinkedInJustConnected(true);
    }
  }, [searchParams]);

  // Re-fetch when org changes
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your business, preferences, and team
        </p>
      </div>

      {linkedInJustConnected && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          LinkedIn account connected successfully!
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5">
            <Building2 className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5">
            <Globe className="size-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Shield className="size-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <Wallet className="size-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* ── General Tab ──────────────────────────────────── */}
        <TabsContent value="general" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Business Details</CardTitle>
            </div>
            {!editingBusiness ? (
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
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingBusiness(false)}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={saving}
                  onClick={handleSaveBusinessDetails}
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            Your business information used by the AI engine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingBusiness ? (
            <>
              <EditRow label="Business name" value={editName} onChange={setEditName} />
              <SettingRow label="Slug" value={orgDetails?.slug} />
              <SettingRow label="Category" value={orgDetails?.businessCategory} />
              <EditRow label="Type" value={editType} onChange={setEditType} />
              <EditRow label="Website" value={editUrl} onChange={setEditUrl} type="url" />
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
                    <p className="text-sm font-medium text-muted-foreground">
                      AI-discovered sectors
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {orgDetails.taxonomy.sectors.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
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
          <CardDescription>
            Your spending limits and AI safety controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orgDetails?.budget ? (
            <>
              <SettingRow
                label="Monthly budget"
                value={`${orgDetails.budget.currency ?? "USD"} ${orgDetails.budget.monthly?.toLocaleString() ?? "--"}`}
              />
              <SettingRow
                label="Daily cap"
                value={`${orgDetails.budget.currency ?? "USD"} ${orgDetails.budget.dailyCap?.toLocaleString() ?? "--"}`}
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
        </TabsContent>

        {/* ── Preferences Tab ──────────────────────────────── */}
        <TabsContent value="preferences" className="mt-6">
          <UserPreferencesCard />
        </TabsContent>

        {/* ── Team Tab ─────────────────────────────────────── */}
        <TabsContent value="team" className="mt-6">
          <TeamSection />
        </TabsContent>

        {/* ── Billing Tab ──────────────────────────────────── */}
        <TabsContent value="billing" className="mt-6 space-y-6">
          {/* Current plan card */}
          <div className="rounded-2xl border bg-muted/30 px-5 pt-4 pb-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Current Plan</h3>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                  {orgDetails?.billing?.plan || "Free"}
                </Badge>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:hello@peakhour.ai">Upgrade plan</a>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Organization</p>
                <p className="text-sm font-medium">{orgDetails?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-medium">
                  {orgDetails?.createdAt ? new Date(orgDetails.createdAt).toLocaleDateString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Billing cycle</p>
                <p className="text-sm font-medium">Monthly</p>
              </div>
            </div>
          </div>

          {/* Usage cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-muted/30 px-4 pt-3 pb-5">
              <p className="font-semibold mb-1">Content pieces</p>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">
                  {orgDetails?.billing?.plan === "free" ? "50" : "Unlimited"}
                </span>
                {orgDetails?.billing?.plan === "free" ? " / 50 included" : " included"}
              </p>
              {orgDetails?.billing?.plan === "free" && (
                <div className="relative mt-2 h-1 w-full rounded-full bg-muted">
                  <span className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-amber-500" />
                </div>
              )}
            </div>
            <div className="rounded-2xl border bg-muted/30 px-4 pt-3 pb-5">
              <p className="font-semibold mb-1">Ad platforms</p>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">
                  {orgDetails?.billing?.plan === "pro" ? "All" : orgDetails?.billing?.plan === "growth" ? "2" : "Preview only"}
                </span>
                {" "}included
              </p>
            </div>
          </div>

          {/* Payment method */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Method</CardTitle>
              <CardDescription>
                Manage your payment details and billing address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No payment method on file. Contact us to set up billing.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <a href="mailto:hello@peakhour.ai">Contact support</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground">--</span>}
      </p>
    </div>
  );
}

function EditRow({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground shrink-0">{label}</p>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-xs text-sm h-8"
      />
    </div>
  );
}

function EditableSectors({
  sectors,
  onChange,
}: {
  sectors: string[];
  onChange: (s: string[]) => void;
}) {
  const [newSector, setNewSector] = useState("");

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Tags className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          AI-discovered sectors
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {sectors.map((s, i) => (
          <Badge
            key={`${s}-${i}`}
            variant="secondary"
            className="text-xs gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
          >
            {s}
            <button
              type="button"
              onClick={() => onChange(sectors.filter((_, j) => j !== i))}
              className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/30"
            >
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
          onClick={() => {
            onChange([...sectors, newSector.trim()]);
            setNewSector("");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

// ── User Preferences Card ──────────────────────────────────────

const DATE_FORMAT_OPTIONS = [
  { value: "__browser__", label: "Browser default" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-12-31)" },
  { value: "DD-MM-YY ddd", label: "DD-MM-YY ddd (31-12-26 Wed)" },
] as const;

const NUMBER_FORMAT_OPTIONS = [
  { value: "__browser__", label: "Browser default" },
  { value: "en-US", label: "1,234.56 (US)" },
  { value: "en-IN", label: "1,23,456.78 (India)" },
  { value: "en-GB", label: "1,234.56 (UK)" },
  { value: "de-DE", label: "1.234,56 (Germany)" },
  { value: "fr-FR", label: "1 234,56 (France)" },
] as const;

function UserPreferencesCard() {
  const { user, refreshUser } = useAuth();
  const { formatDate } = useLocale();
  const prefs = user?.preferences;
  const [saving, setSaving] = useState(false);
  const [dateFormat, setDateFormat] = useState(prefs?.dateFormat || "__browser__");
  const [numberFormat, setNumberFormat] = useState(prefs?.numberFormat || "__browser__");
  const [timezone, setTimezone] = useState(prefs?.timezone || "");

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Dubai"];
    }
  }, []);

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasChanges =
    (dateFormat === "__browser__" ? undefined : dateFormat) !== prefs?.dateFormat ||
    (numberFormat === "__browser__" ? undefined : numberFormat) !== prefs?.numberFormat ||
    (timezone || undefined) !== prefs?.timezone;

  async function handleSave() {
    if (!user?.name) return;
    setSaving(true);
    try {
      await updateProfile({
        name: user.name,
        preferences: {
          dateFormat: dateFormat === "__browser__" ? undefined : dateFormat as UserPreferences["dateFormat"],
          numberFormat: numberFormat === "__browser__" ? undefined : numberFormat as UserPreferences["numberFormat"],
          timezone: timezone || undefined,
        },
      });
      await refreshUser();
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  const previewDate = new Date();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>
                How dates, numbers, and currencies appear across the app
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Format */}
        <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
          <div>
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              Date format
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preview: {formatDate(previewDate)}
            </p>
          </div>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Timezone */}
        <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
          <div>
            <Label>Timezone</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current: {browserTimezone}
            </p>
          </div>
          <Select value={timezone || browserTimezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {timezones.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}{tz === browserTimezone ? " (detected)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Number Format */}
        <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
          <div>
            <Label>Number format</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              How numbers and currency are displayed
            </p>
          </div>
          <Select value={numberFormat} onValueChange={setNumberFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUMBER_FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Save */}
        {hasChanges && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
              {saving ? "Saving..." : <><Check className="h-3.5 w-3.5" /> Save preferences</>}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
