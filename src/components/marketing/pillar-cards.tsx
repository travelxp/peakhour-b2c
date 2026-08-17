"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { PILLAR_ORDER, PILLARS } from "@/lib/pillars";
import { cn } from "@/lib/utils";

/**
 * The five pillars as one row of tall panels that open in place.
 *
 * The constraint driving the shape: all five names have to stay readable at
 * all times AND the whole set has to fit one desktop screen, which rules out
 * both a 3+2 grid (two rows) and a classic accordion (names stack). So the row
 * is a flex track where the open panel takes ~2.7 shares and the rest hold
 * ~0.82 — enough width for a name at every state, never enough for a second
 * row.
 *
 * Three ways in, because a visitor on a laptop, on a phone and on a keyboard
 * each expect a different one: pointer hover (mouse only — `pointerType` is
 * checked so a tap can't also leave a panel stuck open behind the one the
 * visitor actually chose), click/tap, and focus. Click PINS, so a mouse user
 * who opens a panel and moves the cursor across it to read doesn't lose it.
 *
 * Below `lg` the same component is a vertical accordion: the row would give
 * each panel ~110px, which is narrower than the words inside it.
 */

/** Panels this tall fit the row plus its heading in one ~900px viewport. */
const ROW_HEIGHT = "lg:h-[28rem]";

export function PillarCards() {
  // Two inputs, one derived state. `pinned` outranks `hovered` so moving the
  // cursor off a panel that was deliberately opened doesn't close it.
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = pinned ?? hovered;

  return (
    <div
      className={cn("flex flex-col gap-3 lg:flex-row", ROW_HEIGHT)}
      // Only a real mouse leaving the track clears the hover. Touch never sets
      // it in the first place, and a keyboard user is handled by focus below.
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHovered(null);
      }}
    >
      {PILLAR_ORDER.map((slug, i) => {
        const pillar = PILLARS[slug];
        const Icon = pillar.icon;
        const isActive = active === i;
        const isDimmed = active !== null && !isActive;
        const detailsId = `pillar-detail-${slug}`;

        return (
          <div
            key={slug}
            id={slug}
            data-active={isActive ? "true" : undefined}
            className={cn(
              // `u-rail` is the shared gold hairline, and it reads
              // `data-active` — so an open panel wears the same marker the
              // dashboard nav uses for the page you're on.
              "u-rail group relative flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border bg-background",
              "transition-[flex-grow,border-color,box-shadow] duration-500 ease-brand motion-reduce:transition-none",
              // `basis-0` rather than `flex-1`: the shorthand and the `grow-*`
              // longhand below would both set flex-grow, and which one wins
              // would come down to stylesheet order.
              "lg:basis-0 lg:justify-end",
              isActive
                ? "border-brand/55 shadow-lg shadow-brand/10 lg:grow-[2.7]"
                : isDimmed
                  ? "lg:grow-[0.82]"
                  : "lg:grow",
            )}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setHovered(i);
            }}
          >
            <CardVeil active={isActive} />

            <button
              type="button"
              aria-expanded={isActive}
              aria-controls={detailsId}
              onClick={() => setPinned((p) => (p === i ? null : i))}
              onFocus={() => setHovered(i)}
              className="relative flex w-full min-w-0 items-start gap-3 rounded-2xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset lg:flex-col lg:gap-3.5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-inner">
                <Icon className="size-5 text-brand-contrast" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold tracking-tight">{pillar.name}</span>
                {/* The one line a collapsed panel carries. It folds away while
                    another panel is open, because at ~110px it would wrap to
                    six lines and stop being scannable. */}
                <span
                  className={cn(
                    "mt-1.5 block overflow-hidden text-sm text-muted-foreground transition-[max-height,opacity,margin] duration-500 ease-brand motion-reduce:transition-none",
                    isDimmed ? "lg:mt-0 lg:max-h-0 lg:opacity-0" : "max-h-40 opacity-100",
                  )}
                >
                  {pillar.valueProp}
                </span>
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "mt-2 size-4 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none lg:hidden",
                  isActive && "rotate-180",
                )}
              />
            </button>

            {/* 0fr → 1fr is the only height transition that runs from
                content-sized to zero without a hardcoded max-height, which
                would clip whichever pillar ends up tallest. */}
            <div
              id={detailsId}
              // The collapsed detail stays in the DOM so it can transition, so
              // it also has to leave the a11y tree and the tab order —
              // `aria-expanded={false}` on the trigger promises it isn't there.
              inert={!isActive}
              className={cn(
                "relative grid transition-[grid-template-rows,opacity] duration-500 ease-brand motion-reduce:transition-none",
                isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-col gap-4 px-5 pb-5">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-label">
                      Key capabilities
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {pillar.features.map((f) => (
                        <li key={f.title} className="flex items-start gap-2 text-sm">
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-brand"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span className="text-muted-foreground">{f.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-label">
                      Works with
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {pillar.channels.map((c) => (
                        <li
                          key={c}
                          className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* The payoff — one outcome, stated as the visitor's result
                      rather than as another product feature. */}
                  <div className="rounded-xl border border-brand/25 bg-brand-soft/40 px-3.5 py-3">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-label">
                      The outcome
                    </p>
                    <p className="mt-1.5 text-sm font-medium">{pillar.outcomes[0]}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-ink">
                      {pillar.freeLabel}
                    </span>
                    <Link
                      href={"/" + slug}
                      className="group/link inline-flex items-center gap-1.5 text-sm font-bold text-brand-label hover:underline"
                    >
                      Explore {pillar.name}
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover/link:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden
                      />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The empty upper half of a tall panel, filled with the same concentric-ridge
 * motif the hero orbit and the Peakhour mark carry — so the whitespace reads
 * as brand rather than as unfinished layout. Desktop only: below `lg` the
 * panels are content-height and there is no space to fill.
 */
function CardVeil({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 hidden h-1/2 transition-opacity duration-500 ease-brand motion-reduce:transition-none lg:block",
        active ? "opacity-100" : "opacity-60",
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, var(--brand) 14%, transparent), transparent 70%)",
        }}
      />
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 size-full"
        focusable="false"
      >
        <g fill="none" stroke="var(--brand)" strokeLinecap="round" opacity="0.3">
          <circle cx="50" cy="4" r="16" strokeWidth="0.5" />
          <circle cx="50" cy="4" r="26" strokeWidth="0.5" strokeDasharray="2 4" />
          <circle cx="50" cy="4" r="36" strokeWidth="0.5" strokeDasharray="1 5" />
        </g>
      </svg>
    </div>
  );
}
