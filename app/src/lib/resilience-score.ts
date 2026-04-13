/**
 * Moobu-style resilience score: 8 metrics (0–10 each) → weighted composite 0–100.
 * Ported from `moobu/api/src/moobu_api/scoring.py` to match the same logic.
 */

import type { RiskBand } from "@/lib/types";
import type { YearFinancial } from "@/lib/propublica-filing";

export type ResilienceResult = {
  composite_score: number;
  tier: "Thriving" | "Stable" | "Needs Support" | "Urgent";
  confidence: "High" | "Medium" | "Low";
  years_of_data: number;
  metrics: Record<string, number>;
};

function safeNum(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function hhi(c: number, p: number, inv: number, oth: number): number {
  const total = Math.abs(c) + Math.abs(p) + Math.abs(inv) + Math.abs(oth);
  if (total === 0) return 1;
  const s0 = Math.abs(c) / total;
  const s1 = Math.abs(p) / total;
  const s2 = Math.abs(inv) / total;
  const s3 = Math.abs(oth) / total;
  return s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

/** Compute composite 0–100 and Moobu tier; returns null if fewer than 2 filing years. */
export function computeResilienceScore(org: YearFinancial[]): ResilienceResult | null {
  if (org.length < 2) return null;

  const latest = org[org.length - 1];

  const h = hhi(
    latest.contributions_grants,
    latest.program_service_rev,
    latest.investment_income,
    latest.other_revenue,
  );
  const revenue_concentration = Math.max(0, Math.min(10, (10 * (1 - h)) / 0.75));

  const netAssets = safeNum(latest.net_assets_eoy);
  const totalExpenses = safeNum(latest.total_expenses);
  let reserveMonths = 0;
  if (totalExpenses > 0) {
    reserveMonths = (netAssets / totalExpenses) * 12;
  }
  const operating_reserve = Math.max(0, Math.min(10, (reserveMonths / 12) * 10));

  const revenues = org.map((r) => r.total_revenue).filter((x) => Number.isFinite(x));
  let revenue_growth = 5;
  if (revenues.length >= 2 && revenues[0] > 0 && revenues[revenues.length - 1] > 0) {
    const nYears = revenues.length - 1;
    const cagr = (revenues[revenues.length - 1] / revenues[0]) ** (1 / nYears) - 1;
    revenue_growth = Math.max(0, Math.min(10, 5 + cagr * 25));
  }

  const expenses = org.map((r) => r.total_expenses);
  let expense_vs_revenue = 5;
  if (revenues.length >= 2 && expenses.length >= 2 && expenses[0] > 0 && revenues[0] !== 0) {
    const revGrowth = (revenues[revenues.length - 1] - revenues[0]) / Math.max(Math.abs(revenues[0]), 1);
    const expGrowth = (expenses[expenses.length - 1] - expenses[0]) / Math.max(Math.abs(expenses[0]), 1);
    const growthDiff = revGrowth - expGrowth;
    expense_vs_revenue = Math.max(0, Math.min(10, 5 + growthDiff * 20));
  }

  let program_expense = 5;
  const progExp = safeNum(latest.program_expenses);
  const funcExp = safeNum(latest.total_func_expenses) || totalExpenses;
  if (progExp > 0 && funcExp > 0) {
    const programRatio = progExp / funcExp;
    program_expense = Math.max(0, Math.min(10, (programRatio * 10) / 0.75));
  }

  let revenue_volatility = 5;
  if (revenues.length >= 2 && mean(revenues) !== 0) {
    const cv = stddev(revenues) / Math.abs(mean(revenues));
    revenue_volatility = Math.max(0, Math.min(10, 10 * (1 - cv)));
  }

  const naSeries = org.map((r) => r.net_assets_eoy).filter((x) => Number.isFinite(x));
  let net_asset_trend = 5;
  if (naSeries.length >= 2 && Math.abs(naSeries[0]) > 0) {
    const assetGrowth = (naSeries[naSeries.length - 1] - naSeries[0]) / Math.abs(naSeries[0]);
    net_asset_trend = Math.max(0, Math.min(10, 5 + assetGrowth * 10));
  }

  const surpluses = org.map((r) => r.rev_less_expenses);
  let surplus_deficit = 5;
  if (surpluses.length > 0) {
    const positiveYears = surpluses.filter((s) => s > 0).length;
    const consistencyRatio = positiveYears / surpluses.length;
    surplus_deficit = consistencyRatio * 10;
  }

  const weights: Record<string, number> = {
    revenue_concentration_hhi: 2,
    operating_reserve_ratio: 2,
    revenue_growth_trend: 1,
    expense_vs_revenue_growth: 1,
    program_expense_ratio: 1,
    revenue_volatility: 1,
    net_asset_trend: 1,
    surplus_deficit_consistency: 1,
  };

  const metrics: Record<string, number> = {
    revenue_concentration_hhi: revenue_concentration,
    operating_reserve_ratio: operating_reserve,
    revenue_growth_trend: revenue_growth,
    expense_vs_revenue_growth: expense_vs_revenue,
    program_expense_ratio: program_expense,
    revenue_volatility: revenue_volatility,
    net_asset_trend: net_asset_trend,
    surplus_deficit_consistency: surplus_deficit,
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let composite = 0;
  for (const k of Object.keys(weights)) {
    composite += metrics[k] * weights[k];
  }
  composite = (composite / totalWeight) * 10;

  let tier: ResilienceResult["tier"] = "Urgent";
  if (composite >= 75) tier = "Thriving";
  else if (composite >= 50) tier = "Stable";
  else if (composite >= 25) tier = "Needs Support";

  let confidence: ResilienceResult["confidence"] = "Low";
  if (org.length >= 4) confidence = "High";
  else if (org.length >= 3) confidence = "Medium";

  return {
    composite_score: Math.round(composite * 100) / 100,
    tier,
    confidence,
    years_of_data: org.length,
    metrics,
  };
}

export function tierToRiskBand(tier: ResilienceResult["tier"]): RiskBand {
  switch (tier) {
    case "Thriving":
      return "Foundation";
    case "Stable":
      return "Steady";
    case "Needs Support":
      return "Watch";
    default:
      return "At Risk";
  }
}

/** Rough FTE proxy from expense scale when headcount is not in 990 summary (demo use). */
export function estimateStaffFte(totalAnnualExpenses: number): number {
  if (totalAnnualExpenses <= 0) return 1;
  return Math.max(1, Math.round(totalAnnualExpenses / 80_000));
}
