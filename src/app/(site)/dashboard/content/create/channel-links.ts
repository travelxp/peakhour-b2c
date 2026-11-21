import type { ContentHubIntegration } from "@/lib/nav-queries";
import { flattenMetaIntegration } from "@/lib/integrations-meta";
import { resolveChannelCta } from "../channel-cta";
import type { ChannelConfig } from "../channels.config";

/** A channel the merchant has connected, with the page that opens it. */
export interface ChannelLink {
  slug: string;
  name: string;
  description: string;
  href: string;
  channel: ChannelConfig;
}

/** The connection for each provider key. A Meta connection fans out into its capability rows, as the hub always did. */
export function connectionsByProvider(
  integrations: ContentHubIntegration[] | undefined,
): Map<string, ContentHubIntegration> {
  const map = new Map<string, ContentHubIntegration>();
  for (const integ of flattenMetaIntegration(Array.isArray(integrations) ? integrations : [])) {
    map.set(integ.provider, integ);
  }
  return map;
}

/**
 * The channels Create links to: connected, with a page of their own under
 * /dashboard/content. Ad channels (their page is the Ads hub) and channels that
 * are managed only from Connected accounts are left out; Connected accounts is
 * where every other channel is connected, so nothing is listed twice.
 */
export function channelLinks(
  channels: ChannelConfig[],
  connections: Map<string, ContentHubIntegration>,
): ChannelLink[] {
  const links: ChannelLink[] = [];
  for (const channel of channels) {
    const cta = resolveChannelCta(channel, connections.get(channel.providerKey));
    if (!cta.isConnected || !cta.dashboardPath) continue;
    if (!cta.dashboardPath.startsWith("/dashboard/content/")) continue;
    links.push({
      slug: channel.slug,
      name: channel.name,
      description: channel.description,
      href: cta.dashboardPath,
      channel,
    });
  }
  return links;
}
