import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { pageMetadata } from "@/lib/seo";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { HOW_IT_WORKS_STEPS } from "@/lib/how-it-works";

export const metadata = pageMetadata({
  title: "How it works — live in minutes, not quarters | Peakhour.ai",
  description:
    "Connect what you have, approve the plan, then let Peakhour run and learn. Grounded in your real catalog and content — never guessed from your name.",
  path: "/how-it-works",
});

export default async function HowItWorks() {
  const catalog = await getPublicCatalog();
  const cta = signupCta(catalog?.platform?.signupMode ?? "open");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main>
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
              <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
              How it works
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-pretty sm:text-5xl">
              Live in minutes,{" "}
              <span className="font-serif font-normal italic text-brand-gradient">
                not quarters.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              No lengthy setup, no agency onboarding. Connect your tools, approve
              the plan, and Peakhour starts working — grounded in your real
              business from the first minute.
            </p>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 sm:px-6">
            {HOW_IT_WORKS_STEPS.map((s) => (
              <div
                key={s.step}
                className="grid gap-6 rounded-2xl border bg-background p-7 transition-all hover:border-foreground hover:shadow-xl sm:grid-cols-[auto_1fr]"
              >
                <div className="font-serif text-5xl font-normal italic text-brand-gradient">
                  {s.step}
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{s.title}</h2>
                  <p className="mt-2 text-muted-foreground">{s.description}</p>
                  <p className="mt-3 text-sm text-muted-foreground/80">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-24 pt-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 px-6 py-16 text-center text-zinc-100 shadow-2xl">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-pretty sm:text-4xl">
                See it work on{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  your business.
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-zinc-400">
                A free plan on every pillar. No credit card. Your first Peaks are
                on us.
              </p>
              {!cta.disabled && (
                <Link
                  href={cta.href}
                  className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-7 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                >
                  {cta.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
