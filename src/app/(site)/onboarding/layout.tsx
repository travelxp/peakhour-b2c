"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, SITE } from "@/lib/utils";

/**
 * Three-step onboarding shell. Each step has plain-English labels —
 * we never expose backend nouns ("discovery", "taxonomy") to the user.
 *
 * The route slugs map: add-business is the historical first step
 * (renamed visually to "Start"), about is the AI-extracted profile
 * confirmation, and launch is the friendly hand-off where the
 * background pipeline finishes while the user can already use the app.
 */
const STEPS = [
  { path: "/onboarding/add-business", label: "Tell us about you" },
  { path: "/onboarding/about", label: "Confirm" },
  { path: "/onboarding/launch", label: "We're on it" },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">P</span>
            </div>
            <span className="text-lg font-bold tracking-tight">{SITE.name}</span>
          </Link>
          <StepIndicator />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">{children}</div>
      </main>
    </div>
  );
}

function StepIndicator() {
  const pathname = usePathname();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => pathname.startsWith(s.path)));

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.path} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
              i < currentIndex
                ? "bg-primary text-primary-foreground"
                : i === currentIndex
                  ? "border-2 border-primary text-primary"
                  : "border border-muted-foreground/30 text-muted-foreground"
            )}
          >
            {i < currentIndex ? "✓" : i + 1}
          </div>
          <span
            className={cn(
              "hidden text-xs sm:inline transition-colors",
              i === currentIndex
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "h-px w-6 transition-colors",
                i < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
