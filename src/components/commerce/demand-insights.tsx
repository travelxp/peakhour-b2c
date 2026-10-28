"use client";

import { CheckCircle2, ExternalLink, MessageCircleQuestion, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { useDemandInsights } from "@/hooks/use-demand-insights";
import {
  adminUrl,
  askedLine,
  isInsights,
  stateOfError,
  surfaceLine,
  trendLine,
  type DemandInsights,
  type DemandItem,
  type DemandState,
} from "@/lib/demand-insights";

/**
 * Commerce -> What shoppers asked for. The requests your assistant could not
 * meet (storefront chat, WhatsApp, WooCommerce), last 30 days against the 30
 * before, each with why it missed and the one tap that fixes it in your Shopify
 * admin. A request your catalog now meets is marked "Gap closed" and sorted below
 * the open ones. Rows are normalised requests and counts; no shopper's message,
 * name or contact is stored or shown.
 *
 * Five states, none of them the same sentence: loading, failed (never "nothing
 * was asked"), no connected store, nothing yet, and the list.
 */
export function DemandInsightsPanel() {
  const q = useDemandInsights();
  const state: DemandState = q.isLoading
    ? { kind: "loading" }
    : q.isError
      ? stateOfError(q.error)
      : isInsights(q.data)
        ? { kind: "ready", data: q.data }
        : { kind: "error" };
  return <DemandInsightsView state={state} />;
}

/** The page for a state. Pure (no hooks), so every state is renderable and testable. */
export function DemandInsightsView({ state }: { state: DemandState }) {
  switch (state.kind) {
    case "loading":
      return <Skeleton className="h-40 w-full" />;
    case "error":
      return (
        <p role="alert" data-demand="error" className="text-sm text-destructive">
          Shopper requests could not be loaded right now. Please refresh in a moment.
        </p>
      );
    case "no-store":
      return (
        <div data-demand="no-store">
          <EmptyState
            icon={Store}
            title="No Shopify store connected"
            description="Connect your Shopify store and your assistant will start noting what shoppers ask for that your catalog cannot supply."
            action={{ label: "Connect a store", href: "/dashboard/commerce/channels" }}
          />
        </div>
      );
    case "ready":
      return state.data.items.length === 0 ? (
        <div data-demand="empty" className="space-y-1">
          <p className="font-medium">No unmet requests yet.</p>
          <p className="text-sm text-muted-foreground">
            When a shopper asks your assistant for something your catalog cannot supply, it shows up here with how often, so you know what to restock or add.
          </p>
        </div>
      ) : (
        <List data={state.data} />
      );
  }
}

function List({ data }: { data: DemandInsights }) {
  const n = data.totalAsks;
  return (
    <section data-demand="list" aria-labelledby="demand-heading" className="space-y-3">
      <h2 id="demand-heading" className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircleQuestion className="size-5" aria-hidden="true" />
        Requests your assistant could not meet
      </h2>
      <p className="text-sm text-muted-foreground">
        Last {data.windowDays} days ({n === 1 ? "1 request" : `${n} requests`} in all)
        {data.shop ? ` for ${data.shop}` : ""}. Wording is normalised; no shopper&apos;s message or details are kept.
      </p>
      <ul className="space-y-3">
        {data.items.map((item) => (
          <Row key={item.key} item={item} shop={data.shop} />
        ))}
      </ul>
    </section>
  );
}

function Row({ item, shop }: { item: DemandItem; shop: string | undefined }) {
  const closed = item.status === "closed" && !!item.closedBy;
  const trend = trendLine(item);
  const where = surfaceLine(item.surfaces);
  return (
    <li data-demand-item={item.key} data-demand-status={closed ? "closed" : "open"}>
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.label}</p>
            <Badge variant="secondary">{askedLine(item.timesAsked)}</Badge>
            {closed ? (
              <Badge variant="default">
                <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
                Gap closed
              </Badge>
            ) : (
              trend && <Badge variant="outline">{trend.text}</Badge>
            )}
          </div>
          {closed ? <Closed item={item} shop={shop} /> : <Open item={item} shop={shop} />}
          {where && <p className="text-xs text-muted-foreground">{where}</p>}
        </CardContent>
      </Card>
    </li>
  );
}

function AdminLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
      {children}
      <ExternalLink className="size-3" aria-hidden="true" />
      <span className="sr-only">(opens Shopify admin in a new tab)</span>
    </a>
  );
}

function Open({ item, shop }: { item: DemandItem; shop: string | undefined }) {
  const href = adminUrl(shop, item.target?.adminPath);
  const text = item.target?.kind === "product" && item.target.productTitle ? `${item.target.label}: ${item.target.productTitle}` : (item.target?.label ?? "");
  return (
    <>
      <p className="text-sm text-muted-foreground">Why it missed: {item.failed}</p>
      <p className="text-sm">
        Suggested: {item.action.text}
        {href && text ? (
          <>
            {" "}
            <AdminLink href={href}>{text}</AdminLink>
          </>
        ) : null}
      </p>
    </>
  );
}

function Closed({ item, shop }: { item: DemandItem; shop: string | undefined }) {
  const by = item.closedBy as NonNullable<DemandItem["closedBy"]>;
  const asks = by.asksSince && by.asksSince > 0 ? ` ${askedLine(by.asksSince)} since it was last updated.` : "";
  return (
    <p className="text-sm" data-demand-closed>
      Now in stock: <AdminLink href={adminUrl(shop, by.adminPath)}>{by.title}</AdminLink>.{asks}
    </p>
  );
}
