import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PeakHour - AI Marketing Department",
  description:
    "Your AI-powered marketing team. Content intelligence, creative factory, and optimization engine — all in one platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Opt every route into dynamic rendering so the CSP middleware can stamp a
  // per-request nonce onto Next's injected <script> tags. Without this, statically
  // prerendered pages have no nonce and 'strict-dynamic' blocks all framework chunks.
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
