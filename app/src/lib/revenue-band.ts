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
