import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { pageMeta } from "@/lib/seo/metadata";
import { cardCls, eyebrowCls, primaryBtn, wrap } from "@/components/marketing/seo/styles";

export const metadata = pageMeta("contact");

const CONTACT_CHANNELS = [
  {
    title: "General inquiries",
    description: "Questions about Peakhour, partnerships, or anything else.",
    email: "hello@peakhour.ai",
    icon: (
      <svg
        aria-hidden="true"
        className="size-6"
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
        className="size-6"
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
    title: "Privacy and legal",
    description: "Data requests, privacy concerns, or legal matters.",
    email: "privacy@peakhour.ai",
    icon: (
      <svg
        aria-hidden="true"
        className="size-6"
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
    <div className="flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_92%)]">
          <div className={`${wrap} py-10 sm:py-14 lg:py-16`}>
            <p className={eyebrowCls}>Contact</p>
            <h1 className="mt-3 text-[2.2rem] font-black leading-[1.04] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.5rem]">
              Write to <span className="daylight-mark">the right inbox</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-foreground/80 sm:text-xl">
              Questions about Peakhour, your account or your data? Pick the
              address that fits and write to it.
            </p>
          </div>
        </section>

        {/* Contact cards */}
        <section aria-label="Ways to reach us" className="pb-10 sm:pb-14">
          <div className={wrap}>
            <ul className="grid gap-4 sm:grid-cols-3 sm:gap-5">
              {CONTACT_CHANNELS.map((channel) => (
                <li
                  key={channel.title}
                  className={`${cardCls} flex flex-col p-6 shadow-[var(--daylight-shadow)] sm:p-7`}
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                    {channel.icon}
                  </div>
                  <h2 className="mt-4 text-lg font-extrabold tracking-tight">
                    {channel.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">
                    {channel.description}
                  </p>
                  <a
                    href={`mailto:${channel.email}`}
                    className="mt-4 break-all rounded-sm text-sm font-bold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {channel.email}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Response time + CTA */}
        <section className="pb-12 sm:pb-16">
          <div className={wrap}>
            <div className="grid items-center gap-6 rounded-[28px] bg-muted p-6 sm:p-9 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Not sure which inbox?</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Use General inquiries. Put what you need in the subject line
                  so it reaches the right person.
                </p>
              </div>
              <div className="lg:justify-self-end">
                <p className="text-muted-foreground">
                  Ready to try Peakhour?
                </p>
                <Link href="/auth" className={`${primaryBtn} mt-3`}>
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
