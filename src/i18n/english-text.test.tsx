// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import golden from "./__fixtures__/english-chrome.golden.json";
import en from "../../messages/en.json";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false, logout: () => {} }),
}));

import { FooterView } from "@/components/shared/footer";
import { HeaderNav } from "@/components/shared/header-nav";
import { headerLabels } from "@/components/shared/header";
import { LaunchFooterView, LaunchTopBarView } from "@/components/marketing/launch/launch-chrome";
import { PublicNotFoundBody } from "@/components/marketing/public-not-found";

/*
 * The English page text must be exactly what it was before the chrome strings moved into messages/en.json.
 * The golden file was captured by rendering the pre-SEO-4 components (Footer, HeaderNav, LaunchTopBar,
 * LaunchFooter, PublicNotFoundMain) and keeping every text node plus every aria-label and title attribute,
 * in document order. The year is substituted: the golden holds {YEAR}.
 */

const tr = (namespace: string) => createTranslator({ locale: "en", messages: en, namespace: namespace as never }) as (key: string, values?: Record<string, string | number>) => string;

/** Every text node, then every aria-label and title, one per line. */
function text(html: string): string {
  const attrs = [...html.matchAll(/(aria-label|title)="([^"]*)"/g)].map((m) => `@${m[1]}=${m[2]}`);
  const nodes = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "\u0001")
    .split("\u0001")
    .map((s) => s.trim())
    .filter(Boolean)
    // React escapes the apostrophe; the browser shows the same character.
    .map((s) => s.replace(/&#x27;/g, "'"));
  return [...nodes, ...attrs].join("\n");
}
const year = (s: string) => s.replace(String(new Date().getFullYear()), "{YEAR}");
const cta = { label: "Get started", href: "/auth" };

describe("the English chrome renders the same text as before the move to messages/en.json", () => {
  it("footer", () => {
    expect(year(text(renderToStaticMarkup(<FooterView t={tr("Footer")} commonT={tr("Common")} />)))).toBe(golden.footer);
  });
  it("header (desktop nav, language chip, sign in, CTA)", () => {
    const labels = headerLabels(tr("Nav"), tr("Common"));
    expect(text(renderToStaticMarkup(<HeaderNav cta={cta} labels={labels} />))).toBe(golden.headerNav);
  });
  it("minimal header", () => {
    const labels = headerLabels(tr("Nav"), tr("Common"));
    expect(text(renderToStaticMarkup(<HeaderNav minimal cta={cta} labels={labels} />))).toBe(golden.headerNavMinimal);
  });
  it("launch top bar, with and without Back", () => {
    expect(text(renderToStaticMarkup(<LaunchTopBarView t={tr("Launch")} commonT={tr("Common")} />))).toBe(golden.topBar);
    expect(text(renderToStaticMarkup(<LaunchTopBarView back t={tr("Launch")} commonT={tr("Common")} />))).toBe(golden.topBarBack);
  });
  it("launch footer", () => {
    expect(year(text(renderToStaticMarkup(<LaunchFooterView footerT={tr("Footer")} t={tr("Launch")} />)))).toBe(golden.launchFooter);
  });
  it("public 404", () => {
    expect(text(renderToStaticMarkup(<PublicNotFoundBody t={tr("NotFound")} />))).toBe(golden.notFound);
  });
});

describe("the strings the static render cannot show (the open mobile menu and the signed-in menu)", () => {
  it("are the English they always were", () => {
    const labels = headerLabels(tr("Nav"), tr("Common"));
    expect(labels).toEqual({
      homeAria: "Peakhour.ai home",
      primaryAria: "Primary",
      navLinks: { commerce: "Commerce", content: "Content", growth: "Growth", support: "Support", presence: "Presence", peaks: "Peaks", pricing: "Pricing" },
      signIn: "Sign in",
      signOut: "Sign out",
      dashboard: "Dashboard",
      settings: "Settings",
      userMenu: "User menu",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      languageChip: "English",
      languageChipShort: "EN",
      languageMore: "· more soon",
      languageTooltip: "Available in English; more languages coming",
    });
  });
});
