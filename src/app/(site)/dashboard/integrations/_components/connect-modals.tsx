"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { appLabel, appsFlyerAppId, listBusinessApps, platformLabel, splitApps, type BusinessApp } from "@/lib/api/business-apps";
import { Button } from "@/components/ui/button";
import { WhatsAppEmbeddedSignup } from "@/components/integrations/whatsapp-embedded-signup";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BUCKET_EXAMPLE,
  ISSUER_ID_EXAMPLE,
  appStoreConnectBody,
  appStoreFormProblem,
  playConsoleBody,
  playFormProblem,
  type AppStoreForm,
  type PlayForm,
} from "@/lib/store-install-connect";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Loader2 } from "lucide-react";
import { BeehiivIcon } from "@/components/brand/brand-icons";
import { brandTileStyle } from "@/components/brand/brand-colors";

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={brandTileStyle("beehiiv", "dark")}>
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

// ── AppsFlyer Connect Modal ────────────────────────────────────────

/**
 * Connect AppsFlyer (GG-4a): an API token, proved against one of the business's own confirmed apps before it is stored. Peakhour
 * then reads the daily installs of those apps and offers "App installs" as a goal.
 */
export function AppsFlyerConnectModal({
  open,
  onClose,
  onConnect,
}: {
  open: boolean;
  onClose: () => void;
  onConnect: (apiKey: string, appId: string) => Promise<unknown>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [apps, setApps] = useState<BusinessApp[] | null>(null);
  const [appId, setAppId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let live = true;
    setApps(null);
    listBusinessApps()
      .then((all) => {
        if (!live) return;
        const confirmed = splitApps(all).confirmed;
        setApps(confirmed);
        // keep the pick only while that app is still confirmed
        setAppId((cur) => (confirmed.some((a) => appsFlyerAppId(a) === cur) ? cur : confirmed[0] ? appsFlyerAppId(confirmed[0]) : ""));
      })
      .catch(() => {
        if (!live) return;
        // ★A FAILED LIST IS NOT "NO APPS": say so, instead of sending a merchant who has apps to add one.
        setApps(null);
        setAppId("");
        setError("We couldn't load your apps. Close this and try again.");
      });
    return () => {
      live = false;
    };
  }, [open]);

  function reset() {
    setApiKey("");
    setAppId("");
    setApps(null);
    setError("");
    setConnecting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !appId) return;
    setConnecting(true);
    setError("");
    try {
      await onConnect(apiKey.trim(), appId);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to connect. Please check your token and try again.");
    } finally {
      setConnecting(false);
    }
  }

  const noApps = apps !== null && apps.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect AppsFlyer</DialogTitle>
          <DialogDescription>Count your app installs as a goal. Peakhour only reads installs of the apps on your list.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}
          {noApps && (
            <div className="rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
              Add and confirm your app first (your app&apos;s store link), then connect AppsFlyer.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="appsflyer-token">API token (V2.0)</Label>
            <Input id="appsflyer-token" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={connecting} />
            <p className="text-xs text-muted-foreground">
              <a
                href="https://dev.appsflyer.com/hc/reference/overview-11"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Where to find your token
                <ExternalLink className="h-3 w-3" />
              </a>
              {" "}&mdash; an AppsFlyer admin copies it from the profile menu.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appsflyer-app">Your app</Label>
            <select
              id="appsflyer-app"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              disabled={connecting || !apps || apps.length === 0}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {(apps ?? []).map((a) => (
                <option key={a.appId} value={appsFlyerAppId(a)}>
                  {appLabel(a)} ({platformLabel(a.platform)})
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={connecting}>
              Cancel
            </Button>
            <Button type="submit" disabled={connecting || !apiKey.trim() || !appId} className="gap-1.5">
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

// ── App Store Connect and Play Console Connect Modals ──────────────

function readFileInto(file: File | undefined, set: (text: string) => void, onFail: () => void) {
  if (!file) return;
  file.text().then(set).catch(onFail);
}

function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline">
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * Connect App Store Connect (GG-4b): the merchant's own API key, so Peakhour can check its app installs against Apple's download
 * counts ("Store installs"). Read only. The key text is sent once and kept sealed; it is never shown again.
 */
export function AppStoreConnectConnectModal({
  open,
  onClose,
  onConnect,
}: {
  open: boolean;
  onClose: () => void;
  onConnect: (apiKey: string, config: Record<string, string>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<AppStoreForm>({ issuerId: "", keyId: "", vendorNumber: "", p8: "" });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ issuerId: "", keyId: "", vendorNumber: "", p8: "" });
    setError("");
    setConnecting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = appStoreFormProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const body = appStoreConnectBody(form);
      await onConnect(body.apiKey, body.config);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to connect. Please check the details and try again.");
    } finally {
      setConnecting(false);
    }
  }

  const set = (k: keyof AppStoreForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect App Store Connect</DialogTitle>
          <DialogDescription>Check your app installs against Apple&apos;s own download counts. Peakhour only reads first-time downloads of the apps on your list.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}

          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>In App Store Connect, open Users and Access, then the App Store Connect API tab.</li>
            <li>Create a Team key with the Sales access level (Admin also works). Copy the Issuer ID shown above the keys and the Key ID beside yours.</li>
            <li>Download the .p8 file. Apple lets you download it only once. Open it in a text editor and paste all of it below.</li>
            <li>Your vendor number is under Payments and Financial Reports.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            <GuideLink href="https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api">Apple&apos;s guide to API keys</GuideLink>
          </p>

          <div className="space-y-2">
            <Label htmlFor="asc-issuer">Issuer ID</Label>
            <Input id="asc-issuer" value={form.issuerId} onChange={(e) => set("issuerId")(e.target.value)} disabled={connecting} placeholder={ISSUER_ID_EXAMPLE} autoComplete="off" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="asc-key-id">Key ID</Label>
              <Input id="asc-key-id" value={form.keyId} onChange={(e) => set("keyId")(e.target.value)} disabled={connecting} placeholder="2X9R4HXF34" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asc-vendor">Vendor number</Label>
              <Input id="asc-vendor" value={form.vendorNumber} onChange={(e) => set("vendorNumber")(e.target.value)} disabled={connecting} placeholder="85012345" autoComplete="off" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asc-p8">The .p8 key</Label>
            <Textarea id="asc-p8" value={form.p8} onChange={(e) => set("p8")(e.target.value)} disabled={connecting} rows={4} placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"} spellCheck={false} autoComplete="off" className="font-mono text-xs" />
            <input type="file" accept=".p8" disabled={connecting} className="text-xs" onChange={(e) => readFileInto(e.target.files?.[0], set("p8"), () => setError("We couldn't read that file. Paste its text instead."))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={connecting}>
              Cancel
            </Button>
            <Button type="submit" disabled={connecting || !form.p8.trim()} className="gap-1.5">
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

/**
 * Connect Play Console (GG-4b): Google offers install counts only through the reports bucket Play Console exports to, so the
 * merchant gives a service account that can read it. Read only. The key text is sent once and kept sealed.
 */
export function PlayConsoleConnectModal({
  open,
  onClose,
  onConnect,
}: {
  open: boolean;
  onClose: () => void;
  onConnect: (apiKey: string, config: Record<string, string>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<PlayForm>({ bucket: "", serviceAccountJson: "" });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ bucket: "", serviceAccountJson: "" });
    setError("");
    setConnecting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = playFormProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const body = playConsoleBody(form);
      await onConnect(body.apiKey, body.config);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to connect. Please check the details and try again.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Play Console</DialogTitle>
          <DialogDescription>Check your app installs against Google Play&apos;s own install counts. Peakhour only reads the install reports of the apps on your list.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}

          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>In Google Cloud, create a service account and download its JSON key file.</li>
            <li>In Play Console, open Users and permissions, invite the service account&apos;s email address and give it View app information (Global).</li>
            <li>In Play Console, open Download reports, Statistics, and copy the Cloud Storage address (it begins pubsite_prod_rev_).</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            <GuideLink href="https://support.google.com/googleplay/android-developer/answer/6135870">Google&apos;s guide to Play Console reports</GuideLink>
            {" "}&mdash; new reports can take 3 to 7 days to appear.
          </p>

          <div className="space-y-2">
            <Label htmlFor="play-bucket">Reports bucket</Label>
            <Input id="play-bucket" value={form.bucket} onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))} disabled={connecting} placeholder={BUCKET_EXAMPLE} autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="play-key">Service account key (JSON)</Label>
            <Textarea id="play-key" value={form.serviceAccountJson} onChange={(e) => setForm((f) => ({ ...f, serviceAccountJson: e.target.value }))} disabled={connecting} rows={5} spellCheck={false} autoComplete="off" className="font-mono text-xs" />
            <input type="file" accept=".json,application/json" disabled={connecting} className="text-xs" onChange={(e) => readFileInto(e.target.files?.[0], (text) => setForm((f) => ({ ...f, serviceAccountJson: text })), () => setError("We couldn't read that file. Paste its text instead."))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={connecting}>
              Cancel
            </Button>
            <Button type="submit" disabled={connecting || !form.serviceAccountJson.trim()} className="gap-1.5">
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
