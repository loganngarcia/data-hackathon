/**
 * Normalize ProPublica `filings_with_data[]` records into year rows for scoring.
 * Field names vary between 990 / 990EZ extracts — we map common aliases.
 */

export type YearFinancial = {
  tax_year: number;
  total_revenue: number;
  total_expenses: number;
  contributions_grants: number;
  program_service_rev: number;
  investment_income: number;
  other_revenue: number;
  net_assets_eoy: number;
  rev_less_expenses: number;
  program_expenses: number;
  total_func_expenses: number;
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Map one ProPublica filing object to a YearFinancial row. */
export function normalizeFiling(f: Record<string, unknown>): YearFinancial | null {
  const taxYear = num(f.tax_prd_yr);
  if (taxYear <= 0) return null;

  const totalRevenue = num(f.totrevnue ?? f.totrevenue);
  const totalExpenses = num(f.totexpns ?? f.totfuncexpns);
  const totalFunc = num(f.totfuncexpns) || totalExpenses;

  const contributions = num(f.totcntrbs ?? f.totcntrbgfts);
  const programRev = num(f.prgmservrev ?? f.totprgmrevnue);
  const investment = num(f.othrinvstinc ?? f.invstmntinc);
  const otherRev = Math.max(0, totalRevenue - contributions - programRev - investment);

  const netAssets = num(f.totnetassetsend ?? f.totnetassetend);
  const assets = num(f.totassetsend);
  const liab = num(f.totliabend);
  const netAssetsEoy = netAssets || (assets - liab);

  const surplus = num(f.totexcessyr);
  const revLess =
    surplus !== 0 || totalRevenue || totalExpenses
      ? surplus
      : totalRevenue - totalExpenses;

  /** ProPublica summary extracts often omit program expense lines — leave 0 for neutral handling in scorer. */
  const programExpenses = num((f as { prgmservexpns?: unknown }).prgmservexpns);

  return {
    tax_year: taxYear,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    contributions_grants: contributions,
    program_service_rev: programRev,
    investment_income: investment,
    other_revenue: otherRev,
    net_assets_eoy: netAssetsEoy,
    rev_less_expenses: revLess,
    program_expenses: programExpenses,
    total_func_expenses: totalFunc || totalExpenses,
  };
}

export function filingsToYearRows(filings: unknown[]): YearFinancial[] {
  const rows: YearFinancial[] = [];
  for (const raw of filings) {
    if (!raw || typeof raw !== "object") continue;
    const row = normalizeFiling(raw as Record<string, unknown>);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => a.tax_year - b.tax_year);
}
