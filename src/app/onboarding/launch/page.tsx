"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OnboardingStatus {
  onboarding: {
    completed: boolean;
    steps: {
      businessDiscovered: boolean;
      adAccountConnected: boolean;
      budgetSet: boolean;
      firstAdLaunched: boolean;
    };
  };
  businessType: string | null;
  linkedinConnected: boolean;
  hasBudget: boolean;
}

export default function LaunchPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    api
      .get<OnboardingStatus>("/v1/onboarding/status")
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleLaunch() {
    setError("");
    setLaunching(true);

    try {
      await api.post("/v1/onboarding/launch");
      setLaunched(true);
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to launch. Please try again.");
      }
    } finally {
      setLaunching(false);
    }
  }

  if (launched) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">You&apos;re all set!</CardTitle>
          <CardDescription>
            Your AI marketing engine is now active. We&apos;ll start processing
            your content and creating ads.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => router.push("/dashboard/overview")}
          >
            Go to dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ready to launch</CardTitle>
        <CardDescription>
          Review your setup and launch your AI marketing engine
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <CheckItem
                label="Business discovered"
                done={!!status?.onboarding?.steps?.businessDiscovered}
              />
              <CheckItem
                label="Ad platform connected"
                done={!!status?.linkedinConnected}
                optional
              />
              <CheckItem
                label="Budget configured"
                done={!!status?.hasBudget}
                optional
              />
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          className="w-full"
          onClick={handleLaunch}
          disabled={launching || loading}
        >
          {launching ? "Launching..." : "Launch"}
        </Button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/overview")}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Skip to dashboard
        </button>
      </CardFooter>
    </Card>
  );
}

function CheckItem({
  label,
  done,
  optional,
}: {
  label: string;
  done: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div
        className={
          done
            ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
            : "flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/30"
        }
      >
        {done && "\u2713"}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {!done && optional && (
          <p className="text-xs text-muted-foreground">Optional</p>
        )}
      </div>
    </div>
  );
}
