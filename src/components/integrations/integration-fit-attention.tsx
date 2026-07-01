"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { RequestReviewButton } from "@/components/integrations/request-review-button";

/**
 * "Needs attention" surface for the settings page: lists connected accounts the
 * integration-fit reconcile cron flagged as belonging to a DIFFERENT brand than
 * their workspace ("one workspace = one business"). The one-click resolution
 * moves the integration into its own new workspace (POST /adopt-connection).
 * Renders nothing when there's no pollution, so it's invisible in the happy path.
 */

interface FitFlag {
  connectionId: string;
  businessId: string | null;
  businessName: string | null;
  provider: string | null;
  accountName: string | null;
  fit: {
    verdict: string;
    identity: { kind: string; value: string };
    anchor: string | null;
    reason: string | null;
    flaggedAt: string;
  };
}

function formatProvider(p: string | null): string {
  if (!p) return "Integration";
  return p.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function IntegrationFitAttention() {
  const [flags, setFlags] = useState<FitFlag[] | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<FitFlag[]>("/v1/auth/businesses/fit-flags")
      .then((res) => {
        if (active) setFlags(res);
      })
      .catch(() => {
        // Non-critical surface — fail silent (don't block the settings page).
        if (active) setFlags([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!flags || flags.length === 0) return null;

  async function moveToOwnWorkspace(f: FitFlag) {
    setMoving(f.connectionId);
    try {
      const res = await api.post<{ name: string }>("/v1/auth/businesses/adopt-connection", {
        connectionId: f.connectionId,
      });
      setFlags((prev) => (prev ? prev.filter((x) => x.connectionId !== f.connectionId) : prev));
      toast.success(`Moved ${formatProvider(f.provider)} into a new workspace "${res.name}".`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't move this integration. Please try again.",
      );
    } finally {
      setMoving(null);
    }
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
          <CardTitle>Needs attention</CardTitle>
        </div>
        <CardDescription>
          These connected accounts look like a different brand from this workspace. Keeping each
          brand in its own workspace keeps your content on-message — move one out below, or
          disconnect it from its account card.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map((f) => (
          <div
            key={f.connectionId}
            className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <span className="font-medium">{formatProvider(f.provider)}</span>
              {f.accountName ? <span className="text-muted-foreground"> — {f.accountName}</span> : null}
              <p className="text-muted-foreground mt-0.5">
                Looks like{" "}
                <span className="font-medium text-foreground">{f.fit.identity.value}</span>
                {f.fit.anchor ? (
                  <>
                    , but this workspace is set up for{" "}
                    <span className="font-medium text-foreground">{f.fit.anchor}</span>
                  </>
                ) : null}
                .
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={moving === f.connectionId}
                onClick={() => moveToOwnWorkspace(f)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {moving === f.connectionId ? "Moving…" : "Move to its own workspace"}
              </Button>
              <RequestReviewButton
                provider={f.provider ?? "integration"}
                anchor={f.fit.anchor}
                candidate={
                  f.fit.identity?.value
                    ? {
                        identity: {
                          kind: f.fit.identity.kind === "domain" ? "domain" : "handle",
                          value: f.fit.identity.value,
                        },
                      }
                    : undefined
                }
                variant="ghost"
                label="Not right?"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
