"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "url" | "manual";

const BUSINESS_CATEGORIES = [
  { value: "health_medical", label: "Health & Medical" },
  { value: "food_beverage", label: "Food & Beverage" },
  { value: "beauty_wellness", label: "Beauty & Wellness" },
  { value: "professional_services", label: "Professional Services" },
  { value: "retail", label: "Retail" },
  { value: "technology", label: "Technology" },
  { value: "education", label: "Education" },
  { value: "creator_media", label: "Creator & Media" },
  { value: "real_estate", label: "Real Estate" },
  { value: "home_services", label: "Home Services" },
  { value: "automotive", label: "Automotive" },
  { value: "hospitality_travel", label: "Hospitality & Travel" },
  { value: "ecommerce", label: "E-Commerce" },
  { value: "finance_insurance", label: "Finance & Insurance" },
  { value: "entertainment", label: "Entertainment" },
  { value: "nonprofit", label: "Non-Profit" },
  { value: "other", label: "Other" },
];

export default function AddBusinessPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [mode, setMode] = useState<Mode>("url");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [orgName, setOrgName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<{
    businessType: string;
    valueProposition: string;
    confidence: number;
  } | null>(null);

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDiscovering(true);

    try {
      // First create the org so we have an orgId for the discover call
      const orgResult = await api.post<{ org: { _id: string; name: string; slug: string } }>(
        "/v1/onboarding/create-org",
        {
          name: new URL(websiteUrl).hostname.replace("www.", ""),
          websiteUrl,
        }
      );

      await refreshUser();

      // Now run AI discovery
      const result = await api.post<{
        businessType: string;
        valueProposition: string;
        confidence: number;
      }>("/v1/onboarding/discover", { websiteUrl });

      setDiscoveryResult(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to analyze website. Try adding manually instead.");
      }
    } finally {
      setDiscovering(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/v1/onboarding/create-org", {
        name: orgName,
        businessCategory: businessCategory || undefined,
        businessType: businessType || undefined,
        websiteUrl: websiteUrl || undefined,
      });

      await refreshUser();
      router.push("/onboarding/connect-platforms");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // After successful discovery, show confirmation
  if (discoveryResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We found your business</CardTitle>
          <CardDescription>
            Our AI analyzed your website and identified your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">{discoveryResult.businessType}</p>
            <p className="text-sm text-muted-foreground">
              {discoveryResult.valueProposition}
            </p>
            <p className="text-xs text-muted-foreground">
              Confidence: {Math.round(discoveryResult.confidence * 100)}%
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            className="flex-1"
            onClick={() => router.push("/onboarding/connect-platforms")}
          >
            Looks good, continue
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDiscoveryResult(null);
              setMode("manual");
            }}
          >
            Edit manually
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add your business</CardTitle>
        <CardDescription>
          {mode === "url"
            ? "Enter your website URL and our AI will identify your business"
            : "Tell us about your business"}
        </CardDescription>
      </CardHeader>

      {mode === "url" ? (
        <form onSubmit={handleDiscover} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://yourcompany.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                required
                autoFocus
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={discovering}>
              {discovering ? "Analyzing..." : "Discover my business"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Add manually instead
            </button>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="orgName">Business name</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="Your Company Inc."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessCategory">Category</Label>
              <select
                id="businessCategory"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a category</option>
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business type (optional)</Label>
              <Input
                id="businessType"
                type="text"
                placeholder="e.g. Dental clinic, SaaS analytics tool"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualUrl">Website URL (optional)</Label>
              <Input
                id="manualUrl"
                type="url"
                placeholder="https://yourcompany.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading || !orgName.trim()}>
              {loading ? "Creating..." : "Continue"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Use URL discovery instead
            </button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
