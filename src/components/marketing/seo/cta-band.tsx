import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Cta } from "./content-types";
import { wrap } from "./styles";

/** The ink closing band, as on /shopify: one headline, one line, the page's primary action and an optional second. */
export function CtaBand({
  headline,
  body,
  primary,
  secondary,
}: {
  headline: string;
  body: string;
  primary: Cta;
  secondary?: Cta;
}) {
  return (
    <section aria-labelledby="cta-h" className="pb-12 sm:pb-16">
      <div className={wrap}>
        <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] bg-ink px-6 py-9 text-on-ink sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:px-14">
          <div className="max-w-2xl">
            <h2 id="cta-h" className="text-[1.75rem] font-black leading-[1.06] tracking-[-0.03em] text-balance sm:text-4xl">
              {headline}
            </h2>
            <p className="mt-3 text-lg text-on-ink-dim">{body}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href={primary.href}
              className="group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-[15px] font-bold text-brand-contrast transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {primary.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
            </Link>
            {secondary && (
              <Link
                href={secondary.href}
                className="inline-flex items-center rounded-full px-6 py-3.5 text-[15px] font-bold text-on-ink shadow-[inset_0_0_0_2px_var(--on-ink)] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
