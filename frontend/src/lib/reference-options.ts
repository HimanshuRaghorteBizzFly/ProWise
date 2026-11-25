/**
 * Reference lists for form dropdowns. These are fixed vocabularies (not business records): industries are a
 * product list, countries and time zones come from the runtime's own Intl data.
 */

export interface Option {
  label: string;
  value: string;
}

export const INDUSTRIES: readonly string[] = [
  "Software & SaaS",
  "IT Services & Consulting",
  "Healthcare",
  "Financial Services",
  "Banking",
  "Insurance",
  "Education",
  "E-commerce & Retail",
  "Manufacturing",
  "Telecommunications",
  "Media & Entertainment",
  "Marketing & Advertising",
  "Real Estate & Construction",
  "Logistics & Transportation",
  "Energy & Utilities",
  "Government & Public Sector",
  "Non-profit",
  "Hospitality & Travel",
  "Agriculture",
  "Legal Services",
  "Other",
];

/**
 * Two-letter region codes Intl can name that are not current countries: groupings (EU, UN), private-use and pseudo
 * codes (QM-QZ, XA-XZ except XK Kosovo), outlying areas (Ascension, Canary Islands...) and retired codes (SU, YU...).
 */
const NON_COUNTRY_REGIONS = /^(Q[M-Z]|X[A-JL-Z]|AA|ZZ|EU|EZ|UN|AC|CP|CQ|DG|EA|IC|TA|AN|BU|CS|DD|DY|FX|HV|NH|RH|SU|TP|VD|YD|YU|ZR)$/;

let countryCache: string[] | null = null;

/** Country names in English, sorted, built from ISO 3166 two-letter codes the runtime knows. */
export function countryNames(): string[] {
  if (countryCache) return countryCache;
  const names = new Set<string>();
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        if (NON_COUNTRY_REGIONS.test(code)) continue;
        const name = display.of(code);
        if (name && name !== code) names.add(name);
      }
    }
  } catch {
    // Intl.DisplayNames unavailable: the field falls back to free text via the "keep current" option.
  }
  countryCache = Array.from(names).sort((x, y) => x.localeCompare(y));
  return countryCache;
}

const CURRENT_ZONE_NAMES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
};

/** IANA time zones the runtime supports, UTC first. */
export function timeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = typeof intl.supportedValuesOf === "function" ? intl.supportedValuesOf("timeZone") : [];
  // Some runtimes still list legacy names only; offer the current IANA name as well.
  const current = Object.entries(CURRENT_ZONE_NAMES)
    .filter(([legacy, now]) => zones.includes(legacy) && !zones.includes(now))
    .map(([, now]) => now);
  return ["UTC", ...[...zones, ...current].filter((z) => z !== "UTC").sort()];
}

/**
 * Options for a select with an empty "choose" entry; a stored value missing from the list (older free-text data) is
 * kept as its own option so editing never silently drops it.
 */
export function selectOptions(values: readonly string[], current: string, emptyLabel: string): Option[] {
  const list: Option[] = [{ label: emptyLabel, value: "" }, ...values.map((v) => ({ label: v, value: v }))];
  if (current && !values.includes(current)) list.push({ label: current, value: current });
  return list;
}
