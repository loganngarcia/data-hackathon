import type { ScreenerRow } from "@/lib/types";

export type PortfolioBucket = "all" | "at_risk" | "thriving";

/** Cutoffs for bucket assignment (must match Worker TEOS SQL and `/api/portfolio-data` aggregates). */
export const PORTFOLIO_AT_RISK_MAX_EXCLUSIVE = 50;
export const PORTFOLIO_THRIVING_MIN_EXCLUSIVE = 90;

export type PortfolioBucketCounts = {
  total: number;
  atRisk: number;
  thriving: number;
};

export function portfolioBucketCounts(rows: ScreenerRow[]): PortfolioBucketCounts {
  let atRisk = 0;
  let thriving = 0;
  for (const r of rows) {
    if (r.screenScore < PORTFOLIO_AT_RISK_MAX_EXCLUSIVE) atRisk += 1;
    if (r.screenScore > PORTFOLIO_THRIVING_MIN_EXCLUSIVE) thriving += 1;
  }
  return { total: rows.length, atRisk, thriving };
}

export function filterPortfolioByBucket(rows: ScreenerRow[], bucket: PortfolioBucket): ScreenerRow[] {
  if (bucket === "all") return rows;
  if (bucket === "at_risk") {
    return rows.filter((r) => r.screenScore < PORTFOLIO_AT_RISK_MAX_EXCLUSIVE);
  }
  return rows.filter((r) => r.screenScore > PORTFOLIO_THRIVING_MIN_EXCLUSIVE);
}
