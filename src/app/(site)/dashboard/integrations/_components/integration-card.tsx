"use client";

import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug, CheckCircle, AlertCircle, ExternalLink, Unplug, RefreshCw, Loader2, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveProvider, isMetaVirtual, metaDisconnectCopy } from "@/lib/integrations-meta";
import { isRecoverableStatus, showsComingSoon } from "@/lib/integration-card-state";
import { Integration, PROVIDER_COLORS, PROVIDER_ICONS } from "./shared";
import { LinkedInAdsStatus, LinkedInContentPages } from "./linkedin-panels";

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onRefresh,
  onSync,
  onBackfillSync,
  onRepairWebhook,
  onChanged,
  backfillResult,
  disconnecting,
  refreshing,
  syncing,
  backfilling,
  repairingWebhook,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onSync: () => void;
  onBackfillSync?: () => Promise<void>;
  /** Called when the user clicks the "Re-register" action on a red
   *  webhook-health chip. The page handler calls
   *  POST /v1/integrations/:provider/repair-webhook and then refetches. */
  onRepairWebhook?: () => Promise<void>;
  /** Called after the Manage Pages dialog persists toggles, so the
   *  parent can refetch /v1/integrations and re-render with the new
   *  capabilities state. */
  onChanged?: () => void;
  backfillResult?: { message: string; hasErrors: boolean } | null;
  disconnecting: boolean;
  refreshing: boolean;
  syncing: boolean;
  backfilling: boolean;
  repairingWebhook: boolean;
}) {
  const { formatDate, formatDateTime } = useLocale();
  const Icon = PROVIDER_ICONS[integration.provider] || Plug;
  const colorClass = PROVIDER_COLORS[integration.provider] || "bg-muted";
  // A connection that already has a token but isn't `active` (stale scope /
  // revoked / errored). Reconnecting it starts a fresh OAuth which makes
  // the provider issue a NEW token and invalidate the current one — so we
  // gate it behind a confirm to stop accidental token-killing reconnects
  // (the LinkedIn reconnect loop). A truly fresh/disconnected provider gets
  // the plain one-click Connect.
  const isRecoverable = isRecoverableStatus(integration.status);
  // Whether the card presents as a coming-soon signpost. NOT the same question
  // as `availability === "coming_soon"`: a coming-soon provider can still hold
  // a real connection — active or broken — and that connection outranks the
  // signpost, so this tests the connection's EXISTENCE rather than its
  // activeness. See lib/integration-card-state.ts for the Shopify install path
  // that makes it reachable in production, and for the two states it broke.
  const showComingSoon = showsComingSoon(integration.availability, integration.status);
  // ★CAN THIS PROVIDER ACTUALLY RECONNECT RIGHT NOW? Surfacing the Reconnect
  // button on a coming-soon provider is the point of the fix above, but the
  // button has to lead somewhere. Only Shopify does: `handleConnect`
  // intercepts it and opens the App Store listing, a path that ignores
  // `availability` entirely. Every other coming-soon provider would hit a
  // gate — oauth2 does a FULL-PAGE navigation to `/authorize`, which 400s
  // COMING_SOON and dumps the merchant on a raw JSON error page outside the
  // app with no way back; api_key opens a modal whose POST 400s the same way.
  // So for those, keep the card honest (undimmed, lastError shown) but leave
  // the static copy in place of a button that cannot work.
  const canReconnectWhileComingSoon = resolveProvider(integration.provider) === "shopify";
  const offerReconnect =
    isRecoverable &&
    (integration.availability !== "coming_soon" || canReconnectWhileComingSoon);

  return (
    <Card className={`group relative overflow-hidden transition-all hover:shadow-md ${
      showComingSoon ? "opacity-50" : ""
    } ${integration.connected ? "ring-1 ring-success/20" : ""}`}>
      {/* Connected indicator stripe */}
      {integration.connected && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-success" />
      )}

      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          {/* `flex-wrap` lets the webhook health chip drop to a second
              line instead of being clipped by the Card's overflow-hidden
              when the title + Live + Webhook-issue + (optional)
              Re-register button add up to more than the card's width.
              `gap-y-1` keeps the wrapped chip visually tied to the
              title row above. min-w-0 on CardTitle so the title can
              truncate before pushing other items off-screen. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <CardTitle className="min-w-0 truncate text-sm font-semibold leading-snug">
              {integration.name}
            </CardTitle>
            {integration.connected && (
              <Badge className="bg-success text-success-foreground gap-0.5 text-micro px-1.5 py-0 shrink-0">
                <CheckCircle className="h-2.5 w-2.5" />
                Live
              </Badge>
            )}
            {integration.connected && integration.webhookHealth && (
              <WebhookHealthChip
                health={integration.webhookHealth}
                onRepair={onRepairWebhook}
                repairing={repairingWebhook}
                formatDateTime={formatDateTime}
              />
            )}
            {showComingSoon && (
              <Badge variant="outline" className="text-micro px-1.5 py-0 shrink-0">
                Soon
              </Badge>
            )}
          </div>
          {integration.description && (
            <CardDescription className="mt-0.5 text-micro leading-snug line-clamp-2">
              {integration.description}
            </CardDescription>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {integration.connected ? (
          <div className="space-y-2.5">
            {/* Account info — compact */}
            {integration.account && (
              <div className="flex items-center gap-2.5 rounded-md bg-muted/50 px-2.5 py-2">
                {integration.account.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img width={28} height={28} loading="lazy"
                    src={integration.account.avatarUrl}
                    alt=""
                    className="h-7 w-7 rounded-full ring-1 ring-success/30 shrink-0"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 ring-1 ring-success/30 shrink-0">
                    <span className="text-micro font-medium text-primary">
                      {integration.account.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{integration.account.name}</p>
                  {integration.account.extra?.email && (
                    <p className="text-micro text-muted-foreground truncate">
                      {integration.account.extra.email}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ★EVERY ACCOUNT, NOT ONLY THE PRIMARY. A business may hold several
                stores on one channel (a second Shopify shop added to this
                workspace); the card above shows the primary, and these are the
                rest, so a store added here is visible here. */}
            {(integration.accounts?.length ?? 0) > 1 && (
              <ul className="space-y-1 rounded-md border px-2.5 py-2" aria-label={`${integration.name} accounts`}>
                <li className="text-micro uppercase tracking-wide text-muted-foreground">
                  {integration.accounts!.length} connected
                </li>
                {integration.accounts!
                  .filter((a) => !a.primary)
                  .map((a) => (
                    <li key={a.connectionId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{a.name || a.externalId || "Account"}</span>
                      {a.status !== "active" && (
                        <span className="shrink-0 text-micro text-warning-on-tint">
                          {a.status === "needs_reauth" ? "Needs reconnect" : a.status}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            )}

            {/* LinkedIn Ads — compact status badge + detail dialog */}
            {integration.provider === "linkedin_ads" && integration.account?.extra && (
              <LinkedInAdsStatus
                extra={integration.account.extra}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            )}

            {/* LinkedIn Content — page list + refresh + Manage Pages dialog.
                The dialog sidesteps the disconnect-and-reconnect dance for
                choosing which admin Pages Peakhour can actually post to. */}
            {integration.provider === "linkedin_content" && integration.account?.extra && (
              <LinkedInContentPages
                extra={integration.account.extra}
                onRefresh={onRefresh}
                refreshing={refreshing}
                onChanged={onChanged}
              />
            )}

            {/* Beehiiv sync controls */}
            {integration.provider === "beehiiv" && (
              <BeehiivSyncControls
                integration={integration}
                onSync={onSync}
                onBackfillSync={onBackfillSync}
                backfillResult={backfillResult}
                syncing={syncing}
                backfilling={backfilling}
                formatDateTime={formatDateTime}
              />
            )}

            {/* Last sync for non-beehiiv */}
            {integration.provider !== "beehiiv" && integration.lastSyncAt && (
              <p className="text-micro text-muted-foreground">
                Synced {formatDate(integration.lastSyncAt, { month: "short", day: "numeric" })}
              </p>
            )}

            {integration.lastError && (
              <p className="text-micro text-destructive truncate">{integration.lastError}</p>
            )}

            {/* Disconnect */}
            <ConfirmDialog
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full gap-1.5 text-micro text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7"
                  disabled={disconnecting}
                >
                  <Unplug className="h-3 w-3" />
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              }
              title={
                integration.provider === "whatsapp"
                  ? "Disconnect WhatsApp"
                  : isMetaVirtual(integration.provider)
                    ? "Disconnect Meta"
                    : "Disconnect integration"
              }
              description={
                integration.provider === "whatsapp"
                  ? "This disconnects only WhatsApp Business. Your Facebook Pages, Instagram and Meta Ads stay connected."
                  : isMetaVirtual(integration.provider)
                    ? metaDisconnectCopy(
                        { metaLogin: integration.metaLogin, metaConnections: integration.metaConnections },
                        integration.provider,
                        integration.metaConnectedCards,
                      )
                    : `Are you sure you want to disconnect ${integration.name}? You'll need to reconnect to sync data again.`
              }
              confirmLabel="Disconnect"
              variant="destructive"
              onConfirm={onDisconnect}
            />
          </div>
        ) : showComingSoon ? (
          <p className="text-micro text-muted-foreground">Coming soon</p>
        ) : (
          <div className="space-y-1.5">
            {offerReconnect ? (
              <>
                <ConfirmDialog
                  trigger={
                    <Button size="sm" className="w-full gap-1.5 h-8 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Reconnect
                    </Button>
                  }
                  title={`Reconnect ${integration.name}?`}
                  // Shopify does not reconnect in place. `handleConnect`
                  // intercepts it and opens our App Store listing, because
                  // App Store req 2.3.1 forbids starting an install from our
                  // own surface — the merchant finishes from Shopify admin.
                  // The generic copy below describes an in-place OAuth
                  // sign-in and warns about posting, neither of which applies;
                  // it went unnoticed while this button was unreachable in
                  // production on a coming-soon provider.
                  description={
                    resolveProvider(integration.provider) === "shopify"
                      ? "This opens the Shopify App Store. Finish the reinstall from your Shopify admin and your store reconnects with a fresh access token."
                      : "This starts a fresh sign-in and replaces the current access token — the provider invalidates the previous one. Only reconnect if posting is actually failing; repeated reconnects are what break the connection."
                  }
                  confirmLabel="Reconnect"
                  onConfirm={onConnect}
                />
                {integration.lastError && (
                  <p className="text-micro text-destructive truncate">{integration.lastError}</p>
                )}
              </>
            ) : isRecoverable ? (
              // Broken, on a gated provider with no working reconnect path.
              // Falling through to the plain Connect button below would be
              // WORSE than the bug this branch fixes: that button navigates
              // straight to `/authorize`, which 400s COMING_SOON and strands
              // the merchant on a raw JSON page. So say what is true and keep
              // the error visible — the card is still undimmed and unbadged,
              // which is what tells them this is a fault and not a signpost.
              <>
                <p className="text-micro text-muted-foreground">
                  {integration.name} needs reconnecting, but isn&apos;t open for
                  new connections yet. Contact support and we&apos;ll restore it.
                </p>
                {integration.lastError && (
                  <p className="text-micro text-destructive truncate">{integration.lastError}</p>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="w-full gap-1.5 h-8 text-xs"
                onClick={onConnect}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {isMetaVirtual(integration.provider) ? "Connect with Meta" : "Connect"}
              </Button>
            )}
            {integration.grantNote && (offerReconnect || !isRecoverable) && (
              // ★What THIS card's connect asks Meta for — only under a button
              // that connects (not beside "isn't open for new connections"). "One login connects
              // all Meta services" stopped being true when each product got
              // its own Login for Business configuration — and was never true
              // of WhatsApp, which connects through Embedded Signup.
              <p className="text-micro text-center text-muted-foreground">
                {integration.grantNote}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Webhook Health Chip ─────────────────────────────────────────────
//
// Compact badge next to the "Live" indicator on connected integration
// cards. Reads `integration.webhookHealth` (cron-written; beehiiv-only
// today). Green is rendered as silence (no chip) so the card stays
// clean when everything's healthy; only grey / yellow / red show.
//
// Hover surfaces the reason in plain English. Red carries a
// "Re-register" action that hits POST /:provider/repair-webhook.
//
// All bands are user-readable explanations — no internal acronyms.

function WebhookHealthChip({
  health,
  onRepair,
  repairing,
  formatDateTime,
}: {
  health: NonNullable<Integration["webhookHealth"]>;
  onRepair?: () => Promise<void>;
  repairing: boolean;
  formatDateTime: (d: string) => string;
}) {
  // Healthy band: silent. Adding a green chip on every healthy card
  // is visual noise — the existing "Live" badge already signals
  // healthy. We surface ONLY when there's something to communicate.
  if (health.band === "green") return null;

  const missing = Math.max(
    0,
    health.postsLast30dViaCron - health.postsLast30dViaWebhook,
  );

  // Per-band copy + style.
  const label =
    health.band === "red"
      ? "Webhook issue"
      : health.band === "yellow"
        ? "Webhook lagging"
        : "Webhook not verified yet";

  const className =
    health.band === "red"
      ? "bg-destructive/15 text-destructive-on-tint border-destructive/30"
      : health.band === "yellow"
        ? "bg-warning/15 text-warning-on-tint border-warning/40"
        : "bg-muted text-muted-foreground border-border";

  const longExplanation = (() => {
    if (health.band === "red") {
      switch (health.redReason) {
        case "not_registered_on_provider":
          return "The webhook is no longer registered on the provider's side — likely revoked in the provider's UI. Click Re-register to fix.";
        case "signature_invalid":
          return "Recent webhooks failed signature verification — usually means the signing secret is out of sync. Click Re-register to rotate.";
        case "reconciliation_gap":
          return `${missing} of your last ${health.postsLast30dViaCron} posts didn't arrive via webhook. The hourly sync rescued them, but real-time delivery is broken.`;
        default:
          return "Webhook delivery looks broken.";
      }
    }
    if (health.band === "yellow") {
      if (missing > 0) {
        return `${missing} of your last ${health.postsLast30dViaCron} posts missed the webhook. The hourly sync picked them up — investigate if this keeps happening.`;
      }
      return "An isolated webhook signature failure was recorded recently. Worth keeping an eye on but no action needed yet.";
    }
    // grey
    return "Not enough recent posts to verify the webhook end-to-end yet. The chip will turn green once you publish a post and the hourly sync confirms it arrived in real time.";
  })();

  // Red bands also render an inline "Re-register" button next to the
  // chip so the action is reachable on touch devices (Tooltip doesn't
  // open on tap) and by keyboard. Tooltip continues to show the long
  // explanation on hover/focus for desktop users.
  const showInlineRepair = health.band === "red" && Boolean(onRepair);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            tabIndex={0}
            className={`gap-0.5 text-micro px-1.5 py-0 shrink-0 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px] text-micro space-y-1.5">
          <p>{longExplanation}</p>
          {health.lastWebhookAt && (
            <p className="text-muted-foreground">
              Last webhook: {formatDateTime(health.lastWebhookAt)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
      {showInlineRepair && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-5 text-micro px-1.5 shrink-0"
          onClick={() => {
            void onRepair!();
          }}
          disabled={repairing}
        >
          {repairing ? "Re-registering…" : "Re-register"}
        </Button>
      )}
    </TooltipProvider>
  );
}

// ── Beehiiv Sync Controls ───────────────────────────────────────────

function BeehiivSyncControls({
  integration,
  onSync,
  onBackfillSync,
  backfillResult,
  syncing,
  backfilling,
  formatDateTime,
}: {
  integration: Integration;
  onSync: () => void;
  onBackfillSync?: () => Promise<void>;
  backfillResult?: { message: string; hasErrors: boolean } | null;
  syncing: boolean;
  backfilling: boolean;
  formatDateTime: (d: string) => string;
}) {
  return (
    <div className="space-y-2">
      {integration.lastSyncAt && (
        <p className="text-micro text-muted-foreground">
          Last synced {formatDateTime(integration.lastSyncAt)}
        </p>
      )}

      {backfillResult && (
        <div className={`rounded-md border px-2.5 py-1.5 text-micro flex items-center gap-1.5 ${
          backfillResult.hasErrors
            ? "border-warning/40 bg-warning/10 text-warning-on-tint"
            : "border-success/30 bg-success/10 text-success-on-tint"
        }`}>
          {backfillResult.hasErrors ? (
            <AlertCircle className="h-3 w-3 shrink-0" />
          ) : (
            <CheckCircle className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{backfillResult.message}</span>
        </div>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1 text-micro h-7"
          onClick={onSync}
          disabled={syncing || backfilling}
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </Button>
        {onBackfillSync && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1 text-micro h-7"
            onClick={onBackfillSync}
            disabled={syncing || backfilling}
          >
            {backfilling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {backfilling ? "Importing..." : "Import all"}
          </Button>
        )}
      </div>
      {backfilling && (
        <p className="text-micro text-muted-foreground">
          This may take a minute. Please don&apos;t close this page.
        </p>
      )}
    </div>
  );
}

// ── LinkedIn Content — Page list + refresh ──────────────────────────
//
// Replaces the "disconnect and reconnect to pick up new Pages" friction.
// Click Refresh → calls /v1/integrations/linkedin_content/refresh →
// peakhour-api re-runs getAccountInfo → fresh /organizationAcls + per-row
// /organizations/{id} hits → connection.account.extra.pages re-populated
// with any newly-admin'd Pages and updated names. Use case: a user gets
// promoted to Super Admin on a new client Page after their initial
// Connect; one click here picks it up without OAuth round-trip.
