"use client";

/**
 * <ThemeSwitcher> — a floating, test-only control to flip the active brand
 * theme without DevTools or editing the registry schedule.
 *
 * WHY THIS EXISTS. Production picks the theme server-side from the visitor's
 * region + date (resolveTheme in (site)/layout.tsx). That's correct for real
 * users but useless for QA — you can't see Tidal/Noir/Diwali/Christmas on
 * feature-2 without spoofing a geo header or moving a schedule window over
 * today. This widget just sets <html data-theme> directly (all five themes
 * are already bundled in globals.css, so it's a pure attribute flip — no CSS
 * injection, no reload) and persists the choice so it survives navigation.
 *
 * SCOPE. Renders nothing when NEXT_PUBLIC_VERCEL_ENV === "production" — same
 * gate as <CronToolbar>. It is a token-layer testing aid, not a user feature;
 * the real in-app/CMS switcher is a separate effort (CLAUDE-CODE-CMS-DYNAMIC).
 *
 * Dark mode stays owned by next-themes (.dark on <html>); the toggle here just
 * proxies setTheme() so QA can check each theme's light + dark slots in one place.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Palette, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import registry from "@/styles/themes/theme-registry.json";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { isProductionEnv } from "@/lib/env";

const STORAGE_KEY = "peakhour:theme-override";
const AUTO = "auto";

type ThemeMeta = { id: string; label: string };
const THEMES = (registry.themes ?? []) as ThemeMeta[];

/** Read the persisted override (client only); null/invalid → "Auto". */
function readStoredOverride(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && THEMES.some((t) => t.id === stored) ? stored : null;
}

const noopSubscribe = () => () => {};

/**
 * false during SSR + the first (hydration) render, true thereafter — without a
 * setState-in-effect. Lets us render null on the server (the switcher is
 * client-only) and the real control once hydrated, with no hydration mismatch.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ThemeSwitcher() {
  // Hooks run unconditionally; the prod gate decides render, not mount.
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  // null = "Auto" (defer to whatever the server resolver stamped on <html>).
  // Seeded once from storage on the client; the !hydrated render below outputs
  // null, so this client-only seed never causes a hydration mismatch.
  const [override, setOverride] = useState<string | null>(readStoredOverride);

  // Sync the chosen override onto <html> (external DOM, no setState). On "Auto"
  // (null) we leave the server-stamped data-theme untouched.
  useEffect(() => {
    if (override) document.documentElement.setAttribute("data-theme", override);
  }, [override]);

  if (isProductionEnv() || !hydrated) return null;

  function applyTheme(value: string) {
    if (value === AUTO) {
      window.localStorage.removeItem(STORAGE_KEY);
      setOverride(null);
      // The server-resolved theme is the source of truth for "auto"; a reload
      // lets resolveTheme() reassert it (region + today's date) cleanly.
      window.location.reload();
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value);
    setOverride(value);
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div
      className="fixed bottom-3 left-3 z-60 flex items-center gap-1.5 rounded-md border border-dashed bg-background/90 px-2 py-1.5 text-xs shadow-sm backdrop-blur"
      aria-label="Theme switcher (preview + local dev only)"
    >
      <Palette className="size-3.5 text-muted-foreground" />
      <Select value={override ?? AUTO} onValueChange={applyTheme}>
        <SelectTrigger size="sm" className="h-7 w-37.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO}>Auto (region + date)</SelectItem>
          {THEMES.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        title={isDark ? "Switch to light" : "Switch to dark"}
        aria-label={isDark ? "Switch to light" : "Switch to dark"}
      >
        {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </Button>
    </div>
  );
}
