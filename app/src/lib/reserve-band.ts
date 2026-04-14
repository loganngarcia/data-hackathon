/**
 * Reserve **coverage** bands (months), aligned with `ScreenerRow.reserveMonths`:
 * `(net_assets_eoy ÷ cy_total_expenses) × 12` when CY expenses > 0, else `0`.
 * Bounds: [min, max) except `m24p` which is [24, ∞).
 *
 * Note: Uses **total** net assets from Form 990 — a common dashboard proxy, not a substitute
 * for unrestricted-only or cash-only reserve analysis.
 */
export const RESERVE_BAND_IDS = ["all", "m0_3", "m3_6", "m6_12", "m12_24", "m24p"] as const;

export type ReserveBandId = (typeof RESERVE_BAND_IDS)[number];

export const RESERVE_BAND_LABELS: Record<ReserveBandId, string> = {
  all: "All",
  m0_3: "0–3 months",
  m3_6: "3–6 months",
  m6_12: "6–12 months",
  m12_24: "12–24 months",
  m24p: "Over 24 months",
};

export function parseReserveBandQuery(param: string | null): ReserveBandId {
  if (!param?.trim()) return "all";
  const id = param.trim();
  if ((RESERVE_BAND_IDS as readonly string[]).includes(id)) return id as ReserveBandId;
  return "all";
}
