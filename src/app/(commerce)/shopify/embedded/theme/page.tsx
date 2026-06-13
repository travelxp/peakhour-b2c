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
  List,
  Modal,
  Select,
  TextField,
  EmptyState,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  IndexTable,
} from "@shopify/polaris";
import { ClipboardIcon, CheckIcon, EditIcon, ExternalIcon } from "@shopify/polaris-icons";
import { getSessionToken } from "../_lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────

interface Zone {
  zoneId: string;
  railType: string | null;
  title: string | null;
  active: boolean;
  productCount: number;
  updatedAt: string | null;
}

interface ThemeStatusResponse {
  zones: Zone[];
  storefrontKey: string;
  themeEditorUrl: string;
}

interface CreateZoneResponse {
  zoneId: string;
  storefrontKey: string;
  railType: string;
  title: string;
}

// ── Rail types ─────────────────────────────────────────────────────────────

/** cmrc_rail_zones.railType enum → merchant-friendly labels (table + select). */
const RAIL_TYPE_LABELS: Record<string, string> = {
  auto: "Auto",
  dead_stock: "Clearance",
  trending: "Trending",
  new_arrivals: "New arrivals",
  price_drops: "Price drops",
  bestsellers: "Bestsellers",
  back_in_stock: "Back in stock",
  complete_the_look: "Complete the look",
  frequently_bought_together: "Frequently bought together",
  low_inventory: "Low inventory",
};

/** Select options — "auto" gets a descriptive label since it's the default. */
const RAIL_TYPE_OPTIONS = Object.entries(RAIL_TYPE_LABELS).map(([value, label]) => ({
  value,
  label: value === "auto" ? "Auto — let Peakhour decide" : label,
}));

