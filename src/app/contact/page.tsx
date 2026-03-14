import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/utils";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Contact Us - PeakHour",
  description:
    "Get in touch with the PeakHour team — we'd love to hear from you.",
};

const CONTACT_CHANNELS = [
  {
    title: "General Inquiries",
    description: "Questions about PeakHour, partnerships, or anything else.",
    email: "hello@peakhour.ai",
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
        />
      </svg>
    ),
  },
  {
    title: "Support",
    description:
      "Need help with your account, integrations, or campaign setup?",
    email: "support@peakhour.ai",
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
        />
      </svg>
    ),
  },
  {
    title: "Privacy & Legal",
    description: "Data requests, privacy concerns, or legal matters.",
    email: "privacy@peakhour.ai",
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
] as const;

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Get in touch
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Have a question, feedback, or want to explore how PeakHour can work
            for your business? We&apos;d love to hear from you.
          </p>
        </section>

        {/* Contact cards */}
        <section className="border-t bg-muted/40 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-3">
              {CONTACT_CHANNELS.map((channel) => (
                <div
                  key={channel.title}
                  className="flex flex-col items-center rounded-xl border bg-background p-8 text-center shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {channel.icon}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">
                    {channel.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {channel.description}
                  </p>
                  <a
                    href={`mailto:${channel.email}`}
                    className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {channel.email}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Response time + CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
            <div className="rounded-xl border bg-muted/30 p-8">
              <h2 className="text-xl font-semibold">We respond quickly</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Most inquiries get a reply within 24 hours on business days.
                For urgent support issues, mention &quot;urgent&quot; in your
                subject line.
              </p>
            </div>

            <div className="mt-12">
              <p className="text-muted-foreground">
                Ready to see PeakHour in action?
              </p>
              <Link
                href="/auth"
                className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Get started free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
