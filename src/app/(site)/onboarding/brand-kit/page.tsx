"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { BRAND_KIT_QUERY_KEY, getBrandKit, saveBrandKit } from "@/lib/api/brand-kit";
import { draftFromView, draftIsEmpty, kitErrorMessage, kitPermissions, payloadFromDraft } from "@/lib/brand-kit";
import { PrefillReview } from "@/components/brand-kit/prefill-review";
import { useWebsitePrefill } from "@/components/brand-kit/use-website-prefill";

/**
 * Onboarding step: your Brand Kit (Peakhour Drive B2), between "Confirm" and "We're on it".
 *
 * The Brand Kit is the first thing a new business fills in, and Peakhour pre-fills it from the website. So this page reads the site once, shows
 * what it found, and saves only what the person keeps. It is never in the way:
 *   - no website on file, or a kit that already has something in it (another business of the same organisation), and the step is skipped;
 *   - someone who may not edit a kit (a viewer) skips it too;
 *   - "Not now" and a failed read both go straight on. The discovery job is already running behind this page.
 * The first business's kit is saved for the whole organisation, so a business added later starts from it.
 */
export default function BrandKitStepPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { org, orgs, business, isLoading } = useAuth();
  const role = orgs.find((o) => o._id === org?._id)?.role;
  const perms = useMemo(() => kitPermissions(role), [role]);
  const scope = perms.canEditOrg ? "org" : perms.canEditBusiness ? "business" : null;
  const businessId = business?._id ?? "";

  // No retries: this step must never be in the way, so a failed read goes straight on instead of waiting out the backoff.
  const kit = useQuery({ queryKey: [...BRAND_KIT_QUERY_KEY, businessId], queryFn: getBrandKit, enabled: !!businessId && !!scope, retry: false, refetchOnWindowFocus: false });
  const prefill = useWebsitePrefill();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const goOn = () => router.push("/onboarding/launch");

  useEffect(() => {
    if (isLoading) return;
    // Nothing to do here for this person: straight to the next step.
    if (!scope || !businessId) {
      router.replace("/onboarding/launch");
      return;
    }
    // Once the review is up the decision is made: a later failed refetch must not pull the person out of it.
    if (started.current) return;
    if (kit.isError) {
      router.replace("/onboarding/launch");
      return;
    }
    if (!kit.data) return;
    const alreadyHasKit = !draftIsEmpty(draftFromView(kit.data.effective));
    if (alreadyHasKit || !kit.data.websiteUrl) {
      router.replace("/onboarding/launch");
      return;
    }
    started.current = true;
    void prefill.start();
    // prefill.start is stable; the run-once guard is `started`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, scope, businessId, kit.data, kit.isError, router]);

  async function keep() {
    if (!scope) return;
    setError(null);
    setSaving(true);
    try {
      const r = await prefill.apply(scope);
      if (!r) return;
      // The save replaces every section, so it builds on the kit as it is NOW, not as it was when this page opened: a kit made in another tab,
      // or by another admin, since then is added to and never wiped.
      const fresh = await getBrandKit();
      const merged = r.fold(draftFromView(scope === "org" ? fresh.org : fresh.business));
      if (!draftIsEmpty(merged)) {
        await saveBrandKit(scope, payloadFromDraft(merged));
        // Drive's Brand Kit tab reads the same cache: without this it would show the empty kit it fetched before this save.
        await queryClient.invalidateQueries({ queryKey: BRAND_KIT_QUERY_KEY });
      }
      // A logo that could not be brought in leaves the review up with the reason; what did work is saved either way.
      if (r.complete) goOn();
    } catch (err) {
      setError(kitErrorMessage(err, "Your Brand Kit could not be saved. You can set it up later in Drive."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Set up your Brand Kit</h1>
        <p className="text-lg text-muted-foreground">
          Every creative and ad Peakhour makes reads from it. We looked at your website. Keep what looks right and nothing is saved until you do.
        </p>
      </div>

      {prefill.state.status === "idle" ? (
        <div role="status" className="text-center text-sm text-muted-foreground">
          One moment…
        </div>
      ) : (
        <PrefillReview
          state={prefill.state}
          confirmLabel={saving ? "Saving…" : "Save and continue"}
          onToggleColor={prefill.toggleColor}
          onToggleLogo={prefill.toggleLogo}
          onConfirm={() => void keep()}
          onDismiss={goOn}
          onRetry={() => void prefill.start()}
          busy={saving}
        />
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="text-center">
        <Button variant="link" onClick={goOn} disabled={saving}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
