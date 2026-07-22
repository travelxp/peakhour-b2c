import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, Fraunces } from "next/font/google";
import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Numeric face for the Peaks currency (balance chips, inline costs) — set in
// Space Grotesk, tabular, via the --font-space-grotesk variable.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

// Serif display accent for the marketing surface — used sparingly for the
// italic gold headline flourishes (e.g. "Free to start."). Exposed via
// --font-fraunces, which globals.css maps onto --font-serif (the `font-serif`
// utility). preload:false — nothing renders it yet and the variable rides the
// app-wide root layout, so we avoid emitting a preload on every product route;
// it swaps in when a marketing headline first uses `font-serif`.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "600"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Peakhour.ai — Agentic AI Marketing Platform",
  description:
    "Peakhour.ai is an agentic AI marketing platform: autonomous AI agents analyze your content, create campaigns, and optimize performance across every channel — around the clock.",
};

/**
 * Root layout for the site surface — this app's single root layout. (The
 * Shopify embedded app no longer lives here; it moved to the dedicated
 * peakhour-shopify repo.)
 */
export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force dynamic rendering so the CSP middleware can stamp a per-request
  // nonce onto Next's injected <script> tags. Without this, statically
  // prerendered pages have no nonce and 'strict-dynamic' blocks all
  // framework chunks. Scoped here (not the commerce root layout) so the
  // Shopify surface gets its own dynamic behaviour independently.
  await connection();

  // Resolve via next-intl (English-only today) so <html lang> tracks the
  // active locale automatically once more languages are added.
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
              <Toaster richColors position="bottom-right" />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
