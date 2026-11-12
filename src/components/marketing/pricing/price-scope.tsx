import { PRICE_MARKETS, marketSelection, priceScopeLine, pricedCountryName, type PricingEntry } from "@/lib/pricing";

/**
 * The quiet line under a Suite price: which country and currency it is for,
 * and how tax is treated, with a way to correct a wrong geo (VPN, travel).
 *
 * The correction is a plain GET form around a native <select>, inside a
 * <details>, so it works without JavaScript and needs no client component:
 * submitting navigates to `{action}?country=XX`, which both pricing pages
 * resolve first (`resolveCountry`).
 */
export function PriceScope({
  pricing,
  country,
  action,
}: {
  pricing: PricingEntry;
  country: string;
  /** The page the form returns to, with its fragment: "/pricing#suite". */
  action: string;
}) {
  const name = pricedCountryName(pricing, country);
  const selected = marketSelection(pricing, country);
  const options = PRICE_MARKETS.some((m) => m.code === selected)
    ? PRICE_MARKETS
    : [...PRICE_MARKETS, { code: selected, label: selected }];
  const id = `country-${action.replace(/\W/g, "") || "page"}`;
  return (
    <div className="mt-3 text-micro text-muted-foreground" data-testid="price-scope">
      <p>{priceScopeLine(pricing, country)}</p>
      <details className="mt-1">
        <summary className="cursor-pointer underline underline-offset-2 hover:text-foreground">
          {name ? `Not in ${name}? Change` : "Change country"}
        </summary>
        <form method="get" action={action} className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="sr-only">
            Show prices for
          </label>
          <select
            id={id}
            name="country"
            defaultValue={selected}
            className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
          >
            {options.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border px-2 py-1 text-xs font-semibold text-foreground hover:border-brand"
          >
            Show prices
          </button>
        </form>
      </details>
    </div>
  );
}
