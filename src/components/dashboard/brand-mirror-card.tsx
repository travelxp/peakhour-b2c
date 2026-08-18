"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

// Mirror of GET /v1/dashboard/brand-mirror. The endpoint deliberately returns
// warm prose + a provenance label only — NEVER the underlying metrics (post
// counts, structural numbers). Show understanding, never the dials.
interface BrandMirrorData {
  hasUnderstanding: boolean;
  whatYouDo: string | null;
  category: string | null;
  audience: string[];
  voice: {
    source: "learned" | "inferred" | null;
    summary: string | null;
    tone: string[];
    sample: string | null;
  };
}

// org_businesses.businessCategory enum → human label.
const CATEGORY_LABEL: Record<string, string> = {
  health_medical: "Health & Medical",
  food_beverage: "Food & Beverage",
  beauty_wellness: "Beauty & Wellness",
  professional_services: "Professional Services",
  retail: "Retail",
  technology: "Technology",
  education: "Education",
  creator_media: "Creator & Media",
  real_estate: "Real Estate",
  home_services: "Home Services",
  automotive: "Automotive",
  hospitality_travel: "Hospitality & Travel",
  ecommerce: "E-commerce",
  finance_insurance: "Finance & Insurance",
  entertainment: "Entertainment",
  nonprofit: "Non-profit",
  other: "Other",
};

/**
 * "What we understand about you" — the Brand Mirror. Reflects our understanding
 * (value, audience, voice) back to the user as the "we get you" moment, so the
 * ideas and drafts we suggest feel on-brand. Self-fetching; renders nothing until
 * there is something to reflect. Read-only in v1 (confirm/correct is a follow-up).
 */
export function BrandMirrorCard() {
  const { org, business } = useAuth();
  const { data } = useQuery({
    queryKey: ["dashboard-brand-mirror", org?._id, business?._id],
    queryFn: () => api.get<BrandMirrorData>("/v1/dashboard/brand-mirror"),
    enabled: !!org && !!business,
  });

  if (!data?.hasUnderstanding) return null;

  const { whatYouDo, category, audience, voice } = data;
  const categoryLabel = category ? (CATEGORY_LABEL[category] ?? category) : null;

  return (
    <Card className="border-2 border-primary/15 bg-primary/[0.02]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          What we understand about you
        </CardTitle>
        <CardDescription>
          Here&apos;s what we&apos;ve picked up — so the content we suggest sounds like you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {whatYouDo && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">What you do</p>
            <p className="text-sm leading-relaxed">{whatYouDo}</p>
          </div>
        )}

        {audience.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Who you write for</p>
            <div className="flex flex-wrap gap-1.5">
              {audience.map((a) => (
                <Badge key={a} variant="secondary" className="font-normal">
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {voice.summary && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Your voice</span>
              {voice.source === "learned" ? (
                <span className="text-primary">· learned from your posts</span>
              ) : (
                <span>· first impression</span>
              )}
            </p>
            <p className="text-sm leading-relaxed">{voice.summary}</p>
            {voice.tone.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {voice.tone.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {voice.sample && (
              <p className="mt-2 border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground">
                &ldquo;{voice.sample}&rdquo;
              </p>
            )}
          </div>
        )}

        {categoryLabel && (
          <p className="text-xs text-muted-foreground">Category: {categoryLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
