import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { connection } from "next/server";
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

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} font-sans antialiased`}
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
