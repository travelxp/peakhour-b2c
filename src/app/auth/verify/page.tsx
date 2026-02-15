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

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const token = searchParams.get("token");
    const uid = searchParams.get("uid");

    if (!token || !uid) {
      setError("Invalid verification link. Please request a new one.");
      setVerifying(false);
      return;
    }

    verifyMagicLink(token, uid)
      .then(async (result) => {
        await refreshUser();
        router.replace(result.redirectTo);
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

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          {verifying ? "Verifying..." : "Verification failed"}
        </CardTitle>
        <CardDescription>
          {verifying
            ? "Please wait while we verify your sign-in link"
            : "We couldn't verify your sign-in link"}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {verifying ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
            <Button
              className="w-full"
              onClick={() => router.push("/auth")}
            >
              Request a new link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </CardContent>
          </Card>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
