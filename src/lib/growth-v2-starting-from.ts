import type { StartingFrom } from "@/lib/api/growth-v2";

/**
 * Where a starting number came from, in the merchant's words (Playbooks and learning PL-7). ★ONE HELPER: First run and What's working
 * both say it through here, so the four sentences cannot drift apart.
 *
 *   own        "Starting from your own results"
 *   pooled     "Starting from 20+ travel businesses like yours"   (the band's floor and the industry's word)
 *   line       "Starting from the Hotels playbook"                (the line's name, or the playbook's title)
 *   playbook   "Starting from the Travel playbook"
 *   everyone   "Starting guess"                                    (the weakest layer: every business, across every country)
 *
 * A line or playbook with no name (the default playbook) is a starting guess too: there is nothing honest to name.
 * ★A BAND IS A FLOOR, NEVER A COUNT: "20-49" is "20+", so no exact figure is ever shown.
 */

/** The band's floor as the merchant reads it. A band the network does not publish says no number. */
export function bandWord(band: string | undefined): string | undefined {
  if (band === "20-49") return "20+";
  if (band === "50-99") return "50+";
  if (band === "100+") return "100+";
  return undefined;
}

/** The network's industries as a merchant would say them in front of "businesses". `other` says nothing: "businesses like yours". */
const INDUSTRY_WORD: Record<string, string> = {
  fashion: "fashion",
  beauty: "beauty",
  food: "food",
  home: "home",
  wellness: "wellness",
  electronics: "electronics",
  jewellery: "jewellery",
  kids: "kids' products",
  sports: "sports",
  saas: "software",
  creator: "creator",
  travel: "travel",
  travel_flights: "flights",
  travel_hotels: "hotel",
  travel_holidays: "holiday",
  travel_activities: "travel activity",
};

export function startingFromWords(from: StartingFrom | undefined): string | undefined {
  if (!from) return undefined;
  // PL-5: a guess carries its own sentence, written for the merchant.
  if (from.reason) return from.reason;
  switch (from.layer) {
    case "own":
      return "Starting from your own results";
    case "pooled": {
      const n = bandWord(from.band);
      const industry = from.industry ? INDUSTRY_WORD[from.industry] : undefined;
      const who = [n, industry].filter((x): x is string => x !== undefined);
      return `Starting from ${who.length > 0 ? `${who.join(" ")} ` : ""}businesses like yours`;
    }
    case "line":
    case "playbook": {
      const name = from.label?.trim();
      return name ? `Starting from the ${name} playbook` : "Starting guess";
    }
    case "everyone":
      return "Starting guess";
  }
}
