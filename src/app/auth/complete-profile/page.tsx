"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, sendOtp, verifyOtp } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api";

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
  const [otpSent, setOtpSent] = useState(false);

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
        setOtpSent(true);
        setStep("otp");
      } else {
        // Skip mobile verification, go to onboarding
        router.push("/onboarding/add-business");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        setError("Invalid code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    try {
      await sendOtp(mobile);
      setOtpSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to resend code.");
      }
    }
  }

  if (step === "otp") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Verify your mobile</CardTitle>
            <CardDescription>
              We sent a 6-digit code to <strong>{mobile}</strong>
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6">
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
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
                  className="text-center text-lg tracking-widest"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Resend code
                </button>
                <span className="text-muted-foreground">or</span>
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/add-business")}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Skip for now
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Complete your profile</CardTitle>
          <CardDescription>
            Tell us a bit about yourself
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile number (optional)</Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="+91 98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll send a verification code if provided
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : "Continue"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
