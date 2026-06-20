import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Peakhour.ai — Agentic AI Marketing Platform",
  description:
    "Peakhour.ai is an agentic AI marketing platform: autonomous AI agents analyze your content, create campaigns, and optimize performance across every channel — around the clock.",
};

/**
 * Root layout for the site surface — one of this app's multiple root layouts.
 * The Shopify commerce surface (/shopify/**) has its own root layout at
 * (commerce)/layout.tsx so it stays free of Tailwind's preflight reset and
 * can load App Bridge synchronously first in <head> (requirement 2.2.3).
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
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
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
