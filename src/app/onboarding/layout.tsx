"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/providers/auth-provider";
import { cn, SITE } from "@/lib/utils";

const STEPS = [
  { path: "/onboarding/add-business", label: "Your Business" },
  { path: "/onboarding/connect-platforms", label: "Connect" },
  { path: "/onboarding/budget", label: "Budget" },
  { path: "/onboarding/launch", label: "Launch" },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
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
    </AuthProvider>
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
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
              i < currentIndex
                ? "bg-primary text-primary-foreground"
                : i === currentIndex
                  ? "border-2 border-primary text-primary"
                  : "border border-muted-foreground/30 text-muted-foreground"
            )}
          >
            {i < currentIndex ? "\u2713" : i + 1}
          </div>
          <span
            className={cn(
              "hidden text-xs sm:inline",
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
                "h-px w-6",
                i < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
