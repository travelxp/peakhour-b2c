"use client";

/**
 * WordPress / WooCommerce connect modal.
 *
 * Unlike other integrations, the merchant does NOT paste their key into us —
 * we GENERATE an org API key for them to paste into the free Peakhour.ai
 * plugin. The plaintext key is shown exactly ONCE (only its hash is stored
 * server-side). The card flips to "connected" once the plugin calls
 * /v1/integrations/wordpress/connect from the merchant's site.
 */
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WordPressIcon } from "@/components/ui/brand-icons";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  AlertTriangle,
} from "lucide-react";

interface GeneratedKey {
  id: string;
  key: string;
  keyId: string;
  prefix: string;
  last4: string;
  scopes: string[];
}

export function WordPressConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setGenerating(false);
    setGenerated(null);
    setCopied(false);
    setError("");
  }

  function close() {
    reset();
    onClose();
  }

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const result = await api.post<GeneratedKey>("/v1/api-keys", {
        name: "WordPress connection",
      });
      setGenerated(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not generate a key. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function copyKey() {
    if (!generated) return;
    navigator.clipboard
      .writeText(generated.key)
      .then(() => {
        setCopied(true);
        toast.success("Connection key copied");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Couldn't copy — select the key and copy it manually."));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#21759B] text-white">
              <WordPressIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Connect WordPress &amp; WooCommerce</DialogTitle>
              <DialogDescription>
                Install the free plugin and paste your connection key.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 — install */}
          <div className="flex gap-3">
            <StepNumber n={1} />
            <p className="text-sm">
              Install the free{" "}
              <a
                href="https://wordpress.org/plugins/peakhour-ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Peakhour.ai plugin
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              on your WordPress site, then activate it.
            </p>
          </div>

          {/* Step 2 — generate */}
          <div className="flex gap-3">
            <StepNumber n={2} />
            <div className="flex-1 space-y-2">
              <p className="text-sm">Generate your connection key.</p>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              {!generated ? (
                <Button onClick={generate} disabled={generating} className="gap-1.5">
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Generate connection key
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generated.key}
                      onFocus={(e) => e.currentTarget.select()}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyKey}
                      aria-label="Copy key"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Copy this now — for your security it won&apos;t be shown again. You
                      can generate a new one anytime.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3 — paste */}
          <div className="flex gap-3">
            <StepNumber n={3} />
            <p className="text-sm">
              In your WordPress admin, go to{" "}
              <span className="font-medium">Settings → Peakhour.ai</span>, paste the key,
              and save. Your site will appear here as{" "}
              <span className="font-medium">Connected</span> within a minute.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {generated ? "Done" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {n}
    </div>
  );
}
