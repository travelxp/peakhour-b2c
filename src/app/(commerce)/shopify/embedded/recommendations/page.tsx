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
  Link,
  Modal,
  TextField,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  IndexTable,
  Thumbnail,
  Pagination,
  EmptyState,
  Tabs,
} from "@shopify/polaris";
import { ProductIcon } from "@shopify/polaris-icons";
import { getSessionToken } from "../_lib/session";
import { api, ApiError } from "@/lib/api";
import { getCronMetadata, summarizeCronBody } from "@/components/dev/cron-metadata";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const PAGE_SIZE = 25;
// The recommendation engine (P4.4) runs INSIDE the daily dead-stock scoring
// cron — one trigger exercises scoring + recommendation generation.
const DEV_CRON_NAME = "shopify-deadstock-score";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProductPreview {
  id: string;
  title: string | null;
  imageUrl: string | null;
}

interface Recommendation {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  suggestedDiscount: number;
  suggestedDurationHours: number;
  expectedRevenueRange: { min: number; max: number; currency?: string } | null;
  confidenceScore: number;
  reasonSummary: string;
  approvalStatus: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  editedDiscount: number | null;
  editedProducts: string[] | null;
  productCount: number;
  productsPreview: ProductPreview[];
  createdAt: string | null;
}

interface RecommendationsResponse {
  items: Recommendation[];
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

// ── Presentation maps ──────────────────────────────────────────────────────

/** Status tabs. Counts aren't in the API response (no counts aggregation on
 *  GET /embedded/recommendations), so the tabs are label-only. Default tab is
 *  Pending — the action queue. "All" omits the status param entirely, which
 *  also surfaces the engine-managed statuses (expired/executing/completed). */
const STATUS_TABS = [
  { id: "pending", status: "pending", label: "Pending" },
  { id: "approved", status: "approved", label: "Approved" },
  { id: "rejected", status: "rejected", label: "Rejected" },
  { id: "all", status: "", label: "All" },
] as const;

type BadgeTone = "critical" | "warning" | "attention" | "info" | "success" | "magic";

/** cmrc_recommendations.type enum → merchant-friendly label + badge tone. */
const TYPE_PRESENTATION: Record<string, { label: string; tone: BadgeTone }> = {
  dead_stock_recovery: { label: "Dead stock recovery", tone: "attention" },
  trending_boost: { label: "Trending boost", tone: "success" },
  aov_increase: { label: "AOV increase", tone: "info" },
  new_arrival_push: { label: "New arrival push", tone: "info" },
  margin_protect: { label: "Margin protect", tone: "warning" },
  category_revival: { label: "Category revival", tone: "magic" },
};

function typeBadge(type: string) {
  const p = TYPE_PRESENTATION[type];
  if (!p) return <Badge>{type}</Badge>;
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

const STATUS_PRESENTATION: Record<string, { label: string; tone?: BadgeTone }> = {
  pending: { label: "Pending", tone: "attention" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "critical" },
  expired: { label: "Expired" },
  executing: { label: "Executing", tone: "info" },
  completed: { label: "Completed", tone: "success" },
};

function statusBadge(status: string) {
  const p = STATUS_PRESENTATION[status];
  if (!p) return <Badge>{status}</Badge>;
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

/** Confidence score → merchant-friendly band (≥0.75 High, ≥0.5 Medium). */
function confidenceLabel(score: number): string {
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

/** Humanize a duration in hours: whole days read as days ("3 days"),
 *  anything under 48h that isn't a whole day stays in hours. */
function humanizeHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

/** Currency-formatted expected recovery range. The currency code comes from
 *  the recommendation document; an unknown/missing code falls back to plain
 *  numbers (never crash on Intl). */
function formatRevenueRange(range: Recommendation["expectedRevenueRange"]): string | null {
  if (!range) return null;
  const fmt = (n: number): string => {
    if (range.currency) {
      try {
        return new Intl.NumberFormat("en", {
          style: "currency",
          currency: range.currency,
          maximumFractionDigits: 0,
        }).format(n);
      } catch {
        // Unknown ISO code — fall through to the plain form.
      }
    }
    return n.toLocaleString();
  };
  return `${fmt(range.min)}–${fmt(range.max)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** The discount the merchant will actually run: inline edit wins. */
function effectiveDiscount(rec: Recommendation): string {
  if (rec.editedDiscount != null && rec.editedDiscount !== rec.suggestedDiscount) {
    return `${rec.editedDiscount}% (edited from ${rec.suggestedDiscount}%)`;
  }
  return `${rec.editedDiscount ?? rec.suggestedDiscount}%`;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function RecommendationsSkeleton() {
  return (
    <SkeletonPage title="Recommendations">
      <BlockStack gap="500">
        {[0, 1].map((i) => (
          <Card key={i}>
            <BlockStack gap="400">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={4} />
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </SkeletonPage>
  );
}

// ── Dev-only generation trigger ────────────────────────────────────────────
//
// House rule (CronToolbar architecture requirement): pages whose data depends
// on a cron MUST surface a dev trigger — Vercel Cron only fires on production
// deployments. Recommendations are generated by the daily dead-stock scoring
// cron (the engine runs as its last step), so this page reuses the SAME
// trigger as the Intelligence page: same env gate
// (NEXT_PUBLIC_VERCEL_ENV !== "production"), same cookie-authed
// POST /v1/dev/cron/shopify-deadstock-score, same cron-metadata.ts copy.

function isProductionEnv(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}

interface DevGenerateBannerProps {
  running: boolean;
  message: { tone: "success" | "critical"; text: string } | null;
  onRun: () => void;
}

function DevGenerateBanner({ running, message, onRun }: DevGenerateBannerProps) {
  const meta = getCronMetadata(DEV_CRON_NAME);
  return (
    <Banner tone="info" title={`${meta.label} (dev only)`}>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd">
          Recommendations are generated by the daily inventory scoring run (at most one new
          recommendation per day). {meta.frequency} in production — on preview and local builds
          the schedule doesn&apos;t fire, so you can run it manually here.
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

type ModalKind = "approve" | "edit" | "reject";

export default function RecommendationsPage() {
  const [pageState, setPageState] = useState<PageState>("initializing");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTab, setSelectedTab] = useState(0); // default: Pending
  const [fetching, setFetching] = useState(false);
  // Bumped to force a refetch of the current view (post-action, dev run, 409).
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Action modal — one open at a time, always against one recommendation.
  const [modal, setModal] = useState<{ kind: ModalKind; rec: Recommendation } | null>(null);
  const [acting, setActing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editDiscount, setEditDiscount] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Post-action banners (page-level, shown after the modal closes).
  const [conflictNotice, setConflictNotice] = useState(false);
  const [approvedNotice, setApprovedNotice] = useState<{ title: string; zoneId: string | null } | null>(null);

  const [devRunning, setDevRunning] = useState(false);
  const [devMessage, setDevMessage] = useState<{ tone: "success" | "critical"; text: string } | null>(null);
  const devTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = STATUS_TABS[selectedTab]?.status ?? "pending";

  // Cleanup timers on unmount — prevents setState on unmounted component.
  useEffect(() => () => {
    if (devTimerRef.current) clearTimeout(devTimerRef.current);
  }, []);

  const fetchRecommendations = useCallback(async (pg: number, st: string, signal?: AbortSignal) => {
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
      if (st) params.set("status", st);
      const res = await fetch(`${API_URL}/v1/shopify/embedded/recommendations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (signal?.aborted) return;
      if (!res.ok) {
        setFetchError(
          res.status === 404
            ? "This store isn't connected to Peakhour yet — finish setup from the Home tab."
            : `Could not load recommendations (${res.status}).`,
        );
        setPageState("error");
        setFetching(false);
        return;
      }
      const data = (await res.json()) as RecommendationsResponse;
      setItems(data.items);
      setTotal(data.total);
      setPages(data.pages);
      setPageState("ready");
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setFetchError("Network error loading recommendations.");
      setPageState("error");
    } finally {
      setFetching(false);
    }
  }, []);

  // Single fetching effect — AbortController cancels in-flight requests when
  // deps change (tab/page switch, post-action refresh) or on unmount.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchRecommendations(currentPage, status, ctrl.signal);
    return () => ctrl.abort();
  }, [currentPage, status, refreshNonce, fetchRecommendations]);

  const handleTabSelect = useCallback((idx: number) => {
    setSelectedTab(idx);
    setCurrentPage(1);
  }, []);

  // ── Modal openers ────────────────────────────────────────────────────────

  const openModal = useCallback((kind: ModalKind, rec: Recommendation) => {
    setModalError(null);
    setEditDiscount(String(rec.suggestedDiscount));
    setRejectReason("");
    setModal({ kind, rec });
  }, []);

  const closeModal = useCallback(() => {
    if (!acting) setModal(null);
  }, [acting]);

  // ── Approve / reject actions ─────────────────────────────────────────────

  /** Shared POST for approve/reject. A 409 means the row was actioned in
   *  another tab/session between render and click — surface the page-level
   *  "already actioned" notice and refetch so the list catches up. */
  const postAction = useCallback(
    async (rec: Recommendation, action: "approve" | "reject", body: Record<string, unknown>) => {
      setActing(true);
      setModalError(null);
      const token = await getSessionToken();
      if (!token) {
        setModalError("Couldn't get a Shopify session. Please reopen from your admin.");
        setActing(false);
        return;
      }
      try {
        const res = await fetch(
          `${API_URL}/v1/shopify/embedded/recommendations/${rec.id}/${action}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (res.status === 409) {
          setModal(null);
          setConflictNotice(true);
          setRefreshNonce((n) => n + 1);
          setActing(false);
          return;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setModalError(data.error ?? `Could not ${action} the recommendation (${res.status}).`);
          setActing(false);
          return;
        }
        if (action === "approve") {
          const data = (await res.json()) as { approved: boolean; zoneId: string | null };
          setApprovedNotice({ title: rec.title, zoneId: data.zoneId });
        }
        setModal(null);
        setConflictNotice(false);
        setRefreshNonce((n) => n + 1);
      } catch {
        setModalError("Network error — please try again.");
      }
      setActing(false);
    },
    [],
  );

  const handleApprove = useCallback(() => {
    if (!modal) return;
    void postAction(modal.rec, "approve", {});
  }, [modal, postAction]);

  const handleEditApprove = useCallback(() => {
    if (!modal) return;
    const value = Number(editDiscount);
    if (!Number.isInteger(value) || value < 0 || value > 50) {
      setModalError("Discount must be a whole number between 0 and 50.");
      return;
    }
    // Only send editedDiscount when it actually differs — an unchanged value
    // would otherwise be persisted as a (noise) edit signal for learning.
    const body = value === modal.rec.suggestedDiscount ? {} : { editedDiscount: value };
    void postAction(modal.rec, "approve", body);
  }, [modal, editDiscount, postAction]);

  const handleReject = useCallback(() => {
    if (!modal) return;
    const reason = rejectReason.trim();
    void postAction(modal.rec, "reject", reason ? { reason } : {});
  }, [modal, rejectReason, postAction]);

  // ── Dev cron trigger (mirrors the Intelligence page) ─────────────────────

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
        // Refetch after a short delay so freshly-written recommendations land.
        devTimerRef.current = setTimeout(() => {
          setDevRunning(false);
          setCurrentPage(1);
          setRefreshNonce((n) => n + 1);
        }, 1500);
        return;
      }
      console.error(`[Recommendations] ${DEV_CRON_NAME} failed: HTTP ${res.status}`, res.body);
      setDevMessage({ tone: "critical", text: "Scoring run didn't complete. Please try again in a moment." });
      setDevRunning(false);
    } catch (err) {
      console.error(`[Recommendations] ${DEV_CRON_NAME} request failed:`, err);
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

  if (pageState === "initializing") return <RecommendationsSkeleton />;

  if (pageState === "error") {
    return (
      <Page title="Recommendations">
        <Banner tone="critical" title="Could not load recommendations">
          <Text as="p" variant="bodyMd">{fetchError}</Text>
        </Banner>
      </Page>
    );
  }

  const showDevBanner = !isProductionEnv();
  const isPendingTab = status === "pending";

  // ── Shared notice banners ────────────────────────────────────────────────

  const noticesMarkup = (
    <>
      {conflictNotice && (
        <Banner tone="warning" title="Already actioned" onDismiss={() => setConflictNotice(false)}>
          <Text as="p" variant="bodyMd">
            This recommendation was already approved or rejected elsewhere — the list has been
            refreshed.
          </Text>
        </Banner>
      )}
      {approvedNotice && (
        <Banner tone="success" title="Recommendation approved" onDismiss={() => setApprovedNotice(null)}>
          <BlockStack gap="200">
          {approvedNotice.zoneId ? (
            <>
              <Text as="p" variant="bodyMd">
                &ldquo;{approvedNotice.title}&rdquo; is now live as a Smart Rail zone with these
                products. Zone ID:{" "}
                <Text as="span" variant="bodyMd" fontWeight="semibold">{approvedNotice.zoneId}</Text>
              </Text>
              <Text as="p" variant="bodyMd">
                {/* Internal navigation — Polaris Link via Next Link (PolarisShell
                    linkComponent), stays inside the admin iframe. */}
                Manage it on the <Link url="/shopify/embedded/theme">Storefront page</Link>, and if
                this is your first zone, paste the Zone ID into the Smart Rail block in your theme.
              </Text>
            </>
          ) : (
            <Text as="p" variant="bodyMd">
              &ldquo;{approvedNotice.title}&rdquo; is approved. The Smart Rail zone couldn&apos;t be
              set up just now — it will be retried automatically, and you can check the{" "}
              <Link url="/shopify/embedded/theme">Storefront page</Link> shortly.
            </Text>
          )}
          </BlockStack>
        </Banner>
      )}
    </>
  );

  // ── Empty states ─────────────────────────────────────────────────────────

  if (items.length === 0 && !fetching && currentPage === 1) {
    return (
      <Page title="Recommendations">
        <BlockStack gap="400">
          {showDevBanner && (
            <DevGenerateBanner running={devRunning} message={devMessage} onRun={handleDevRun} />
          )}
          {noticesMarkup}
          <Card padding="0">
            <Tabs
              tabs={STATUS_TABS.map((t) => ({ id: t.id, content: t.label }))}
              selected={selectedTab}
              onSelect={handleTabSelect}
            />
            {isPendingTab ? (
              <EmptyState
                heading="No recommendations waiting"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
              >
                <Text as="p" variant="bodyMd">
                  Peakhour generates one recommendation per day once your inventory analysis finds
                  opportunities — campaigns to recover dead stock, boost trending products and
                  more will appear here for your approval.
                </Text>
              </EmptyState>
            ) : (
              <Box padding="1000">
                <InlineStack align="center">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No recommendations here yet.
                  </Text>
                </InlineStack>
              </Box>
            )}
          </Card>
        </BlockStack>
      </Page>
    );
  }

  // ── Pending cards (the rich, actionable view) ────────────────────────────

  const pendingCardsMarkup = items.map((rec) => {
    const revenueRange = formatRevenueRange(rec.expectedRevenueRange);
    const extraCount = rec.productCount - rec.productsPreview.length;
    return (
      <Card key={rec.id}>
        <BlockStack gap="300">
          <InlineStack gap="200" blockAlign="center" wrap>
            <Text as="h2" variant="headingMd">{rec.title}</Text>
            {typeBadge(rec.type)}
          </InlineStack>
          {rec.subtitle && (
            <Text as="p" variant="bodyMd" tone="subdued">{rec.subtitle}</Text>
          )}

          {/* Products preview: first 3 thumbnails + remainder count. */}
          <InlineStack gap="200" blockAlign="center">
            {rec.productsPreview.map((p) => (
              <Thumbnail
                key={p.id}
                source={p.imageUrl ?? ProductIcon}
                alt={p.title ?? "Product"}
                size="small"
              />
            ))}
            <Text as="span" variant="bodyMd" tone="subdued">
              {extraCount > 0
                ? `+${extraCount} more (${rec.productCount} products)`
                : `${rec.productCount} ${rec.productCount === 1 ? "product" : "products"}`}
            </Text>
          </InlineStack>

          {/* Facts row */}
          <InlineStack gap="400" wrap>
            <Text as="span" variant="bodyMd">
              <Text as="span" variant="bodyMd" fontWeight="semibold">{rec.suggestedDiscount}%</Text>{" "}
              discount
            </Text>
            <Text as="span" variant="bodyMd">
              for{" "}
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {humanizeHours(rec.suggestedDurationHours)}
              </Text>
            </Text>
            {revenueRange && (
              <Text as="span" variant="bodyMd">
                expected recovery{" "}
                <Text as="span" variant="bodyMd" fontWeight="semibold">{revenueRange}</Text>
              </Text>
            )}
            <Text as="span" variant="bodyMd" tone="subdued">
              Confidence: {confidenceLabel(rec.confidenceScore)}
            </Text>
          </InlineStack>

          <Text as="p" variant="bodyMd">{rec.reasonSummary}</Text>

          <InlineStack gap="200">
            <Button variant="primary" onClick={() => openModal("approve", rec)}>
              Approve
            </Button>
            <Button onClick={() => openModal("edit", rec)}>Adjust discount</Button>
            <Button tone="critical" onClick={() => openModal("reject", rec)}>
              Reject
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  });

  // ── Compact table (Approved / Rejected / All) ────────────────────────────

  const compactRowsMarkup = items.map((rec, index) => (
    <IndexTable.Row id={rec.id} key={rec.id} position={index}>
      <IndexTable.Cell>
        <Box maxWidth="280px">
          <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
            {rec.title}
          </Text>
        </Box>
      </IndexTable.Cell>
      <IndexTable.Cell>{typeBadge(rec.type)}</IndexTable.Cell>
      <IndexTable.Cell>{statusBadge(rec.approvalStatus)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatDate(rec.approvedAt ?? rec.rejectedAt ?? rec.createdAt)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{effectiveDiscount(rec)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {rec.approvalStatus === "approved" ? (
          // Approved → a Smart Rail zone was activated by the approval; the
          // list API doesn't carry the zoneId, so link to the zones table.
          <Link url="/shopify/embedded/theme">Smart Rail zone</Link>
        ) : (
          <Text as="span" variant="bodyMd" tone="subdued">—</Text>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Recommendations"
      subtitle="AI campaign suggestions built from your inventory analysis — approve to put them live"
    >
      <BlockStack gap="400">
        {showDevBanner && (
          <DevGenerateBanner running={devRunning} message={devMessage} onRun={handleDevRun} />
        )}

        {noticesMarkup}

        {isPendingTab ? (
          <BlockStack gap="400">
            <Card padding="0">
              <Tabs
                tabs={STATUS_TABS.map((t) => ({ id: t.id, content: t.label }))}
                selected={selectedTab}
                onSelect={handleTabSelect}
              />
            </Card>
            {pendingCardsMarkup}
          </BlockStack>
        ) : (
          <Card padding="0">
            <Tabs
              tabs={STATUS_TABS.map((t) => ({ id: t.id, content: t.label }))}
              selected={selectedTab}
              onSelect={handleTabSelect}
            />
            <IndexTable
              resourceName={{ singular: "recommendation", plural: "recommendations" }}
              itemCount={items.length}
              headings={[
                { title: "Title" },
                { title: "Type" },
                { title: "Status" },
                { title: "Date" },
                { title: "Discount" },
                { title: "Zone" },
              ]}
              selectable={false}
              loading={fetching}
            >
              {compactRowsMarkup}
            </IndexTable>
          </Card>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <InlineStack align="center">
            <Pagination
              hasPrevious={currentPage > 1}
              onPrevious={() => setCurrentPage((p) => p - 1)}
              hasNext={currentPage < pages}
              onNext={() => setCurrentPage((p) => p + 1)}
              label={`Page ${currentPage} of ${pages} (${total} total)`}
            />
          </InlineStack>
        )}
      </BlockStack>

      {/* ── Approve confirm modal ────────────────────────────────────────── */}
      <Modal
        open={modal?.kind === "approve"}
        onClose={closeModal}
        title="Approve this recommendation?"
        primaryAction={{ content: "Approve", loading: acting, onAction: handleApprove }}
        secondaryActions={[{ content: "Cancel", disabled: acting, onAction: closeModal }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Errors render INSIDE the modal — a banner behind the overlay
                would be invisible while the modal is open. */}
            {modalError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{modalError}</Text>
              </Banner>
            )}
            <Text as="p" variant="bodyMd">
              Approving activates a Smart Rail zone with these {modal?.rec.productCount ?? 0}{" "}
              products on your storefront. The {modal?.rec.suggestedDiscount ?? 0}% discount itself
              isn&apos;t applied to your Shopify prices yet — campaign execution follows
              separately.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ── Edit (adjust discount) & approve modal ───────────────────────── */}
      {/* Edit scope is DISCOUNT ONLY for now. The approve API also accepts
          editedProducts (a subset of the recommendation's products), but the
          list payload only carries a 3-thumbnail preview — a real product
          checklist needs a paged product-list fetch for the recommendation's
          full product set. Deferred to a follow-up rather than shipping a
          picker that can only show 3 of N products. */}
      <Modal
        open={modal?.kind === "edit"}
        onClose={closeModal}
        title="Adjust discount"
        primaryAction={{ content: "Approve with this discount", loading: acting, onAction: handleEditApprove }}
        secondaryActions={[{ content: "Cancel", disabled: acting, onAction: closeModal }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {modalError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{modalError}</Text>
              </Banner>
            )}
            <TextField
              label="Discount"
              type="number"
              value={editDiscount}
              onChange={setEditDiscount}
              suffix="%"
              min={0}
              max={50}
              autoComplete="off"
              helpText={`Peakhour suggested ${modal?.rec.suggestedDiscount ?? 0}%. Whole numbers from 0 to 50.`}
            />
            <Text as="p" variant="bodySm" tone="subdued">
              Approving still activates the Smart Rail zone with all{" "}
              {modal?.rec.productCount ?? 0} suggested products.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ── Reject modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modal?.kind === "reject"}
        onClose={closeModal}
        title="Reject this recommendation?"
        primaryAction={{
          content: "Reject",
          destructive: true,
          loading: acting,
          onAction: handleReject,
        }}
        secondaryActions={[{ content: "Cancel", disabled: acting, onAction: closeModal }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {modalError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{modalError}</Text>
              </Banner>
            )}
            <Text as="p" variant="bodyMd">
              Nothing changes on your storefront. Telling us why helps Peakhour suggest better
              campaigns next time.
            </Text>
            <TextField
              label="Reason (optional)"
              value={rejectReason}
              onChange={setRejectReason}
              autoComplete="off"
              multiline={2}
              maxLength={200}
              showCharacterCount
              placeholder="e.g. Discount too deep for this collection"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
