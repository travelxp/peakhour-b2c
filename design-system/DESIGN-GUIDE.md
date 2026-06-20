# Peakhour — Design Guide

The visual system behind `peakhour-b2c`. Tokens are the contract: every component reads CSS custom-property slots, so the whole product re-skins by swapping the token layer. Open **`Peakhour-Themes.html`** in this folder for the live, switchable reference.

---

## 1. Brand POV — "Solar / Peak"
Warmth, used with discipline. A deep **warm ink** (never pure black), warm paper neutrals, and **one brave accent — Peak Amber** — carried by the logo, the "Peaks" currency, focus states, and key moments. Cold indigo "AI-tech" is deliberately avoided. Premium = space + restraint + one confident color.

## 2. Color tokens (light)
Authoring uses the shadcn slot names; brand truth is in OKLCH.

| Token | Value (OKLCH) | Role |
|---|---|---|
| `--brand` | `0.77 0.146 67` | Peak Amber — accent, focus, Peaks |
| `--brand-strong` | `0.66 0.156 50` | Ember — hovers, gradients |
| `--brand-gold` | `0.86 0.13 88` | Sun Gold — highlights |
| `--background` | `0.985 0.007 78` | warm paper |
| `--foreground` | `0.205 0.014 58` | warm ink |
| `--primary` | `0.205 0.014 58` | primary actions = ink (premium, high-contrast) |
| `--muted-foreground` | `0.52 0.016 62` | supporting text |
| `--border` | `0.9 0.011 78` | hairline |
| `--ring` | `var(--brand)` | focus glows amber |
| `--destructive` | `0.585 0.2 27` | warm red |

Full light + dark sets live in `src/app/globals.css` (`:root` / `.dark`). Data-viz ramp is warm-led: amber → teal → terracotta → gold → plum (`--chart-1…5`).

## 3. Themes (token overlays)
Same components, different token set. Switch via `:root[data-theme="…"]`.

| Theme | Type | Character |
|---|---|---|
| **Solar / Peak** | flagship (default) | warm amber, disciplined, premium |
| **Tidal / Deep** | direction | cool ocean teal, technical, calm |
| **Noir / Editorial** | direction | high-contrast ink, serif display, one sharp red |
| **Diwali** | seasonal | jewel plum, marigold, magenta |
| **Christmas** | seasonal | snow, pine, cranberry |

Seasonal/country themes are scheduled by the CMS (see `CLAUDE-CODE-CMS-DYNAMIC.md`).

## 4. Typography
| Family | Token | Use |
|---|---|---|
| Sora | `--font-display` | headlines, hero, big numbers |
| Plus Jakarta Sans / Geist | `--font-sans` | body, UI |
| Space Grotesk | `--font-numeric` | metrics, Peaks currency, data |
| Geist Mono | `--font-mono` | code, IDs, logs |

Scale (rem): `2xs .625 · xs .75 · sm .875 · base 1 · lg 1.125 · xl 1.375 · 2xl 1.625 · 3xl 2 · 4xl 2.5 · 5xl 3.25 · 6xl 4.25 · 7xl 5.25`. Headings run tight (`tracking -0.02em`); display goes tighter (`-0.03em`). Body stays warm and very legible (`line-height 1.55`).

## 5. Spacing, radius, elevation
- **Spacing:** 4px grid. Default card padding/gap `24px`; section rhythm `80px`; hero `96px`.
- **Radius:** derived from one `--radius` (10px) — `sm 6 · md 8 · lg 10 · xl 14 · 2xl 18`. Retune one number, everything stays in proportion. (Noir overrides `--radius` to 4px for a sharp editorial feel; Tidal to 12px.)
- **Elevation:** restrained shadow ladder (`xs → lg`). Borders do most of the separation; shadows are a secondary cue. Surfaces lift on hover (`sm → md`).
- **Focus:** `3px` ring at `--ring` (amber), 50% mixed.

## 6. Usage rules
- One brave accent. Don't introduce a second saturated color per surface — let amber lead.
- Primary actions are **ink** in light, **amber** in dark. Keep that inversion.
- Use `--brand-soft` for amber tints/chips; `--brand-ink` for text **on** amber.
- Dark dramatic sections use `--surface-ink`; the logo sits on the dark tile.
- Charts follow the warm-led ramp; don't recolor series ad hoc.
- Never hard-code a hex in a component — read the slot, so themes keep working.
