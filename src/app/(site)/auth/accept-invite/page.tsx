"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { acceptInvite, sendMagicLink } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { CheckCircle2, XCircle, Mail } from "lucide-react";
import { FlowButton, FlowCard, FlowHead, FlowNotice, FlowSpinner, flowStage } from "@/components/marketing/flow/flow-kit";
import { Suspense } from "react";
import { HOME_ROUTE } from "@/lib/nav-home";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className={flowStage} role="status">
        <FlowSpinner className="size-8" />
        <span className="sr-only">Loading</span>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
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
  const [sendError, setSendError] = useState("");
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token || !email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time validation of URL search params on mount; necessary to surface the error UI
      setStatus("error");
      setMessage("This invitation link is incomplete. Ask the person who invited you to send it again.");
      return;
    }

    let redirectTimer: ReturnType<typeof setTimeout>;

    (async () => {
      try {
        const res = await acceptInvite(token, email);
        if (res.status === "joined") {
          setStatus("joined");
          setMessage(res.message);
          await refreshUser();
          redirectTimer = setTimeout(() => router.push(HOME_ROUTE), 2000);
        } else if (res.status === "signup_required") {
          setStatus("signup");
          setMessage(res.message);
          setOrgName(res.orgName || "the team");
        } else {
          setStatus("error");
          setMessage(res.message || "Something went wrong");
        }
      } catch (err: unknown) {
        setStatus("error");
        const message =
          err instanceof Error ? err.message : "";
        setMessage(
          message || "This invitation has expired or was already used. Ask for a new one."
        );
      }
    })();

    return () => clearTimeout(redirectTimer);
  }, [token, email, refreshUser, router]);

  const handleSignup = async () => {
    if (!email) return;
    setSendError("");
    try {
      await sendMagicLink(email);
      setMagicLinkSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setSendError(
        message
          ? `${message.replace(/[.!]+$/, "")}. Try again in a moment.`
          : "The sign-in link didn’t send. Try again.",
      );
    }
  };

  return (
    <div className={flowStage}>
      <FlowCard className="max-w-md">
        {status === "loading" && (
          <div role="status" className="flex flex-col items-center gap-4 py-6 text-center">
            <FlowSpinner className="size-9" />
            <h1 className="text-lg font-bold">Opening your invitation…</h1>
          </div>
        )}

        {status === "joined" && (
          <>
            <FlowHead icon={CheckCircle2} tone="ok" title="You’ve joined the team">
              <span role="status">{message}</span>
            </FlowHead>
            <p className="mt-4 text-sm text-muted-foreground">Taking you to your dashboard…</p>
          </>
        )}

        {status === "signup" && !magicLinkSent && (
          <>
            <FlowHead icon={Mail} title={<>You&apos;re invited to {orgName}</>}>
              Create your account to join. We&apos;ll email a sign-in link to{" "}
              <strong className="text-foreground">{email}</strong>.
            </FlowHead>
            {sendError && (
              <FlowNotice tone="bad" role="alert" className="mt-5">
                {sendError}
              </FlowNotice>
            )}
            <FlowButton onClick={handleSignup} className="mt-5">
              Send sign-in link
            </FlowButton>
          </>
        )}

        {status === "signup" && magicLinkSent && (
          <FlowHead icon={CheckCircle2} tone="ok" title="Check your email">
            We sent a sign-in link to <strong className="text-foreground">{email}</strong>. Open it
            to create your account and join {orgName}.
          </FlowHead>
        )}

        {status === "error" && (
          <>
            <FlowHead icon={XCircle} tone="bad" title="This invitation can’t be used">
              <span role="alert">{message}</span>
            </FlowHead>
            <FlowButton variant="ghost" onClick={() => router.push("/auth")} className="mt-5">
              Go to sign in
            </FlowButton>
          </>
        )}
      </FlowCard>
    </div>
  );
}
