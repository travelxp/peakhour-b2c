"use client";

/**
 * /cms/crons — Dev cron hub. Lists every cron handler that can be
 * manually triggered (the same whitelist the api enforces) with a
 * one-click "Run now" button per row.
 *
 * Vercel Cron only runs on production deployments, so previews + local
 * dev had no UI way to exercise cron paths. This page is the central
 * spot; contextual <CronToolbar/> components on dashboard pages cover
 * the per-page case.
 *
 * Server-side: /v1/dev/cron and /v1/dev/cron/:name return 403 on
 * production, so this page degrades to "no crons available" there. The
 * client-side NEXT_PUBLIC_VERCEL_ENV check is a UX-only gate; the
 * server is the real protection.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { getCronMetadata } from "@/components/dev/cron-metadata";
import { AlertTriangle, Zap } from "lucide-react";

interface DevCronList {
  env: string;
  crons: string[];
}

export default function CmsCronsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dev-crons"],
    queryFn: () => api.get<DevCronList>("/v1/dev/cron"),
    // No retry on 403 (production deployment will always reject) — let
    // the error surface so the user sees the gating message immediately.
    retry: false,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="size-6" />
          Dev Cron Hub
        </h2>
        <p className="text-muted-foreground">
          Manually trigger any cron handler. Vercel Cron only fires on production
          deployments — this hub covers preview + local dev.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Cron hub unavailable</p>
                <p className="text-muted-foreground mt-1">
                  This usually means you&apos;re on a production deployment (the
                  /v1/dev namespace is server-side-blocked on prod). Dev cron
                  triggers are only available on preview + local dev.
                </p>
                {error instanceof Error && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">{error.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Environment:</span>
            <Badge variant="outline">{data.env}</Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{data.crons.length} crons</span>
          </div>
          {/* The toolbar pattern, applied to every cron at once — same
              friendly labels + hover tooltips as the per-page toolbars. */}
          <CronToolbar crons={data.crons} />
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-2">
                {data.crons.map((name) => {
                  const meta = getCronMetadata(name);
                  return (
                    <div
                      key={name}
                      className="flex items-start justify-between border-b pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{meta.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {meta.frequency}
                        </span>
                        <span className="text-xs text-muted-foreground/80 mt-1 max-w-2xl">
                          {meta.description}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                          cron: {name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
