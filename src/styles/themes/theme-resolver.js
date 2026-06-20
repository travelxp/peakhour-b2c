/* ===========================================================================
   Peakhour · theme-resolver.js
   Tiny, dependency-free runtime that turns the registry + (region, date) into
   an active theme: loads the theme's CSS once and sets <html data-theme>.
   The whole design system re-skins because every component reads token slots.

   Usage (client or SSR-hydrated):
     import { applyTheme, resolveTheme } from './theme-resolver.js';
     applyTheme({ region: 'IN', dark: false });           // auto by today's date
     applyTheme({ themeId: 'diwali' });                   // force a specific theme

   SSR: call resolveTheme() on the server and render
     <html data-theme="diwali"> + the matching <link> in <head>
     so there is zero flash. This client file is the progressive-enhancement
     fallback and the live theme switcher.
   =========================================================================== */

const DEFAULT_REGISTRY_URL = "tokens/themes/theme-registry.json";
let REGISTRY = null;

export async function loadRegistry(url = DEFAULT_REGISTRY_URL) {
  if (REGISTRY) return REGISTRY;
  REGISTRY = await fetch(url).then((r) => r.json());
  return REGISTRY;
}

/* Pure: given a registry, region and date, return the winning theme id. */
export function resolveTheme(registry, { region = "*", date = new Date() } = {}) {
  const day = (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10);
  const active = (registry.schedule || [])
    .filter((s) => s.status === "approved")
    .filter((s) => s.start <= day && day <= s.end)
    .filter((s) => s.regions.includes(region) || s.regions.includes("*"))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return active.length ? active[0].theme : (registry.default || "solar");
}

const loadedHrefs = new Set();
function ensureCss(href) {
  if (!href || loadedHrefs.has(href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.peakhourTheme = "1";
  document.head.appendChild(link);
  loadedHrefs.add(href);
}
function ensureFonts(families = []) {
  if (!families.length) return;
  const q = families.map((f) => "family=" + f.replace(/ /g, "+") + ":wght@400;600;700").join("&");
  ensureCss("https://fonts.googleapis.com/css2?" + q + "&display=swap");
}

/* Apply a theme to the document. Loads its CSS + fonts, sets data-theme. */
export async function applyTheme({ region = "*", date = new Date(), themeId = null, dark = false, registryUrl } = {}) {
  const reg = await loadRegistry(registryUrl);
  const id = themeId || resolveTheme(reg, { region, date });
  const meta = (reg.themes || []).find((t) => t.id === id) || reg.themes.find((t) => t.id === reg.default);
  ensureCss(meta.href);
  ensureFonts(meta.fonts);
  const root = document.documentElement;
  root.setAttribute("data-theme", meta.id);
  root.classList.toggle("dark", !!dark && meta.supportsDark);
  root.dispatchEvent(new CustomEvent("peakhour:theme", { detail: { id: meta.id, dark } }));
  return meta.id;
}
