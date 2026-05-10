"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import {
  PostComposer,
  PostComposerSkeleton,
  useLinkedInIdentity,
} from "./_components/post-composer";

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
}

export default function LinkedInDashboardPage() {
  // Mirror the X hub's pattern — read /v1/integrations once for the
  // top-level connect gate, then defer to /linkedin-content/me for
  // the picker data. Two queries because the integrations endpoint
  // gives us the lifecycle truth that lets us render an EmptyState
  // before /me would 404.
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () =>
      api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  const linkedInConnection = useMemo(
    () => integrations.data?.integrations.find((i) => i.provider === "linkedin_content"),
    [integrations.data]
  );
  // Treat `needs_reauth` as "set up, just stale" — the composer
  // renders + surfaces the in-page banner. Without this, /v1/integrations'
  // strict `connected = status === "active"` would bounce stale-scope
  // users to the EmptyState, hiding the very banner that tells them to
  // reconnect.
  const isConnected =
    linkedInConnection?.connected === true ||
    linkedInConnection?.status === "needs_reauth";

  const identity = useLinkedInIdentity();
  const enabledIdentity = isConnected ? identity : null;

  if (integrations.isLoading) {
    return <PageShell loading />;
  }

  if (!isConnected) {
    return (
      <PageShell>
        <EmptyState
          icon={MessageSquare}
          title="Connect LinkedIn to get started"
          description="Once connected, you can publish to your personal feed or any company page you administer, all from here."
          action={{ label: "Connect LinkedIn", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  // Identity errors that aren't NOT_CONNECTED — surface a Reconnect prompt.
  // (NOT_CONNECTED itself can't happen here: isConnected gated us in.)
  if (identity.isError) {
    const err = identity.error;
    const code = err instanceof ApiError ? err.code : "UNKNOWN";
    return (
      <PageShell>
        <EmptyState
          icon={RefreshCw}
          title="LinkedIn needs a quick reconnect"
          description={
            code === "NO_ACCOUNT"
              ? "We're missing your LinkedIn member identity. Reconnect to repair the integration."
              : "We couldn't read your LinkedIn identity. Reconnect to continue posting."
          }
          action={{ label: "Reconnect LinkedIn", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  const needsReauth =
    enabledIdentity?.data && enabledIdentity.data.status !== "active";

  return (
    <PageShell>
      {needsReauth && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex items-center justify-between gap-4 p-4 text-sm">
            <span>
              Your LinkedIn connection is{" "}
              <span className="font-medium">{enabledIdentity?.data?.status}</span>.
              Reconnect to keep publishing.
            </span>
            <a
              href="/dashboard/integrations"
              className="font-medium text-amber-900 underline underline-offset-4 dark:text-amber-200"
            >
              Reconnect
            </a>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose" className="gap-1.5">
            <Send className="size-4" /> Compose
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4">
          <Card>
            <CardContent className="p-5">
              {identity.isLoading || !enabledIdentity?.data ? (
                <PostComposerSkeleton />
              ) : (
                <PostComposer identity={enabledIdentity.data} />
              )}
            </CardContent>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Text + link posts only for now — carousels, polls, and scheduling are coming.
          </p>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function PageShell({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">LinkedIn</h2>
        <p className="text-muted-foreground">
          Publish to your personal feed or any company page you administer.
        </p>
      </div>
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
