import type { ScreenerRow } from "@/lib/types";

/**
 * Pick peer rows for “Similar organizations”: closest **reserve coverage** first (same state),
 * then same-state **revenue** proximity, then same metrics **any state** (reserve, then revenue).
 * Only considers orgs already in `portfolioRows` (paginated client list).
 */
export function pickSimilarOrganizationRows(
  portfolioRows: ScreenerRow[],
  selected: ScreenerRow,
  max: number,
): ScreenerRow[] {
  const others = portfolioRows.filter((r) => r.id !== selected.id);
  if (others.length === 0 || max <= 0) return [];

  const sameState = others.filter((r) => r.state === selected.state);

  const byReserveGap = (a: ScreenerRow, b: ScreenerRow) => {
    const da = Math.abs(a.reserveMonths - selected.reserveMonths);
    const db = Math.abs(b.reserveMonths - selected.reserveMonths);
    if (da !== db) return da - db;
    return Math.abs(a.revenue - selected.revenue) - Math.abs(b.revenue - selected.revenue);
  };

  const byRevenueGap = (a: ScreenerRow, b: ScreenerRow) => {
    const da = Math.abs(a.revenue - selected.revenue);
    const db = Math.abs(b.revenue - selected.revenue);
    if (da !== db) return da - db;
    return Math.abs(a.reserveMonths - selected.reserveMonths) - Math.abs(b.reserveMonths - selected.reserveMonths);
  };

  const out: ScreenerRow[] = [];
  const used = new Set<string>();

  const takeFrom = (candidates: ScreenerRow[], sortFn: (a: ScreenerRow, b: ScreenerRow) => number) => {
    const sorted = [...candidates].sort(sortFn);
    for (const r of sorted) {
      if (out.length >= max) return;
      if (used.has(r.id)) continue;
      out.push(r);
      used.add(r.id);
    }
  };

  // 1. Same state — closest reserve coverage
  takeFrom(sameState, byReserveGap);
  // 2. Same state — closest annual revenue (remaining)
  takeFrom(
    sameState.filter((r) => !used.has(r.id)),
    byRevenueGap,
  );
  // 3. Any state — closest reserve coverage
  takeFrom(
    others.filter((r) => !used.has(r.id)),
    byReserveGap,
  );
  // 4. Any state — closest revenue
  takeFrom(
    others.filter((r) => !used.has(r.id)),
    byRevenueGap,
  );

  return out;
}
