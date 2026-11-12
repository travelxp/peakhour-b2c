"use client";

import type { CSSProperties } from "react";
import { Mail, Megaphone } from "lucide-react";
import { brandTileStyle } from "@/components/brand/brand-colors";
import { LinkedinIcon, FacebookIcon, InstagramIcon, GoogleIcon, YoutubeIcon, BeehiivIcon, SubstackIcon, MailchimpIcon, ShopifyIcon, WordPressIcon, WooCommerceIcon, GhostIcon, TwitterIcon, WhatsAppIcon, SlackIcon, DiscordIcon, TelegramIcon, TeamsIcon } from "@/components/brand/brand-icons";
import { type MetaLoginInfo } from "@/lib/integrations-meta";

export interface Integration {
  provider: string;
  name: string;
  category: string;
  authType: string;
  availability: string;
  description?: string;
  /** Meta cards only: what a connect from this card asks Meta for. */
  grantNote?: string | null;
  /** api: on the `facebook` row, which Meta purposes have their own Login for
   *  Business configuration in this environment. Absent from an older api. */
  metaLogin?: MetaLoginInfo["metaLogin"];
  /** api: on the `facebook` row, the live web rows that serve the Meta cards
   *  (`purpose: null` is the shared all-purpose row). */
  metaConnections?: MetaLoginInfo["metaConnections"];
  /** Meta cards only: which Meta cards are connected right now. */
  metaConnectedCards?: string[];
  group?: string | null;
  groupDisplayName?: string | null;
  subLabel?: string | null;
  connected: boolean;
  status?: string;
  account?: {
    externalId: string;
    name: string;
    profileUrl?: string;
    avatarUrl?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: Record<string, any>; // TODO: type provider-specific extras (pages, adAccounts, capabilities, etc.)
  };
  /** Every live account on this provider, primary first (api: GET
   *  /v1/integrations `accounts`). A business may hold several stores on one
   *  channel; `account` above is only the primary. Absent from an older api. */
  accounts?: Array<{
    connectionId: string;
    externalId?: string;
    name?: string;
    status: string;
    primary: boolean;
  }>;
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  /** Per-connection webhook health (cron-written; beehiiv-only today).
   *  Absent when integration doesn't use webhooks OR cron hasn't run
   *  on a new connection yet. See peakhour-api integrations/webhook-health.ts */
  webhookHealth?: {
    band: "grey" | "green" | "yellow" | "red";
    computedAt: string;
    postsLast30dViaCron: number;
    postsLast30dViaWebhook: number;
    registeredOnProvider: boolean;
    lastWebhookAt?: string;
    lastWebhookOutcome?: "success" | "signature_invalid" | "parse_error";
    redReason?: "not_registered_on_provider" | "signature_invalid" | "reconciliation_gap";
  };
}

export const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin_content: LinkedinIcon,
  linkedin_ads: LinkedinIcon,
  facebook: FacebookIcon,
  // Meta virtual providers (flattened from single facebook connection)
  facebook_pages: FacebookIcon,
  instagram: InstagramIcon,
  meta_ads: Megaphone,
  whatsapp: WhatsAppIcon,
  google_ads: GoogleIcon,
  google_analytics: GoogleIcon,
  google_search_console: GoogleIcon,
  google_business_profile: GoogleIcon,
  youtube: YoutubeIcon,
  beehiiv: BeehiivIcon,
  substack: SubstackIcon,
  mailchimp: MailchimpIcon,
  kit: Mail,
  shopify: ShopifyIcon,
  wordpress: WordPressIcon,
  woocommerce: WooCommerceIcon,
  ghost: GhostIcon,
  x: TwitterIcon,
  slack: SlackIcon,
  discord: DiscordIcon,
  telegram: TelegramIcon,
  teams: TeamsIcon,
};

/** Brand tile style per provider; colours live in brand-colors.ts. A provider
 *  with no entry falls back to a neutral tile at the call site. */
export const PROVIDER_TILES: Record<string, CSSProperties> = {
  linkedin_content: brandTileStyle("linkedin"),
  linkedin_ads: brandTileStyle("linkedin"),
  facebook: brandTileStyle("meta"),
  facebook_pages: brandTileStyle("facebook"),
  instagram: brandTileStyle("instagram"),
  meta_ads: brandTileStyle("meta"),
  whatsapp: brandTileStyle("whatsapp"),
  google_ads: brandTileStyle("google"),
  google_analytics: brandTileStyle("googleAnalytics"),
  google_search_console: brandTileStyle("googleSearchConsole"),
  google_business_profile: brandTileStyle("googleBusinessProfile"),
  youtube: brandTileStyle("youtube"),
  beehiiv: brandTileStyle("beehiiv", "dark"),
  substack: brandTileStyle("substack"),
  mailchimp: brandTileStyle("mailchimp", "dark"),
  kit: brandTileStyle("kit"),
  shopify: brandTileStyle("shopify"),
  wordpress: brandTileStyle("wordpress"),
  woocommerce: brandTileStyle("woocommerce"),
  ghost: brandTileStyle("ghost"),
  x: brandTileStyle("x"),
  slack: brandTileStyle("slack"),
  discord: brandTileStyle("discord"),
  telegram: brandTileStyle("telegram"),
  teams: brandTileStyle("teams"),
};
