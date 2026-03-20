"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { acceptInvite, sendMagicLink } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

export default function AcceptInvitePage() {
  const params = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();

  const token = params.get("token");
  const email = params.get("email");

  const [status, setStatus] = useState<
    "loading" | "joined" | "signup" | "error"
  >("loading");
  const [message, setMessage] = useState("");
  const [orgName, setOrgName] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setStatus("error");
      setMessage("Invalid invitation link. Please ask for a new invite.");
      return;
    }

    (async () => {
      try {
        const res = await acceptInvite(token, email);
        if (res.status === "joined") {
          setStatus("joined");
          setMessage(res.message);
          // Refresh auth context then redirect
          await refreshUser();
          setTimeout(() => router.push("/dashboard/overview"), 2000);
        } else if (res.status === "signup_required") {
          setStatus("signup");
          setMessage(res.message);
          setOrgName(res.orgName || "the team");
        } else {
          setStatus("error");
          setMessage(res.message || "Something went wrong");
        }
      } catch (err: any) {
        setStatus("error");
        setMessage(
          err.message || "This invitation has expired or already been used."
        );
      }
    })();
  }, [token, email, refreshUser, router]);

  const handleSignup = async () => {
    if (!email) return;
    try {
      await sendMagicLink(email);
      setMagicLinkSent(true);
    } catch (err: any) {
      setMessage(err.message || "Failed to send sign-in link");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Accepting invitation...</p>
            </>
          )}

          {status === "joined" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Welcome to the team!</h2>
              <p className="text-muted-foreground">{message}</p>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === "signup" && !magicLinkSent && (
            <>
              <Mail className="h-12 w-12 text-blue-500 mx-auto" />
              <h2 className="text-xl font-semibold">
                You&apos;re invited to {orgName}
              </h2>
              <p className="text-muted-foreground">
                Create your PeakHour account to join the team. We&apos;ll send a
                sign-in link to <strong>{email}</strong>.
              </p>
              <Button onClick={handleSignup} className="w-full">
                Send sign-in link
              </Button>
            </>
          )}

          {status === "signup" && magicLinkSent && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="text-muted-foreground">
                We sent a sign-in link to <strong>{email}</strong>. Click the
                link to create your account and join {orgName}.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mx-auto" />
              <h2 className="text-xl font-semibold">Invitation expired</h2>
              <p className="text-muted-foreground">{message}</p>
              <Button
                variant="outline"
                onClick={() => router.push("/auth")}
                className="mt-2"
              >
                Go to sign in
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
