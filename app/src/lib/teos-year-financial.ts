import type { YearFinancial } from "@/lib/propublica-filing";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Fields needed from Worker `/api/irs990-browse` (TEOS `irs990_xml_returns` + joins). */
export type Irs990BrowseFinancialFields = {
  tax_yr?: number | null;
  cy_total_revenue_amt?: number | null;
  py_total_revenue_amt?: number | null;
  cy_total_expenses_amt?: number | null;
  py_total_expenses_amt?: number | null;
  cy_rev_less_expenses_amt?: number | null;
  net_assets_eoy_amt?: number | null;
  net_assets_boy_amt?: number | null;
  cy_contributions_grants_amt?: number | null;
  cy_program_service_revenue_amt?: number | null;
  cy_investment_income_amt?: number | null;
  cy_other_revenue_amt?: number | null;
  total_program_service_expenses_amt?: number | null;
};

/**
 * Build two filing years (prior, current) for the same Moobu scorer as ProPublica (`computeResilienceScore`).
 * Prior-year revenue streams use the current-year mix scaled to prior-year totals when PY detail is absent.
 */
export function irs990BrowseRowToYearFinancials(r: Irs990BrowseFinancialFields): YearFinancial[] | null {
  const taxYr = Math.floor(num(r.tax_yr));
  if (taxYr <= 0) return null;

  const cyRev = num(r.cy_total_revenue_amt);
  const pyRev = num(r.py_total_revenue_amt);
  const cyExp = num(r.cy_total_expenses_amt);
  const pyExp = num(r.py_total_expenses_amt);

  const cg = num(r.cy_contributions_grants_amt);
  const psr = num(r.cy_program_service_revenue_amt);
  const inv = num(r.cy_investment_income_amt);
  const otherExplicit = num(r.cy_other_revenue_amt);

  let cyTotal = cyRev;
  if (cyTotal <= 0) {
    const sumStreams = cg + psr + inv + Math.max(0, otherExplicit);
    if (sumStreams > 0) cyTotal = sumStreams;
  }
  const otherCy = Math.max(0, cyTotal > 0 ? cyTotal - cg - psr - inv : otherExplicit);

  const mixDenom = cyTotal > 1e-9 ? cyTotal : 0;
  const shareContrib = mixDenom > 0 ? cg / mixDenom : 0.25;
  const sharePsr = mixDenom > 0 ? psr / mixDenom : 0.25;
  const shareInv = mixDenom > 0 ? inv / mixDenom : 0.25;
  const shareOther = mixDenom > 0 ? otherCy / mixDenom : 0.25;

  const pyCg = pyRev * shareContrib;
  const pyPsr = pyRev * sharePsr;
  const pyInv = pyRev * shareInv;
  const pyOther = Math.max(0, pyRev - pyCg - pyPsr - pyInv);

  const cyRevLessRaw = num(r.cy_rev_less_expenses_amt);
  const hasRevLess = r.cy_rev_less_expenses_amt != null && r.cy_rev_less_expenses_amt !== undefined;
  const cySurplus = hasRevLess && Number.isFinite(cyRevLessRaw) ? cyRevLessRaw : cyTotal - cyExp;
  const pySurplus = pyRev - pyExp;

  const naEoy = num(r.net_assets_eoy_amt);
  const naBoy = num(r.net_assets_boy_amt);

  const progCy = num(r.total_program_service_expenses_amt);
  const progPy = pyExp > 1e-9 && cyExp > 1e-9 ? pyExp * (progCy / cyExp) : 0;
  const funcCy = cyExp > 0 ? cyExp : progCy;
  const funcPy = pyExp > 0 ? pyExp : progPy;

  const prior: YearFinancial = {
    tax_year: taxYr - 1,
    total_revenue: pyRev,
    total_expenses: pyExp,
    contributions_grants: pyCg,
    program_service_rev: pyPsr,
    investment_income: pyInv,
    other_revenue: pyOther,
    net_assets_eoy: naBoy,
    rev_less_expenses: pySurplus,
    program_expenses: progPy,
    total_func_expenses: funcPy > 0 ? funcPy : pyExp,
  };

  const current: YearFinancial = {
    tax_year: taxYr,
    total_revenue: cyTotal,
    total_expenses: cyExp,
    contributions_grants: cg,
    program_service_rev: psr,
    investment_income: inv,
    other_revenue: otherCy,
    net_assets_eoy: naEoy,
    rev_less_expenses: cySurplus,
    program_expenses: progCy,
    total_func_expenses: funcCy > 0 ? funcCy : cyExp,
  };

  return [prior, current];
}
