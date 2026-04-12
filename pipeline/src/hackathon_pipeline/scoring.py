"""Resilience scoring and risk classification for nonprofits.

Eight-signal model covering:
  1. Revenue growth
  2. Revenue volatility
  3. Operating stability (margin)
  4. Liquidity / reserves
  5. Concentration risk (revenue HHI)
  6. Net asset trend
  7. Employee stability
  8. Shock recovery (margin recovery after deficit)

Outputs per-org scores, risk bands, top driver explanations, and
peer benchmark percentiles.
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq


# ── Signal definitions ─────────────────────────────────────────────────────
# Each signal function takes a feature dict (latest year) and returns a
# score from 0.0 (worst) to 1.0 (best), plus an explanation string.

def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _signal_revenue_growth(feat: dict[str, Any]) -> tuple[float, str]:
    growth = feat.get("revenue_growth_yoy")
    if growth is None:
        return 0.5, "No prior-year revenue data to assess growth."
    if growth > 0.10:
        score = _clamp(0.7 + growth * 1.5, 0.0, 1.0)
        return score, f"Strong revenue growth of {growth:.0%} year-over-year."
    if growth > 0.0:
        score = _clamp(0.5 + growth * 2.0)
        return score, f"Modest revenue growth of {growth:.0%} year-over-year."
    if growth > -0.10:
        score = _clamp(0.3 + (growth + 0.10) * 3.0)
        return score, f"Slight revenue decline of {growth:.0%} year-over-year."
    score = _clamp(0.1 + (growth + 0.30) * 0.5)
    return score, f"Significant revenue decline of {growth:.0%} year-over-year."


def _signal_revenue_volatility(feat: dict[str, Any]) -> tuple[float, str]:
    vol = feat.get("revenue_volatility_3yr")
    if vol is None:
        return 0.5, "Insufficient history to assess revenue volatility."
    if vol < 0.05:
        return 0.95, "Very stable revenue stream (< 5% 3-year volatility)."
    if vol < 0.15:
        score = _clamp(0.9 - (vol - 0.05) * 4.0)
        return score, f"Moderate revenue volatility ({vol:.0%} 3-year CV)."
    if vol < 0.30:
        score = _clamp(0.5 - (vol - 0.15) * 2.0)
        return score, f"Elevated revenue volatility ({vol:.0%} 3-year CV)."
    score = _clamp(0.15 - (vol - 0.30) * 0.5)
    return score, f"High revenue volatility ({vol:.0%} 3-year CV) indicates instability."


def _signal_operating_stability(feat: dict[str, Any]) -> tuple[float, str]:
    margin = feat.get("operating_margin")
    avg_margin = feat.get("avg_operating_margin_3yr")
    m = avg_margin if avg_margin is not None else margin
    if m is None:
        return 0.5, "No margin data available."
    if m > 0.10:
        return _clamp(0.8 + m * 0.5), f"Healthy operating margin of {m:.1%}."
    if m > 0.0:
        return _clamp(0.5 + m * 3.0), f"Positive but thin operating margin of {m:.1%}."
    if m > -0.10:
        return _clamp(0.3 + (m + 0.10) * 3.0), f"Slight operating deficit ({m:.1%} margin)."
    return _clamp(0.1 + (m + 0.30) * 0.5), f"Significant operating deficit ({m:.1%} margin)."


def _signal_liquidity(feat: dict[str, Any]) -> tuple[float, str]:
    months = feat.get("months_of_reserve")
    if months is None:
        return 0.3, "Unable to calculate reserve months."
    if months >= 12:
        return _clamp(0.85 + (months - 12) * 0.005), f"{months:.1f} months of reserves (strong cushion)."
    if months >= 6:
        score = _clamp(0.5 + (months - 6) / 6 * 0.35)
        return score, f"{months:.1f} months of reserves (adequate)."
    if months >= 3:
        score = _clamp(0.25 + (months - 3) / 3 * 0.25)
        return score, f"{months:.1f} months of reserves (thin cushion)."
    if months >= 0:
        return _clamp(0.1 + months / 3 * 0.15), f"Only {months:.1f} months of reserves (fragile)."
    return 0.05, f"Negative net assets imply {months:.1f} months of deficit."


def _signal_concentration(feat: dict[str, Any]) -> tuple[float, str]:
    hhi = feat.get("revenue_hhi")
    if hhi is None:
        return 0.5, "Revenue breakdown not available to assess concentration."
    # HHI ranges from 0.25 (perfectly even across 4 streams) to 1.0 (single source)
    if hhi < 0.35:
        return 0.9, f"Well-diversified revenue (HHI {hhi:.2f})."
    if hhi < 0.50:
        score = _clamp(0.7 - (hhi - 0.35) * 2.0)
        return score, f"Moderately concentrated revenue (HHI {hhi:.2f})."
    if hhi < 0.75:
        score = _clamp(0.4 - (hhi - 0.50) * 1.2)
        return score, f"Concentrated revenue (HHI {hhi:.2f}); vulnerable to single-source loss."
    return _clamp(0.15 - (hhi - 0.75) * 0.4), f"Highly concentrated revenue (HHI {hhi:.2f}); single-source dependent."


def _signal_net_asset_trend(feat: dict[str, Any]) -> tuple[float, str]:
    change = feat.get("net_asset_change_yoy")
    if change is None:
        return 0.5, "No prior-year net asset data for trend assessment."
    if change > 0.05:
        return _clamp(0.7 + change * 1.0), f"Net assets grew {change:.0%} year-over-year."
    if change > -0.05:
        return _clamp(0.45 + change * 2.0), f"Net assets roughly stable ({change:+.0%} YoY)."
    if change > -0.15:
        return _clamp(0.25 + (change + 0.15) * 2.0), f"Net assets declined {change:.0%} year-over-year."
    return _clamp(0.05 + (change + 0.30) * 0.5), f"Sharp net asset decline of {change:.0%} is a red flag."


def _signal_employee_stability(feat: dict[str, Any]) -> tuple[float, str]:
    change = feat.get("employee_change_yoy")
    if change is None:
        return 0.5, "No employee trend data available."
    if -0.05 <= change <= 0.15:
        return 0.8, f"Stable workforce ({change:+.0%} YoY change)."
    if change > 0.15:
        return 0.65, f"Rapid workforce growth ({change:+.0%}); may signal scaling strain."
    if change > -0.15:
        return _clamp(0.4 + (change + 0.15) * 3.0), f"Workforce contraction ({change:+.0%} YoY)."
    return _clamp(0.1 + (change + 0.30) * 0.5), f"Major workforce reduction ({change:+.0%}) signals distress."


def _signal_shock_recovery(feat: dict[str, Any]) -> tuple[float, str]:
    """Assess ability to recover from financial shocks.

    Uses a combination of reserves, margin trend, and revenue diversity.
    """
    months = feat.get("months_of_reserve") or 0
    margin = feat.get("operating_margin") or 0
    hhi = feat.get("revenue_hhi") or 0.5
    vol = feat.get("revenue_volatility_3yr") or 0.15

    # Higher reserves + better margins + lower concentration = better recovery
    reserve_score = _clamp(months / 12)
    margin_score = _clamp((margin + 0.1) / 0.3)
    diversity_score = _clamp(1.0 - hhi)
    stability_score = _clamp(1.0 - vol * 3)

    composite = (reserve_score * 0.4 + margin_score * 0.25 +
                 diversity_score * 0.2 + stability_score * 0.15)
    score = _clamp(composite)

    if score > 0.7:
        return score, "Strong shock absorption capacity: solid reserves, margins, and diversification."
    if score > 0.4:
        return score, "Moderate shock resilience; some vulnerability to sustained revenue disruption."
    return score, "Weak shock recovery outlook; limited buffer against financial disruptions."


# ── Composite scoring ──────────────────────────────────────────────────────

SIGNAL_FUNCTIONS = [
    ("revenue_growth", _signal_revenue_growth, 0.12),
    ("revenue_volatility", _signal_revenue_volatility, 0.12),
    ("operating_stability", _signal_operating_stability, 0.15),
    ("liquidity", _signal_liquidity, 0.18),
    ("concentration_risk", _signal_concentration, 0.12),
    ("net_asset_trend", _signal_net_asset_trend, 0.10),
    ("employee_stability", _signal_employee_stability, 0.08),
    ("shock_recovery", _signal_shock_recovery, 0.13),
]

RISK_BANDS = [
    ("Steady", 0.60, 1.0),
    ("Watch", 0.35, 0.60),
    ("At Risk", 0.0, 0.35),
]


def score_organization(feat: dict[str, Any]) -> dict[str, Any]:
    """Compute resilience score and risk band for a single org-year."""
    signals: dict[str, dict[str, Any]] = {}
    weighted_sum = 0.0
    total_weight = 0.0

    for name, func, weight in SIGNAL_FUNCTIONS:
        score, explanation = func(feat)
        signals[name] = {
            "score": round(score, 3),
            "weight": weight,
            "weighted_score": round(score * weight, 4),
            "explanation": explanation,
        }
        weighted_sum += score * weight
        total_weight += weight

    composite_score = weighted_sum / total_weight if total_weight > 0 else 0.5
    composite_score = round(composite_score, 3)

    # Determine risk band
    risk_band = "Watch"
    for band, lo, hi in RISK_BANDS:
        if lo <= composite_score < hi:
            risk_band = band
            break
    if composite_score >= 1.0:
        risk_band = "Steady"

    # Top drivers (sorted by absolute contribution to score)
    sorted_signals = sorted(
        signals.items(),
        key=lambda x: abs(x[1]["weighted_score"] - x[1]["weight"] * 0.5),
        reverse=True,
    )
    top_drivers = [
        {"signal": name, "direction": "positive" if info["score"] > 0.5 else "negative",
         "explanation": info["explanation"]}
        for name, info in sorted_signals[:3]
    ]

    # Watchouts: signals scoring below 0.3
    watchouts = [
        info["explanation"]
        for name, info in signals.items()
        if info["score"] < 0.3
    ]

    return {
        "ein": feat.get("ein"),
        "organization_name": feat.get("organization_name"),
        "tax_year": feat.get("tax_year"),
        "state": feat.get("state"),
        "city": feat.get("city"),
        "size_band": feat.get("size_band"),
        "resilience_score": composite_score,
        "risk_band": risk_band,
        "total_revenue": feat.get("total_revenue"),
        "total_expenses": feat.get("total_expenses"),
        "operating_margin": feat.get("operating_margin"),
        "months_of_reserve": feat.get("months_of_reserve"),
        "revenue_hhi": feat.get("revenue_hhi"),
        "revenue_growth_yoy": feat.get("revenue_growth_yoy"),
        "revenue_volatility_3yr": feat.get("revenue_volatility_3yr"),
        "net_assets_eoy": feat.get("net_assets_eoy"),
        "total_employee_count": feat.get("total_employee_count"),
        "program_expense_ratio": feat.get("program_expense_ratio"),
        "contribution_share": feat.get("contribution_share"),
        "program_revenue_share": feat.get("program_revenue_share"),
        "years_of_data": feat.get("years_of_data"),
        "peer_group": feat.get("peer_group"),
        "margin_pctile_peer": feat.get("margin_pctile_peer"),
        "reserve_pctile_peer": feat.get("reserve_pctile_peer"),
        "concentration_pctile_peer": feat.get("concentration_pctile_peer"),
        "margin_pctile_size": feat.get("margin_pctile_size"),
        "signals": signals,
        "top_drivers": top_drivers,
        "watchouts": watchouts,
    }


# ── Output schema ──────────────────────────────────────────────────────────

SCORES_SCHEMA = pa.schema([
    pa.field("ein", pa.string()),
    pa.field("organization_name", pa.string()),
    pa.field("tax_year", pa.string()),
    pa.field("state", pa.string()),
    pa.field("city", pa.string()),
    pa.field("size_band", pa.string()),
    pa.field("resilience_score", pa.float64()),
    pa.field("risk_band", pa.string()),
    pa.field("total_revenue", pa.int64()),
    pa.field("total_expenses", pa.int64()),
    pa.field("operating_margin", pa.float64()),
    pa.field("months_of_reserve", pa.float64()),
    pa.field("revenue_hhi", pa.float64()),
    pa.field("revenue_growth_yoy", pa.float64()),
    pa.field("revenue_volatility_3yr", pa.float64()),
    pa.field("net_assets_eoy", pa.int64()),
    pa.field("total_employee_count", pa.int64()),
    pa.field("program_expense_ratio", pa.float64()),
    pa.field("contribution_share", pa.float64()),
    pa.field("program_revenue_share", pa.float64()),
    pa.field("years_of_data", pa.int64()),
    pa.field("peer_group", pa.string()),
    pa.field("margin_pctile_peer", pa.float64()),
    pa.field("reserve_pctile_peer", pa.float64()),
    pa.field("concentration_pctile_peer", pa.float64()),
    pa.field("margin_pctile_size", pa.float64()),
])


def _write_parquet(rows: list[dict[str, Any]], path: Path, schema: pa.Schema) -> None:
    if not rows:
        table = pa.table({f.name: pa.array([], type=f.type) for f in schema})
        pq.write_table(table, path)
        return
    columns: dict[str, list[Any]] = {f.name: [] for f in schema}
    for row in rows:
        for f in schema:
            columns[f.name].append(row.get(f.name))
    arrays = [pa.array(columns[f.name], type=f.type) for f in schema]
    table = pa.table({f.name: arr for f, arr in zip(schema, arrays)})
    pq.write_table(table, path)


# ── Public API ─────────────────────────────────────────────────────────────

def score_portfolio(features_dir: Path, output_dir: Path) -> dict[str, Any]:
    """Score all organizations and produce risk-banded portfolio.

    Reads: features_dir/features.parquet
    Writes:
      - output_dir/scores.parquet
      - output_dir/scores_detail.json  (full signal breakdowns)
      - manifests_dir/scoring_manifest.json
    """
    features_dir = Path(features_dir).expanduser().resolve()
    output_dir = Path(output_dir).expanduser().resolve()
    manifests_dir = output_dir.parent / "manifests"

    features_path = features_dir / "features.parquet"
    if not features_path.exists():
        return {
            "status": "error",
            "step": "score",
            "message": f"Feature table not found at {features_path}. Run build-features first.",
        }

    table = pq.read_table(features_path)
    rows = table.to_pylist()

    if not rows:
        return {"status": "error", "step": "score", "message": "Feature table is empty."}

    # Get latest year per EIN for scoring
    latest_by_ein: dict[str, dict[str, Any]] = {}
    for row in rows:
        ein = row.get("ein")
        if ein is None:
            continue
        year = row.get("tax_year", "")
        if ein not in latest_by_ein or year > latest_by_ein[ein].get("tax_year", ""):
            latest_by_ein[ein] = row

    # Score each org
    scored: list[dict[str, Any]] = []
    for ein, feat in sorted(latest_by_ein.items()):
        scored.append(score_organization(feat))

    # Write outputs
    output_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    scores_path = output_dir / "scores.parquet"
    _write_parquet(scored, scores_path, SCORES_SCHEMA)

    # Full detail JSON (includes signal breakdowns)
    detail_path = output_dir / "scores_detail.json"
    detail_path.write_text(json.dumps(scored, indent=2, default=str) + "\n", encoding="utf-8")

    # Scoring manifest
    band_counts = defaultdict(int)
    score_values = []
    for s in scored:
        band_counts[s["risk_band"]] += 1
        score_values.append(s["resilience_score"])

    manifest = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "organizations_scored": len(scored),
        "risk_band_distribution": dict(sorted(band_counts.items())),
        "score_stats": {
            "min": min(score_values) if score_values else None,
            "max": max(score_values) if score_values else None,
            "mean": round(sum(score_values) / len(score_values), 3) if score_values else None,
            "median": sorted(score_values)[len(score_values) // 2] if score_values else None,
        },
        "signal_weights": {name: weight for name, _, weight in SIGNAL_FUNCTIONS},
        "outputs": {
            "scores_parquet": str(scores_path),
            "scores_detail_json": str(detail_path),
        },
    }
    manifest_path = manifests_dir / "scoring_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    return {
        "status": "ok",
        "step": "score",
        "organizations_scored": len(scored),
        "risk_band_distribution": dict(band_counts),
        "outputs": {
            "scores_parquet": str(scores_path),
            "scores_detail_json": str(detail_path),
            "scoring_manifest": str(manifest_path),
        },
    }
