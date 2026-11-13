"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopifyGroup } from "@/lib/shopify-features";
import { cn } from "@/lib/utils";
import { ProductTile, SampleTag } from "./shopify-art";
import { Disclosure } from "./shopify-disclosure";

/**
 * "What it does": the feature groups as tabs, each with a picture of the app
 * and its features as a list that opens one at a time.
 *
 * Every panel and every feature is in the server HTML (inactive panels carry
 * `hidden`), so search engines read the whole catalogue of features and a
 * no-JS visitor gets all of it through the page's <noscript> rule. The tabs
 * are real `#group` links and each feature keeps its `#feature` anchor: a
 * link to either opens the right tab, and the right feature in it.
 */
export function ShopifyJobs({ groups }: { groups: ShopifyGroup[] }) {
  const [active, setActive] = useState(groups[0]?.id ?? "");
  /**
   * The open feature per group, or null for none. It mirrors the DOM in both
   * directions (onToggle reports a visitor's own open or close), so the `open`
   * prop always equals what the page shows and React can re-open a feature a
   * visitor closed. Each group starts with its first feature open.
   */
  const [openBy, setOpenBy] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.features[0]?.id ?? null])),
  );
  /**
   * A #hash to scroll to. Held in state, with a counter so the same hash can
   * ask twice, so the scroll runs in the effect of the render that applied it:
   * by then the target's panel is no longer hidden.
   */
  const [scrollTarget, setScrollTarget] = useState<{ id: string; n: number } | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const group = groups.find((g) => g.id === id || g.features.some((f) => f.id === id));
      if (!group) return;
      setActive(group.id);
      if (group.id !== id) setOpenBy((s) => ({ ...s, [group.id]: id }));
      setScrollTarget((t) => ({ id, n: (t?.n ?? 0) + 1 }));
    };
    fromHash();
    // hashchange for links and the address bar; popstate for history steps
    // and pushState navigation, which fire no hashchange.
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("popstate", fromHash);
    };
  }, [groups]);

  useEffect(() => {
    if (scrollTarget) document.getElementById(scrollTarget.id)?.scrollIntoView({ block: "start" });
  }, [scrollTarget]);

  const select = (id: string, focus = false) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) tabRefs.current[id]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = groups.findIndex((g) => g.id === active);
    const next =
      e.key === "ArrowRight" ? (i + 1) % groups.length : e.key === "ArrowLeft" ? (i - 1 + groups.length) % groups.length : -1;
    if (next < 0) return;
    e.preventDefault();
    select(groups[next].id, true);
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="What Peakhour does"
        onKeyDown={onKeyDown}
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {groups.map((g) => {
          const selected = g.id === active;
          return (
            <a
              key={g.id}
              ref={(el) => {
                tabRefs.current[g.id] = el;
              }}
              href={`#${g.id}`}
              role="tab"
              id={`tab-${g.id}`}
              aria-controls={g.id}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={(e) => {
                // A new-tab or new-window click keeps the link's own behaviour.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                select(g.id);
              }}
              className={cn(
                "shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground shadow-[inset_0_0_0_1.5px_var(--border)] hover:shadow-[inset_0_0_0_1.5px_var(--foreground)]",
              )}
            >
              {g.name}
            </a>
          );
        })}
      </div>

      {groups.map((g) => (
        <div
          key={g.id}
          id={g.id}
          role="tabpanel"
          aria-labelledby={`tab-${g.id}`}
          data-jobs-panel
          hidden={g.id !== active}
          className="mt-4 scroll-mt-28 overflow-hidden rounded-[28px] border bg-card shadow-[0_1px_2px_rgb(15_17_48/6%),0_10px_28px_-12px_rgb(15_17_48/18%)] sm:mt-5"
        >
          {/* Top: what the group is, beside a picture of it in the app. */}
          <div className="grid grid-cols-1 items-center gap-5 p-4 sm:p-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:p-8">
            <div className="min-w-0 px-1 lg:px-0">
              <h3 className="text-2xl font-extrabold tracking-tight sm:text-[2rem] sm:leading-tight">{g.name}</h3>
              <p className="mt-2 text-lg text-muted-foreground">{g.blurb}</p>
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {g.features.length} features · open one to see how it works
              </p>
            </div>
            <div className="relative flex justify-center rounded-2xl bg-muted px-3 pb-4 pt-10 sm:px-6 sm:pb-6">
              <SampleTag className="absolute right-3 top-3" />
              <GroupPicture id={g.id} />
            </div>
          </div>
          {/* Below: every feature, in two columns from md, one open at a time. */}
          <div className="border-t px-5 pb-2 sm:px-6 md:columns-2 md:gap-x-10 lg:px-8">
            {g.features.map((f) => (
              <Disclosure
                key={f.id}
                id={f.id}
                title={f.title}
                open={openBy[g.id] === f.id}
                onToggle={(isOpen) =>
                  setOpenBy((s) => {
                    const next = isOpen ? f.id : s[g.id] === f.id ? null : s[g.id];
                    return next === s[g.id] ? s : { ...s, [g.id]: next };
                  })
                }
                className="scroll-mt-28 break-inside-avoid"
                summaryClassName="py-3.5"
              >
                <div className="flex flex-col gap-2 pb-4 text-[15px] text-muted-foreground">
                  <p className="text-foreground">{f.does}</p>
                  <p>{f.benefit}</p>
                  <ol className="ml-5 list-decimal space-y-0.5 text-sm">
                    {f.steps.map((st) => (
                      <li key={st}>{st}</li>
                    ))}
                  </ol>
                </div>
              </Disclosure>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- the app pictures, one per group (sample store data) ---------- */

function AppCard({ title, chip, children }: { title: string; chip: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-[440px] overflow-hidden rounded-2xl border bg-card text-sm shadow-[var(--daylight-shadow)]">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 font-extrabold">
        <span>{title}</span>
        {chip}
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </div>
  );
}

type Tone = "plain" | "ok" | "warn" | "bad";
function Chip({ tone = "plain", children }: { tone?: Tone; children: React.ReactNode }) {
  const tones: Record<Tone, string> = {
    plain: "bg-muted text-foreground",
    ok: "bg-[var(--daylight-ok-soft)] text-[var(--daylight-ok-ink)]",
    warn: "bg-[var(--daylight-warn-soft)] text-[var(--daylight-warn-ink)]",
    bad: "bg-[var(--daylight-bad-soft)] text-[var(--daylight-bad-ink)]",
  };
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-micro font-bold", tones[tone])}>{children}</span>;
}

function Btn({ alt = false, children }: { alt?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold",
        alt ? "bg-muted text-foreground" : "bg-foreground text-background",
      )}
    >
      {children}
    </span>
  );
}

function Line({
  art,
  tint,
  title,
  sub,
  end,
}: {
  art: React.ComponentProps<typeof ProductTile>["art"];
  tint: React.ComponentProps<typeof ProductTile>["tint"];
  title: string;
  sub: string;
  end?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProductTile art={art} tint={tint} className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <b className="block truncate">{title}</b>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </div>
      {end}
    </div>
  );
}

function GroupPicture({ id }: { id: string }) {
  switch (id) {
    case "sell":
      return (
        <AppCard title="What shoppers ask for" chip={<Chip>This week</Chip>}>
          <Line art="kurta" tint="indigo" title="Kurta in XXL" sub="Asked 14 times · not in your catalogue" end={<Btn>Add size</Btn>} />
          <Line art="scarf" tint="rose" title="Silk dupatta, maroon" sub="Asked 9 times · out of stock" end={<Btn>Restock</Btn>} />
          <Line
            art="bottle"
            tint="leaf"
            title="“Is the hair oil safe for kids?”"
            sub="No answer yet · suggested answer ready"
            end={<Btn alt>Review</Btn>}
          />
        </AppCard>
      );
    case "shelves":
      return (
        <AppCard title="Popular now · A/B test" chip={<Chip tone="ok">Measured</Chip>}>
          <div className="flex gap-2">
            <ProductTile art="bag" tint="marigold" className="size-16 rounded-xl" />
            <ProductTile art="mug" tint="clay" className="size-16 rounded-xl" />
            <ProductTile art="scarf" tint="rose" className="size-16 rounded-xl" />
          </div>
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">Why these:</b> most added to cart this week, in stock in every size
          </p>
          <Meter label="Version A · by sales" value="Added to cart 4.1%" pct={82} />
          <Meter label="Version B · by new arrivals" value="Added to cart 2.9%" pct={58} faint />
          <div className="flex justify-end">
            <Btn>Keep version A</Btn>
          </div>
        </AppCard>
      );
    case "run":
      return (
        <AppCard title="Inventory" chip={<Chip tone="warn">Needs attention · 3</Chip>}>
          <Line art="kurta" tint="indigo" title="Indigo kurta, XL" sub="3 left · runs out in about 6 days" end={<Chip tone="bad">Low</Chip>} />
          <Line art="mug" tint="clay" title="Terracotta chai mug" sub="No sale in 41 days" end={<Chip tone="warn">Slow</Chip>} />
          <Line art="bottle" tint="leaf" title="Amla hair oil 200 ml" sub="12 left · reorder suggested" end={<Chip tone="bad">Low</Chip>} />
          <div className="flex flex-wrap justify-end gap-2">
            <Btn alt>Suggest markdown</Btn>
            <Btn>Print purchase order</Btn>
          </div>
        </AppCard>
      );
    case "catalogue":
      return (
        <AppCard title="Fix with AI" chip={<Chip>Review before saving</Chip>}>
          <Line art="kurta" tint="indigo" title="Product title" sub="Missing fabric and size range" />
          <p className="leading-relaxed">
            <del className="rounded bg-[var(--daylight-bad-soft)] px-1 text-[var(--daylight-bad-ink)]">Blue Kurta New</del>
            <br />
            <ins className="rounded bg-[var(--daylight-ok-soft)] px-1 text-[var(--daylight-ok-ink)] no-underline">Indigo Hand-Block Cotton Kurta, S–XL</ins>
          </p>
          <p className="text-xs text-muted-foreground">Written with your writing profile: warm, short, no exclamation marks</p>
          <div className="flex justify-end gap-2">
            <Btn alt>Edit</Btn>
            <Btn>Apply · undo any time</Btn>
          </div>
        </AppCard>
      );
    case "content":
      return (
        <AppCard title="Blog ideas" chip={<Chip>3 new</Chip>}>
          <Line
            art="bag"
            tint="marigold"
            title="How to wash hand-block prints"
            sub="People search this before buying · fits your Care page"
          />
          <Line art="scarf" tint="rose" title="Diwali gifting under ₹2,000" sub="Seasonal · links 6 of your products" />
          <Line art="bottle" tint="leaf" title="Bagru vs Sanganeri prints" sub="Builds trust in your craft story" />
          <div className="flex justify-end">
            <Btn>Write draft</Btn>
          </div>
        </AppCard>
      );
    default:
      return null;
  }
}

function Meter({ label, value, pct, faint = false }: { label: string; value: string; pct: number; faint?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <b>{label}</b>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <i className={cn("block h-full rounded-full", faint ? "bg-border" : "bg-foreground")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
