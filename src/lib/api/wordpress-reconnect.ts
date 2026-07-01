import { api } from "@/lib/api";

/**
 * Typed client for the WordPress keyless RECONNECT flow (peakhour-api wp-bridge
 * reconnect-approve). When a claimed site's plugin is reinstalled, it files a
 * pending reconnect (a fresh secret gated by a short pairing code) and opens
 * /reconnect/wordpress?site=<id>. The signed-in owner enters the code shown in
 * their plugin; this call confirms it and the server adopts the plugin's secret.
 * Cookie-authed (the user is signed in here). See
 * peakhour-mongodb/docs/idea/wordpress-keyless-reconnect-plan.md.
 */
export async function approveWordpressReconnect(
  site: string,
  code: string,
  confirmed?: boolean,
): Promise<{ reconnected: boolean; host: string; adopted?: boolean }> {
  return api.request<{ reconnected: boolean; host: string; adopted?: boolean }>(
    "/v1/integrations/wordpress/reconnect-approve",
    { method: "POST", body: JSON.stringify({ site, code, ...(confirmed ? { confirmed: true } : {}) }) },
  );
}
