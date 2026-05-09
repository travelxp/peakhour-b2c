"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Mail, Loader2, Check, Share2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * UpgradeDrawer — reusable Sheet that opens on any plan-gated
 * interaction. Operates in two modes (a third "limit-reached" mode
 * for fair-use 429s lives in a separate component).
 *
 *   waitlist  — v1 GA default. No prices shown. Captures email +
 *               business context for the Pro waiting list. Founding-
 *               member badge for the first 500 signups.
 *   checkout  — flips on once public pricing GA-s. Plan card +
 *               Stripe/Razorpay handoff.
 *
 * The two modes share the same Sheet chrome, animated header, and
 * telemetry tags so flipping `mode` is one config change at the call
 * site (eventually a remote-config flag).
 *
 * Props pass `featureKey` so the body copy + waitlist signup know
 * what triggered the drawer; that string is the single best dataset
 * we'll have for pricing decisions later.
 */
type UpgradeDrawerMode = "waitlist" | "checkout";

export interface UpgradeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** cfg_features.key the user clicked into. */
  featureKey?: string;
  /** Display name of the locked feature, for the headline. */
  featureName?: string;
  /** One-line value prop shown under the headline. */
  featureTagline?: string;
  /** Drawer mode. Defaults to "waitlist" — the v1 production posture. */
  mode?: UpgradeDrawerMode;
  /** Optional intent override; defaults derived from featureKey/addonKey. */
  intent?: "plan_upgrade" | "addon" | "integration" | "general";
  addonKey?: string;
  integrationKey?: string;
}

/**
 * Client-side random suffix used in the success card's share URL —
 * defeats exact-URL caching on retweets. Non-security; Math.random
 * is fine.
 */
function clientNonce(): string {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Pick the right `intent` for a waitlist signup based on which key
 * the caller passed. Documents the precedence so callers passing
 * BOTH addonKey AND featureKey (legitimate — an add-on unlocks a
 * feature) know they'll be bucketed by add-on (the more specific of
 * the two for analytics). Override via the explicit `intent` prop
 * when the default is wrong.
 */
function inferIntent(args: {
  addonKey?: string;
  integrationKey?: string;
  featureKey?: string;
}): "plan_upgrade" | "addon" | "integration" | "general" {
  if (args.addonKey) return "addon";
  if (args.integrationKey) return "integration";
  if (args.featureKey) return "plan_upgrade";
  return "general";
}

