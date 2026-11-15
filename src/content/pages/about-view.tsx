import Link from "next/link";
import type { PageRecord } from "@/lib/seo/types";
import { Bullets, FactsCard, Frame } from "@/components/marketing/seo/frame";
import { Section } from "@/components/marketing/seo/section";
import { cardCls, linkCls } from "@/components/marketing/seo/styles";
import { ABOUT, ABOUT_COMPANIES, ABOUT_CONTACTS, ABOUT_MARKETS, ABOUT_PILLARS } from "./about";
import { pathFor } from "@/lib/seo/resolve";

/** The organization entity page (Bible 11.2). Built from the kit's Frame and Section; every fact comes from SITE. */
export function AboutView({ page }: { page: PageRecord }) {
  return (
      <Frame
        page={page}
        content={ABOUT}
        art={
          <FactsCard
            title="At a glance"
            facts={[
              { label: "Modules", value: ABOUT_PILLARS.length },
              { label: "Markets", value: ABOUT_MARKETS.length },
              { label: "Plan", value: "One, for all five" },
            ]}
          />
        }
      >
        <Section id="what" eyebrow="What Peakhour is" title="One platform, five modules.">
          <ul role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {ABOUT_PILLARS.map((p) => (
              <li key={p.name} className={`${cardCls} p-5`}>
                <h3 className="text-lg font-extrabold tracking-tight">
                  <Link href={p.href} className={linkCls}>
                    {p.name}
                  </Link>
                </h3>
                <p className="mt-1.5 text-[15px] text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </Section>
        <Section id="markets" eyebrow="Where it works" title="Built for six markets." tone="muted">
          <Bullets items={[...ABOUT_MARKETS]} className="max-w-md text-base sm:grid-cols-2" />
        </Section>
        <Section id="company" eyebrow="The company" title="Who stands behind it.">
          <div className="grid gap-4 md:grid-cols-2">
            {ABOUT_COMPANIES.map((c) => (
              <div key={c.region} className={`${cardCls} p-5 sm:p-6`}>
                <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{c.region}</h3>
                <p className="mt-2 font-bold">{c.ref}</p>
                <p className="mt-1 text-[15px] text-muted-foreground">{c.address}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-[15px] text-muted-foreground">
            The two companies share one legal name; their country of incorporation and registration number tell them apart. Our{" "}
            <Link href={pathFor("legal.terms")} className={linkCls}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href={pathFor("legal.privacy")} className={linkCls}>
              Privacy Policy
            </Link>{" "}
            say which one you contract with.
          </p>
        </Section>
        <Section id="contact" eyebrow="Contact" title="How to reach us." tone="muted">
          <dl className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {ABOUT_CONTACTS.map((c) => (
              <div key={c.email} className={`${cardCls} p-5`}>
                <dt className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{c.label}</dt>
                <dd className="mt-1.5">
                  <a href={`mailto:${c.email}`} className={linkCls}>
                    {c.email}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[15px] text-muted-foreground">
            More ways to get in touch are on the{" "}
            <Link href={pathFor("contact")} className={linkCls}>
              contact page
            </Link>
            .
          </p>
        </Section>
      </Frame>
  );
}
