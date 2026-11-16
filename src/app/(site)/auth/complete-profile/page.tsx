"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, sendOtp, verifyOtp } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { Smartphone, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { FlowButton, FlowCard, FlowHead, FlowNotice, flowStage } from "@/components/marketing/flow/flow-kit";

type Step = "profile" | "otp";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<Step>("profile");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await updateProfile({ name, mobile: mobile || undefined });
      await refreshUser();

      if (mobile) {
        // Send OTP for mobile verification
        await sendOtp(mobile);
        setStep("otp");
      } else {
        // Skip mobile verification, go to onboarding
        router.push("/onboarding/add-business");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("That didn’t save. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile) return;
    setError("");
    setLoading(true);

    try {
      await verifyOtp(mobile, otp);
      await refreshUser();
      router.push("/onboarding/add-business");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("That code didn’t work. Check it and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!mobile) return;
    setError("");
    try {
      await sendOtp(mobile);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("The code didn’t send. Try again.");
      }
    }
  }

  if (step === "otp") {
    return (
      <div className={flowStage}>
        <FlowCard className="max-w-md">
          <FlowHead icon={Smartphone} title="Confirm your mobile number">
            We sent a 6-digit code to <strong className="text-foreground">{mobile}</strong>
          </FlowHead>
          <form onSubmit={handleOtpSubmit} className="mt-6 flex flex-col gap-4">
            {error && (
              <FlowNotice tone="bad" role="alert">
                {error}
              </FlowNotice>
            )}
            <div className="space-y-2">
              <Label htmlFor="otp" className="font-bold">
                Verification code
              </Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                autoComplete="one-time-code"
                className="h-12 rounded-xl bg-card text-center text-lg tracking-widest"
              />
            </div>
            <FlowButton type="submit" disabled={loading || otp.length !== 6}>
              {loading ? "Confirming…" : "Confirm"}
            </FlowButton>
            <div className="flex items-center justify-center gap-1 text-sm">
              <FlowButton type="button" variant="quiet" inline className="min-h-11 px-4" onClick={handleResendOtp}>
                Resend code
              </FlowButton>
              <span className="text-muted-foreground" aria-hidden>
                or
              </span>
              <FlowButton
                type="button"
                variant="quiet"
                inline
                className="min-h-11 px-4"
                onClick={() => router.push("/onboarding/add-business")}
              >
                Skip for now
              </FlowButton>
            </div>
          </form>
        </FlowCard>
      </div>
    );
  }

  return (
    <div className={flowStage}>
      <FlowCard className="max-w-md">
        <FlowHead icon={UserRound} title="Finish your profile">
          Add your name to continue. A mobile number is optional.
        </FlowHead>
        <form onSubmit={handleProfileSubmit} className="mt-6 flex flex-col gap-4">
          {error && (
            <FlowNotice tone="bad" role="alert">
              {error}
            </FlowNotice>
          )}
          <div className="space-y-2">
            <Label htmlFor="name" className="font-bold">
              Full name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              autoFocus
              className="h-12 rounded-xl bg-card text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile" className="font-bold">
              Mobile number (optional)
            </Label>
            <Input
              id="mobile"
              type="tel"
              placeholder="+91 98765 43210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              autoComplete="tel"
              aria-describedby="mobile-hint"
              className="h-12 rounded-xl bg-card text-base"
            />
            <p id="mobile-hint" className="text-xs text-muted-foreground">
              If you add one, we&apos;ll text you a code to confirm it.
            </p>
          </div>
          <FlowButton type="submit" disabled={loading || !name.trim()}>
            {loading ? "Saving…" : "Continue"}
          </FlowButton>
        </form>
      </FlowCard>
    </div>
  );
}
