"use client";

/**
 * <AiComposeToolbar/> — chip-rail of AI rewrite actions for any
 * composer surface. Sits above (or below) the host's `<Textarea/>`
 * and exposes a single uniform handler interface — the host owns the
 * network call.
 *
 * Buttons (left-to-right, lucide icons):
 *   Compose · Redraft · Shorten · Lengthen · Tone · Quote · Disclosure
 *
 * Each button:
 *   - Disabled when `text.length === 0` (except Compose, which
 *     generates from nothing).
 *   - Shows a spinning loader while its op is in flight (per-op
 *     loading flag — the user can fire Quote while Shorten is still
 *     running).
 *   - Tooltip explains the op in plain English (NO marketing copy
 *     today, NO SME pass yet — that's [[project_sme_cta_vocabulary]]).
 *
 * The Tone button opens a small popover with 4 preset tones (Punchier,
 * Warmer, More formal, Storytelling) — host's onAiAction receives the
 * choice via `extras.targetTone`. Hosts that want a free-text tone
 * box can pass `customTones` to extend the list.
 *
 * Visual design: matches the Cron Toolbar band convention in this
 * repo (border-dashed, muted background, sits as its own row above
 * the heading). Doesn't try to dock to the textarea — that's the
 * host's layout call.
 */

import { useState } from "react";
import {
  Sparkles,
  Wand2,
  Minimize2,
  Maximize2,
  Mic2,
  Quote,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AiActionContext, PlatformKey, RewriteOp } from "./types";

// ── Op metadata ──────────────────────────────────────────
// Single source of truth for label / icon / disabled-when-empty rules.
// Tone is handled separately because it needs a popover.

interface OpMeta {
  op: RewriteOp;
  label: string;
  icon: typeof Sparkles;
  tooltip: string;
  requiresText: boolean;
}

const OPS: OpMeta[] = [
  {
    op: "compose",
    label: "Compose",
    icon: Sparkles,
    tooltip: "Generate a fresh draft from scratch.",
    requiresText: false,
  },
  {
    op: "redraft",
    label: "Redraft",
    icon: Wand2,
    tooltip: "Rewrite the current draft with a different angle.",
    requiresText: true,
  },
  {
    op: "shorten",
    label: "Shorten",
    icon: Minimize2,
    tooltip: "Trim the draft down (target ~65% of current length).",
    requiresText: true,
  },
  {
    op: "lengthen",
    label: "Lengthen",
    icon: Maximize2,
    tooltip: "Expand the draft with more context (target ~140% of length).",
    requiresText: true,
  },
];

// Quote + Disclosure are inserts (not rewrites of the whole text) so
// they live in a small "Insert" group on the right.
const INSERT_OPS: OpMeta[] = [
  {
    op: "quote",
    label: "Quote",
    icon: Quote,
    tooltip: "Insert a pull-quote suggestion at the caret.",
    requiresText: true,
  },
  {
    op: "disclosure",
    label: "Disclosure",
    icon: ShieldCheck,
    tooltip: "Insert a sponsorship / disclosure boilerplate.",
    requiresText: false,
  },
];

interface ToneChoice {
  key: string;
  label: string;
  hint: string;
}

const DEFAULT_TONES: ToneChoice[] = [
  { key: "punchier", label: "Punchier", hint: "Shorter sentences, stronger verbs." },
  { key: "warmer", label: "Warmer", hint: "More human, less corporate." },
  { key: "formal", label: "More formal", hint: "Tighter syntax, no contractions." },
  { key: "storytelling", label: "Storytelling", hint: "Open with a scene, build a narrative." },
];

export interface AiComposeToolbarProps {
  /** Full current composer text. The toolbar reads this to gate
   *  requiresText buttons; passed verbatim to onAiAction. */
  text: string;
  /** Platform the host composer targets. Threaded through the AI
   *  handler so the backend picks the right write-skill. */
  platform: PlatformKey;
  /** Single handler the host wires to its AI API (today the consumer
   *  in PR #3/#4 will wire to a new POST /v1/content/rewrite endpoint;
   *  the foundation primitive doesn't care — handler shape is the
   *  contract). Must return the NEW full composer text so the host
   *  can call its setText after the toolbar fires onAiAction. */
  onAiAction: (ctx: AiActionContext) => Promise<string>;
  /** Optional extra tones (appended to DEFAULT_TONES). Lets a host
   *  expose org-configured tones without losing the four defaults. */
  customTones?: ToneChoice[];
  /** Hide individual ops. Useful for surfaces where e.g. "Compose"
   *  doesn't make sense (a reply drawer pre-filled with a parent). */
  hideOps?: ReadonlyArray<RewriteOp>;
  /** Compact variant — icon-only buttons, no labels. For tight
   *  layouts (mobile, sidebar). */
  compact?: boolean;
  className?: string;
}

