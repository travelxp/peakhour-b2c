"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { CHANNELS } from "@/app/(site)/dashboard/content/channels.config";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  TrendingUp,
  Lightbulb,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingRecommendation {
  platform: string;
  rationale: string;
  digitalLiteracyTips?: string[];
  firstAction: string;
  status?: string;
}

interface RecommendationsCardProps {
  recommendations: PendingRecommendation[];
}

const PLATFORM_LABEL: Record<string, string> = {
  linkedin_content: "LinkedIn",
  linkedin_ads: "LinkedIn Ads",
  beehiiv: "Beehiiv",
  facebook: "Facebook",
  x: "X",
  x_ads: "X Ads",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  youtube: "YouTube",
  substack: "Substack",
  mailchimp: "Mailchimp",
  kit: "Kit",
  shopify: "Shopify",
  wordpress: "WordPress",
  ghost: "Ghost",
};

// Analytics/SEO recommendations don't live in the channels hub — they have
// their own Insights setup pages. Match the platform ids the discovery
// pipeline may emit for these (and common aliases).
const INSIGHTS_ROUTES: Record<string, string> = {
  google_search_console: "/dashboard/insights/search-console",
  search_console: "/dashboard/insights/search-console",
  gsc: "/dashboard/insights/search-console",
  google_analytics: "/dashboard/insights/analytics",
  analytics: "/dashboard/insights/analytics",
  ga4: "/dashboard/insights/analytics",
  ga: "/dashboard/insights/analytics",
};

/**
 * Where "I'll start with this" should take the user for a given recommended
 * platform. Prefer a live channel's own dashboard (from the channels-hub
 * registry, so we don't maintain a parallel route map), then the Insights
 * setup pages for GSC/GA, and finally the Integrations hub — so the button
 * always lands on the relevant setup surface instead of just dismissing.
 */
function destinationForPlatform(platform: string): string {
  if (INSIGHTS_ROUTES[platform]) return INSIGHTS_ROUTES[platform];
  const channel = CHANNELS.find(
    (c) => c.providerKey === platform || c.slug === platform,
  );
  if (channel?.status === "live" && channel.dashboardPath) {
    return channel.dashboardPath;
  }
  return "/dashboard/integrations";
}

export function RecommendationsCard({ recommendations }: RecommendationsCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Optimistic dismissal — see the same pattern in
  // footprint-review-card.tsx. Keeps in sync with prop refetches and
  // avoids the snapshot-rollback race when two clicks land in flight
  // at the same time.
  const [dismissedPlatforms, setDismissedPlatforms] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");

  const visible = recommendations.filter((r) => !dismissedPlatforms.has(r.platform));

  if (visible.length === 0) return null;

  async function handleAction(
    platform: string,
    action: "accept" | "dismiss" | "started",
  ) {
    setError("");
    setBusy(platform);
    setDismissedPlatforms((prev) => {
      const next = new Set(prev);
      next.add(platform);
      return next;
    });
    try {
      await api.post(`/v1/onboarding/recommendations/${encodeURIComponent(platform)}/${action}`);
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-discovery"] });
      });
    } catch (err) {
      // RECOMMENDATION_NOT_FOUND means the rec was already removed
      // server-side (e.g. another tab actioned it). Keep our optimistic
      // dismissal AND refetch so the UI converges with the truth — no
      // need to surface an error to the user.
      if (err instanceof ApiError && err.code === "RECOMMENDATION_NOT_FOUND") {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-discovery"] });
        });
        return;
      }
      setDismissedPlatforms((prev) => {
        const next = new Set(prev);
        next.delete(platform);
        return next;
      });
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Couldn't save. Try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  // "I'll start with this" — record the intent, then take the user to the
  // relevant setup surface. Recording is best-effort: even if the POST fails
  // we still navigate, because getting the user to the integration is the
  // primary goal (and marking it "started" server-side stops it reappearing).
  async function handleStart(platform: string) {
    setError("");
    setBusy(platform);
    try {
      await api.post(
        `/v1/onboarding/recommendations/${encodeURIComponent(platform)}/started`,
      );
    } catch {
      // Non-blocking — navigate regardless.
    }
    startTransition(() => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-discovery"] });
    });
    router.push(destinationForPlatform(platform));
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Where to grow next
            </CardTitle>
            <CardDescription className="mt-1">
              A few platforms that fit your business. Take your time —
              they&apos;ll stay here until you&apos;re ready.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {visible.map((rec) => {
          const isBusy = busy === rec.platform;
          const label = PLATFORM_LABEL[rec.platform] ?? prettyPlatform(rec.platform);
          return (
            <div
              key={rec.platform}
              className={cn(
                "rounded-lg border-2 p-4 transition-opacity",
                isBusy && "opacity-50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="text-base font-semibold">{label}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {rec.rationale}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAction(rec.platform, "dismiss")}
                  disabled={isBusy}
                  aria-label="I'll do this later"
                  title="I'll do this later"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {rec.digitalLiteracyTips && rec.digitalLiteracyTips.length > 0 && (
                <div className="mt-3 rounded-md bg-muted/50 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      How to start
                    </p>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {rec.digitalLiteracyTips.map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">·</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="text-muted-foreground">First step: </span>
                  <span>{rec.firstAction}</span>
                </p>
                <Button
                  size="sm"
                  onClick={() => handleStart(rec.platform)}
                  disabled={isBusy}
                >
                  I&apos;ll start with this
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function prettyPlatform(id: string): string {
  return id
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
