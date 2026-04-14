/**
 * Latest-year total revenue bands (TEOS `cy_total_revenue_amt`, USD).
 * Bounds: [min, max) except `gt5m` which is [min, ∞).
 */
export const REVENUE_BAND_IDS = [
  "all",
  "lt10k",
  "10k_100k",
  "100k_500k",
  "500k_1m",
  "1m_5m",
  "gt5m",
] as const;

export type RevenueBandId = (typeof REVENUE_BAND_IDS)[number];

export const REVENUE_BAND_LABELS: Record<RevenueBandId, string> = {
  all: "All",
  lt10k: "Below $10K",
  "10k_100k": "$10K–100K",
  "100k_500k": "$100K–500K",
  "500k_1m": "$500K–$1M",
  "1m_5m": "$1–5M",
  gt5m: "Over $5M",
};

export function parseRevenueBandQuery(param: string | null): RevenueBandId {
  if (!param?.trim()) return "all";
  const id = param.trim();
  if ((REVENUE_BAND_IDS as readonly string[]).includes(id)) return id as RevenueBandId;
  return "all";
}

export const REVENUE_BAND_MENU_ORDER: Exclude<RevenueBandId, "all">[] = [
  "lt10k",
  "10k_100k",
  "100k_500k",
  "500k_1m",
  "1m_5m",
  "gt5m",
];

export type RevenueBandSelection = Exclude<RevenueBandId, "all">[];

export function isRevenueBandId(s: string): s is RevenueBandId {
  return (REVENUE_BAND_IDS as readonly string[]).includes(s);
}

export function expandRevenueBandSelection(selected: RevenueBandSelection): RevenueBandSelection {
  if (selected.length === 0) return [];
  const order = REVENUE_BAND_MENU_ORDER;
  const idx = selected.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  if (idx.length === 0) return [];
  const lo = Math.min(...idx);
  const hi = Math.max(...idx);
  return order.slice(lo, hi + 1);
}

export function parseRevenueBandsQuery(param: string | null): RevenueBandSelection {
  if (!param?.trim()) return [];
  const out: RevenueBandSelection = [];
  for (const part of param.split(",")) {
    const id = part.trim();
    if (id === "all") continue;
    if (isRevenueBandId(id) && id !== "all") out.push(id);
  }
  return [...new Set(out)];
}

export function toggleRevenueBandSelection(prev: RevenueBandSelection, id: RevenueBandId): RevenueBandSelection {
  if (id === "all") return [];
  const nid = id as Exclude<RevenueBandId, "all">;
  const set = new Set(prev);
  if (set.has(nid)) {
    set.delete(nid);
    return [...set] as RevenueBandSelection;
  }
  set.add(nid);
  return expandRevenueBandSelection([...set] as RevenueBandSelection);
}

/** Display range endpoints (aligned with `portfolio-browse-filters` / Worker SQL). */
const REV_RANGE_START: Record<Exclude<RevenueBandId, "all">, string> = {
  lt10k: "<$10K",
  "10k_100k": "$10K",
  "100k_500k": "$100K",
  "500k_1m": "$500K",
  "1m_5m": "$1M",
  gt5m: "$5M",
};

const REV_RANGE_END: Record<Exclude<RevenueBandId, "all">, string> = {
  lt10k: "$10K",
  "10k_100k": "$100K",
  "100k_500k": "$500K",
  "500k_1m": "$1M",
  "1m_5m": "$5M",
  gt5m: "$5M+",
};

const REV_CHIP: Record<Exclude<RevenueBandId, "all">, string> = {
  lt10k: "<$10K",
  "10k_100k": "$10K–100K",
  "100k_500k": "$100K–500K",
  "500k_1m": "$500K–$1M",
  "1m_5m": "$1–5M",
  gt5m: "$5M+",
};

export function formatRevenueBandSelectionChip(ids: RevenueBandSelection): string {
  if (ids.length === 0) return "Revenue";
  if (ids.length === 1) return `${REVENUE_BAND_LABELS[ids[0]]} revenue`;
  const order = REVENUE_BAND_MENU_ORDER;
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
    return `${sorted.map((id) => REV_CHIP[id]).join(", ")} revenue`;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return `${REV_RANGE_START[first]}–${REV_RANGE_END[last]} revenue`;
}

export function revenueValueMatchesBand(revenue: number, band: Exclude<RevenueBandId, "all">): boolean {
  switch (band) {
    case "lt10k":
      return revenue >= 0 && revenue < 10_000;
    case "10k_100k":
      return revenue >= 10_000 && revenue < 100_000;
    case "100k_500k":
      return revenue >= 100_000 && revenue < 500_000;
    case "500k_1m":
      return revenue >= 500_000 && revenue < 1_000_000;
    case "1m_5m":
      return revenue >= 1_000_000 && revenue < 5_000_000;
    case "gt5m":
      return revenue >= 5_000_000;
    default:
      return true;
  }
}

export function revenueMatchesSelection(revenue: number, ids: RevenueBandSelection): boolean {
  if (ids.length === 0) return true;
  return ids.some((id) => revenueValueMatchesBand(revenue, id));
}
