"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { api, API_BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
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
  Linkedin,
  Facebook,
  Chrome,
  Building2,
  Wallet,
  Shield,
  Tags,
  ExternalLink,
  CheckCircle2,
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

  useEffect(() => {
    if (searchParams?.get("linkedin") === "connected") {
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
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Business Details</CardTitle>
          </div>
          <CardDescription>
            Your business information used by the AI engine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Connected Accounts</CardTitle>
          </div>
          <CardDescription>
            Ad platforms and content sources linked to your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* LinkedIn */}
          <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2] text-white">
                <Linkedin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">LinkedIn Ads</p>
                {orgDetails?.adPlatforms?.linkedin?.connected ? (
                  <p className="text-xs text-muted-foreground">
                    {orgDetails.adPlatforms.linkedin.adAccountName ||
                      orgDetails.adPlatforms.linkedin.linkedInProfileName ||
                      "Connected"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not connected
                  </p>
                )}
              </div>
            </div>
            {orgDetails?.adPlatforms?.linkedin?.connected ? (
              <Badge className="bg-green-600 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  window.location.href = `${API_BASE_URL}/v1/integrations/linkedin_ads/authorize`;
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Connect
              </Button>
            )}
          </div>

          <Separator />

          {/* Placeholder for future platforms */}
          <div className="flex items-center justify-between rounded-lg border border-dashed p-4 opacity-50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1877F2] text-white">
                <Facebook className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Meta Ads</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
            <Badge variant="outline">Soon</Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-dashed p-4 opacity-50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4285F4] text-white">
                <Chrome className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Google Ads</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
            <Badge variant="outline">Soon</Badge>
          </div>
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
