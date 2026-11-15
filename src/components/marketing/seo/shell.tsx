import type { ReactNode } from "react";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";

/**
 * The Daylight page chrome: `.theme-daylight` (the marketing palette in globals.css) scoped to the page so the Header
 * and Footer inside it follow without being forked, as /shopify does. Every public page of the kit sits in this.
 */
export function DaylightShell({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      {banner}
      <Header />
      {children}
      <Footer />
    </div>
  );
}