export function AiComposeToolbar({
  text,
  platform,
  onAiAction,
  customTones,
  hideOps,
  compact,
  className,
}: AiComposeToolbarProps) {
  // Per-op loading state so multiple ops can run in parallel without
  // disabling each other.
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [tonePopoverOpen, setTonePopoverOpen] = useState(false);

  const tones = customTones ? [...DEFAULT_TONES, ...customTones] : DEFAULT_TONES;

  // Shared key helper — used by both fire() and the render's
  // running-flag lookup so the magic string only lives in one place.
  // (If a future render call passes extras to a "primary" op we'd
  // otherwise diverge — caller in render must use runningKey too.)
  function runningKey(op: RewriteOp, extras?: Record<string, unknown>): string {
    return `${op}:${JSON.stringify(extras ?? {})}`;
  }

  async function fire(op: RewriteOp, extras?: Record<string, unknown>) {
    const key = runningKey(op, extras);
    if (running[key]) return;
    setRunning((s) => ({ ...s, [key]: true }));
    try {
      await onAiAction({ op, text, platform, extras });
      // Caller owns the toast for success — different composers will
      // want different copy (e.g. "Draft regenerated" vs "Tone
      // updated"). Toolbar only signals failure (consistent across
      // hosts).
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${op} failed`, { description: msg });
    } finally {
      setRunning((s) => {
        const next = { ...s };
        delete next[key];
        return next;
      });
    }
  }

  const visibleOps = OPS.filter((o) => !hideOps?.includes(o.op));
  const visibleInsertOps = INSERT_OPS.filter((o) => !hideOps?.includes(o.op));
  const showTone = !hideOps?.includes("tone");

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          // Flex-col on narrow viewports so the two visual groups
          // (rewrites + inserts) stack cleanly instead of the previous
          // ml-auto separator pushing inserts off-row on wrap. md:
          // breakpoint becomes the single-row layout.
          "flex flex-col gap-1.5 rounded-md border border-dashed bg-muted/30 px-2 py-1.5",
          "md:flex-row md:flex-wrap md:items-center md:gap-1",
          className,
        )}
        // Generic group role (not toolbar) — we do not implement the
        // WAI-ARIA roving-tabindex toolbar pattern; every chip is its
        // own tab stop, which matches the rest of the cmdk-driven kit.
        role="group"
        aria-label="AI compose actions"
      >
        <div className="flex flex-wrap items-center gap-1">
          <span className="flex items-center gap-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3" />
            {compact ? null : <span>AI</span>}
          </span>
          <span className="text-muted-foreground/40">·</span>

          {/* Primary rewrite ops */}
          {visibleOps.map((meta) => {
            const key = runningKey(meta.op);
            const isRunning = running[key];
            const disabled = isRunning || (meta.requiresText && text.trim().length === 0);
            const Icon = meta.icon;
            return (
              <Tooltip key={meta.op}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => fire(meta.op)}
                    disabled={disabled}
                  >
                    {isRunning ? (
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                    {compact ? null : meta.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{meta.tooltip}</TooltipContent>
              </Tooltip>
            );
          })}

          {/* Tone popover — uses cmdk Command for arrow-key + type-
              ahead navigation, mirroring the rest of the kit. */}
          {showTone && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <Popover open={tonePopoverOpen} onOpenChange={setTonePopoverOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 px-2 text-xs"
                        disabled={text.trim().length === 0}
                      >
                        <Mic2 className="size-3.5" />
                        {compact ? null : "Tone"}
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Rewrite in a different tone.</TooltipContent>
                </Tooltip>
                <PopoverContent align="start" className="w-64 p-0">
                  <div className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Tone
                  </div>
                  <Command className="bg-transparent">
                    <CommandList>
                      <CommandGroup>
                        {tones.map((tone) => {
                          const key = runningKey("tone", { targetTone: tone.key });
                          const isRunning = running[key];
                          return (
                            <CommandItem
                              key={tone.key}
                              value={`${tone.label} ${tone.hint}`}
                              disabled={isRunning}
                              onSelect={() => {
                                setTonePopoverOpen(false);
                                void fire("tone", { targetTone: tone.key });
                              }}
                              className="flex flex-col items-start gap-0.5"
                            >
                              <span className="flex items-center gap-2 font-medium">
                                {isRunning && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}
                                {tone.label}
                              </span>
                              <span className="text-xs text-muted-foreground">{tone.hint}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {/* Insert ops — stack as their own row on mobile, push to the
            right on md+ via the parent's md:flex-row + this group's
            md:ml-auto. */}
        {visibleInsertOps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 md:ml-auto">
            <span className="text-muted-foreground/40">·</span>
            {visibleInsertOps.map((meta) => {
              const key = runningKey(meta.op);
              const isRunning = running[key];
              const disabled = isRunning || (meta.requiresText && text.trim().length === 0);
              const Icon = meta.icon;
              return (
                <Tooltip key={meta.op}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => fire(meta.op)}
                      disabled={disabled}
                    >
                      {isRunning ? (
                        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                      {compact ? null : meta.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{meta.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
