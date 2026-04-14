/**
 * Shared bucket IDs for Employees / Volunteers toolbar filters (aligned with Worker query params).
 */

export const COUNT_BAND_IDS = ["all", "0_1", "1_10", "10_50", "50_100", "100p"] as const;
export type CountBandId = (typeof COUNT_BAND_IDS)[number];

/** Menu row labels (tiers are inclusive on both ends where ranges overlap — matches Worker SQL). */
export const COUNT_BAND_MENU_LABELS: Record<Exclude<CountBandId, "all">, string> = {
  "0_1": "0–1",
  "1_10": "1–10",
  "10_50": "10–50",
  "50_100": "50–100",
  "100p": "100+",
};

export function isCountBandId(s: string): s is CountBandId {
  return (COUNT_BAND_IDS as readonly string[]).includes(s);
}

export const COUNT_BAND_MENU_ORDER: Exclude<CountBandId, "all">[] = ["0_1", "1_10", "10_50", "50_100", "100p"];

export type CountBandSelection = Exclude<CountBandId, "all">[];

export function expandCountBandSelection(selected: CountBandSelection): CountBandSelection {
  if (selected.length === 0) return [];
  const order = COUNT_BAND_MENU_ORDER;
  const idx = selected.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  if (idx.length === 0) return [];
  const lo = Math.min(...idx);
  const hi = Math.max(...idx);
  return order.slice(lo, hi + 1);
}

export function parseCountBandsQuery(param: string | null): CountBandSelection {
  if (!param?.trim()) return [];
  const out: CountBandSelection = [];
  for (const part of param.split(",")) {
    const id = part.trim();
    if (id === "all") continue;
    if (isCountBandId(id) && id !== "all") {
      out.push(id as CountBandSelection[number]);
    }
  }
  return [...new Set(out)] as CountBandSelection;
}

export function toggleCountBandSelection(prev: CountBandSelection, id: CountBandId): CountBandSelection {
  if (id === "all") return [];
  const nid = id as Exclude<CountBandId, "all">;
  const set = new Set(prev);
  if (set.has(nid)) {
    set.delete(nid);
    return [...set] as CountBandSelection;
  }
  set.add(nid);
  return expandCountBandSelection([...set] as CountBandSelection);
}

const CNT_LO: Record<Exclude<CountBandId, "all">, number> = {
  "0_1": 0,
  "1_10": 1,
  "10_50": 10,
  "50_100": 50,
  "100p": 100,
};

const CNT_HI: Record<Exclude<CountBandId, "all">, number | null> = {
  "0_1": 1,
  "1_10": 10,
  "10_50": 50,
  "50_100": 100,
  "100p": null,
};

const CNT_CHIP: Record<Exclude<CountBandId, "all">, string> = {
  "0_1": "0–1",
  "1_10": "1–10",
  "10_50": "10–50",
  "50_100": "50–100",
  "100p": "100+",
};

export function formatCountBandSelectionChip(
  ids: CountBandSelection,
  kind: "employees" | "volunteers",
): string {
  const noun = kind === "employees" ? "employees" : "volunteers";
  const title = kind === "employees" ? "Employees" : "Volunteers";
  if (ids.length === 0) return title;
  if (ids.length === 1) {
    return `${COUNT_BAND_MENU_LABELS[ids[0]]} ${noun}`;
  }
  const order = COUNT_BAND_MENU_ORDER;
  const sorted = [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const idxs = sorted.map((id) => order.indexOf(id));
  let contiguous = true;
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] !== idxs[i - 1] + 1) {
      contiguous = false;
      break;
    }
  }
  if (!contiguous) {
    return `${sorted.map((id) => CNT_CHIP[id]).join(", ")} ${noun}`;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const lo = CNT_LO[first];
  const hi = CNT_HI[last];
  if (hi === null) {
    return `${lo}–100+ ${noun}`;
  }
  return `${lo}–${hi} ${noun}`;
}

export function headcountMatchesBand(n: number, band: Exclude<CountBandId, "all">): boolean {
  switch (band) {
    case "0_1":
      return n >= 0 && n <= 1;
    case "1_10":
      return n >= 1 && n <= 10;
    case "10_50":
      return n >= 10 && n <= 50;
    case "50_100":
      return n >= 50 && n <= 100;
    case "100p":
      return n >= 100;
    default:
      return true;
  }
}

export function headcountMatchesSelection(n: number, ids: CountBandSelection): boolean {
  if (ids.length === 0) return true;
  return ids.some((id) => headcountMatchesBand(n, id));
}

