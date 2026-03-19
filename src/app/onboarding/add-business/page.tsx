"use client";

import { useState, useEffect } from "react";
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
import {
  Globe,
  Brain,
  Users,
  Megaphone,
  Sparkles,
  Tags,
  CheckCircle,
} from "lucide-react";

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
  const { refreshUser, org, business } = useAuth();
  const isAddingToExistingOrg = !!org; // true = adding another business, false = first-time onboarding
  const [mode, setMode] = useState<Mode>("url");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [orgName, setOrgName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [discoveryResult, setDiscoveryResult] = useState<{
    businessType: string;
    valueProposition: string;
    confidence: number;
  } | null>(null);

  // Check onboarding status on mount — auto-run discovery if URL exists but taxonomy is missing
  useEffect(() => {
    if (!org) {
      setCheckingStatus(false);
      return;
    }
    (async () => {
      try {
        const status = await api.get<{
          hasTaxonomy: boolean;
          websiteUrl: string | null;
          businessType: string | null;
        }>("/v1/onboarding/status");

        if (status.hasTaxonomy) {
          // Discovery already done — skip to next step
          router.replace("/onboarding/connect-platforms");
          return;
        }

        if (status.websiteUrl) {
          // Org + URL exist but discovery hasn't run — auto-trigger it
          setWebsiteUrl(status.websiteUrl);
          setCheckingStatus(false);
          await runDiscovery(status.websiteUrl);
          return;
        }
      } catch {
        // Status check failed — show form normally
      }
      setCheckingStatus(false);
    })();
  }, [org]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runDiscovery(url: string) {
    setError("");
    setDiscovering(true);

    try {
      const result = await api.post<{
        businessType: string;
        valueProposition: string;
        confidence: number;
      }>("/v1/onboarding/discover", { websiteUrl: url });

      setDiscoveryResult(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to analyze website. Try again or add manually.");
      }
    } finally {
      setDiscovering(false);
    }
  }

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();

    let hostname: string;
    try {
      hostname = new URL(websiteUrl).hostname.replace(/^www\./, "");
    } catch {
      setError("Please enter a valid URL (e.g. https://yourcompany.com)");
      return;
    }

    try {
      if (isAddingToExistingOrg) {
        // Adding a new business to existing org
        await api.post("/v1/auth/businesses/create", {
          name: hostname,
          businessCategory: "other",
        });
        await refreshUser();
      } else {
        // First-time: create org + default business
        await api.post<{ org: { _id: string; name: string; slug: string } }>(
          "/v1/onboarding/create-org",
          { name: hostname, websiteUrl }
        );
        await refreshUser();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "ORG_EXISTS") {
        // Org already exists — proceed to discovery
      } else if (err instanceof ApiError && err.code === "SLUG_EXISTS") {
        setError("A business with this name already exists.");
        return;
      } else {
        if (err instanceof ApiError) setError(err.message);
        else setError("Something went wrong. Please try again.");
        return;
      }
    }

    await runDiscovery(websiteUrl);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isAddingToExistingOrg) {
        await api.post("/v1/auth/businesses/create", {
          name: orgName,
          businessCategory: businessCategory || undefined,
          businessType: businessType || undefined,
        });
      } else {
        await api.post("/v1/onboarding/create-org", {
          name: orgName,
          businessCategory: businessCategory || undefined,
          businessType: businessType || undefined,
          websiteUrl: websiteUrl || undefined,
        });
      }

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

  // Loading state while checking onboarding status
  if (checkingStatus) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary mb-4" />
          <p className="text-sm text-muted-foreground">Checking your progress...</p>
        </CardContent>
      </Card>
    );
  }

  // Animated AI discovery loading
  if (discovering && !error) {
    return <DiscoveryLoader url={websiteUrl} />;
  }

  // After successful discovery, show confirmation
  if (discoveryResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We found your business</CardTitle>
          <CardDescription>
            Here&apos;s what we learned from your website
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
        <CardTitle>{isAddingToExistingOrg ? "Add another business" : "Add your business"}</CardTitle>
        <CardDescription>
          {mode === "url"
            ? "Paste your website link — our AI will learn about your business in seconds"
            : "Tell us a bit about your business so we can set things up"}
        </CardDescription>
      </CardHeader>

      {mode === "url" ? (
        <form onSubmit={handleDiscover} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            {error && (
              <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
              {discovering ? "Analyzing your website..." : "Discover my business"}
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
              <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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

const DISCOVERY_STEPS = [
  { icon: Globe, label: "Scanning your website", duration: 1200 },
  { icon: Brain, label: "Reading your content", duration: 1000 },
  { icon: Users, label: "Identifying your audience", duration: 1000 },
  { icon: Tags, label: "Mapping industry sectors", duration: 800 },
  { icon: Megaphone, label: "Finding ad angles", duration: 800 },
  { icon: Sparkles, label: "Crafting your brand voice", duration: 800 },
  { icon: CheckCircle, label: "Building your marketing DNA", duration: 2400 },
];

function DiscoveryLoader({ url }: { url: string }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    function advance(step: number) {
      if (step >= DISCOVERY_STEPS.length - 1) return; // Keep last step active (pulsing) until API returns
      timeout = setTimeout(() => {
        setActiveStep(step + 1);
        advance(step + 1);
      }, DISCOVERY_STEPS[step].duration);
    }
    advance(0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Card>
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">Analyzing your business</CardTitle>
        <CardDescription className="text-xs truncate max-w-xs mx-auto">
          {url}
        </CardDescription>
      </CardHeader>
      <CardContent className="py-8">
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {DISCOVERY_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === activeStep;
            const isDone = i < activeStep;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-500 ${
                  isActive
                    ? "bg-primary/10 border border-primary/20 shadow-sm"
                    : isDone
                      ? "opacity-60"
                      : "opacity-30"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                    isActive
                      ? "bg-primary text-primary-foreground animate-pulse"
                      : isDone
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-sm transition-all duration-500 ${
                    isActive ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                  {isActive && (
                    <span className="ml-1 inline-flex">
                      <span className="animate-[pulse_1s_ease-in-out_infinite]">.</span>
                      <span className="animate-[pulse_1s_ease-in-out_0.2s_infinite]">.</span>
                      <span className="animate-[pulse_1s_ease-in-out_0.4s_infinite]">.</span>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
