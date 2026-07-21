"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyMagicLink } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { LoadingScreen } from "@/components/molecules/loading-screen";

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
      setError("Invalid verification link. Please request a new one.");
      setVerifying(false);
      return;
    }

    verifyMagicLink(token, uid)
      .then(async (result) => {
        await refreshUser();
        router.replace(next ?? result.redirectTo);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Verification failed. Please request a new sign-in link.");
        }
        setVerifying(false);
      });
  }, [searchParams, router, refreshUser]);

  // While verifying (and until the redirect commits) show the sleek loader,
  // never a blank card.
  if (verifying) {
    return (
      <LoadingScreen
        fullScreen
        message="Signing you in…"
        steps={["Verifying your link", "Setting up your session"]}
      />
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Verification failed</CardTitle>
        <CardDescription>We couldn&apos;t verify your sign-in link</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <div className="space-y-4">
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
          <Button className="w-full" onClick={() => router.push("/auth")}>
            Request a new link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <Suspense fallback={<LoadingScreen fullScreen message="Loading…" />}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
