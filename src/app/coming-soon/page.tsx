import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { SITE } from "@/lib/utils";

export const metadata: Metadata = {
  title: "PeakHour — Agentic AI Marketing Platform",
  description:
    "PeakHour is an agentic AI marketing platform. Autonomous AI agents analyze your content, create campaigns, and optimize performance across every channel — around the clock. Launching soon.",
};

/**
 * Standalone pre-launch teaser. Served for EVERY route in production while the
 * coming-soon gate is on (see middleware.ts) — deliberately self-contained
 * (no Header/Footer that link into the gated app). Pure teaser: no signup/
 * capture. Preview locally at /coming-soon, or set COMING_SOON=true to exercise
 * the full gate in dev.
 */
export default function ComingSoonPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Subtle backdrop (standard utilities — no brittle arbitrary theme()). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-primary/5 to-transparent"
      />

      <div className="mx-auto flex max-w-2xl flex-col items-center gap-7">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden />
          Agentic AI Marketing Platform
        </span>

        <h1 className="text-pretty text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Every hour is{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {SITE.name}
          </span>
        </h1>

        <p className="max-w-xl text-balance text-lg text-muted-foreground">
          Autonomous AI agents that analyze your content, create campaigns, and
          optimize performance across every channel — around the clock, so your
          marketing runs at its peak even when you&rsquo;re off.
        </p>

        <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-5 py-2.5 text-sm font-medium text-muted-foreground">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Launching soon
        </div>
      </div>

      <p className="absolute bottom-6 text-xs text-muted-foreground">
        © {SITE.name}. All rights reserved.
      </p>
    </main>
  );
}
