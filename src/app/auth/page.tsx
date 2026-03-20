"use client";

import { useState } from "react";
import Link from "next/link";
import { sendMagicLink } from "@/lib/auth";
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
import { SITE } from "@/lib/utils";

const VALUE_PROPS = [
  {
    title: "Add your business in minutes",
    description:
      "Just paste your website URL. Our AI discovers your brand, audience, and creates a marketing strategy instantly.",
  },
  {
    title: "AI creates ads from your content",
    description:
      "Connect your newsletter, blog, or social media. We turn every piece into high-performing ads across LinkedIn, Google, and Meta.",
  },
  {
    title: "Hands-free optimization",
    description:
      "The AI monitors performance hourly, pauses what doesn't work, boosts what does, and rebalances your budget automatically.",
  },
] as const;

const TRUST_STATS = [
  { value: "12", label: "dimensions of content intelligence" },
  { value: "3", label: "ad platforms, one dashboard" },
  { value: "24/7", label: "autonomous optimization" },
] as const;

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await sendMagicLink(email);
      setSent(true);
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

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Left panel — value proposition */}
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }} />
        </div>

        <div className="relative z-10 space-y-10">
          <div>
            <h1 className="text-3xl font-bold leading-tight xl:text-4xl">
              Your AI marketing department starts here
            </h1>
            <p className="mt-3 max-w-lg text-primary-foreground/70">
              Stop spending hours on ads. Add your business, connect your
              content, and let AI handle the rest.
            </p>
          </div>

          <div className="space-y-6">
            {VALUE_PROPS.map((prop, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10 text-sm font-semibold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold">{prop.title}</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60">
                    {prop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex gap-8 border-t border-primary-foreground/10 pt-6">
            {TRUST_STATS.map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-primary-foreground/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          {sent ? (
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <svg aria-hidden="true" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                <CardDescription>
                  We sent a sign-in link to <strong>{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to sign in. The link expires in 15
                  minutes.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                >
                  Use a different email
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="w-full max-w-md space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome to {SITE.name}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Enter your email to sign in or create your account. No
                  password needed.
                </p>
              </div>

              <Card>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <CardContent className="space-y-4 pt-6">
                    {error && (
                      <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Work email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        autoFocus
                        className="h-11"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Button
                      type="submit"
                      className="h-11 w-full text-base"
                      disabled={loading}
                    >
                      {loading ? "Sending link..." : "Continue with email"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      We&apos;ll send you a magic link. No password to remember.
                    </p>
                  </CardFooter>
                </form>
              </Card>

              <p className="text-center text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy-policy"
                  className="underline hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
