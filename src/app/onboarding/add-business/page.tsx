"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, Globe, ArrowRight } from "lucide-react";
import {
  InstagramIcon,
  LinkedinIcon,
  YoutubeIcon,
} from "@/components/ui/brand-icons";
import { cn } from "@/lib/utils";

interface ClassifyResponse {
  kind: string;
  canonicalUrl: string;
  hostname: string;
  handle?: string;
}

interface ExtractResponse {
  profile: {
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
  };
  url: string;
  urlKind: string;
  hostname: string;
}

const URL_EXAMPLES = [
  { label: "yourcompany.com", icon: Globe },
  { label: "instagram.com/you", icon: InstagramIcon },
  { label: "linkedin.com/in/you", icon: LinkedinIcon },
  { label: "youtube.com/@you", icon: YoutubeIcon },
];

const KIND_LABEL: Record<string, string> = {
  website: "Website",
  instagram: "Instagram profile",
  linkedin_personal: "LinkedIn profile",
  linkedin_company: "LinkedIn company page",
  youtube: "YouTube channel",
  x: "X profile",
  tiktok: "TikTok profile",
  facebook: "Facebook page",
  threads: "Threads profile",
  pinterest: "Pinterest profile",
  beehiiv: "Beehiiv newsletter",
  substack: "Substack newsletter",
  medium: "Medium publication",
  ghost: "Ghost site",
  wordpress: "WordPress site",
  shopify: "Shopify store",
  google_business: "Google Business listing",
  other: "Link",
};

export default function AddBusinessPage() {
  return (
    <Suspense>
      <AddBusinessContent />
    </Suspense>
  );
}

function AddBusinessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { org, isLoading: authLoading } = useAuth();
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [classified, setClassified] = useState<ClassifyResponse | null>(null);
  const [classifyError, setClassifyError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // If onboarding is complete, send to dashboard instead of restarting
  useEffect(() => {
    if (authLoading) return;
    if (org?.onboarding?.completed) {
      router.replace("/dashboard/overview");
    }
  }, [authLoading, org, router]);

  // Live classify on input change. 300ms debounce + cancel flag so a
  // slow earlier response can't clobber a fresh later one (response
  // ordering ≠ request ordering).
  useEffect(() => {
    setClassifyError("");
    const trimmed = url.trim();
    if (trimmed.length < 4) {
      setClassified(null);
      return;
    }
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      api
        .post<ClassifyResponse>("/v1/onboarding/classify", { url: trimmed })
        .then((r) => {
          if (!cancelled) setClassified(r);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.code === "INVALID_URL") {
            setClassifyError(err.message);
            setClassified(null);
            return;
          }
          // Transient error — don't wipe a previously-good classification
          // (the user might have hit a network blip mid-typing).
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [url]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!url.trim()) return;

    setSubmitting(true);
    try {
      const result = await api.post<ExtractResponse>("/v1/onboarding/extract", {
        url: url.trim(),
      });
      // Stash for the next step. sessionStorage survives a refresh in the
      // same tab — our 3 steps are a single user flow.
      sessionStorage.setItem("onboarding:extract", JSON.stringify(result));
      router.push("/onboarding/about");
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("We couldn't read that link. Please try another.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Tell us about you
        </h1>
        <p className="text-lg text-muted-foreground">
          Paste any link — your website, social profile, or newsletter.
          We&apos;ll figure out the rest.
        </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Where can we find you?
          </CardTitle>
          <CardDescription>
            One link is enough. We&apos;ll use it to set up your profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="url" className="text-base font-medium">
                Your link
              </Label>
              <Input
                id="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="https://yourcompany.com or instagram.com/yourhandle"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 text-base"
                disabled={submitting}
                autoFocus
              />
              {classified && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  Looks like a{vowelStart(KIND_LABEL[classified.kind]) ? "n" : ""}{" "}
                  <span className="font-medium text-foreground">
                    {KIND_LABEL[classified.kind] ?? "link"}
                  </span>
                  {classified.handle ? (
                    <>
                      {" "}for{" "}
                      <span className="font-medium text-foreground">
                        @{classified.handle}
                      </span>
                    </>
                  ) : null}
                </div>
              )}
              {classifyError && (
                <p className="text-sm text-destructive">{classifyError}</p>
              )}
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {submitError}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-base"
              disabled={submitting || url.trim().length < 4}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                  Reading your page…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">
          Examples
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {URL_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setUrl(ex.label)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              )}
            >
              <ex.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{ex.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function vowelStart(s: string | undefined): boolean {
  if (!s) return false;
  return /^[aeiouAEIOU]/.test(s);
}
