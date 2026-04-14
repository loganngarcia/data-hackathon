/**
 * Net assets EOY bands (TEOS `net_assets_eoy_amt`, USD).
 * Bounds: [min, max) except `1m_plus` which is [min, ∞).
 */
export const ASSETS_BAND_IDS = [
  "all",
  "0_10k",
  "10k_50k",
  "50k_100k",
  "100k_500k",
  "500k_1m",
  "1m_plus",
] as const;

export type AssetsBandId = (typeof ASSETS_BAND_IDS)[number];

export const ASSETS_BAND_LABELS: Record<AssetsBandId, string> = {
  all: "All",
  "0_10k": "$0–10K",
  "10k_50k": "$10K–50K",
  "50k_100k": "$50K–100K",
  "100k_500k": "$100K–500K",
  "500k_1m": "$500K–1M",
  "1m_plus": "$1M+",
};

export function parseAssetsBandQuery(param: string | null): AssetsBandId {
  if (!param?.trim()) return "all";
  const id = param.trim();
  if ((ASSETS_BAND_IDS as readonly string[]).includes(id)) return id as AssetsBandId;
  return "all";
}

export const ASSETS_BAND_MENU_ORDER: Exclude<AssetsBandId, "all">[] = [
  "0_10k",
  "10k_50k",
  "50k_100k",
  "100k_500k",
  "500k_1m",
  "1m_plus",
];

export type AssetsBandSelection = Exclude<AssetsBandId, "all">[];

export function isAssetsBandId(s: string): s is AssetsBandId {
  return (ASSETS_BAND_IDS as readonly string[]).includes(s);
}

export function expandAssetsBandSelection(selected: AssetsBandSelection): AssetsBandSelection {
  if (selected.length === 0) return [];
  const order = ASSETS_BAND_MENU_ORDER;
  const idx = selected.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  if (idx.length === 0) return [];
  const lo = Math.min(...idx);
  const hi = Math.max(...idx);
  return order.slice(lo, hi + 1);
}

export function parseAssetsBandsQuery(param: string | null): AssetsBandSelection {
  if (!param?.trim()) return [];
  const out: AssetsBandSelection = [];
  for (const part of param.split(",")) {
    const id = part.trim();
    if (id === "all") continue;
    if (isAssetsBandId(id) && id !== "all") out.push(id);
  }
  return [...new Set(out)];
}

export function toggleAssetsBandSelection(prev: AssetsBandSelection, id: AssetsBandId): AssetsBandSelection {
  if (id === "all") return [];
  const nid = id as Exclude<AssetsBandId, "all">;
  const set = new Set(prev);
  if (set.has(nid)) {
    set.delete(nid);
    return [...set] as AssetsBandSelection;
  }
  set.add(nid);
  return expandAssetsBandSelection([...set] as AssetsBandSelection);
}

const AST_RANGE_START: Record<Exclude<AssetsBandId, "all">, string> = {
  "0_10k": "$0",
  "10k_50k": "$10K",
  "50k_100k": "$50K",
  "100k_500k": "$100K",
  "500k_1m": "$500K",
  "1m_plus": "$1M",
};

const AST_RANGE_END: Record<Exclude<AssetsBandId, "all">, string> = {
  "0_10k": "$10K",
  "10k_50k": "$50K",
  "50k_100k": "$100K",
  "100k_500k": "$500K",
  "500k_1m": "$1M",
  "1m_plus": "$1M+",
};

const AST_CHIP: Record<Exclude<AssetsBandId, "all">, string> = {
  "0_10k": "$0–10K",
  "10k_50k": "$10K–50K",
  "50k_100k": "$50K–100K",
  "100k_500k": "$100K–500K",
  "500k_1m": "$500K–1M",
  "1m_plus": "$1M+",
};

export function formatAssetsBandSelectionChip(ids: AssetsBandSelection): string {
  if (ids.length === 0) return "Net assets";
  if (ids.length === 1) return `${ASSETS_BAND_LABELS[ids[0]]} net assets`;
  const order = ASSETS_BAND_MENU_ORDER;
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
    return `${sorted.map((id) => AST_CHIP[id]).join(", ")} net assets`;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return `${AST_RANGE_START[first]}–${AST_RANGE_END[last]} net assets`;
}

export function netAssetsMatchesBand(na: number, band: Exclude<AssetsBandId, "all">): boolean {
  switch (band) {
    case "0_10k":
      return na >= 0 && na < 10_000;
    case "10k_50k":
      return na >= 10_000 && na < 50_000;
    case "50k_100k":
      return na >= 50_000 && na < 100_000;
    case "100k_500k":
      return na >= 100_000 && na < 500_000;
    case "500k_1m":
      return na >= 500_000 && na < 1_000_000;
    case "1m_plus":
      return na >= 1_000_000;
    default:
      return true;
  }
}

export function netAssetsMatchesSelection(na: number, ids: AssetsBandSelection): boolean {
  if (ids.length === 0) return true;
  return ids.some((id) => netAssetsMatchesBand(na, id));
}
