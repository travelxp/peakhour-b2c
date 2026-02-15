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

export default function ConnectPlatformsPage() {
  const router = useRouter();
  const { org } = useAuth();
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{
        linkedinConnected: boolean;
      }>("/v1/onboarding/status")
      .then((status) => {
        setLinkedinConnected(status.linkedinConnected);
      })
      .catch((err: unknown) => {
        console.error("[onboarding] status fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleConnectLinkedIn() {
    // Redirect to LinkedIn OAuth flow
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/v1/linkedin/authorize`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your ad platforms</CardTitle>
        <CardDescription>
          Connect the platforms where you want to run ads
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : (
          <div className="rounded-md border p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">LinkedIn Ads</p>
              <p className="text-sm text-muted-foreground">
                {linkedinConnected
                  ? "Connected"
                  : "Connect your LinkedIn ad account"}
              </p>
            </div>
            {linkedinConnected ? (
              <span className="text-sm font-medium text-green-600">
                Connected
              </span>
            ) : (
              <Button size="sm" onClick={handleConnectLinkedIn}>
                Connect
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          More platforms (Google Ads, Meta) coming soon.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          className="w-full"
          onClick={() => router.push("/onboarding/budget")}
        >
          {linkedinConnected ? "Continue" : "Skip for now"}
        </Button>
      </CardFooter>
    </Card>
  );
}
