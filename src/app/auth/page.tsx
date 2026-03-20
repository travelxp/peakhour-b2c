"use client";

import { useState } from "react";
import Link from "next/link";
import { sendMagicLink } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { ArrowRight, Mail } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GradientButton } from "@/components/ui/gradient-button";
import { PulsingStatusBadge } from "@/components/ui/pulsing-status-badge";
import { DividerWithLabel } from "@/components/ui/divider-with-label";
import { MonoLabel } from "@/components/ui/mono-label";

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
    <div className="relative flex min-h-screen flex-col">
      {/* ─── Header ─── */}
      <header className="flex w-full items-center justify-between px-8 py-6">
        <div className="font-display text-2xl font-bold tracking-tight">
          Neural Interface
        </div>
        <div className="flex items-center gap-4">
          <button className="text-sm font-medium uppercase tracking-wider text-foreground/60 transition-opacity hover:opacity-100">
            System Status
          </button>
        </div>
      </header>

      {/* ─── Background decorations ─── */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.03), transparent 70%)",
          }}
        />
        <div className="absolute right-10 top-10 h-96 w-96 rounded-full bg-[--ph-info]/5 blur-[100px]" />
        <div className="absolute bottom-10 left-10 h-80 w-80 rounded-full bg-primary/5 blur-[80px]" />
      </div>

      {/* ─── Main content ─── */}
      <main className="flex flex-1 items-center justify-center px-6">
        <section className="w-full max-w-120">
          {sent ? (
            <GlassPanel padding="lg">
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[--ph-accent-muted]">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                  Check your email
                </h2>
                <p className="mx-auto mt-4 max-w-sm text-lg leading-relaxed text-muted-foreground">
                  We sent a sign-in link to{" "}
                  <strong className="text-foreground">{email}</strong>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Click the link to sign in. It expires in 15 minutes.
                </p>
                <button
                  className="mt-8 w-full rounded-md border border-border py-4 font-display font-bold transition-colors hover:bg-foreground hover:text-background"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                >
                  Use a different email
                </button>
              </div>
            </GlassPanel>
          ) : (
            <GlassPanel padding="lg">
              {/* Status badge */}
              <div className="mb-10 text-center">
                <div className="mb-6 flex justify-center">
                  <PulsingStatusBadge
                    label="Active Node"
                    variant="glow"
                    color="primary"
                  />
                </div>
                <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                  Welcome back to your AI Brain.
                </h1>
                <p className="mx-auto mt-4 max-w-sm text-lg leading-relaxed text-muted-foreground">
                  Access your cognitive architecture and resume neural
                  processing.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[--ph-error]/20 bg-[--ph-error-bg] p-3 text-sm text-[--ph-error]"
                  >
                    {error}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Email Address
                  </label>
                  <div className="group relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.ai"
                      required
                      autoComplete="email"
                      autoFocus
                      className="peer w-full rounded-md bg-[--ph-surface-250] px-4 py-4 text-foreground outline-none transition-colors duration-200 placeholder:text-foreground/30 focus:bg-[--ph-surface-300] focus:ring-0"
                    />
                    <div className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 peer-focus:w-full" />
                  </div>
                </div>

                <GradientButton
                  type="submit"
                  loading={loading}
                  icon={<ArrowRight className="h-5 w-5" />}
                  className="w-full"
                >
                  Continue with Email
                </GradientButton>

                <DividerWithLabel label="Neural Auth Sync" />

                {/* Google OAuth */}
                <button
                  type="button"
                  className="group flex w-full items-center justify-center gap-3 rounded-md border border-border/15 bg-background px-6 py-3.5 transition-colors duration-200 hover:bg-[--ph-bg-shell]"
                >
                  <svg
                    className="h-5 w-5 opacity-80 transition-opacity group-hover:opacity-100"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="text-sm font-bold">
                    Continue with Google
                  </span>
                </button>
              </form>

              {/* Footer actions */}
              <div className="mt-10 space-y-4 border-t border-border/10 pt-8 text-center">
                <p className="text-sm text-muted-foreground">
                  New here?{" "}
                  <Link
                    href="/auth"
                    className="ml-1 font-bold text-primary underline-offset-4 hover:underline"
                  >
                    Create account
                  </Link>
                </p>
                <Link
                  href="/contact"
                  className="block text-xs font-bold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-primary"
                >
                  Need help accessing your node?
                </Link>
              </div>
            </GlassPanel>
          )}

          {/* Trust badge */}
          <div className="mt-12 text-center opacity-40 transition-opacity duration-500 hover:opacity-80">
            <MonoLabel size="xs" className="tracking-[0.3em] font-bold">
              End-to-End Neural Encryption Active
            </MonoLabel>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="flex flex-col items-center justify-between gap-4 px-12 py-8 md:flex-row">
        <div className="text-sm font-bold">
          <Link href="/" className="font-display tracking-tight">
            peakhour<span className="text-primary">.ai</span>
          </Link>
        </div>
        <div className="flex gap-6">
          {[
            { href: "/privacy-policy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <MonoLabel size="xs" className="font-bold">
            Status
          </MonoLabel>
        </div>
      </footer>
    </div>
  );
}
