"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { WhatsAppEmbeddedSignup } from "@/components/integrations/whatsapp-embedded-signup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Loader2 } from "lucide-react";
import { BeehiivIcon } from "@/components/brand/brand-icons";

export function WhatsAppConnectModal({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect WhatsApp Business</DialogTitle>
          <DialogDescription>
            Connect your WhatsApp Business account through Meta&apos;s secure
            sign-up. Your existing WhatsApp Business app keeps working.
          </DialogDescription>
        </DialogHeader>
        {/*
          Refresh the integrations list on success so the card flips to
          connected. The component stays mounted showing its own success
          state; the merchant closes the dialog when ready.
        */}
        <WhatsAppEmbeddedSignup onConnected={onConnected} />
      </DialogContent>
    </Dialog>
  );
}

// ── Beehiiv Connect Modal ──────────────────────────────────────────

export function BeehiivConnectModal({
  open,
  onClose,
  onConnect,
}: {
  open: boolean;
  onClose: () => void;
  onConnect: (apiKey: string, publicationId: string) => Promise<unknown>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setApiKey("");
    setPublicationId("");
    setError("");
    setConnecting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !publicationId.trim()) return;

    setConnecting(true);
    setError("");

    try {
      await onConnect(apiKey.trim(), publicationId.trim());
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to connect. Please check your credentials and try again.");
      }
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFD100] text-black">
              <BeehiivIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Connect Beehiiv</DialogTitle>
              <DialogDescription>
                Import your newsletters for AI-powered tagging and ads
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="beehiiv-api-key">API Key</Label>
            <Input
              id="beehiiv-api-key"
              type="password"
              placeholder="pk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={connecting}
            />
            <p className="text-xs text-muted-foreground">
              {/* Beehiiv moved both the API-key list AND the publication
                * ID surface under /settings/workspace/api in their latest
                * dashboard rev — both connection inputs now deep-link to
                * the same place. Previously the API-key link pointed at
                * the older /settings/integrations/api URL (404 today) and
                * the publication-ID link pointed at /settings/general
                * (no longer shows the pub_ ID). User-reported. */}
              <a
                href="https://app.beehiiv.com/settings/workspace/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Open Beehiiv API Settings
                <ExternalLink className="h-3 w-3" />
              </a>
              {" "}&mdash; copy the key that starts with <code className="rounded bg-muted px-1 py-0.5">pk_</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beehiiv-pub-id">Publication ID</Label>
            <Input
              id="beehiiv-pub-id"
              placeholder="pub_..."
              value={publicationId}
              onChange={(e) => setPublicationId(e.target.value)}
              disabled={connecting}
            />
            <p className="text-xs text-muted-foreground">
              <a
                href="https://app.beehiiv.com/settings/workspace/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Open Beehiiv API Settings
                <ExternalLink className="h-3 w-3" />
              </a>
              {" "}&mdash; copy the ID that starts with <code className="rounded bg-muted px-1 py-0.5">pub_</code>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={connecting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={connecting || !apiKey.trim() || !publicationId.trim()}
              className="gap-1.5"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Integration Card ───────────────────────────────────────────────
