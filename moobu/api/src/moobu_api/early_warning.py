"""Early-Warning Engine — identify nonprofits showing pre-crisis patterns."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

from .db import get_db


def _find_crisis_events(filings_df: pd.DataFrame, threshold: float = 0.30) -> pd.DataFrame:
    """Find historical >threshold single-year revenue drops."""
    events = []
    for ein, org_df in filings_df.groupby("ein"):
        org_df = org_df.sort_values("tax_year").reset_index(drop=True)
        if len(org_df) < 2:
            continue
        for i in range(1, len(org_df)):
            prev_rev = org_df.iloc[i - 1]["total_revenue"]
            curr_rev = org_df.iloc[i]["total_revenue"]
            if pd.isna(prev_rev) or pd.isna(curr_rev) or prev_rev <= 0:
                continue
            drop_pct = (prev_rev - curr_rev) / prev_rev
            if drop_pct >= threshold:
                events.append({
                    "ein": ein,
                    "crisis_year": int(org_df.iloc[i]["tax_year"]),
                    "revenue_drop_pct": round(drop_pct, 4),
                    "pre_crisis_revenue": int(prev_rev),
                    "crisis_revenue": int(curr_rev),
                })
    return pd.DataFrame(events) if events else pd.DataFrame(
        columns=["ein", "crisis_year", "revenue_drop_pct", "pre_crisis_revenue", "crisis_revenue"]
    )


def _build_features(org_df: pd.DataFrame) -> dict | None:
    """Build feature vector for early-warning classification."""
    if len(org_df) < 2:
        return None

    latest = org_df.iloc[-1]
    prev = org_df.iloc[-2]

    def safe(val, default=0.0):
        if pd.isna(val):
            return default
        return float(val)

    total_rev = safe(latest["total_revenue"])
    prev_rev = safe(prev["total_revenue"])
    total_exp = safe(latest["total_expenses"])
    net_assets = safe(latest["net_assets_eoy"])
    contributions = safe(latest["contributions_grants"])

    # Features for classification
    features = {}

    # Reserve ratio (months)
    features["reserve_months"] = (net_assets / total_exp * 12) if total_exp > 0 else 0

    # Revenue change YoY
    features["rev_change_pct"] = (
        (total_rev - prev_rev) / abs(prev_rev) if prev_rev != 0 else 0
    )

    # Contribution concentration
    features["contribution_pct"] = contributions / total_rev if total_rev > 0 else 1.0

    # Expense to revenue ratio
    features["expense_ratio"] = total_exp / total_rev if total_rev > 0 else 2.0

    # Net surplus/deficit
    surplus = safe(latest["rev_less_expenses"])
    features["surplus_pct"] = surplus / total_rev if total_rev > 0 else -1.0

    # Revenue volatility (if enough data)
    revs = org_df["total_revenue"].dropna()
    if len(revs) >= 2 and revs.mean() != 0:
        features["rev_volatility"] = float(revs.std() / abs(revs.mean()))
    else:
        features["rev_volatility"] = 0

    # Net asset trend
    assets = org_df["net_assets_eoy"].dropna()
    if len(assets) >= 2 and abs(assets.iloc[0]) > 0:
        features["asset_trend"] = float(
            (assets.iloc[-1] - assets.iloc[0]) / abs(assets.iloc[0])
        )
    else:
        features["asset_trend"] = 0

    return features


def _rule_based_warning(features: dict) -> tuple[float, list[str]]:
    """Rule-based early warning when not enough crisis data for ML.

    Returns (vulnerability_score 0-1, list of contributing factors).
    """
    score = 0.0
    factors = []

    # Low reserves (<3 months)
    if features["reserve_months"] < 1:
        score += 0.30
        factors.append(f"Very low reserves ({features['reserve_months']:.1f} months)")
    elif features["reserve_months"] < 3:
        score += 0.15
        factors.append(f"Low reserves ({features['reserve_months']:.1f} months)")

    # Revenue declining
    if features["rev_change_pct"] < -0.10:
        score += 0.25
        factors.append(f"Revenue declining ({features['rev_change_pct']*100:.1f}% YoY)")
    elif features["rev_change_pct"] < -0.02:
        score += 0.10
        factors.append(f"Revenue slightly declining ({features['rev_change_pct']*100:.1f}% YoY)")

    # High contribution concentration (>80%)
    if features["contribution_pct"] > 0.90:
        score += 0.15
        factors.append(f"Very high contribution dependence ({features['contribution_pct']*100:.0f}%)")
    elif features["contribution_pct"] > 0.80:
        score += 0.08
        factors.append(f"High contribution dependence ({features['contribution_pct']*100:.0f}%)")

    # Expenses exceeding revenue
    if features["expense_ratio"] > 1.1:
        score += 0.15
        factors.append(f"Expenses exceed revenue by {(features['expense_ratio']-1)*100:.0f}%")

    # Deficit
    if features["surplus_pct"] < -0.05:
        score += 0.10
        factors.append(f"Operating deficit ({features['surplus_pct']*100:.1f}% of revenue)")

    # High revenue volatility
    if features["rev_volatility"] > 0.30:
        score += 0.05
        factors.append(f"High revenue volatility (CV={features['rev_volatility']:.2f})")

    # Declining assets
    if features["asset_trend"] < -0.10:
        score += 0.10
        factors.append(f"Net assets declining ({features['asset_trend']*100:.1f}%)")

    return min(score, 1.0), factors


def _generate_recommendation(factors: list[str], features: dict) -> str:
    """Generate plain-English intervention recommendation."""
    recs = []
    if features["contribution_pct"] > 0.80:
        recs.append("Diversify revenue sources beyond contributions/grants")
    if features["reserve_months"] < 3:
        recs.append("Build operating reserves to at least 3 months of expenses")
    if features["expense_ratio"] > 1.0:
        recs.append("Align expenses with revenue — review cost structure")
    if features["rev_change_pct"] < -0.05:
        recs.append("Investigate revenue decline drivers and develop growth strategy")
    if features["asset_trend"] < -0.10:
        recs.append("Address net asset erosion to maintain long-term stability")
    return "; ".join(recs) if recs else "Monitor financial health indicators"


def run_early_warning(db_path=None) -> dict:
    """Run the full early-warning pipeline."""
    db = get_db(db_path)

    filings_df = db.sql("SELECT * FROM filings ORDER BY ein, tax_year").df()
    print(f"Loaded {len(filings_df)} filings for {filings_df['ein'].nunique()} orgs")

    # Step 1: Find historical crisis events
    crisis_df = _find_crisis_events(filings_df)
    print(f"Found {len(crisis_df)} crisis events (>30% revenue drop)")

    # Store crisis events
    db.execute("DELETE FROM crisis_events")
    if len(crisis_df) > 0:
        db.execute("INSERT INTO crisis_events SELECT * FROM crisis_df")

    # Step 2: Score all orgs with rule-based approach
    # (ML requires more crisis events than we may have for reliable training)
    warnings = []
    for ein, org_df in filings_df.groupby("ein"):
        org_df = org_df.sort_values("tax_year").reset_index(drop=True)
        features = _build_features(org_df)
        if features is None:
            continue
        score, factors = _rule_based_warning(features)
        if score > 0:
            rec = _generate_recommendation(factors, features)
            warnings.append({
                "ein": ein,
                "org_name": org_df.iloc[-1].get("org_name", ""),
                "vulnerability_score": round(score, 4),
                "method": "rule_based",
                "factors": json.dumps(factors),
                "recommendation": rec,
            })

    print(f"Generated {len(warnings)} early warnings")

    if warnings:
        warnings_df = pd.DataFrame(warnings)
        db.execute("DELETE FROM early_warnings")
        db.execute("INSERT INTO early_warnings SELECT * FROM warnings_df")

    # Summary
    high_risk = sum(1 for w in warnings if w["vulnerability_score"] > 0.5)
    summary = {
        "crisis_events": len(crisis_df),
        "warnings_total": len(warnings),
        "high_risk": high_risk,
        "method": "rule_based",
    }
    print(f"High risk (>0.5): {high_risk}")
    return summary


if __name__ == "__main__":
    run_early_warning()
