/**
 * Enforces TEOS browse filter rules on raw Worker rows before `mapIrs990Rows`, so results
 * match the toolbar even when upstream responses are cached without varying by query string.
 * Bounds mirror `workers/nonprofit-data` `handleIrs990Browse` (same formulas as SQL).
 */

import type { AssetsBandSelection } from "@/lib/assets-band";
import { netAssetsMatchesSelection } from "@/lib/assets-band";
import { boardCountMatchesSelection, type BoardBandSelection } from "@/lib/board-band";
import {
  headcountMatchesSelection,
  type CountBandSelection,
  type StateAbbrevSelection,
} from "@/lib/portfolio-toolbar-bands";
import type { ReserveBandSelection } from "@/lib/reserve-band";
import { reserveMatchesSelection } from "@/lib/reserve-band";
import type { RevenueBandSelection } from "@/lib/revenue-band";
import { revenueMatchesSelection } from "@/lib/revenue-band";

/** Minimal shape of `/api/irs990-browse` row JSON (subset used for filtering). */
export type TeosBrowseRowLike = {
  cy_total_revenue_amt?: number | null;
  net_assets_eoy_amt?: number | null;
  cy_total_expenses_amt?: number | null;
  total_employee_cnt?: number | null;
  total_volunteers_cnt?: number | null;
  board_members_cnt?: number | null;
  governing_body_voting_cnt?: number | null;
  voting_members_governing_cnt?: number | null;
  voting_members_independent_cnt?: number | null;
  independent_voting_member_cnt?: number | null;
  /** Worker SELECT aliases `filer_state` → `state`. */
  state?: string | null;
};

export type BrowseFilterOptions = {
  revenueBands: RevenueBandSelection;
  assetsBands: AssetsBandSelection;
  reserveBands: ReserveBandSelection;
  employeeBands: CountBandSelection;
  volunteerBands: CountBandSelection;
  boardBands: BoardBandSelection;
  states: StateAbbrevSelection;
};

export function normalizeBrowseFilterOptions(opts?: Partial<BrowseFilterOptions>): BrowseFilterOptions {
  return {
    revenueBands: opts?.revenueBands ?? [],
    assetsBands: opts?.assetsBands ?? [],
    reserveBands: opts?.reserveBands ?? [],
    employeeBands: opts?.employeeBands ?? [],
    volunteerBands: opts?.volunteerBands ?? [],
    boardBands: opts?.boardBands ?? [],
    states: opts?.states ?? [],
  };
}

function coalesceNum(v: unknown, fallback = 0): number {
  const n = Number(v ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function parseNonnegativeInt(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  return i >= 0 ? i : undefined;
}

function boardMembersFromRow(r: TeosBrowseRowLike): number {
  const fromAlias = parseNonnegativeInt(r.board_members_cnt);
  if (fromAlias !== undefined) return fromAlias;
  const a = parseNonnegativeInt(r.governing_body_voting_cnt);
  if (a !== undefined) return a;
  const b = parseNonnegativeInt(r.voting_members_governing_cnt);
  if (b !== undefined) return b;
  const c = parseNonnegativeInt(r.voting_members_independent_cnt);
  if (c !== undefined) return c;
  return parseNonnegativeInt(r.independent_voting_member_cnt) ?? 0;
}

/** Same as Worker `reserveMonthsExpr`. */
function reserveMonthsRaw(r: TeosBrowseRowLike): number {
  const exp = coalesceNum(r.cy_total_expenses_amt, 0);
  if (exp <= 0) return 0;
  const na = coalesceNum(r.net_assets_eoy_amt, 0);
  return (na / exp) * 12;
}

export function teosBrowseRowMatchesFilters(row: TeosBrowseRowLike, f: BrowseFilterOptions): boolean {
  const rev = coalesceNum(row.cy_total_revenue_amt, 0);
  const na = coalesceNum(row.net_assets_eoy_amt, 0);
  const reserveM = reserveMonthsRaw(row);
  const emp = coalesceNum(row.total_employee_cnt, 0);
  const vol = coalesceNum(row.total_volunteers_cnt, 0);
  const board = boardMembersFromRow(row);

  if (!reserveMatchesSelection(reserveM, f.reserveBands)) return false;
  if (!revenueMatchesSelection(rev, f.revenueBands)) return false;
  if (!netAssetsMatchesSelection(na, f.assetsBands)) return false;
  if (!headcountMatchesSelection(emp, f.employeeBands)) return false;
  if (!headcountMatchesSelection(vol, f.volunteerBands)) return false;
  if (!boardCountMatchesSelection(board, f.boardBands)) return false;
  if (f.states.length > 0) {
    const abbrev = String(row.state ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 2);
    if (abbrev.length !== 2 || !f.states.includes(abbrev)) return false;
  }
  return true;
}

function browseFiltersAllDefault(f: BrowseFilterOptions): boolean {
  return (
    f.revenueBands.length === 0 &&
    f.assetsBands.length === 0 &&
    f.reserveBands.length === 0 &&
    f.employeeBands.length === 0 &&
    f.volunteerBands.length === 0 &&
    f.boardBands.length === 0 &&
    f.states.length === 0
  );
}

/** Drop rows that do not satisfy active browse filters (raw TEOS fields). */
export function filterTeosBrowseRows<T extends TeosBrowseRowLike>(
  rows: T[],
  opts?: Partial<BrowseFilterOptions>,
): T[] {
  const f = normalizeBrowseFilterOptions(opts);
  if (browseFiltersAllDefault(f)) return rows;
  return rows.filter((row) => teosBrowseRowMatchesFilters(row, f));
}
