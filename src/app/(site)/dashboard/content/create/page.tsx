"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, PenSquare } from "lucide-react";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHomeSummary } from "@/hooks/use-home-summary";
import { COMPOSE_HREF, contentNeedsOk, draftsLine } from "@/lib/content-home";
import { CONTENT_NEEDS_OK } from "@/lib/content-nav";
import { contentHubCatalogQuery, contentHubIntegrationsQuery } from "@/lib/nav-queries";
import { navLabel } from "@/lib/nav-copy";
import { AutoWriteCard } from "@/components/content/auto-write-card";
import { ChannelLogo } from "../_components/channel-logo";
import { CHANNELS, type ChannelConfig } from "../channels.config";
import { mapCatalogToChannels } from "../channels-from-catalog";
import { channelLinks, connectionsByProvider } from "./channel-links";

/**
 * Content > Create. Four ways in: write a post (the Compose sheet), review the
 * drafts Peakhour has made, start or edit a web page, or open one of your
 * channels. Between Drafts and Web pages sits the Automatic writing card (which
 * jobs may start themselves, and the one monthly Peaks limit): what it writes
 * lands in Drafts. Connecting a channel is NOT here: Connected accounts is the one
 * place that lists every channel and connects it.
 */
export default function ContentCreatePage() {
  const integrations = useQuery(contentHubIntegrationsQuery);
  const catalog = useQuery(contentHubCatalogQuery);
  const summary = useHomeSummary();

  const channels = useMemo<ChannelConfig[]>(
    () => (catalog.data?.integrations?.length ? mapCatalogToChannels(catalog.data.integrations) : [...CHANNELS]),
    [catalog.data],
  );
  const links = useMemo(
    () => channelLinks(channels, connectionsByProvider(integrations.data?.integrations)),
    [channels, integrations.data],
  );

  const drafts = summary.data ? contentNeedsOk(summary.data) : undefined;

  return (
    <PageShell>
      <PageHeader
        title="Create"
        description="Write a post, check the drafts Peakhour made, or work on a web page."
        actions={
          <Button asChild>
            <Link href={COMPOSE_HREF}>
              <PenSquare className="size-4" /> Post something
            </Link>
          </Button>
        }
      />

      <section aria-labelledby="create-drafts" className="space-y-3">
        <h2 id="create-drafts" className="text-sm font-semibold">
          Drafts
        </h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            {summary.isLoading ? (
              <Skeleton className="h-5 w-64" />
            ) : (
              <p className="text-sm text-muted-foreground">{draftsLine(drafts)}</p>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={CONTENT_NEEDS_OK}>
                Open {navLabel(CONTENT_NEEDS_OK)} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Automatic writing">
        <AutoWriteCard />
      </section>

      <section aria-labelledby="create-pages" className="space-y-3">
        <h2 id="create-pages" className="text-sm font-semibold">
          Web pages
        </h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Pages on your website that Peakhour writes and keeps fresh.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/pages">
                Open {navLabel("/dashboard/pages")} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="create-channels" className="space-y-3">
        <h2 id="create-channels" className="text-sm font-semibold">
          Your channels
        </h2>
        {integrations.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : links.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {integrations.isError
              ? "We couldn't load your channels. Try again in a moment."
              : "No channel is connected yet."}{" "}
            <Link href="/dashboard/integrations" className="font-medium text-foreground underline underline-offset-4">
              Connect a channel
            </Link>
          </p>
        ) : (
          <>
            <ul className="grid gap-3 2xl:grid-cols-2">
              {links.map((l) => (
                <li key={l.slug}>
                  <Link
                    href={l.href}
                    className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <ChannelLogo channel={l.channel} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-sm text-muted-foreground">{l.description}</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Want another channel?{" "}
              <Link href="/dashboard/integrations" className="font-medium text-foreground underline underline-offset-4">
                Connect it in Connected accounts
              </Link>
              .
            </p>
          </>
        )}
      </section>
    </PageShell>
  );
}
