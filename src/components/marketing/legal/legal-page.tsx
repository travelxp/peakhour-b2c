import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { eyebrowCls, wrap } from "@/components/marketing/seo/styles";

/**
 * The shared page for the legal and policy documents (privacy, terms, cookies, data deletion, data retention): Daylight,
 * the minimal header, a readable measure, a table of contents, and a "Last updated" chip.
 *
 * ★IT NEVER TOUCHES THE LEGAL TEXT. The document arrives as `children` and is rendered as it came; this component only
 * adds `id`s to `h2`s that have none (so the table of contents can link to them) and reads the h2 text for the contents
 * list. `legal-text.test.tsx` renders each page and compares its text to a committed golden, so a word that moved or
 * changed fails the build.
 */

type Heading = { id: string; label: string };
type Node = ReactElement<{ id?: string; children?: ReactNode }>;

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node as Node).props.children);
  return "";
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/^\d+(\.\d+)*\.?\s*/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/** Walk host elements and fragments (a legal body is plain JSX), collecting h2s and giving each an id. */
function withHeadings(children: ReactNode, found: Heading[], used: Set<string>): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as Node;
    if (el.type === "h2") {
      const label = textOf(el.props.children).replace(/\s+/g, " ").trim();
      let id = el.props.id;
      if (!id) {
        const base = slug(label);
        id = base;
        for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      }
      used.add(id);
      found.push({ id, label });
      return el.props.id ? el : cloneElement(el, { id });
    }
    if (typeof el.type === "string" || el.type === Fragment) {
      const inner = el.props.children;
      if (inner == null) return el;
      return cloneElement(el, undefined, withHeadings(inner, found, used));
    }
    return el;
  });
}

/** Every id the document already sets on an h2, so a generated id never collides with a hand-written one that comes later. */
function explicitIds(children: ReactNode, into: Set<string>) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as Node;
    if (el.type === "h2" && el.props.id) into.add(el.props.id);
    else if (typeof el.type === "string" || el.type === Fragment) explicitIds(el.props.children, into);
  });
}

export function LegalPage({
  title,
  lastUpdated,
  aboveBody,
  children,
}: {
  title: string;
  /** The date only, e.g. "November 3, 2026". The chip adds the "Last updated:" label. */
  lastUpdated: string;
  /** Live content that is not part of the document (the data-deletion status). */
  aboveBody?: ReactNode;
  children: ReactNode;
}) {
  const headings: Heading[] = [];
  const used = new Set<string>();
  explicitIds(children, used);
  const body = withHeadings(children, headings, used);
  const toc = headings.length > 1;

  return (
    <div className="flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header minimal />

      <main className="flex-1">
        <section className="border-b bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_100%)]">
          <div className={`${wrap} py-8 sm:py-12`}>
            <p className={eyebrowCls}>Legal</p>
            <h1 className="mt-3 text-[2rem] font-black leading-[1.06] tracking-[-0.03em] text-balance sm:text-5xl">{title}</h1>
            <p className="mt-4 inline-flex rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-foreground">
              Last updated: {lastUpdated}
            </p>
          </div>
        </section>

        <div className={`${wrap} py-8 sm:py-12 ${toc ? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14" : ""}`}>
          {toc && (
            <>
              {/* Phone and tablet: one closed row, so the document starts straight away. */}
              <details className="group mb-8 rounded-2xl border bg-card lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  On this page
                  <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none">
                    ▾
                  </span>
                </summary>
                <TocList headings={headings} className="border-t px-4 py-3" />
              </details>
              {/* Desktop: a sticky rail beside the text. */}
              <nav aria-label="On this page" className="hidden lg:block">
                <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">On this page</p>
                  <TocList headings={headings} className="mt-3" />
                </div>
              </nav>
            </>
          )}

          <article className="min-w-0 max-w-[46rem]">
            {aboveBody}
            <div data-legal-body className="legal-body space-y-10">
              {body}
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function TocList({ headings, className }: { headings: Heading[]; className?: string }) {
  return (
    <ol className={`space-y-0.5 text-sm ${className ?? ""}`}>
      {headings.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            className="-mx-2 block rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {h.label}
          </a>
        </li>
      ))}
    </ol>
  );
}
