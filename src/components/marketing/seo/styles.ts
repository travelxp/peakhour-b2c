/*
 * Layout rhythm for the SEO template kit, taken from /shopify so a template page and
 * /shopify read as one site: one container, one section padding, one heading scale.
 * Sections are py-12 on a phone and py-16 from sm (a notch tighter than /shopify's
 * py-14/py-20, because these pages stack more sections and must not leave empty bands).
 */
export const wrap = "mx-auto max-w-6xl px-4 sm:px-6";
export const sectionPad = "py-12 sm:py-16";
export const eyebrowCls = "text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground";
export const h2Cls = "mt-3 text-[1.75rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-balance sm:text-4xl";
export const subCls = "mt-3 max-w-2xl text-lg text-muted-foreground";
export const primaryBtn =
  "group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-[15px] font-bold text-brand-contrast shadow-[0_8px_20px_-8px_var(--brand)] transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
export const ghostBtn =
  "inline-flex items-center rounded-full px-6 py-3.5 text-[15px] font-bold shadow-[inset_0_0_0_2px_var(--foreground)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
export const linkCls =
  "font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4 hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm";
export const cardCls = "rounded-2xl border bg-card";