export function UpgradeDrawer(props: UpgradeDrawerProps) {
  const {
    open,
    onOpenChange,
    featureKey,
    featureName,
    featureTagline,
    mode = "waitlist",
    intent,
    addonKey,
    integrationKey,
  } = props;
  const { user } = useAuth();

  // Local form state — kept inside the drawer so closing-and-reopening
  // resets the form. Authenticated callers see their email auto-filled.
  const [email, setEmail] = useState(user?.email ?? "");
  const [businessContext, setBusinessContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    referralCode: string;
    foundingMember: boolean;
    position: number | null;
  } | null>(null);

  // Reset state when drawer closes — useEffect would also work but
  // open/close gives a more deterministic UX.
  function reset() {
    setEmail(user?.email ?? "");
    setBusinessContext("");
    setSuccess(null);
    setSubmitting(false);
  }

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Reset form once the Sheet's close animation has finished
      // (Radix's default close transition is ~300ms in this build).
      // Resetting earlier would visibly clear the form while the
      // drawer is still fading out.
      setTimeout(reset, 350);
    }
  }

  async function submitWaitlist() {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        email,
        intent: intent ?? inferIntent({ addonKey, integrationKey, featureKey }),
      };
      if (featureKey) body.featureKey = featureKey;
      if (addonKey) body.addonKey = addonKey;
      if (integrationKey) body.integrationKey = integrationKey;
      if (businessContext) body.businessContext = businessContext;

      const r = await api.post<{
        _id: string;
        referralCode: string;
        foundingMember: boolean;
        position: number | null;
        idempotent?: boolean;
      }>("/v1/waitlist/signup", body);

      setSuccess({
        referralCode: r.referralCode,
        foundingMember: r.foundingMember,
        position: r.position,
      });
      if (r.idempotent) {
        toast.success("You're already on the waitlist");
      } else {
        toast.success("You're in");
      }
    } catch (err) {
      toast.error((err as Error)?.message || "Could not join the waitlist");
    } finally {
      setSubmitting(false);
    }
  }

  function shareReferral() {
    if (!success) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/?ref=${success.referralCode}&n=${clientNonce()}`;
    if (navigator.share) {
      navigator.share({
        title: "Peakhour — early access",
        text: "I just joined the Peakhour waitlist. Skip the line:",
        url,
      }).catch(() => {/* user dismissed */});
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Referral link copied"))
        .catch(() => toast.error("Could not copy link — copy it manually below"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {mode === "waitlist" ? (
              <>
                <Sparkles className="size-5 text-amber-500" />
                Pro is opening soon
              </>
            ) : (
              <>Unlock {featureName || "this feature"}</>
            )}
          </SheetTitle>
          <SheetDescription>
            {success
              ? "You're in line. We'll email you when access opens."
              : mode === "waitlist"
                ? `Reserve your spot${featureName ? ` for ${featureName}` : ""}. Founding members lock in early-access perks.`
                : (featureTagline ?? "Choose a plan to unlock this and the rest of Pro.")}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 flex-1 overflow-auto space-y-5">
          {/* Locked-feature preview block */}
          {!success && featureName ? (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Feature
              </p>
              <p className="mt-1 text-sm font-medium">{featureName}</p>
              {featureTagline ? (
                <p className="mt-1 text-sm text-muted-foreground">{featureTagline}</p>
              ) : null}
              {featureKey ? (
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">{featureKey}</p>
              ) : null}
            </div>
          ) : null}

          {/* Waitlist form */}
          {mode === "waitlist" && !success ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!submitting) submitWaitlist();
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="upgrade-email">Email</Label>
                <Input
                  id="upgrade-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={Boolean(user?.email)}
                  className={user?.email ? "bg-muted" : undefined}
                  required
                />
                {user?.email ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Signed-in email. Sign out and resubmit to use a different one.
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="upgrade-context">
                  Tell us how you&apos;d use this
                  <span className="text-xs font-normal text-muted-foreground ml-1">(optional, shapes what we ship first)</span>
                </Label>
                <Textarea
                  id="upgrade-context"
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  placeholder="e.g. We post on LinkedIn 3×/week and want a writer agent that picks up our brand voice."
                  maxLength={2048}
                  rows={4}
                />
              </div>
            </form>
          ) : null}

          {/* Checkout-mode placeholder. The pricing matrix is wired
              once we flip drawerMode globally — for now this is a
              visible reminder that the path exists. */}
          {mode === "checkout" && !success ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              Checkout mode renders the pricing matrix and Stripe/Razorpay
              handoff. Until public pricing flips on, the drawer ships in
              waitlist mode.
            </div>
          ) : null}

          {/* Success card */}
          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
                <div className="rounded-full bg-green-100 dark:bg-green-950 p-2 mt-0.5">
                  <Check className="size-4 text-green-700 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">You&apos;re in line</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {success.position
                      ? `Position #${success.position.toLocaleString()}`
                      : "Position will update on your next visit"}
                  </p>
                  {success.foundingMember ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <Sparkles className="size-3" />
                      Founding Member — early-access perks locked in
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">Skip 5 spots</p>
                <p className="text-xs text-muted-foreground">
                  Invite a friend with your code; both of you move up the line.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-1.5 font-mono text-xs">
                    {success.referralCode}
                  </code>
                  <Button size="sm" variant="outline" onClick={shareReferral} aria-label="Share referral link">
                    <Share2 className="size-3.5 mr-1.5" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter>
          {success ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                Maybe later
              </Button>
              <Button onClick={submitWaitlist} disabled={submitting || mode === "checkout"}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Mail className="size-4 mr-2" />
                    {mode === "waitlist" ? "Reserve my spot" : "Continue to checkout"}
                  </>
                )}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
