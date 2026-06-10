// Bare root shell — no CSS, no providers, no fonts.
// All site-wide styles and providers live in (site)/layout.tsx so they are
// isolated from the Shopify embedded surface (/shopify/**), which uses
// Polaris exclusively and must not inherit Tailwind's preflight reset.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
