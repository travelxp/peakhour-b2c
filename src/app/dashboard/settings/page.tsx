"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError, API_BASE_URL } from "@/lib/api";
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
  const { org } = useAuth();
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your business configuration and connected accounts
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

      {/* Business Details */}
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

      {/* Connected Accounts — nudge to Integrations */}
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
