import { metaAdAccountBareId } from "./meta-ads-view";

/**
 * MR-F3 - routing tags on a business's Meta ad accounts, as the dashboard reads and writes them.
 *
 * Mirrors the api's `helpers/meta-saved-ad-account.ts` (`config.metaAdAccounts.tags[actId]`, which reaches the dashboard in
 * `account.extra.metaAdAccounts`). The api is the authority and re-cleans every value; this only builds the request and the
 * words. PURPOSES ARE THE GROWTH GOAL PHASES (api `GOAL_PHASES`), the one campaign-intent list: awareness, conversion,
 * retention. MARKETS are ISO 3166-1 alpha-2, upper case. COLLECTIONS are Shopify collection ids.
 */
export const AD_ACCOUNT_PURPOSES = [
  { id: "awareness", label: "Brand awareness" },
  { id: "conversion", label: "Sales" },
  { id: "retention", label: "Repeat customers" },
] as const;

export type AdAccountPurpose = (typeof AD_ACCOUNT_PURPOSES)[number]["id"];

export interface AdAccountTags {
  markets?: string[];
  collections?: string[];
  purposes?: AdAccountPurpose[];
}

export type AdAccountTagMap = Record<string, AdAccountTags>;

const PURPOSE_IDS: readonly string[] = AD_ACCOUNT_PURPOSES.map((p) => p.id);

/** The explanation shown once under the tag pickers. */
export const AD_ACCOUNT_TAGS_HELP =
  "Peakhour uses these to choose the ad account for automated campaigns. Untagged: your default.";

function clean(raw: unknown): AdAccountTags | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const strings = (v: unknown, ok: (s: string) => boolean): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && ok(x))
      : [];
  const markets = [
    ...new Set(
      strings(r.markets, (s) => /^[A-Za-z]{2}$/.test(s)).map((s) =>
        s.toUpperCase(),
      ),
    ),
  ];
  const collections = [
    ...new Set(strings(r.collections, (s) => /^\d{1,20}$/.test(s))),
  ];
  const purposes = [
    ...new Set(strings(r.purposes, (s) => PURPOSE_IDS.includes(s))),
  ] as AdAccountPurpose[];
  const out: AdAccountTags = {
    ...(markets.length ? { markets } : {}),
    ...(collections.length ? { collections } : {}),
    ...(purposes.length ? { purposes } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** The saved tags, keyed by the account's id as the connection lists it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function savedMetaAdAccountTags(extra: Record<string, any> | undefined): AdAccountTagMap {
  const stored = extra?.metaAdAccounts?.tags;
  if (!stored || typeof stored !== "object") return {};
  const listed: Array<{ id: string }> = Array.isArray(extra?.adAccounts)
    ? extra.adAccounts
    : [];
  const out: AdAccountTagMap = {};
  for (const [key, value] of Object.entries(
    stored as Record<string, unknown>,
  )) {
    const tags = clean(value);
    if (!tags) continue;
    const match = listed.find(
      (a) =>
        typeof a?.id === "string" &&
        metaAdAccountBareId(a.id) === metaAdAccountBareId(key),
    );
    out[match?.id ?? key] = tags;
  }
  return out;
}

/** The request's `tags`: only the ticked accounts, only the dimensions with a value. */
export function tagsForSave(
  tags: AdAccountTagMap,
  enabledIds: readonly string[],
): AdAccountTagMap {
  const out: AdAccountTagMap = {};
  for (const id of enabledIds) {
    const t = clean(tags[id]);
    if (t) out[id] = t;
  }
  return out;
}

/** One account's tags as a comparable string: each dimension is a SET, so order does not count. */
function canonical(raw: unknown): string {
  const t = clean(raw);
  if (!t) return "null";
  const sorted = (v?: readonly string[]) => (v ? [...v].sort() : undefined);
  return JSON.stringify({ markets: sorted(t.markets), collections: sorted(t.collections), purposes: sorted(t.purposes) });
}

/** Whether two tag maps say the same thing (an account with no tags and a missing one are the same; order within a dimension does not count). */
export function sameTags(a: AdAccountTagMap, b: AdAccountTagMap): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) if (canonical(a[id]) !== canonical(b[id])) return false;
  return true;
}

/** A tag value changed: the next tags of one account, with an emptied dimension left out. */
export function withTag<K extends keyof AdAccountTags>(
  tags: AdAccountTags | undefined,
  key: K,
  value: NonNullable<AdAccountTags[K]>,
): AdAccountTags {
  const next: AdAccountTags = { ...(tags ?? {}), [key]: value };
  if (value.length === 0) delete next[key];
  return next;
}
