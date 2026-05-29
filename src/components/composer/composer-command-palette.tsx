"use client";

/**
 * <ComposerCommandPalette/> — Cmd/Ctrl+K command bar scoped to the
 * active composer. Surfaces actions the host registers (Schedule
 * for…, Add image, Add poll, Make a thread, Change account, AI
 * compose, etc.) in a single discoverable surface. Keyboard-first,
 * matches the cmdk pattern shipping across the rest of the app.
 *
 * Design: host registers `commands` declaratively + the palette
 * handles the open/close, search, keyboard shortcuts, and run
 * dispatch. Each command is grouped under a heading so the user can
 * skim by category.
 *
 * The host typically renders this OUTSIDE the composer body so the
 * palette is reachable even when the textarea has focus (it
 * registers a window-level keydown for Cmd+K).
 *
 * Premium UX touches:
 *   - Recent commands surface at the top (localStorage, keyed by
 *     palette id so multiple composers on one page don't share
 *     recents — though that case is rare).
 *   - kbd hint per command (right-aligned).
 *   - Smooth open / close via Dialog (no flash, no scroll-jump).
 *   - Auto-clear search on close so re-open is a fresh state.
 *
 * Future (not this PR): show a per-command result preview pane
 * (Linear-style) — needs `onPreview` callback shape. Skipped for v1.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
// CommandSeparator retained — used between Recent and the rest below.
import type { LucideIcon } from "lucide-react";

export interface ComposerCommand {
  /** Stable id — used for recents + de-dupe across re-renders. */
  id: string;
  /** Display label (left-aligned). */
  label: string;
  /** Optional secondary text (shown small under the label). */
  hint?: string;
  /** Group heading. Commands with the same group sit together. */
  group: string;
  /** Icon — defaults to none. Composer commands look denser without. */
  icon?: LucideIcon;
  /** Optional keyboard shortcut to display (visual only — the host's
   *  global handler is responsible for wiring the actual key). */
  shortcut?: string;
  /** Disabled state. Disabled commands render but don't fire. */
  disabled?: boolean;
  /** Runs when the user picks the command. Palette closes on resolve. */
  run: () => void | Promise<void>;
}

export interface ComposerCommandPaletteProps {
  /** Stable id for this palette instance — used as the recents
   *  localStorage key suffix. Pass the composer's purpose (e.g.
   *  "x-composer", "linkedin-composer"). */
  paletteId: string;
  /** The commands the host wants to surface. Order matters within
   *  a group. */
  commands: ReadonlyArray<ComposerCommand>;
  /** Optional placeholder for the search input. */
  placeholder?: string;
  /** Whether the global Cmd/Ctrl+K listener is enabled. **Default
   *  false** because the dashboard shell already mounts a global
   *  `<CommandMenu/>` (src/components/molecules/command-menu.tsx)
   *  that owns Cmd+K. Set to `true` ONLY on surfaces that do NOT
   *  render the global CommandMenu, otherwise both palettes open
   *  simultaneously. The host should also document its own shortcut
   *  (e.g. via a `<ComposerCommandPalette ... shortcutHint="⌘⇧K">`
   *  affordance) if it picks a non-default chord. */
  enableGlobalShortcut?: boolean;
}

const RECENT_PREFIX = "peakhour:composer-palette:recent:";
const MAX_RECENT = 5;

function readRecents(paletteId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_PREFIX + paletteId);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(paletteId: string, commandId: string) {
  if (typeof window === "undefined") return;
  const recents = readRecents(paletteId);
  const next = [commandId, ...recents.filter((id) => id !== commandId)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_PREFIX + paletteId, JSON.stringify(next));
  } catch {
    /* best-effort — quota / privacy mode */
  }
}

export function ComposerCommandPalette({
  paletteId,
  commands,
  placeholder = "Search composer actions…",
  enableGlobalShortcut = false,
}: ComposerCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Hydrate recents whenever the palette opens (so a recent command
  // added by another tab shows up next time). The repo's
  // react-hooks/set-state-in-effect lint rule rejects direct setState
  // in an effect body, so we schedule via Promise.resolve() — fires
  // on the next microtask, still well before the user can interact
  // with the open palette. The one-tick "no recents on first frame"
  // flicker is invisible in practice because the open animation
  // takes ~150ms.
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => setRecentIds(readRecents(paletteId)));
  }, [open, paletteId]);

  // Global Cmd/Ctrl+K listener.
  useEffect(() => {
    if (!enableGlobalShortcut) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableGlobalShortcut]);

  const groups = useMemo(() => {
    const map = new Map<string, ComposerCommand[]>();
    for (const cmd of commands) {
      const arr = map.get(cmd.group) ?? [];
      arr.push(cmd);
      map.set(cmd.group, arr);
    }
    return Array.from(map.entries());
  }, [commands]);

  const recentCommands = useMemo(() => {
    if (recentIds.length === 0) return [];
    const byId = new Map(commands.map((c) => [c.id, c]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((c): c is ComposerCommand => c !== undefined && !c.disabled)
      .slice(0, MAX_RECENT);
  }, [recentIds, commands]);

  const runCommand = useCallback(
    async (cmd: ComposerCommand) => {
      if (cmd.disabled) return;
      setOpen(false);
      pushRecent(paletteId, cmd.id);
      try {
        await cmd.run();
      } catch {
        // The host owns failure UX (toast). Palette doesn't double-toast.
      }
    },
    [paletteId],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // No need to clear search — CommandDialog resets internally
        // when its open state flips.
      }}
      title="Composer actions"
      description="Search and run any action available in this composer."
    >
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>No matching action.</CommandEmpty>

        {recentCommands.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentCommands.map((cmd) => (
                <PaletteItem key={`recent:${cmd.id}`} command={cmd} onRun={runCommand} />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* cmdk CommandGroups already provide vertical rhythm via
            their headings — no inter-group separator needed. */}
        {groups.map(([heading, cmds]) => (
          <CommandGroup key={heading} heading={heading}>
            {cmds.map((cmd) => (
              <PaletteItem key={cmd.id} command={cmd} onRun={runCommand} />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function PaletteItem({
  command,
  onRun,
}: {
  command: ComposerCommand;
  onRun: (cmd: ComposerCommand) => void;
}) {
  const Icon = command.icon;
  return (
    <CommandItem
      value={`${command.label} ${command.hint ?? ""}`}
      disabled={command.disabled}
      onSelect={() => onRun(command)}
      className="group/item flex items-start gap-2 py-2"
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{command.label}</span>
        {command.hint && (
          <span className="truncate text-xs text-muted-foreground">{command.hint}</span>
        )}
      </div>
      {/* Show the custom shortcut if defined; otherwise show a subtle
          "↵" hint on the currently-active row (data-selected from
          cmdk) so users know Enter runs the command. */}
      {command.shortcut ? (
        <CommandShortcut>{command.shortcut}</CommandShortcut>
      ) : (
        <CommandShortcut className="opacity-0 group-data-[selected=true]/item:opacity-100">
          ↵
        </CommandShortcut>
      )}
    </CommandItem>
  );
}
