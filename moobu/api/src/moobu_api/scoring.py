"""Resilience Score Engine — 8 financial metrics → composite 0–100 score."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd

from .db import get_db


def _safe_num(val, default=0) -> float:
    """Safely convert a pandas value to float, handling NA/NaN."""
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _hhi(contributions: float, program_rev: float, investment: float, other: float) -> float:
    """Herfindahl-Hirschman Index for revenue concentration.

    Returns 0–1 where 1 = all revenue from one source (most concentrated).
    """
    total = abs(contributions) + abs(program_rev) + abs(investment) + abs(other)
    if total == 0:
        return 1.0
    shares = [abs(v) / total for v in [contributions, program_rev, investment, other]]
    return sum(s * s for s in shares)


def compute_org_metrics(org_df: pd.DataFrame) -> dict | None:
    """Compute 8 resilience metrics for a single org's multi-year data.

    org_df should be sorted by tax_year ascending.
    Returns None if insufficient data.
    """
    if len(org_df) < 2:
        return None

    latest = org_df.iloc[-1]
    ein = latest["ein"]
    org_name = latest["org_name"]
    state = latest["state"]

    # 1. Revenue Concentration (HHI) — latest year
    hhi = _hhi(
        _safe_num(latest.get("contributions_grants")),
        _safe_num(latest.get("program_service_rev")),
        _safe_num(latest.get("investment_income")),
        _safe_num(latest.get("other_revenue")),
    )
    # Convert: lower HHI = more diversified = better. Score: 10 * (1 - HHI)
    # HHI range for 4 sources: [0.25, 1.0]
    revenue_concentration = max(0, min(10, 10 * (1 - hhi) / 0.75))

    # 2. Operating Reserve Ratio — net_assets / total_expenses
    net_assets = _safe_num(latest.get("net_assets_eoy"))
    total_expenses = _safe_num(latest.get("total_expenses"))
    if total_expenses > 0:
        reserve_months = (net_assets / total_expenses) * 12
    else:
        reserve_months = 0
    # Score: cap at 12 months = 10, linear scale
    operating_reserve = max(0, min(10, reserve_months / 12 * 10))

    # 3. Revenue Growth Trend (CAGR)
    revenues = org_df["total_revenue"].dropna()
    if len(revenues) >= 2 and revenues.iloc[0] > 0 and revenues.iloc[-1] > 0:
        n_years = len(revenues) - 1
        cagr = (revenues.iloc[-1] / revenues.iloc[0]) ** (1 / n_years) - 1
    else:
        cagr = 0
    # Score: -20% = 0, 0% = 5, +20% = 10
    revenue_growth = max(0, min(10, 5 + cagr * 25))

    # 4. Expense vs Revenue Growth
    expenses = org_df["total_expenses"].dropna()
    if len(revenues) >= 2 and len(expenses) >= 2:
        rev_growth = (revenues.iloc[-1] - revenues.iloc[0]) / max(abs(revenues.iloc[0]), 1)
        exp_growth = (expenses.iloc[-1] - expenses.iloc[0]) / max(abs(expenses.iloc[0]), 1)
        growth_diff = rev_growth - exp_growth  # positive = revenue growing faster
    else:
        growth_diff = 0
    # Score: revenue growing faster than expenses = good
    expense_vs_revenue = max(0, min(10, 5 + growth_diff * 20))

    # 5. Program Expense Ratio
    prog_expenses = _safe_num(latest.get("program_expenses"))
    func_expenses = _safe_num(latest.get("total_func_expenses")) or _safe_num(latest.get("total_expenses"))
    if func_expenses > 0:
        program_ratio = prog_expenses / func_expenses
    else:
        program_ratio = 0
    # Score: 75%+ = 10, 50% = 5, below 25% = 0
    program_expense = max(0, min(10, program_ratio * 10 / 0.75))

    # 6. Revenue Volatility (coefficient of variation)
    if len(revenues) >= 2 and revenues.mean() != 0:
        cv = revenues.std() / abs(revenues.mean())
    else:
        cv = 0
    # Score: lower volatility = better. CV of 0 = 10, CV of 1 = 0
    revenue_volatility = max(0, min(10, 10 * (1 - cv)))

    # 7. Net Asset Trend
    net_assets_series = org_df["net_assets_eoy"].dropna()
    if len(net_assets_series) >= 2 and abs(net_assets_series.iloc[0]) > 0:
        asset_growth = (net_assets_series.iloc[-1] - net_assets_series.iloc[0]) / abs(net_assets_series.iloc[0])
    else:
        asset_growth = 0
    # Score: growing assets = good
    net_asset_trend = max(0, min(10, 5 + asset_growth * 10))

    # 8. Surplus/Deficit Consistency
    surpluses = org_df["rev_less_expenses"].dropna()
    if len(surpluses) > 0:
        positive_years = (surpluses > 0).sum()
        consistency_ratio = positive_years / len(surpluses)
    else:
        consistency_ratio = 0.5
    # Score: all surplus years = 10, all deficit = 0
    surplus_deficit = consistency_ratio * 10

    # Composite Score: weighted sum
    # Revenue concentration and operating reserves at 2x weight
    weights = {
        "revenue_concentration_hhi": 2,
        "operating_reserve_ratio": 2,
        "revenue_growth_trend": 1,
        "expense_vs_revenue_growth": 1,
        "program_expense_ratio": 1,
        "revenue_volatility": 1,
        "net_asset_trend": 1,
        "surplus_deficit_consistency": 1,
    }
    metrics = {
        "revenue_concentration_hhi": revenue_concentration,
        "operating_reserve_ratio": operating_reserve,
        "revenue_growth_trend": revenue_growth,
        "expense_vs_revenue_growth": expense_vs_revenue,
        "program_expense_ratio": program_expense,
        "revenue_volatility": revenue_volatility,
        "net_asset_trend": net_asset_trend,
        "surplus_deficit_consistency": surplus_deficit,
    }

    total_weight = sum(weights.values())
    composite = sum(metrics[k] * weights[k] for k in weights) / total_weight * 10

    # Tier assignment
    if composite >= 75:
        tier = "Thriving"
    elif composite >= 50:
        tier = "Stable"
    elif composite >= 25:
        tier = "Needs Support"
    else:
        tier = "Urgent"

    # Confidence based on years of data
    years = len(org_df)
    if years >= 4:
        confidence = "High"
    elif years >= 3:
        confidence = "Medium"
    else:
        confidence = "Low"

    return {
        "ein": ein,
        "org_name": org_name,
        "state": state,
        "composite_score": round(composite, 2),
        "tier": tier,
        "confidence": confidence,
        "years_of_data": years,
        **{k: round(v, 4) for k, v in metrics.items()},
        "latest_total_revenue": int(_safe_num(latest.get("total_revenue"))),
        "latest_total_expenses": int(_safe_num(latest.get("total_expenses"))),
        "latest_net_assets": int(_safe_num(latest.get("net_assets_eoy"))),
    }


def score_all_orgs(db_path=None) -> dict:
    """Compute resilience scores for all qualifying orgs and store in DuckDB."""
    db = get_db(db_path)

    # Load all filings
    filings_df = db.sql("SELECT * FROM filings ORDER BY ein, tax_year").df()
    print(f"Loaded {len(filings_df)} filings for {filings_df['ein'].nunique()} orgs")

    results = []
    for ein, org_df in filings_df.groupby("ein"):
        org_df = org_df.sort_values("tax_year").reset_index(drop=True)
        metrics = compute_org_metrics(org_df)
        if metrics is not None:
            results.append(metrics)

    print(f"Scored {len(results)} organizations")

    if not results:
        return {"scored": 0}

    scores_df = pd.DataFrame(results)

    # Load into DuckDB
    db.execute("DELETE FROM org_scores")
    db.execute("INSERT INTO org_scores SELECT * FROM scores_df")

    # Summary stats
    count = db.execute("SELECT COUNT(*) FROM org_scores").fetchone()[0]
    tier_dist = db.execute(
        "SELECT tier, COUNT(*) FROM org_scores GROUP BY tier ORDER BY tier"
    ).fetchall()
    avg_score = db.execute("SELECT AVG(composite_score) FROM org_scores").fetchone()[0]
    std_score = db.execute(
        "SELECT STDDEV(composite_score) FROM org_scores"
    ).fetchone()[0]

    summary = {
        "scored": count,
        "avg_score": round(avg_score, 2),
        "std_score": round(std_score, 2),
        "tiers": {tier: cnt for tier, cnt in tier_dist},
    }
    print(f"Avg score: {summary['avg_score']}, Std: {summary['std_score']}")
    print(f"Tiers: {summary['tiers']}")
    return summary


if __name__ == "__main__":
    score_all_orgs()
