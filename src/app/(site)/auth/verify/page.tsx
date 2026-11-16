"use client";

import { Suspense, useEffect, useState } from "react";
import { landingRoute } from "@/lib/nav-home";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyMagicLink } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { XCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { LoadingScreen } from "@/components/molecules/loading-screen";
import { FlowButton, FlowCard, FlowHead, FlowNotice, flowStage } from "@/components/marketing/flow/flow-kit";

/**
 * Same-origin relative path only — the `next` return path is attacker-influenced
 * (it rode through the email link), so re-validate here before navigating even
 * though the server already sanitized it. Rejects protocol-relative ("//host"),
 * backslash ("/\\host" → browsers normalize to "//host"), schemes, and control
 * chars/space.
 */
function safeReturnTo(v: string | null): string | null {
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  // Reject control chars, space, and backslash (browsers normalize backslash
  // to "/", so "/\\host" would resolve to the protocol-relative "//host").
  if (/[\u0000-\u0020\\]/.test(v)) return null;
  if (v.startsWith("//") || v.includes("://")) return null;
  return v;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const token = searchParams.get("token");
    const uid = searchParams.get("uid");
    // Where to land after verify: an explicit same-origin `next` (e.g. the
    // Shopify store-claim page the user came from) wins over the server default.
    const next = safeReturnTo(searchParams.get("next"));

    if (!token || !uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time validation of URL search params on mount; necessary to surface the error UI
      setError("This link is incomplete. Request a new sign-in link.");
      setVerifying(false);
      return;
    }

    verifyMagicLink(token, uid)
      .then(async (result) => {
        await refreshUser();
        // ★THE SERVER'S "HOME" IS NORMALISED AGAINST THE FLAG. The api has no
        // visibility of a NEXT_PUBLIC build flag, so it hands back
        // /dashboard/overview as the app's home — and signing in is the
        // PRIMARY entry into the product, which would land on the one screen
        // the flag demotes. An explicit `next` is left exactly as it is.
        router.replace(next ?? landingRoute(result.redirectTo));
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("We couldn’t sign you in. Request a new sign-in link.");
        }
        setVerifying(false);
      });
  }, [searchParams, router, refreshUser]);

  // While verifying (and until the redirect commits) show the loader in the
  // card, never a blank page.
  if (verifying) {
    return (
      <FlowCard className="max-w-md">
        <h1 className="sr-only">Signing you in</h1>
        <LoadingScreen
          message="Signing you in…"
          steps={["Verifying your link", "Setting up your session"]}
          className="min-h-48"
        />
      </FlowCard>
    );
  }

  return (
    <FlowCard className="max-w-md">
      <FlowHead icon={XCircle} tone="bad" title="This link didn’t work">
        It may have expired or been used already.
      </FlowHead>
      <FlowNotice tone="bad" role="alert" className="mt-5">
        {error}
      </FlowNotice>
      <FlowButton className="mt-4" onClick={() => router.push("/auth")}>
        Request a new link
      </FlowButton>
    </FlowCard>
  );
}

export default function VerifyPage() {
  return (
    <div className={flowStage}>
      <Suspense
        fallback={
          <FlowCard className="max-w-md">
            <LoadingScreen message="Loading…" className="min-h-48" />
          </FlowCard>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
