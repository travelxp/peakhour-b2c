"use client";

import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";

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

interface ExtractedProfile {
  displayName: string;
  type: "business" | "individual";
  businessCategory: string;
  businessType?: string;
  description: string;
  valueProposition?: string;
  avatarUrl?: string;
  location?: { city?: string; country?: string };
  taxonomy?: unknown;
  brandVoice?: unknown;
  confidence: number;
}

interface ExtractStashed {
  profile: ExtractedProfile;
  url: string;
  urlKind: string;
  hostname: string;
}

interface ConfirmResponse {
  org: { _id: string; name: string };
  business: { _id: string; name: string };
  jobId: string;
}

export default function AboutPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [stash, setStash] = useState<ExtractStashed | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Edit-mode draft (separate from stash so cancel restores cleanly)
  const [displayName, setDisplayName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("other");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("onboarding:extract");
    if (!raw) {
      router.replace("/onboarding/add-business");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as ExtractStashed;
      setStash(parsed);
      setDisplayName(parsed.profile.displayName);
      setBusinessCategory(parsed.profile.businessCategory);
      setDescription(parsed.profile.description);
    } catch {
      router.replace("/onboarding/add-business");
    } finally {
      setHydrated(true);
    }
  }, [router]);

  async function handleConfirm() {
    if (!stash) return;
    setError("");
    setSubmitting(true);
    try {
      const profile: ExtractedProfile = editing
        ? { ...stash.profile, displayName, businessCategory, description }
        : stash.profile;

      const result = await api.post<ConfirmResponse>("/v1/onboarding/confirm", {
        url: stash.url,
        profile,
        notifyByEmail: false,
      });

      sessionStorage.setItem("onboarding:jobId", result.jobId);
      sessionStorage.removeItem("onboarding:extract");
      await refreshUser();
      router.push("/onboarding/launch");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!stash) return null;

  const { profile, hostname, urlKind } = stash;
  const confidencePct = Math.round(profile.confidence * 100);
  const lowConfidence = profile.confidence < 0.6;
  const initials = profile.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Is this you?</h1>
        <p className="text-lg text-muted-foreground">
          We read your page. Here&apos;s what we got — confirm or fix anything
          that&apos;s wrong.
        </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar
              avatarUrl={isHttpUrl(profile.avatarUrl) ? profile.avatarUrl! : undefined}
              initials={initials}
            />
            <div className="flex-1 min-w-0">
              {editing ? (
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="text-xl font-semibold h-9"
                  autoFocus
                />
              ) : (
                <CardTitle className="text-2xl truncate">
                  {profile.displayName}
                </CardTitle>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="capitalize">
                  {profile.type}
                </Badge>
                <span>·</span>
                <span>{hostname}</span>
                {!lowConfidence && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Sparkles className="h-3 w-3" />
                      {confidencePct}% confident
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            {editing ? (
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-11"
              />
            ) : (
              <p className="text-base leading-relaxed">{profile.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            {editing ? (
              <Select value={businessCategory} onValueChange={setBusinessCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-base">
                {BUSINESS_CATEGORIES.find((c) => c.value === profile.businessCategory)?.label
                  ?? profile.businessCategory}
              </p>
            )}
          </div>

          {profile.location?.city && (
            <div className="space-y-2">
              <Label>Location</Label>
              <p className="text-base">
                {[profile.location.city, profile.location.country].filter(Boolean).join(", ")}
              </p>
            </div>
          )}

          {lowConfidence && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                We&apos;re not 100% sure — your {urlKindLabel(urlKind)} didn&apos;t
                give us much to work with. Tap <strong>Edit details</strong> to fix
                anything that&apos;s wrong.
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/onboarding/add-business")}
              disabled={submitting}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Not me
            </Button>
            {!editing ? (
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={submitting}
              >
                Edit details
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDisplayName(profile.displayName);
                  setBusinessCategory(profile.businessCategory);
                  setDescription(profile.description);
                }}
              >
                Cancel edits
              </Button>
            )}
          </div>
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={submitting || (editing && !displayName.trim())}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                Setting up…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Yes, that&apos;s me
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function Avatar({ avatarUrl, initials }: { avatarUrl?: string; initials: string }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-14 w-14 rounded-full object-cover ring-1 ring-border"
        onError={(e) => {
          // Hide on broken; the AI sometimes hallucinates avatar URLs.
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-1 ring-border">
      {initials}
    </div>
  );
}

function isHttpUrl(s: string | undefined): boolean {
  if (!s) return false;
  return /^https?:\/\//i.test(s);
}

function urlKindLabel(kind: string): string {
  const map: Record<string, string> = {
    instagram: "Instagram profile",
    linkedin_personal: "LinkedIn profile",
    linkedin_company: "LinkedIn page",
    youtube: "YouTube channel",
    x: "X profile",
    tiktok: "TikTok profile",
    facebook: "Facebook page",
    threads: "Threads profile",
    pinterest: "Pinterest page",
    beehiiv: "newsletter",
    substack: "newsletter",
    medium: "publication",
    website: "website",
  };
  return map[kind] ?? "page";
}
