"use client";

import { AuthProvider } from "@/providers/auth-provider";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
