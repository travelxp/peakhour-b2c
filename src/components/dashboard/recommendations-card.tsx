"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
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

export function RecommendationsCard({ recommendations }: RecommendationsCardProps) {
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
                  aria-label="Not interested"
                  title="Not interested"
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
                  onClick={() => handleAction(rec.platform, "started")}
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
