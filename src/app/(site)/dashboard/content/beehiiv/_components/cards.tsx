"use client";

import { SENTIMENT_CONFIG, label } from "@/lib/content-labels";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/locale";
import { type Draft } from "../columns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function KpiCard({
  title,
  value,
  subtitle,
  loading,
  progress: progressValue,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  loading?: boolean;
  progress?: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1">{value ?? "—"}</p>
            {progressValue !== undefined && (
              <Progress value={progressValue} className="h-1.5 mt-2" />
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ArticleCard({
  draft,
  onClick,
  onRepurpose,
}: {
  draft: Draft;
  onClick: () => void;
  onRepurpose: () => void;
}) {
  const t = draft.tags;
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      {draft.thumbnailUrl && (
        <div className="h-32 overflow-hidden rounded-t-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2 leading-snug">
          {draft.title}
        </h3>
        {draft.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {draft.subtitle}
          </p>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap gap-1">
          {t?.contentType && (
            <Badge variant="outline" className="text-xs">
              {label(undefined,t.contentType)}
            </Badge>
          )}
          <SentimentBadge value={t?.sentiment} />
          {t?.sectors?.slice(0, 2).map((s) => (
            <Badge key={s.name} variant="secondary" className="text-xs">
              {label(undefined,s.name)}
            </Badge>
          ))}
        </div>

        {/* Ad score bar */}
        <div className="flex items-center justify-between">
          <AdScoreBar score={t?.adPotentialScore} unprocessable={draft.unprocessable} />
          <span className="text-xs text-muted-foreground">
            {formatDate(draft.publishedAt, null)}
          </span>
        </div>

        {/* Repurpose action — coloured by the row's repurposeFit band,
            same as the table-view RepurposeActionCell. The card view and
            the table view sit in front of the same Draft data; keeping
            their treatments consistent avoids "the table says green but
            the card says nothing" confusion when the user toggles
            between views. stopPropagation prevents the card's onClick
            (router.push) firing on a Repurpose click. */}
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`h-7 text-xs ${
              draft.repurposeFit?.topBand === "green"
                ? "text-success-on-tint hover:bg-success/10"
                : draft.repurposeFit?.topBand === "amber"
                  ? "text-warning-on-tint hover:bg-warning/10"
                  : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onRepurpose();
            }}
            title={
              draft.repurposeFit
                ? `Top fit: ${draft.repurposeFit.topChannel} (${draft.repurposeFit.topBand}) — ${draft.repurposeFit.topRationale}`
                : "Score connected platforms and generate variants"
            }
          >
            <Share2 className="mr-1 size-3" />
            Repurpose
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdScoreBar({
  score,
  unprocessable,
}: {
  score?: number;
  unprocessable?: { message: string };
}) {
  if (score == null) {
    // Reason set by the API (AI cap hit, preflight gate, etc.) —
    // show why instead of an indefinite "Not scored". `message` is
    // pre-rendered server-side; display as-is. Guard against an
    // empty message so we don't render an empty hover bubble if the
    // API ever ships partial data.
    if (unprocessable && unprocessable.message) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* tabIndex makes the span focusable so keyboard users
                can reach the tooltip — Radix auto-opens on focus
                once the trigger is focusable. stopPropagation on
                click + pointerdown — card is wired to navigate on
                click; without both, tapping the Info routes away and
                closes the tooltip the user was trying to read.
                Mirrors the Repurpose button pattern below. */}
            <span
              className="flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={0}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Can&apos;t score
              <Info className="size-3 text-warning" aria-label="Why not scored?" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{unprocessable.message}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <span className="text-xs text-muted-foreground">Not scored</span>
    );
  }

  const color =
    score >= 8
      ? "bg-success"
      : score >= 6
        ? "bg-warning"
        : score >= 4
          ? "bg-warning"
          : "bg-destructive";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${score * 10}%` }}
            />
          </div>
          <span className="text-xs font-medium">{score}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Ad Potential Score: {score}/10</p>
      </TooltipContent>
    </Tooltip>
  );
}

function SentimentBadge({ value }: { value?: string }) {
  if (!value) return null;
  const config = SENTIMENT_CONFIG[value];
  if (!config) return <Badge variant="outline" className="text-xs">{value}</Badge>;
  return (
    <Badge className={`text-xs ${config.bg} ${config.color} border-0`}>
      {config.label}
    </Badge>
  );
}
