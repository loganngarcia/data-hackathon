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
