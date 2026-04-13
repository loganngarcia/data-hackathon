import type { ScreenerRow } from "@/lib/types";

export type PortfolioBucket = "all" | "at_risk" | "thriving";

/** Cutoffs for bucket assignment; labels in the UI do not expose these values. */
const AT_RISK_EXCLUSIVE_MAX = 50;
const THRIVING_EXCLUSIVE_MIN = 90;

export function portfolioBucketCounts(rows: ScreenerRow[]): {
  total: number;
  atRisk: number;
  thriving: number;
} {
  let atRisk = 0;
  let thriving = 0;
  for (const r of rows) {
    if (r.screenScore < AT_RISK_EXCLUSIVE_MAX) atRisk += 1;
    if (r.screenScore > THRIVING_EXCLUSIVE_MIN) thriving += 1;
  }
  return { total: rows.length, atRisk, thriving };
}

export function filterPortfolioByBucket(rows: ScreenerRow[], bucket: PortfolioBucket): ScreenerRow[] {
  if (bucket === "all") return rows;
  if (bucket === "at_risk") {
    return rows.filter((r) => r.screenScore < AT_RISK_EXCLUSIVE_MAX);
  }
  return rows.filter((r) => r.screenScore > THRIVING_EXCLUSIVE_MIN);
}
