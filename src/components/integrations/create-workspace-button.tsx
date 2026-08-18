"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";

/**
 * Connect-time escape hatch for the integration-fit guard: when a connect is
 * hard-stopped as a different brand, create a NEW workspace for it and switch
 * there, then send the user to the integrations page to reconnect (now against
 * an empty workspace → anchors cleanly). Reuses POST /auth/businesses/create,
 * which switches the active business + reissues the session cookie; the full
 * navigation picks up the new active business. Works for OAuth and API-key
 * providers alike (no provider-specific re-auth wiring).
 */

interface CreateWorkspaceButtonProps {
  /** Provider being connected — used for the default workspace name + copy. */
  provider: string;
  /** Suggested workspace name (the blocked candidate's brand), if known. */
  suggestedName?: string | null;
}

export function CreateWorkspaceButton({ provider, suggestedName }: CreateWorkspaceButtonProps) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const name = suggestedName?.trim() || `${provider} workspace`;
      await api.post("/v1/auth/businesses/create", { name });
      toast.success(`Created workspace "${name}". Connect ${provider} here.`);
      // Full navigation so the new active business (fresh cookie) is picked up.
      window.location.href = "/dashboard/integrations";
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't create the workspace. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={run}>
      <FolderPlus className="h-3.5 w-3.5" />
      {busy ? "Creating…" : "Create a separate workspace"}
    </Button>
  );
}