function railTypeLabel(railType: string | null): string {
  if (!railType) return "—";
  return RAIL_TYPE_LABELS[railType] ?? railType;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Click-to-copy field ────────────────────────────────────────────────────
//
// navigator.clipboard can be BLOCKED inside the Shopify admin iframe (the
// Clipboard API needs a permissions-policy grant the admin frame may not
// delegate). Strategy, in order:
//   1. navigator.clipboard.writeText (modern, needs permission)
//   2. select the readonly input + document.execCommand("copy") (legacy
//      user-gesture path — works in most iframes without any permission)
//   3. both blocked → leave the value SELECTED and tell the merchant to
//      press Ctrl+C/⌘C. "Copied" only ever shows on a confirmed copy — no
//      lying toasts.

type CopyStatus = "idle" | "copied" | "manual";

function CopyField({
  label,
  value,
  labelHidden = false,
}: {
  label: string;
  value: string;
  labelHidden?: boolean;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the "Copied" reset timer on unmount — no setState after unmount.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const selectValue = useCallback(() => {
    const input = wrapRef.current?.querySelector("input");
    if (input) {
      input.focus();
      input.select();
    }
    return input;
  }, []);

  const markCopied = useCallback(() => {
    setStatus("copied");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const handleCopy = useCallback(async () => {
    // 1 — async Clipboard API.
    try {
      await navigator.clipboard.writeText(value);
      markCopied();
      return;
    } catch {
      // Blocked or unavailable — fall through.
    }
    // 2 — legacy execCommand on the selected input (same user gesture).
    try {
      if (selectValue() && document.execCommand("copy")) {
        markCopied();
        return;
      }
    } catch {
      // Fall through to manual.
    }
    // 3 — both blocked: leave the value selected for a manual Ctrl+C.
    selectValue();
    setStatus("manual");
  }, [value, selectValue, markCopied]);

  return (
    <div ref={wrapRef}>
      <BlockStack gap="100">
        <TextField
          label={label}
          labelHidden={labelHidden}
          value={value}
          readOnly
          autoComplete="off"
          onFocus={() => selectValue()}
          connectedRight={
            <Button
              onClick={handleCopy}
              icon={status === "copied" ? CheckIcon : ClipboardIcon}
              accessibilityLabel={`Copy ${label}`}
            >
              {status === "copied" ? "Copied" : "Copy"}
            </Button>
          }
        />
        {status === "manual" && (
          <Text as="p" variant="bodySm" tone="subdued">
            Copying is blocked in this window — the value is selected, press Ctrl+C (⌘C on Mac).
          </Text>
        )}
      </BlockStack>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function ThemeSkeleton() {
  return (
    <SkeletonPage title="Storefront">
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

// ── Main component ─────────────────────────────────────────────────────────

type PageState = "initializing" | "ready" | "error";

export default function ThemePage() {
  const [pageState, setPageState] = useState<PageState>("initializing");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [storefrontKey, setStorefrontKey] = useState("");
  const [themeEditorUrl, setThemeEditorUrl] = useState("");

  // Row actions (activate/deactivate) — optimistic, with revert on failure.
  const [busyZoneId, setBusyZoneId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create-zone modal.
  const [createOpen, setCreateOpen] = useState(false);
  const [createRailType, setCreateRailType] = useState("auto");
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdZoneId, setCreatedZoneId] = useState<string | null>(null);

  // Edit-zone modal.
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRailType, setEditRailType] = useState("auto");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const token = await getSessionToken();
      if (ctrl.signal.aborted) return;
      if (!token) {
        setFetchError("Couldn't get a Shopify session. Please reopen Peakhour from your Shopify admin.");
        setPageState("error");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/theme/status`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          setFetchError(
            res.status === 404
              ? "This store isn't connected to Peakhour yet — finish setup from the Home tab."
              : `Could not load storefront status (${res.status}).`,
          );
          setPageState("error");
          return;
        }
        const data = (await res.json()) as ThemeStatusResponse;
        setZones(data.zones);
        setStorefrontKey(data.storefrontKey);
        setThemeEditorUrl(data.themeEditorUrl);
        setPageState("ready");
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setFetchError("Network error loading storefront status.");
        setPageState("error");
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Theme editor lives in the Shopify admin — top-level navigation escapes
  // the app iframe (a relative/iframe navigation would render admin-in-iframe).
  const openThemeEditor = useCallback(() => {
    if (!themeEditorUrl) return;
    (window.top ?? window).location.href = themeEditorUrl;
  }, [themeEditorUrl]);

  // ── Activate / deactivate (optimistic) ──────────────────────────────────

  const handleToggleActive = useCallback(async (zone: Zone) => {
    const next = !zone.active;
    setBusyZoneId(zone.zoneId);
    setActionError(null);
    // Optimistic flip — reverted below on any failure.
    setZones((zs) => zs.map((z) => (z.zoneId === zone.zoneId ? { ...z, active: next } : z)));
    const revert = () =>
      setZones((zs) => zs.map((z) => (z.zoneId === zone.zoneId ? { ...z, active: zone.active } : z)));

    const token = await getSessionToken();
    if (!token) {
      revert();
      setActionError("Couldn't get a Shopify session. Please reopen from your admin.");
      setBusyZoneId(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/zones/${zone.zoneId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) {
        revert();
        setActionError(`Could not ${next ? "activate" : "deactivate"} the zone (${res.status}). Please try again.`);
      } else {
        const data = (await res.json()) as { zone: Zone };
        setZones((zs) => zs.map((z) => (z.zoneId === data.zone.zoneId ? data.zone : z)));
      }
    } catch {
      revert();
      setActionError("Network error updating the zone.");
    }
    setBusyZoneId(null);
  }, []);

  // ── Create zone ──────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setCreateRailType("auto");
    setCreateTitle("");
    setCreateError(null);
    setCreateOpen(true);
  }, []);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    const token = await getSessionToken();
    if (!token) {
      setCreateError("Couldn't get a Shopify session. Please reopen from your admin.");
      setCreating(false);
      return;
    }
    try {
      const body: { railType: string; title?: string } = { railType: createRailType };
      if (createTitle.trim()) body.title = createTitle.trim();
      const res = await fetch(`${API_URL}/v1/shopify/embedded/zones`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCreateError(data.error ?? `Could not create the zone (${res.status}).`);
        setCreating(false);
        return;
      }
      const created = (await res.json()) as CreateZoneResponse;
      // Zones are born inactive with no products — append locally (matches
      // the server insert) instead of refetching the whole list.
      setZones((zs) => [
        ...zs,
        {
          zoneId: created.zoneId,
          railType: created.railType,
          title: created.title,
          active: false,
          productCount: 0,
          updatedAt: new Date().toISOString(),
        },
      ]);
      setCreatedZoneId(created.zoneId);
      setCreateOpen(false);
    } catch {
      setCreateError("Network error creating the zone.");
    }
    setCreating(false);
  }, [createRailType, createTitle]);

  // ── Edit zone ────────────────────────────────────────────────────────────

  const openEdit = useCallback((zone: Zone) => {
    setEditZone(zone);
    setEditTitle(zone.title ?? "");
    setEditRailType(zone.railType ?? "auto");
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editZone) return;
    const patch: { title?: string; railType?: string } = {};
    if (editTitle.trim() && editTitle.trim() !== (editZone.title ?? "")) patch.title = editTitle.trim();
    if (editRailType !== editZone.railType) patch.railType = editRailType;
    if (Object.keys(patch).length === 0) {
      setEditZone(null);
      return;
    }
    setSaving(true);
    setEditError(null);
    const token = await getSessionToken();
    if (!token) {
      setEditError("Couldn't get a Shopify session. Please reopen from your admin.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/zones/${editZone.zoneId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setEditError(data.error ?? `Could not save changes (${res.status}).`);
        setSaving(false);
        return;
      }
      const data = (await res.json()) as { zone: Zone };
      setZones((zs) => zs.map((z) => (z.zoneId === data.zone.zoneId ? data.zone : z)));
      setEditZone(null);
    } catch {
      setEditError("Network error saving changes.");
    }
    setSaving(false);
  }, [editZone, editTitle, editRailType]);

  // ── Render states ────────────────────────────────────────────────────────

  if (pageState === "initializing") return <ThemeSkeleton />;

  if (pageState === "error") {
    return (
      <Page title="Storefront">
        <Banner tone="critical" title="Could not load storefront status">
          <Text as="p" variant="bodyMd">{fetchError}</Text>
        </Banner>
      </Page>
    );
  }

  // ── Create zone modal (shared by empty state + table view) ──────────────

  const createModalMarkup = (
    <Modal
      open={createOpen}
      onClose={() => { if (!creating) setCreateOpen(false); }}
      title="Create a Smart Zone"
      primaryAction={{ content: "Create zone", loading: creating, onAction: handleCreate }}
      secondaryActions={[
        { content: "Cancel", disabled: creating, onAction: () => setCreateOpen(false) },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Errors render INSIDE the modal — a banner behind the overlay
              would be invisible while the modal is open. */}
          {createError && (
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">{createError}</Text>
            </Banner>
          )}
          <Select
            label="Rail type"
            options={RAIL_TYPE_OPTIONS}
            value={createRailType}
            onChange={setCreateRailType}
            helpText="What this rail should show. Auto lets Peakhour pick based on your inventory."
          />
          <TextField
            label="Title (optional)"
            value={createTitle}
            onChange={setCreateTitle}
            autoComplete="off"
            placeholder="Recommended for you"
            helpText="Shown as the rail heading on your storefront."
          />
          <Text as="p" variant="bodySm" tone="subdued">
            After creating, paste the new Zone ID into the Smart Rail block settings in the
            theme editor. New zones start inactive and turn on when you activate them.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );

  // ── Setup card (always shown — the storefront key lives here) ───────────

  const setupCard = (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">Add Smart Rails to your theme</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Smart Rails are product carousels that Peakhour fills with the right products —
          clearance picks, trending items, new arrivals and more. Add the block once; we
          handle what shows in it.
        </Text>
        <List type="number">
          <List.Item>
            <BlockStack gap="200">
              <Text as="span" variant="bodyMd">
                Open the theme editor and pick where the rail should appear.
              </Text>
              <Box>
                <Button onClick={openThemeEditor} icon={ExternalIcon} disabled={!themeEditorUrl}>
                  Open theme editor
                </Button>
              </Box>
            </BlockStack>
          </List.Item>
          <List.Item>
            <Text as="span" variant="bodyMd">
              Add the <Text as="span" variant="bodyMd" fontWeight="semibold">Peakhour Smart Rail</Text>{" "}
              block to a section (Add block → Apps).
            </Text>
          </List.Item>
          <List.Item>
            <Text as="span" variant="bodyMd">
              Paste your Zone ID and Storefront key into the block settings.
            </Text>
          </List.Item>
        </List>
        <CopyField label="Storefront key" value={storefrontKey} />
      </BlockStack>
    </Card>
  );

  // ── Empty state (no zones yet) ───────────────────────────────────────────

  if (zones.length === 0) {
    return (
      <Page title="Storefront" subtitle="Put Peakhour Smart Rails on your storefront">
        <BlockStack gap="500">
          {setupCard}
          <Card>
            <EmptyState
              heading="Create your first Smart Zone"
              action={{ content: "Create your first zone", onAction: openCreate }}
              image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
            >
              <Text as="p" variant="bodyMd">
                A Smart Zone connects one Smart Rail block in your theme to Peakhour. Create a
                zone, paste its Zone ID into the block settings, and Peakhour keeps it stocked
                with the right products. A suggested clearance zone also appears here
                automatically after your first inventory analysis finds at-risk products.
              </Text>
            </EmptyState>
          </Card>
        </BlockStack>
        {createModalMarkup}
      </Page>
    );
  }

  // ── Zones table ──────────────────────────────────────────────────────────

  const createdZone = createdZoneId ? zones.find((z) => z.zoneId === createdZoneId) : undefined;

  const rowMarkup = zones.map((zone, index) => {
    // P3.9 seeds an inactive dead_stock zone after the first inventory
    // analysis — nudge the merchant that it's ours, not something they made.
    const isSeededSuggestion = zone.railType === "dead_stock" && !zone.active;
    return (
      <IndexTable.Row id={zone.zoneId} key={zone.zoneId} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {zone.title || "—"}
            </Text>
            {isSeededSuggestion && (
              <Text as="span" variant="bodySm" tone="subdued">
                Suggested by Peakhour from your inventory analysis — activate when ready
              </Text>
            )}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">{railTypeLabel(zone.railType)}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" alignment="end">
            {zone.productCount.toLocaleString()}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {zone.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">{formatRelative(zone.updatedAt)}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Box maxWidth="260px">
            <CopyField label={`Zone ID for ${zone.title || zone.zoneId}`} labelHidden value={zone.zoneId} />
          </Box>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200" wrap={false}>
            <Button
              size="slim"
              onClick={() => handleToggleActive(zone)}
              loading={busyZoneId === zone.zoneId}
              disabled={busyZoneId !== null && busyZoneId !== zone.zoneId}
            >
              {zone.active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              size="slim"
              icon={EditIcon}
              onClick={() => openEdit(zone)}
              accessibilityLabel={`Edit ${zone.title || "zone"}`}
            />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Storefront"
      subtitle="Smart Rail zones on your storefront"
      primaryAction={{ content: "Create zone", onAction: openCreate }}
    >
      <BlockStack gap="500">
        {setupCard}

        {actionError && (
          <Banner tone="critical" onDismiss={() => setActionError(null)}>
            <Text as="p" variant="bodyMd">{actionError}</Text>
          </Banner>
        )}

        {createdZone && (
          <Banner
            tone="success"
            title="Zone created"
            onDismiss={() => setCreatedZoneId(null)}
          >
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                Now paste this Zone ID (and your Storefront key above) into the Smart Rail
                block settings in the theme editor.
              </Text>
              <Box maxWidth="420px">
                <CopyField label="New Zone ID" labelHidden value={createdZone.zoneId} />
              </Box>
            </BlockStack>
          </Banner>
        )}

        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "zone", plural: "zones" }}
            itemCount={zones.length}
            headings={[
              { title: "Title" },
              { title: "Rail type" },
              { title: "Products", alignment: "end" },
              { title: "Status" },
              { title: "Updated" },
              { title: "Zone ID" },
              { title: "Actions" },
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      </BlockStack>

      {createModalMarkup}

      {/* ── Edit zone modal ──────────────────────────────────────────────── */}
      <Modal
        open={editZone !== null}
        onClose={() => { if (!saving) setEditZone(null); }}
        title="Edit zone"
        primaryAction={{ content: "Save", loading: saving, onAction: handleSaveEdit }}
        secondaryActions={[
          { content: "Cancel", disabled: saving, onAction: () => setEditZone(null) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Errors render INSIDE the modal — a banner behind the overlay
                would be invisible while the modal is open. */}
            {editError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{editError}</Text>
              </Banner>
            )}
            <TextField
              label="Title"
              value={editTitle}
              onChange={setEditTitle}
              autoComplete="off"
              placeholder="Recommended for you"
              helpText="Shown as the rail heading on your storefront."
            />
            <Select
              label="Rail type"
              options={RAIL_TYPE_OPTIONS}
              value={editRailType}
              onChange={setEditRailType}
              helpText="Setting a specific rail type overrides Peakhour's automatic recommendation."
            />
            {editZone && <CopyField label="Zone ID" value={editZone.zoneId} />}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
