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
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  IndexTable,
  Thumbnail,
  Pagination,
  EmptyState,
  TextField,
  Icon,
} from "@shopify/polaris";
import { SearchIcon, ProductIcon } from "@shopify/polaris-icons";
import { getSessionToken } from "../_lib/session";
import { useEmbeddedContext } from "../_lib/context";
import { LensActivationHub } from "../_components/lens-activation-hub";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const PAGE_SIZE = 25;

// ── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  title: string;
  status: "active" | "draft" | "archived" | null;
  minPrice: string | null;
  maxPrice: string | null;
  currency: string | null;
  productType: string | null;
  vendor: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  variantCount: number;
}

interface CatalogResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  /** Set by the API when the store is disconnected — catalog is preserved
   *  server-side but withheld from the UI. */
  disconnected?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(p: Product): string {
  if (!p.minPrice && !p.maxPrice) return "—";
  const sym = p.currency === "USD" ? "$" : p.currency ? `${p.currency} ` : "";
  if (!p.maxPrice || p.minPrice === p.maxPrice) return `${sym}${p.minPrice}`;
  return `${sym}${p.minPrice} – ${sym}${p.maxPrice}`;
}

function statusBadge(status: string | null) {
  if (status === "active") return <Badge tone="success">Active</Badge>;
  if (status === "draft") return <Badge tone="attention">Draft</Badge>;
  if (status === "archived") return <Badge>Archived</Badge>;
  return null;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function CatalogSkeleton() {
  return (
    <SkeletonPage title="Catalog">
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={10} />
        </BlockStack>
      </Card>
    </SkeletonPage>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type PageState = "initializing" | "ready" | "error";

export default function CatalogPage() {
  const { ctx } = useEmbeddedContext();
  const [pageState, setPageState] = useState<PageState>("initializing");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount — prevents setState on unmounted component.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
  }, []);

  const fetchCatalog = useCallback(async (pg: number, q: string, signal?: AbortSignal) => {
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
      if (q) params.set("q", q);
      const res = await fetch(`${API_URL}/v1/shopify/embedded/catalog?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (signal?.aborted) return;
      if (!res.ok) {
        setFetchError(`Could not load catalog (${res.status}).`);
        setPageState("error");
        setFetching(false);
        return;
      }
      const data = (await res.json()) as CatalogResponse;
      if (data.disconnected) {
        setDisconnected(true);
        setPageState("ready");
        setFetching(false);
        return;
      }
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages);
      setPageState("ready");
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setFetchError("Network error loading catalog.");
      setPageState("error");
    } finally {
      setFetching(false);
    }
  }, []);

  // Single effect: runs on mount (currentPage=1, searchQuery="") and on changes.
  // AbortController cancels any in-flight request when deps change or on unmount.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchCatalog(currentPage, searchQuery, ctrl.signal);
    return () => ctrl.abort();
  }, [currentPage, searchQuery, fetchCatalog]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      setSearchQuery(value);
    }, 400);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    const token = await getSessionToken();
    if (!token) {
      setSyncError("Couldn't get a Shopify session.");
      setSyncing(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setSyncError(d.error ?? "Sync failed. Please try again.");
        setSyncing(false);
      } else {
        // Refetch after giving the background sync a few seconds to land products.
        // Stored in ref so the cleanup effect can cancel it on unmount.
        syncTimerRef.current = setTimeout(() => {
          setSyncing(false);
          fetchCatalog(1, "");
        }, 5000);
      }
    } catch {
      setSyncError("Network error triggering sync.");
      setSyncing(false);
    }
  }, [fetchCatalog]);

  // ── Render states ────────────────────────────────────────────────────────

  if (pageState === "initializing") return <CatalogSkeleton />;

  if (disconnected) {
    return <LensActivationHub shop={ctx?.shop} status="disconnected" />;
  }

  if (pageState === "error") {
    return (
      <Page title="Catalog">
        <Banner tone="critical" title="Could not load catalog">
          <Text as="p" variant="bodyMd">{fetchError}</Text>
        </Banner>
      </Page>
    );
  }

  // Zero products and no active search — prompt to sync.
  if (total === 0 && !searchQuery && !fetching) {
    return (
      <Page title="Catalog">
        <BlockStack gap="400">
          {syncError && (
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">{syncError}</Text>
            </Banner>
          )}
          <EmptyState
            heading="No products synced yet"
            action={{
              content: syncing ? "Syncing…" : "Sync catalog",
              onAction: syncing ? undefined : handleSync,
              loading: syncing,
            }}
            image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
          >
            <Text as="p" variant="bodyMd">
              Your Shopify catalog hasn&apos;t synced yet. Sync now to import your products and
              enable the catalog-grounded AI assistant.
            </Text>
          </EmptyState>
        </BlockStack>
      </Page>
    );
  }

  // ── Product table ────────────────────────────────────────────────────────

  const rowMarkup = products.map((product, index) => (
    <IndexTable.Row id={product.id} key={product.id} position={index}>
      <IndexTable.Cell>
        <Thumbnail
          source={product.imageUrl ?? ProductIcon}
          alt={product.imageAlt ?? product.title}
          size="small"
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {product.title}
          </Text>
          {product.vendor && (
            <Text as="span" variant="bodySm" tone="subdued">
              {product.vendor}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {product.productType || "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatPrice(product)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {statusBadge(product.status)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="end">
          {product.variantCount}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Catalog" subtitle={`${total.toLocaleString()} products`}>
      <BlockStack gap="400">
        <Card padding="0">
          {/* Search bar */}
          <Box padding="300" borderBlockEndWidth="025" borderColor="border">
            <TextField
              label="Search products"
              labelHidden
              value={searchInput}
              onChange={handleSearchChange}
              prefix={<Icon source={SearchIcon} />}
              placeholder="Search by title, vendor, or type…"
              clearButton
              onClearButtonClick={() => handleSearchChange("")}
              autoComplete="off"
            />
          </Box>

          {/* No search results */}
          {!fetching && searchQuery && products.length === 0 ? (
            <Box padding="1000">
              <InlineStack align="center">
                <Text as="p" variant="bodyMd" tone="subdued">
                  No products match &ldquo;{searchQuery}&rdquo;
                </Text>
              </InlineStack>
            </Box>
          ) : (
            <IndexTable
              resourceName={{ singular: "product", plural: "products" }}
              itemCount={products.length}
              headings={[
                { title: "" },
                { title: "Product" },
                { title: "Type" },
                { title: "Price" },
                { title: "Status" },
                { title: "Variants", alignment: "end" },
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
