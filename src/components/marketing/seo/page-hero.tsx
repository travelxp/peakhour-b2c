import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";
import type { Crumb, Cta } from "./content-types";
import { eyebrowCls, ghostBtn, primaryBtn, wrap } from "./styles";
import { safeHref } from "./safe-href";

/**
 * The first screen. The H1 is the page's only one; the paragraph right under it is the DIRECT ANSWER (Bible
 * 11.1), the first substantive text on the page and the sentence an answer engine should be able to lift whole.
 * With an `art` slot it is two columns from lg and stacks on a phone; without one it is a single column, never a
 * grid with an empty half.
 */
export function PageHero({
  crumbs,
  eyebrow,
  h1,
  directAnswer,
  primaryCta,
  secondaryCta,
  art,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  h1: string;
  directAnswer: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
  art?: ReactNode;
}) {
  return (
    <section className="bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_92%)]">
      <div
        className={cn(
          wrap,
          "grid grid-cols-1 items-center gap-8 py-8 sm:py-12",
          art && "lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-16",
        )}
      >
        <div className={cn("min-w-0", !art && "max-w-3xl")}>
          <Breadcrumbs crumbs={crumbs} />
          <p className={cn(eyebrowCls, crumbs.length > 1 && "mt-5")}>{eyebrow}</p>
          <h1 className="mt-3 text-[2.2rem] font-black leading-[1.04] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.5rem]">
            {h1}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-foreground/80 sm:text-xl">{directAnswer}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={safeHref(primaryCta.href)} className={primaryBtn}>
              {primaryCta.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
            </Link>
            {secondaryCta && (
              <Link href={safeHref(secondaryCta.href)} className={ghostBtn}>
                {secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
        {art && <div className="min-w-0">{art}</div>}
      </div>
    </section>
  );
}
