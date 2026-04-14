/**
 * Persist Tipping Point portfolio toolbar filters in localStorage.
 */

import type { AssetsBandSelection } from "@/lib/assets-band";
import { isAssetsBandId } from "@/lib/assets-band";
import type { BoardBandSelection } from "@/lib/board-band";
import { isBoardBandId } from "@/lib/board-band";
import type { CountBandSelection, StateAbbrevSelection } from "@/lib/portfolio-toolbar-bands";
import { isCountBandId } from "@/lib/portfolio-toolbar-bands";
import type { RevenueBandSelection } from "@/lib/revenue-band";
import { isRevenueBandId } from "@/lib/revenue-band";
import type { ReserveBandSelection } from "@/lib/reserve-band";
import { isReserveBandId } from "@/lib/reserve-band";

export const PORTFOLIO_FILTERS_STORAGE_KEY = "tipping-point-portfolio-filters-v2";

/** Initial defaults when no saved preferences exist — no band/state filters (full TEOS pool). Saved prefs in localStorage still override. */
export const DEFAULT_PORTFOLIO_FILTERS: {
  assetsBands: AssetsBandSelection;
  revenueBands: RevenueBandSelection;
  reserveBands: ReserveBandSelection;
  employeeBands: CountBandSelection;
  volunteerBands: CountBandSelection;
  boardBands: BoardBandSelection;
  stateAbbrevs: StateAbbrevSelection;
} = {
  boardBands: [],
  reserveBands: [],
  assetsBands: [],
  revenueBands: [],
  employeeBands: [],
  volunteerBands: [],
  stateAbbrevs: [],
};

export type PersistedPortfolioFilters = typeof DEFAULT_PORTFOLIO_FILTERS;

function pickStateAbbrevs(o: Record<string, unknown>, fallback: StateAbbrevSelection): StateAbbrevSelection {
  const raw = o.stateAbbrevs;
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const x of raw) {
      if (typeof x === "string") {
        const t = x.trim().toUpperCase();
        if (t.length === 2 && /^[A-Z]{2}$/.test(t)) out.push(t);
      }
    }
    return [...new Set(out)];
  }
  const legacy = o.stateFilter;
  if (legacy === "all") return [];
  if (typeof legacy === "string") {
    const t = legacy.trim().toUpperCase();
    if (t.length === 2 && /^[A-Z]{2}$/.test(t)) return [t];
  }
  return fallback;
}

function pickBandArray<T extends string>(
  key: string,
  legacyKey: string,
  o: Record<string, unknown>,
  fallback: T[],
  isId: (s: string) => s is T,
): T[] {
  const raw = o[key];
  if (Array.isArray(raw)) {
    const out: T[] = [];
    for (const x of raw) {
      if (typeof x === "string" && isId(x) && x !== "all") out.push(x);
    }
    return [...new Set(out)];
  }
  const legacy = o[legacyKey];
  if (typeof legacy === "string" && legacy !== "all" && isId(legacy)) {
    return [legacy];
  }
  return fallback;
}

export function readPersistedPortfolioFilters(): PersistedPortfolioFilters {
  const d = { ...DEFAULT_PORTFOLIO_FILTERS };
  if (typeof window === "undefined") return d;
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_FILTERS_STORAGE_KEY);
    if (!raw?.trim()) return tryMigrateV1(d);
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      assetsBands: pickBandArray("assetsBands", "assetsBand", o, d.assetsBands, (s): s is AssetsBandSelection[number] =>
        isAssetsBandId(s) && s !== "all",
      ),
      revenueBands: pickBandArray("revenueBands", "revenueBand", o, d.revenueBands, (s): s is RevenueBandSelection[number] =>
        isRevenueBandId(s) && s !== "all",
      ),
      reserveBands: pickBandArray("reserveBands", "reserveBand", o, d.reserveBands, (s): s is ReserveBandSelection[number] =>
        isReserveBandId(s) && s !== "all",
      ),
      employeeBands: pickBandArray("employeeBands", "employeeBand", o, d.employeeBands, (s): s is CountBandSelection[number] =>
        isCountBandId(s) && s !== "all",
      ),
      volunteerBands: pickBandArray(
        "volunteerBands",
        "volunteerBand",
        o,
        d.volunteerBands,
        (s): s is CountBandSelection[number] => isCountBandId(s) && s !== "all",
      ),
      boardBands: (() => {
        const rawB = o.boardBands;
        if (Array.isArray(rawB)) {
          const out: BoardBandSelection = [];
          for (const x of rawB) {
            if (typeof x === "string" && isBoardBandId(x) && x !== "all") {
              out.push(x);
            }
          }
          return [...new Set(out)] as BoardBandSelection;
        }
        const legacy = o.boardBand;
        if (typeof legacy === "string" && legacy !== "all" && isBoardBandId(legacy) && legacy !== "all") {
          return [legacy];
        }
        return d.boardBands;
      })(),
      stateAbbrevs: pickStateAbbrevs(o, d.stateAbbrevs),
    };
  } catch {
    return tryMigrateV1(d);
  }
}

/** One-time read from v1 key when v2 is empty. */
function tryMigrateV1(d: PersistedPortfolioFilters): PersistedPortfolioFilters {
  if (typeof window === "undefined") return d;
  try {
    const raw = window.localStorage.getItem("tipping-point-portfolio-filters-v1");
    if (!raw?.trim()) return d;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const assetsBand = o.assetsBand;
    const revenueBand = o.revenueBand;
    const reserveBand = o.reserveBand;
    const employeeBand = o.employeeBand;
    const volunteerBand = o.volunteerBand;
    return {
      ...d,
      assetsBands:
        typeof assetsBand === "string" && isAssetsBandId(assetsBand) && assetsBand !== "all"
          ? [assetsBand]
          : d.assetsBands,
      revenueBands:
        typeof revenueBand === "string" && isRevenueBandId(revenueBand) && revenueBand !== "all"
          ? [revenueBand]
          : d.revenueBands,
      reserveBands:
        typeof reserveBand === "string" && isReserveBandId(reserveBand) && reserveBand !== "all"
          ? [reserveBand]
          : d.reserveBands,
      employeeBands:
        typeof employeeBand === "string" && isCountBandId(employeeBand) && employeeBand !== "all"
          ? [employeeBand]
          : d.employeeBands,
      volunteerBands:
        typeof volunteerBand === "string" && isCountBandId(volunteerBand) && volunteerBand !== "all"
          ? [volunteerBand]
          : d.volunteerBands,
      boardBands: (() => {
        const rawB = o.boardBands;
        if (Array.isArray(rawB)) {
          const out: BoardBandSelection = [];
          for (const x of rawB) {
            if (typeof x === "string" && isBoardBandId(x) && x !== "all") out.push(x);
          }
          return [...new Set(out)] as BoardBandSelection;
        }
        const leg = o.boardBand;
        if (typeof leg === "string" && leg !== "all" && isBoardBandId(leg) && leg !== "all") {
          return [leg];
        }
        return d.boardBands;
      })(),
      stateAbbrevs: pickStateAbbrevs(o, d.stateAbbrevs),
    };
  } catch {
    return d;
  }
}

export function writePersistedPortfolioFilters(f: PersistedPortfolioFilters): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTFOLIO_FILTERS_STORAGE_KEY, JSON.stringify(f));
  } catch {
    /* quota / private mode */
  }
}
