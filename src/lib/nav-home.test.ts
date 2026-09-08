import { describe, it, expect, vi } from "vitest";
import { funnelNav, type NavGroupLike } from "./nav-home";

/**
 * ★★THE RULE UNDER TEST IS "NOTHING IS REMOVED". The plan's instruction for the
 * navigation collapse is "the tool screens KEPT and demoted rather than
 * removed", and the way that breaks is not a crash: a destination simply stops
 * appearing, in a navigation nobody has switched on, so nothing fails and
 * nobody notices until somebody does switch it on and a pillar is gone.
 *
 * A hand-written second list would do that the first time a pillar was added.
 * The partition cannot, and these are what say so.
 */

interface Item {
  href: string;
  label: string;
}

const pillars: NavGroupLike<Item>[] = [
  {
    label: "",
    items: [
      { href: "/dashboard/overview", label: "Overview" },
      { href: "/dashboard/integrations", label: "Integrations" },
      { href: "/dashboard/inbox", label: "Inbox" },
      { href: "/dashboard/content", label: "Content" },
      { href: "/dashboard/ads", label: "Growth" },
      { href: "/dashboard/commerce", label: "Commerce" },
      { href: "/dashboard/presence", label: "Presence" },
      { href: "/dashboard/insights/analytics", label: "Insights" },
      { href: "/dashboard/tasks", label: "Tasks" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
];

const home: Item = { href: "/dashboard/outcomes", label: "Outcomes" };

const hrefs = (groups: NavGroupLike<Item>[]) => groups.flatMap((g) => g.items).map((i) => i.href);

describe("funnelNav", () => {
  it("★★keeps every pillar destination, exactly once", () => {
    const out = hrefs(funnelNav(pillars, home));
    for (const href of hrefs(pillars)) {
      expect(out).toContain(href);
      expect(out.filter((h) => h === href)).toHaveLength(1);
    }
  });

  it("★★sweeps a destination it has never heard of into the tail rather than losing it", () => {
    // The failure a second hand-written list would produce, the first time a
    // pillar was added: the new screen is simply absent, and nothing says so.
    const withNew: NavGroupLike<Item>[] = [
      { label: "", items: [...pillars[0].items, { href: "/dashboard/brand-new", label: "New" }] },
    ];
    const out = funnelNav(withNew, home);
    expect(hrefs(out)).toContain("/dashboard/brand-new");
    // In the TAIL — unassigned means demoted, never promoted into a funnel
    // heading it was never assigned to.
    expect(out[out.length - 1].items.map((i) => i.href)).toContain("/dashboard/brand-new");
  });

  it("leads with the home screen, then the two prerequisites", () => {
    // Connecting is the prerequisite for every answer below it, and a customer
    // waiting on a reply outranks any question about reach.
    const out = funnelNav(pillars, home);
    expect(out[0].label).toBe("");
    expect(out[0].items.map((i) => i.href)).toEqual([
      "/dashboard/outcomes",
      "/dashboard/integrations",
      "/dashboard/inbox",
    ]);
  });

  it("★demotes Overview into the tail rather than deleting it", () => {
    // ★THE WHOLE OF S4-4, AND ITS LIMIT. Overview stops being the first thing a
    // merchant sees; it does not stop existing, because its setup and discovery
    // content has nowhere else to live yet.
    const out = funnelNav(pillars, home);
    expect(out[0].items.map((i) => i.href)).not.toContain("/dashboard/overview");
    expect(out[out.length - 1].items.map((i) => i.href)).toContain("/dashboard/overview");
  });

  it("groups the pillars under the funnel questions", () => {
    const out = funnelNav(pillars, home);
    const byLabel = Object.fromEntries(out.map((g) => [g.label, g.items.map((i) => i.href)]));
    expect(byLabel.Found).toEqual(["/dashboard/presence"]);
    expect(byLabel.Chosen).toEqual(["/dashboard/content", "/dashboard/ads"]);
    expect(byLabel.Convinced).toEqual([
      "/dashboard/insights/analytics",
      "/dashboard/commerce",
    ]);
  });

  it("★has no BOUGHT heading, which is a finding rather than an omission", () => {
    // The other three questions each have tools behind them; the fourth has
    // none — its answer is a figure on the home screen and there is nothing to
    // navigate to. A heading over Commerce would imply Commerce answers "what
    // was it worth", which it does not.
    expect(funnelNav(pillars, home).map((g) => g.label)).not.toContain("Bought");
  });

  it("★passes items through BY REFERENCE, so icons, subitems and gates survive", () => {
    // The real items carry entitlement keys, upsell copy, badge renderers and
    // up to eight subitems. A partition that rebuilt them would drop whichever
    // field it forgot, and the loss would show only under the flag.
    const out = funnelNav(pillars, home);
    const content = out.flatMap((g) => g.items).find((i) => i.href === "/dashboard/content");
    expect(content).toBe(pillars[0].items.find((i) => i.href === "/dashboard/content"));
  });

  it("★★drops a heading with nothing under it rather than showing an empty section", () => {
    // ★A BUILD MUST NOT FAIL BECAUSE A PILLAR WAS RETIRED — and a "Found"
    // heading over empty space tells a merchant a section exists that does not.
    // The grouping names hrefs; a retired or mistyped one simply leaves its
    // question with nothing to answer it, and the question goes with it.
    const withoutPresence: NavGroupLike<Item>[] = [
      { label: "", items: pillars[0].items.filter((i) => i.href !== "/dashboard/presence") },
    ];
    const out = funnelNav(withoutPresence, home);
    expect(out.map((g) => g.label)).not.toContain("Found");
    expect(hrefs(out)).toHaveLength(hrefs(withoutPresence).length + 1);
  });

  it("★★never lists the promoted home twice, even once it is a pillar of its own", () => {
    // ★TODAY Outcomes is promoted from a SUBITEM, so it is not in the pillar
    // list and the exclusion costs nothing. The moment it becomes a top-level
    // pillar it would appear in the lead AND in the tail — the "exactly once"
    // rule breaking silently on the one item the navigation is built around.
    const withHome: NavGroupLike<Item>[] = [
      { label: "", items: [...pillars[0].items, home] },
    ];
    const out = hrefs(funnelNav(withHome, home));
    expect(out.filter((h) => h === "/dashboard/outcomes")).toHaveLength(1);
  });

  it("★removes the promoted route from whichever parent held it as a subitem", () => {
    // Outcomes lives under Growth in the pillar navigation. Promoted without
    // this, the route is in two places at once: both entries light up on it,
    // Growth auto-expands beneath its own promoted child, and in the collapsed
    // rail the two are indistinguishable.
    type WithSubs = Item & { subItems?: { href: string }[] };
    const withSubs: NavGroupLike<WithSubs>[] = [
      {
        label: "",
        items: [
          {
            href: "/dashboard/ads",
            label: "Growth",
            subItems: [{ href: "/dashboard/ads" }, { href: "/dashboard/outcomes" }],
          },
        ],
      },
    ];
    const out = funnelNav(withSubs, home as WithSubs);
    const growth = out.flatMap((g) => g.items).find((i) => i.href === "/dashboard/ads");
    expect(growth?.subItems?.map((s) => s.href)).toEqual(["/dashboard/ads"]);
    // ★AND THE ORIGINAL IS NOT MUTATED. The pillar navigation is a module-scope
    // constant shared with the un-flagged render; editing it in place would
    // change what a merchant WITHOUT the flag sees.
    expect(withSubs[0].items[0].subItems?.map((s) => s.href)).toEqual([
      "/dashboard/ads",
      "/dashboard/outcomes",
    ]);
  });
});

describe("the flag itself", () => {
  it("★the flag is OFF for every spelling of off", async () => {
    // ★★COMPARED AGAINST "1", NOT COERCED. `process.env` values are strings, so
    // `Boolean(process.env.X)` is true for "0" and "false" — the two spellings
    // somebody switching a flag OFF is most likely to reach for. The failure is
    // a navigation reorganisation shipping to every merchant because a variable
    // said "false".
    for (const value of ["0", "false", "no", "off", ""]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_OUTCOMES_HOME", value);
      const mod = await import("./nav-home");
      expect(mod.OUTCOMES_HOME, `NEXT_PUBLIC_OUTCOMES_HOME=${JSON.stringify(value)}`).toBe(false);
    }
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("★the home route follows the flag, in one place", async () => {
    // The redirect and the sidebar's logo both read this. Two copies is how a
    // click on the mark comes to land somewhere other than where the app opened.
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_OUTCOMES_HOME", "1");
    const on = await import("./nav-home");
    expect(on.HOME_ROUTE).toBe("/dashboard/outcomes");

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_OUTCOMES_HOME", "");
    const off = await import("./nav-home");
    expect(off.HOME_ROUTE).toBe("/dashboard/overview");

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
