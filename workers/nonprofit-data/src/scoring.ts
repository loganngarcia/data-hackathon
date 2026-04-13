/**
 * Moobu-style resilience scoring: 8 metrics (0–10 each) → weighted composite 0–100.
 * Ported from app/src/lib/resilience-score.ts for use inside the Worker.
 */
import type { YearFinancial } from "./normalize";

export type ResilienceScore = {
  composite_score: number;
  tier: "Strong" | "Stable" | "Vulnerable" | "Urgent";
  metrics: Record<string, number>;
};

function clamp(v: number, lo = 0, hi = 10): number {
  return Math.max(lo, Math.min(hi, v));
}

function median(nums: number[]): number {
  const s = nums.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export const scoring = {
  compute(years: YearFinancial[]): ResilienceScore | null {
    if (years.length < 2) return null;

    const latest   = years[years.length - 1]!;
    const all      = years.slice(-7);

    // 1. Operating reserve (net assets / annual expenses → months → score)
    const reserveMonths =
      latest.total_expenses > 0
        ? (latest.net_assets_eoy / latest.total_expenses) * 12
        : 0;
    const operating_reserve = clamp((reserveMonths / 12) * 10);

    // 2. Revenue growth YoY (latest vs prior)
    const prior = years[years.length - 2]!;
    const growth =
      Math.abs(prior.total_revenue) > 1e-9
        ? ((latest.total_revenue - prior.total_revenue) / Math.abs(prior.total_revenue)) * 100
        : 0;
    const revenue_growth = clamp(growth > 20 ? 10 : growth > 10 ? 8 : growth > 0 ? 6 : growth > -10 ? 4 : 2);

    // 3. Revenue diversification (1 - HHI of 4 streams, normalized to 0–10)
    const streams = [
      latest.contributions_grants,
      latest.program_service_rev,
      latest.investment_income,
      latest.other_revenue,
    ];
    const total = streams.reduce((s, v) => s + Math.max(0, v), 0);
    const hhi = total > 0
      ? streams.reduce((s, v) => s + (Math.max(0, v) / total) ** 2, 0)
      : 1;
    const revenue_diversification = clamp((1 - hhi) * 10 * 1.5);

    // 4. Expense stability (CV of expenses over available years, inverted)
    const expList = all.map((y) => y.total_expenses).filter((e) => e > 0);
    const expMed  = median(expList);
    const cv      = expMed > 0
      ? Math.sqrt(expList.reduce((s, e) => s + (e - expMed) ** 2, 0) / expList.length) / expMed
      : 1;
    const expense_stability = clamp((1 - cv) * 10);

    // 5. Surplus trend (rev_less_expenses positive for recent years)
    const surplusList = all.map((y) => y.rev_less_expenses);
    const positiveYears = surplusList.filter((s) => s >= 0).length;
    const surplus_trend = clamp((positiveYears / surplusList.length) * 10);

    // 6. Program ratio (program expenses / total expenses)
    const programRatio =
      latest.total_func_expenses > 0
        ? latest.program_expenses / latest.total_func_expenses
        : 0;
    const program_ratio = clamp(programRatio * 10);

    // 7. Net asset growth trend (direction over available years)
    const naList = all.map((y) => y.net_assets_eoy);
    const naGrowing = naList.length > 1 && naList[naList.length - 1]! > naList[0]!;
    const net_asset_trend = clamp(naGrowing ? 7 : 4);

    // 8. Revenue per-year consistency (YoY growth positive ≥ 60 % of years)
    const growthList = all.slice(1).map((y, i) => {
      const p = all[i]!.total_revenue;
      return Math.abs(p) > 1e-9 ? (y.total_revenue - p) / Math.abs(p) : 0;
    });
    const positiveGrowthPct = growthList.length > 0
      ? growthList.filter((g) => g >= 0).length / growthList.length
      : 0.5;
    const revenue_consistency = clamp(positiveGrowthPct * 10);

    const weights: Record<string, number> = {
      operating_reserve:        0.25,
      revenue_growth:           0.15,
      revenue_diversification:  0.15,
      expense_stability:        0.10,
      surplus_trend:            0.15,
      program_ratio:            0.10,
      net_asset_trend:          0.05,
      revenue_consistency:      0.05,
    };
    const metrics: Record<string, number> = {
      operating_reserve, revenue_growth, revenue_diversification,
      expense_stability, surplus_trend, program_ratio,
      net_asset_trend, revenue_consistency,
    };
    const composite_score = Object.entries(weights).reduce(
      (acc, [k, w]) => acc + (metrics[k] ?? 0) * w * 10,
      0,
    );

    const tier: ResilienceScore["tier"] =
      composite_score >= 75 ? "Strong"
      : composite_score >= 55 ? "Stable"
      : composite_score >= 35 ? "Vulnerable"
      : "Urgent";

    return { composite_score, tier, metrics };
  },
};