/** USPS state codes — multi-select (OR). Empty = all states. */
export type StateAbbrevSelection = string[];

export function parseStatesQuery(param: string | null): StateAbbrevSelection {
  if (!param?.trim()) return [];
  const out: string[] = [];
  for (const part of param.split(",")) {
    const t = part.trim().toUpperCase();
    if (t.length === 2 && /^[A-Z]{2}$/.test(t)) out.push(t);
  }
  return [...new Set(out)];
}

export function toggleStateAbbrevSelection(prev: StateAbbrevSelection, id: string): StateAbbrevSelection {
  if (id === "all") return [];
  const t = id.trim().toUpperCase();
  if (t.length !== 2 || !/^[A-Z]{2}$/.test(t)) return prev;
  const set = new Set(prev);
  if (set.has(t)) {
    set.delete(t);
    return [...set];
  }
  set.add(t);
  return [...set];
}

export function formatStateSelectionChip(ids: StateAbbrevSelection): string {
  if (ids.length === 0) return "State";
  if (ids.length === 1) {
    return US_STATE_OPTIONS.find((s) => s.abbrev === ids[0])?.name ?? ids[0];
  }
  if (ids.length <= 3) {
    return ids
      .map((a) => US_STATE_OPTIONS.find((s) => s.abbrev === a)?.abbrev ?? a)
      .join(", ");
  }
  return `${ids.length} states`;
}

/** US states + DC, A–Z by full name; value is USPS abbreviation. */
export const US_STATE_OPTIONS: { abbrev: string; name: string }[] = [
  { abbrev: "AL", name: "Alabama" },
  { abbrev: "AK", name: "Alaska" },
  { abbrev: "AZ", name: "Arizona" },
  { abbrev: "AR", name: "Arkansas" },
  { abbrev: "CA", name: "California" },
  { abbrev: "CO", name: "Colorado" },
  { abbrev: "CT", name: "Connecticut" },
  { abbrev: "DE", name: "Delaware" },
  { abbrev: "DC", name: "District of Columbia" },
  { abbrev: "FL", name: "Florida" },
  { abbrev: "GA", name: "Georgia" },
  { abbrev: "HI", name: "Hawaii" },
  { abbrev: "ID", name: "Idaho" },
  { abbrev: "IL", name: "Illinois" },
  { abbrev: "IN", name: "Indiana" },
  { abbrev: "IA", name: "Iowa" },
  { abbrev: "KS", name: "Kansas" },
  { abbrev: "KY", name: "Kentucky" },
  { abbrev: "LA", name: "Louisiana" },
  { abbrev: "ME", name: "Maine" },
  { abbrev: "MD", name: "Maryland" },
  { abbrev: "MA", name: "Massachusetts" },
  { abbrev: "MI", name: "Michigan" },
  { abbrev: "MN", name: "Minnesota" },
  { abbrev: "MS", name: "Mississippi" },
  { abbrev: "MO", name: "Missouri" },
  { abbrev: "MT", name: "Montana" },
  { abbrev: "NE", name: "Nebraska" },
  { abbrev: "NV", name: "Nevada" },
  { abbrev: "NH", name: "New Hampshire" },
  { abbrev: "NJ", name: "New Jersey" },
  { abbrev: "NM", name: "New Mexico" },
  { abbrev: "NY", name: "New York" },
  { abbrev: "NC", name: "North Carolina" },
  { abbrev: "ND", name: "North Dakota" },
  { abbrev: "OH", name: "Ohio" },
  { abbrev: "OK", name: "Oklahoma" },
  { abbrev: "OR", name: "Oregon" },
  { abbrev: "PA", name: "Pennsylvania" },
  { abbrev: "RI", name: "Rhode Island" },
  { abbrev: "SC", name: "South Carolina" },
  { abbrev: "SD", name: "South Dakota" },
  { abbrev: "TN", name: "Tennessee" },
  { abbrev: "TX", name: "Texas" },
  { abbrev: "UT", name: "Utah" },
  { abbrev: "VT", name: "Vermont" },
  { abbrev: "VA", name: "Virginia" },
  { abbrev: "WA", name: "Washington" },
  { abbrev: "WV", name: "West Virginia" },
  { abbrev: "WI", name: "Wisconsin" },
  { abbrev: "WY", name: "Wyoming" },
].sort((a, b) => a.name.localeCompare(b.name, "en"));
