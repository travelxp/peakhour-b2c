import Link from "next/link";
import type { DetailSectionContent } from "./content-types";
import { Bullets } from "./frame";
import { Section } from "./section";
import { safeHref } from "./safe-href";
import { cardCls, linkCls } from "./styles";

/** Three columns when the count divides by three, four when it divides by four, else two. */
function columnsClass(n: number): string {
  if (n % 3 === 0) return "lg:grid-cols-3";
  if (n % 4 === 0) return "lg:grid-cols-4";
  return "lg:grid-cols-2";
}

/** An odd last card spans the row wherever the grid has two columns, so it is never left alone. */
function lastCardClass(n: number): string {
  return n % 3 === 0 || n % 4 === 0
    ? "sm:max-lg:[&:last-child:nth-child(odd)]:col-span-2"
    : "sm:[&:last-child:nth-child(odd)]:col-span-2";
}

/**
 * A section of a feature page that explains what the feature is made of: a few paragraphs, then named parts in a
 * grid (one column on a phone, two from sm, then three or four from lg), then what the part does not do. A server component.
 */
export function DetailSection({ section, tone = "plain" }: { section: DetailSectionContent; tone?: "plain" | "muted" }) {
  const items = section.items ?? [];
  return (
    <Section id={section.id} eyebrow={section.eyebrow} title={section.title} tone={tone}>
      <div className="grid max-w-3xl gap-3 text-[17px] text-muted-foreground">
        {section.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {items.length > 0 && (
        <ul role="list" className={`mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4 ${columnsClass(items.length)}`}>
          {items.map((i) => (
            <li key={i.title} className={`${cardCls} p-5 ${lastCardClass(items.length)}`}>
              <h3 className="text-lg font-extrabold tracking-tight">{i.title}</h3>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                {i.body}
                {i.href && i.linkLabel && (
                  <>
                    {" "}
                    <Link href={safeHref(i.href)} className={linkCls}>
                      {i.linkLabel}
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {section.limitations && section.limitations.length > 0 && (
        <div className={`${cardCls} mt-6 max-w-3xl p-5`}>
          <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">What this part does not do</h3>
          <Bullets items={section.limitations} className="mt-2" />
        </div>
      )}
    </Section>
  );
}
