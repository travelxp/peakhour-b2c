import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, Fraunces } from "next/font/google";
import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { SITE } from "@/lib/utils";
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

const DEFAULT_TITLE = "Peakhour.ai — The AI business platform for growing brands";
const DEFAULT_DESCRIPTION =
  "Five AI pillars — Commerce, Content, Growth, Support, Presence — that sell, publish, advertise, answer, and get you found. A free plan on every pillar. No credit card.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE.name,
  alternates: {
    canonical: "/",
    // hreflang-ready: English-only today (self-referencing). Add locales here
    // alongside messages/<locale>.json when languages grow.
    languages: { en: "/" },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
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
