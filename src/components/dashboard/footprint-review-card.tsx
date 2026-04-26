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
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ExternalLink,
  Check,
  X,
  HelpCircle,
  AtSign,
  Music2,
  Globe,
  Pin,
} from "lucide-react";
import {
  LinkedinIcon,
  InstagramIcon,
  YoutubeIcon,
  FacebookIcon,
} from "@/components/ui/brand-icons";
import { cn } from "@/lib/utils";

interface PendingFootprint {
  url: string;
  source: string;
  handle?: string;
  confidence?: number;
  evidence?: string;
  confirmedByUser?: boolean | null;
}

interface FootprintReviewCardProps {
  pending: PendingFootprint[];
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: LinkedinIcon,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  facebook: FacebookIcon,
  threads: AtSign,
  pinterest: Pin,
  tiktok: Music2,
};

const SOURCE_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  threads: "Threads",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  beehiiv: "Beehiiv",
  substack: "Substack",
  medium: "Medium",
  ghost: "Ghost",
  wordpress: "WordPress",
  shopify: "Shopify",
  google_business: "Google Business",
  manual: "Other",
  ai_generated: "AI-suggested",
};

export function FootprintReviewCard({ pending }: FootprintReviewCardProps) {
  const queryClient = useQueryClient();
  const [pendingItems, setPendingItems] = useState(pending);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (pendingItems.length === 0) return null;

  async function handleConfirm(url: string, confirmed: boolean | null) {
    setError("");
    setSubmitting(url);
    // Optimistically remove from the list — the server-side update
    // is async but rarely fails for these toggles.
    const previous = pendingItems;
    setPendingItems((items) => items.filter((i) => i.url !== url));
    try {
      await api.post("/v1/onboarding/confirm-footprint", {
        confirmations: [{ url, confirmed }],
      });
      // Invalidate the dashboard discovery snapshot so other consumers
      // (e.g. tech-stack badge) see the updated server state.
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-discovery"] });
      });
    } catch (err) {
      // Roll back on failure
      setPendingItems(previous);
      setError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              We found you online
            </CardTitle>
            <CardDescription className="mt-1">
              Tell us which of these are actually yours so we don&apos;t
              recommend things you&apos;re already on.
            </CardDescription>
          </div>
          <Badge variant="secondary">{pendingItems.length} to review</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {pendingItems.map((item) => {
          const Icon = SOURCE_ICONS[item.source] ?? Globe;
          const label = SOURCE_LABEL[item.source] ?? item.source;
          const isPending = submitting === item.url;
          const display = item.handle ? `@${item.handle}` : prettyUrl(item.url);
          return (
            <div
              key={item.url}
              className={cn(
                "flex items-center gap-3 rounded-md border p-3 transition-opacity",
                isPending && "opacity-50",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium truncate">{display}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {label}
                  </span>
                </div>
                {item.evidence && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.evidence}
                  </p>
                )}
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
                aria-label="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleConfirm(item.url, false)}
                  disabled={isPending}
                  aria-label="Not mine"
                  title="Not mine"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleConfirm(item.url, null)}
                  disabled={isPending}
                  aria-label="Skip"
                  title="Not sure"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleConfirm(item.url, true)}
                  disabled={isPending}
                  aria-label="Yes, mine"
                  title="Yes, that's mine"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Yes
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}
