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

export const RESERVE_BAND_MENU_ORDER: Exclude<ReserveBandId, "all">[] = [
  "m0_3",
  "m3_6",
  "m6_12",
  "m12_24",
  "m24p",
];

export type ReserveBandSelection = Exclude<ReserveBandId, "all">[];

export function isReserveBandId(s: string): s is ReserveBandId {
  return (RESERVE_BAND_IDS as readonly string[]).includes(s);
}

export function expandReserveBandSelection(selected: ReserveBandSelection): ReserveBandSelection {
  if (selected.length === 0) return [];
  const order = RESERVE_BAND_MENU_ORDER;
  const idx = selected.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  if (idx.length === 0) return [];
  const lo = Math.min(...idx);
  const hi = Math.max(...idx);
  return order.slice(lo, hi + 1);
}

export function parseReserveBandsQuery(param: string | null): ReserveBandSelection {
  if (!param?.trim()) return [];
  const out: ReserveBandSelection = [];
  for (const part of param.split(",")) {
    const id = part.trim();
    if (id === "all") continue;
    if (isReserveBandId(id) && id !== "all") out.push(id);
  }
  return [...new Set(out)];
}

export function toggleReserveBandSelection(prev: ReserveBandSelection, id: ReserveBandId): ReserveBandSelection {
  if (id === "all") return [];
  const nid = id as Exclude<ReserveBandId, "all">;
  const set = new Set(prev);
  if (set.has(nid)) {
    set.delete(nid);
    return [...set] as ReserveBandSelection;
  }
  set.add(nid);
  return expandReserveBandSelection([...set] as ReserveBandSelection);
}

const RES_HULL_LO_MO: Record<Exclude<ReserveBandId, "all">, number> = {
  m0_3: 0,
  m3_6: 3,
  m6_12: 6,
  m12_24: 12,
  m24p: 24,
};

const RES_HULL_HI_MO: Record<Exclude<ReserveBandId, "all">, number | null> = {
  m0_3: 3,
  m3_6: 6,
  m6_12: 12,
  m12_24: 24,
  m24p: null,
};

const RES_CHIP: Record<Exclude<ReserveBandId, "all">, string> = {
  m0_3: "0–3 mo",
  m3_6: "3–6 mo",
  m6_12: "6–12 mo",
  m12_24: "12–24 mo",
  m24p: "24+ mo",
};

export function formatReserveBandSelectionChip(ids: ReserveBandSelection): string {
  if (ids.length === 0) return "Reserve";
  if (ids.length === 1) return `${RESERVE_BAND_LABELS[ids[0]]} reserve`;
  const order = RESERVE_BAND_MENU_ORDER;
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
    return `${sorted.map((id) => RES_CHIP[id]).join(", ")} reserve`;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const lo = RES_HULL_LO_MO[first];
  const hi = RES_HULL_HI_MO[last];
  if (hi === null) {
    return `${lo}–24+ months reserve`;
  }
  return `${lo}–${hi} months reserve`;
}

export function reserveMonthsMatchesBand(months: number, band: Exclude<ReserveBandId, "all">): boolean {
  switch (band) {
    case "m0_3":
      return months >= 0 && months < 3;
    case "m3_6":
      return months >= 3 && months < 6;
    case "m6_12":
      return months >= 6 && months < 12;
    case "m12_24":
      return months >= 12 && months < 24;
    case "m24p":
      return months >= 24;
    default:
      return true;
  }
}

export function reserveMatchesSelection(months: number, ids: ReserveBandSelection): boolean {
  if (ids.length === 0) return true;
  return ids.some((id) => reserveMonthsMatchesBand(months, id));
}
