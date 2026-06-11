"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Badge,
  Box,
  Button,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  IndexTable,
  Thumbnail,
  Pagination,
  EmptyState,
  Tabs,
  Tooltip,
} from "@shopify/polaris";
import { ProductIcon } from "@shopify/polaris-icons";
import { getSessionToken } from "../_lib/session";
import { api, ApiError } from "@/lib/api";
import { getCronMetadata, summarizeCronBody } from "@/components/dev/cron-metadata";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const PAGE_SIZE = 25;
const DEV_CRON_NAME = "shopify-deadstock-score";

// ── Types ──────────────────────────────────────────────────────────────────

interface IntelItem {
  productId: string;
  title: string | null;
  imageUrl: string | null;
  deadStockScore: number | null;
  scoreBand: string | null;
  inventoryAgeDays: number | null;
  daysSinceLastSale: number | null;
  stockQuantity: number | null;
  diagnosisText: string | null;
  suggestedAction: string | null;
  scoredAt: string | null;
}

interface BandCounts {
  healthy: number;
  watchlist: number;
  slow_moving: number;
  dead_stock_risk: number;
  critical: number;
  unscored: number;
}

interface IntelligenceResponse {
  items: IntelItem[];
  counts: BandCounts;
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Shape returned by POST /v1/dev/cron/:name (mirrors <CronToolbar/>). */
interface DevCronResult {
  cron: string;
  status: number;
  ok: boolean;
  durationMs: number;
  body: string;
  truncated: boolean;
}

// ── Band → presentation maps ───────────────────────────────────────────────

/** Tab order is worst-last so "All" and "Critical" lead the row. */
const BAND_TABS = [
  { id: "all", band: "", label: "All" },
  { id: "critical", band: "critical", label: "Critical" },
  { id: "dead_stock_risk", band: "dead_stock_risk", label: "At risk" },
  { id: "slow_moving", band: "slow_moving", label: "Slow moving" },
  { id: "watchlist", band: "watchlist", label: "Watchlist" },
  { id: "healthy", band: "healthy", label: "Healthy" },
] as const;

type BadgeTone = "critical" | "warning" | "attention" | "info" | "success";

const BAND_PRESENTATION: Record<string, { label: string; tone: BadgeTone }> = {
  critical: { label: "Critical", tone: "critical" },
  dead_stock_risk: { label: "At risk", tone: "warning" },
  slow_moving: { label: "Slow moving", tone: "attention" },
  watchlist: { label: "Watchlist", tone: "info" },
  healthy: { label: "Healthy", tone: "success" },
};

/** cmrc_product_intelligence.suggestedAction enum → merchant-friendly label. */
const ACTION_LABELS: Record<string, string> = {
  discount_pricing: "Reprice",
  boost_discovery: "Boost discovery",
  bundle: "Bundle",
  clearance: "Clearance",
  monitor: "Monitor",
  none: "—",
};

function scoreBadge(item: IntelItem) {
  const band = item.scoreBand ? BAND_PRESENTATION[item.scoreBand] : undefined;
  if (!band || item.deadStockScore == null) {
    return <Badge>Not scored</Badge>;
  }
  return <Badge tone={band.tone}>{`${band.label} · ${Math.round(item.deadStockScore)}`}</Badge>;
}

function formatLastSale(days: number | null): string {
  if (days == null) return "Never in 90d";
  if (days === 0) return "Today";
  return `${days}d ago`;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function IntelligenceSkeleton() {
  return (
    <SkeletonPage title="Intelligence">
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={10} />
        </BlockStack>
      </Card>
    </SkeletonPage>
  );
}

// ── Dev-only scoring trigger ───────────────────────────────────────────────
//
// House rule (CronToolbar architecture requirement): pages whose data depends
// on a cron MUST surface a dev trigger — Vercel Cron only fires on production
// deployments, so preview + local dev would otherwise have no way to exercise
// the scoring path this page reflects. The embedded surface is Polaris-only
// (zero Tailwind), so <CronToolbar/> can't be mounted here; this Banner is the
// Polaris-native equivalent. It mirrors CronToolbar exactly: same env gate
// (NEXT_PUBLIC_VERCEL_ENV !== "production"), same endpoint
// (POST /v1/dev/cron/shopify-deadstock-score via the cookie-authed api
// client — the api route is requireAuth + server-side VERCEL_ENV-gated), and
// the same friendly metadata from cron-metadata.ts.

function isProductionEnv(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}

interface DevScoringBannerProps {
  running: boolean;
  message: { tone: "success" | "critical"; text: string } | null;
  onRun: () => void;
}

function DevScoringBanner({ running, message, onRun }: DevScoringBannerProps) {
  const meta = getCronMetadata(DEV_CRON_NAME);
  return (
    <Banner tone="info" title={`${meta.label} (dev only)`}>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd">
          {meta.description} {meta.frequency} in production — on preview and local builds the
          schedule doesn&apos;t fire, so you can run it manually here.
        </Text>
        {message && (
          <Text as="p" variant="bodyMd" tone={message.tone === "success" ? "success" : "critical"}>
            {message.text}
          </Text>
        )}
        <Box>
          <Button onClick={onRun} loading={running} disabled={running} size="slim">
            Run scoring now (dev)
          </Button>
        </Box>
      </BlockStack>
    </Banner>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type PageState = "initializing" | "ready" | "error";

const ZERO_COUNTS: BandCounts = {
  healthy: 0,
  watchlist: 0,
  slow_moving: 0,
  dead_stock_risk: 0,
  critical: 0,
  unscored: 0,
};

export default function IntelligencePage() {
  const [pageState, setPageState] = useState<PageState>("initializing");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [items, setItems] = useState<IntelItem[]>([]);
  const [counts, setCounts] = useState<BandCounts>(ZERO_COUNTS);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTab, setSelectedTab] = useState(0);
  const [fetching, setFetching] = useState(false);
  // Bumped to force a refetch of the current view (after a dev scoring run).
  const [refreshNonce, setRefreshNonce] = useState(0);
  // P2.8 — from /embedded/context, best-effort (page works without it).
  const [missingScopes, setMissingScopes] = useState<string[]>([]);
  const [shop, setShop] = useState("");
  const [devRunning, setDevRunning] = useState(false);
  const [devMessage, setDevMessage] = useState<{ tone: "success" | "critical"; text: string } | null>(null);
  const devTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const band = BAND_TABS[selectedTab]?.band ?? "";

  // Cleanup timers on unmount — prevents setState on unmounted component.
  useEffect(() => () => {
    if (devTimerRef.current) clearTimeout(devTimerRef.current);
  }, []);

  const fetchIntelligence = useCallback(async (pg: number, bd: string, signal?: AbortSignal) => {
    setFetching(true);
    const token = await getSessionToken();
    if (signal?.aborted) return;
    if (!token) {
      setFetchError("Couldn't get a Shopify session. Please reopen from your admin.");
      setPageState("error");
      setFetching(false);
      return;
    }
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) });
      if (bd) params.set("band", bd);
      const res = await fetch(`${API_URL}/v1/shopify/embedded/intelligence?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (signal?.aborted) return;
      if (!res.ok) {
        setFetchError(
          res.status === 404
            ? "This store isn't connected to Peakhour yet — finish setup from the Home tab."
            : `Could not load intelligence (${res.status}).`,
        );
        setPageState("error");
        setFetching(false);
        return;
      }
      const data = (await res.json()) as IntelligenceResponse;
      setItems(data.items);
      setCounts(data.counts);
      setPages(data.pages);
      setPageState("ready");
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setFetchError("Network error loading intelligence.");
      setPageState("error");
    } finally {
      setFetching(false);
    }
  }, []);

  // Single fetching effect — AbortController cancels in-flight requests when
  // deps change (tab/page switch, dev-run refresh) or on unmount.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchIntelligence(currentPage, band, ctrl.signal);
    return () => ctrl.abort();
  }, [currentPage, band, refreshNonce, fetchIntelligence]);

  // P2.8 — fetch missingScopes (+ shop for the reconnect URL) once.
  // Best-effort: a context failure just hides the re-auth prompt.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const token = await getSessionToken();
      if (ctrl.signal.aborted || !token) return;
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/context`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted || !res.ok) return;
        const ctx = (await res.json()) as { shop?: string; missingScopes?: string[] };
        setShop(ctx.shop ?? "");
        setMissingScopes(Array.isArray(ctx.missingScopes) ? ctx.missingScopes : []);
      } catch {
        // Best-effort — ignore.
      }
    })();
    return () => ctrl.abort();
  }, []);

  const handleTabSelect = useCallback((idx: number) => {
    setSelectedTab(idx);
    setCurrentPage(1);
  }, []);

  // P2.8 — reuse the existing reconnect flow (it handles session-or-auth and
  // Shopify shows an incremental grant screen for the new scope). Top-level
  // navigation: relative URLs inside the admin iframe would only move the
  // iframe itself, and the connect wizard must run outside the iframe.
  const handleReauth = useCallback(() => {
    (window.top ?? window).location.href =
      `/shopify/connect?shop=${encodeURIComponent(shop)}&reconnect=1`;
  }, [shop]);

  const handleDevRun = useCallback(async () => {
    if (devRunning) return;
    setDevRunning(true);
    setDevMessage(null);
    const meta = getCronMetadata(DEV_CRON_NAME);
    try {
      const res = await api.post<DevCronResult>(`/v1/dev/cron/${DEV_CRON_NAME}`, {});
      if (res.ok) {
        setDevMessage({
          tone: "success",
          text: summarizeCronBody(DEV_CRON_NAME, res.body) ?? `${meta.label} complete.`,
        });
        // Refetch after a short delay so the freshly-written scores land.
        // Timer lives in a ref so the unmount cleanup can cancel it.
        devTimerRef.current = setTimeout(() => {
          setDevRunning(false);
          setCurrentPage(1);
          setRefreshNonce((n) => n + 1);
        }, 1500);
        return;
      }
      // Friendly failure copy only — the HTTP status/body are dev detail.
      console.error(`[Intelligence] ${DEV_CRON_NAME} failed: HTTP ${res.status}`, res.body);
      setDevMessage({ tone: "critical", text: "Scoring run didn't complete. Please try again in a moment." });
      setDevRunning(false);
    } catch (err) {
      console.error(`[Intelligence] ${DEV_CRON_NAME} request failed:`, err);
      const unauthorized = err instanceof ApiError && err.status === 401;
      setDevMessage({
        tone: "critical",
        text: unauthorized
          ? "Dev triggers need a Peakhour dashboard sign-in in this browser."
          : "Scoring run couldn't start. Please try again in a moment.",
      });
      setDevRunning(false);
    }
  }, [devRunning]);

  // ── Render states ────────────────────────────────────────────────────────

  if (pageState === "initializing") return <IntelligenceSkeleton />;

  if (pageState === "error") {
    return (
      <Page title="Intelligence">
        <Banner tone="critical" title="Could not load intelligence">
          <Text as="p" variant="bodyMd">{fetchError}</Text>
        </Banner>
      </Page>
    );
  }

  const allCount =
    counts.healthy +
    counts.watchlist +
    counts.slow_moving +
    counts.dead_stock_risk +
    counts.critical +
    counts.unscored;
  const missingOrders = missingScopes.includes("read_orders");
  const showDevBanner = !isProductionEnv();

  // Store has no intelligence rows at all — empty states (with the dev
  // trigger still visible, since running the cron is how data appears).
  if (allCount === 0 && !fetching) {
    return (
      <Page title="Intelligence">
        <BlockStack gap="400">
          {showDevBanner && (
            <DevScoringBanner running={devRunning} message={devMessage} onRun={handleDevRun} />
          )}
          {missingOrders ? (
            // P2.8 — scoring needs order history; the merchant's grant predates
            // the read_orders scope. Same reconnect CTA as the Home banner.
            <EmptyState
              heading="Unlock inventory intelligence"
              action={{ content: "Update permissions", onAction: handleReauth }}
              image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
            >
              <Text as="p" variant="bodyMd">
                Dead-stock scores are built from your order history, and Peakhour doesn&apos;t have
                permission to read orders yet. Approve the updated permissions on Shopify — it takes
                a few seconds — and your first analysis will run automatically.
              </Text>
            </EmptyState>
          ) : (
            <EmptyState
              heading="No scores yet"
              image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
            >
              <Text as="p" variant="bodyMd">
                Scores are computed daily — your first analysis will appear after the next run.
              </Text>
            </EmptyState>
          )}
        </BlockStack>
      </Page>
    );
  }

  // ── Table ────────────────────────────────────────────────────────────────

  const tabs = BAND_TABS.map((t) => ({
    id: t.id,
    content: `${t.label} (${t.band ? counts[t.band as keyof BandCounts] : allCount})`,
  }));

  const rowMarkup = items.map((item, index) => (
    <IndexTable.Row id={item.productId} key={item.productId} position={index}>
      <IndexTable.Cell>
        <Thumbnail
          source={item.imageUrl ?? ProductIcon}
          alt={item.title ?? "Product"}
          size="small"
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Box maxWidth="220px">
          <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
            {item.title ?? "Untitled product"}
          </Text>
        </Box>
      </IndexTable.Cell>
      <IndexTable.Cell>{scoreBadge(item)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{formatLastSale(item.daysSinceLastSale)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="end">
          {item.stockQuantity != null ? item.stockQuantity.toLocaleString() : "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="end">
          {item.inventoryAgeDays != null ? `${item.inventoryAgeDays}d` : "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {item.diagnosisText ? (
          <Tooltip content={item.diagnosisText} width="wide">
            <Box maxWidth="280px">
              <Text as="span" variant="bodyMd" truncate>{item.diagnosisText}</Text>
            </Box>
          </Tooltip>
        ) : (
          <Text as="span" variant="bodyMd" tone="subdued">—</Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {(item.suggestedAction && ACTION_LABELS[item.suggestedAction]) || "—"}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Intelligence" subtitle="Daily inventory health scores for your catalog">
      <BlockStack gap="400">
        {showDevBanner && (
          <DevScoringBanner running={devRunning} message={devMessage} onRun={handleDevRun} />
        )}

        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabSelect} />

          {!fetching && items.length === 0 ? (
            <Box padding="1000">
              <InlineStack align="center">
                <Text as="p" variant="bodyMd" tone="subdued">
                  No products in this band right now.
                </Text>
              </InlineStack>
            </Box>
          ) : (
            <IndexTable
              resourceName={{ singular: "product", plural: "products" }}
              itemCount={items.length}
              headings={[
                { title: "" },
                { title: "Product" },
                { title: "Score" },
                { title: "Last sale" },
                { title: "Stock", alignment: "end" },
                { title: "Age", alignment: "end" },
                { title: "Diagnosis" },
                { title: "Suggested action" },
              ]}
              selectable={false}
              loading={fetching}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>

        {/* Pagination */}
        {pages > 1 && (
          <InlineStack align="center">
            <Pagination
              hasPrevious={currentPage > 1}
              onPrevious={() => setCurrentPage((p) => p - 1)}
              hasNext={currentPage < pages}
              onNext={() => setCurrentPage((p) => p + 1)}
              label={`Page ${currentPage} of ${pages}`}
            />
          </InlineStack>
        )}
      </BlockStack>
    </Page>
  );
}
