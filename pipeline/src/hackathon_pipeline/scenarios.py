"""Scenario engine: simulate financial interventions and project score changes.

Implements controlled scenario levers:
  - Grant/revenue cut (e.g. 20% federal funding drop)
  - Reserve grant injection
  - Revenue diversification improvement
  - Operating margin improvement
  - Staffing stabilization

Each scenario recomputes projected features and re-scores, producing
a before/after comparison labeled as a forecasted scenario.
"""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from .scoring import score_organization


# ── Scenario definitions ───────────────────────────────────────────────────

SCENARIO_CATALOG = {
    "grant_cut_20pct": {
        "title": "20% Grant/Contribution Cut",
        "assumption": "Contributions and grants decline by 20%, simulating a major funder withdrawal.",
        "lever": "contributions_cut",
        "magnitude": 0.20,
    },
    "grant_cut_40pct": {
        "title": "40% Grant/Contribution Cut",
        "assumption": "Severe 40% decline in contributions, simulating loss of primary funding source.",
        "lever": "contributions_cut",
        "magnitude": 0.40,
    },
    "reserve_grant_500k": {
        "title": "$500K Reserve Grant",
        "assumption": "Organization receives a one-time $500,000 unrestricted reserve grant.",
        "lever": "reserve_injection",
        "magnitude": 500_000,
    },
    "diversification_boost": {
        "title": "Revenue Diversification Improvement",
        "assumption": "Organization shifts 15% of concentrated revenue into a secondary stream.",
        "lever": "diversify_revenue",
        "magnitude": 0.15,
    },
    "margin_improvement_5pct": {
        "title": "5-Point Margin Improvement",
        "assumption": "Operating margin improves by 5 percentage points through cost optimization.",
        "lever": "margin_improvement",
        "magnitude": 0.05,
    },
}


def _apply_contributions_cut(feat: dict[str, Any], magnitude: float) -> dict[str, Any]:
    """Simulate a cut to contributions/grants."""
    f = deepcopy(feat)
    contrib = f.get("contributions_grants") or f.get("contribution_share", 0)

    # Work with absolute values if available
    revenue = f.get("total_revenue") or 0
    contrib_share = f.get("contribution_share") or 0
    contrib_amount = revenue * contrib_share

    cut_amount = int(contrib_amount * magnitude)
    if f.get("total_revenue") is not None:
        f["total_revenue"] = max(0, (f["total_revenue"] or 0) - cut_amount)
    if f.get("contribution_share") is not None and f.get("contribution_share", 0) > 0:
        new_share = f["contribution_share"] * (1 - magnitude)
        # Redistribute: other shares stay absolute, recompute ratios
        new_total = max(1, (revenue or 1) - cut_amount)
        f["contribution_share"] = new_share
        if new_total > 0:
            f["revenue_hhi"] = _recompute_hhi(f, new_total, revenue)

    # Recompute operating margin
    expenses = f.get("total_expenses") or 0
    new_rev = f.get("total_revenue") or 0
    f["operating_margin"] = (new_rev - expenses) / new_rev if new_rev > 0 else None
    f["revenue_growth_yoy"] = -magnitude  # Proxy: the cut is the growth

    # Recompute reserves
    if f.get("net_assets_eoy") is not None:
        f["net_assets_eoy"] = (f["net_assets_eoy"] or 0) - cut_amount
        if expenses > 0:
            f["months_of_reserve"] = f["net_assets_eoy"] / (expenses / 12)

    return f


def _apply_reserve_injection(feat: dict[str, Any], amount: int) -> dict[str, Any]:
    """Simulate a one-time reserve grant."""
    f = deepcopy(feat)
    f["net_assets_eoy"] = (f.get("net_assets_eoy") or 0) + amount
    expenses = f.get("total_expenses") or 0
    if expenses > 0:
        f["months_of_reserve"] = f["net_assets_eoy"] / (expenses / 12)
    return f


def _apply_diversify_revenue(feat: dict[str, Any], shift_pct: float) -> dict[str, Any]:
    """Simulate revenue diversification by shifting concentration."""
    f = deepcopy(feat)
    contrib_share = f.get("contribution_share") or 0
    program_share = f.get("program_revenue_share") or 0

    if contrib_share > 0.5:
        shift = contrib_share * shift_pct
        f["contribution_share"] = contrib_share - shift
        f["program_revenue_share"] = program_share + shift
    elif program_share > 0.5:
        shift = program_share * shift_pct
        f["program_revenue_share"] = program_share - shift
        f["contribution_share"] = contrib_share + shift

    # Recompute HHI
    shares = [
        f.get("contribution_share") or 0,
        f.get("program_revenue_share") or 0,
        f.get("investment_share") or 0,
        max(0, 1 - (f.get("contribution_share") or 0) -
            (f.get("program_revenue_share") or 0) -
            (f.get("investment_share") or 0)),
    ]
    f["revenue_hhi"] = sum(s * s for s in shares)
    return f


def _apply_margin_improvement(feat: dict[str, Any], improvement: float) -> dict[str, Any]:
    """Simulate operating margin improvement."""
    f = deepcopy(feat)
    current_margin = f.get("operating_margin") or 0
    f["operating_margin"] = current_margin + improvement
    f["avg_operating_margin_3yr"] = (f.get("avg_operating_margin_3yr") or current_margin) + improvement

    # Adjust expenses to match the new margin
    revenue = f.get("total_revenue") or 0
    if revenue > 0:
        new_expenses = int(revenue * (1 - (current_margin + improvement)))
        f["total_expenses"] = max(0, new_expenses)
        if new_expenses > 0 and f.get("net_assets_eoy") is not None:
            f["months_of_reserve"] = f["net_assets_eoy"] / (new_expenses / 12)

    return f


def _recompute_hhi(feat: dict[str, Any], new_total: int, old_total: int) -> float:
    shares = [
        feat.get("contribution_share") or 0,
        feat.get("program_revenue_share") or 0,
        feat.get("investment_share") or 0,
    ]
    other = max(0, 1 - sum(shares))
    shares.append(other)
    return sum(s * s for s in shares)


LEVER_FUNCTIONS = {
    "contributions_cut": _apply_contributions_cut,
    "reserve_injection": _apply_reserve_injection,
    "diversify_revenue": _apply_diversify_revenue,
    "margin_improvement": _apply_margin_improvement,
}


def run_scenario(
    feat: dict[str, Any],
    scenario_id: str,
) -> dict[str, Any] | None:
    """Run a single scenario on an org's feature set.

    Returns a scenario result dict with before/after scores, or None
    if the scenario is not applicable.
    """
    if scenario_id not in SCENARIO_CATALOG:
        return None

    scenario = SCENARIO_CATALOG[scenario_id]
    lever_func = LEVER_FUNCTIONS.get(scenario["lever"])
    if lever_func is None:
        return None

    # Score baseline
    baseline = score_organization(feat)

    # Apply intervention
    projected_feat = lever_func(feat, scenario["magnitude"])
    projected = score_organization(projected_feat)

    score_delta = projected["resilience_score"] - baseline["resilience_score"]
    risk_shift = f"{baseline['risk_band']} -> {projected['risk_band']}"

    return {
        "scenario_id": scenario_id,
        "title": scenario["title"],
        "assumption": scenario["assumption"],
        "ein": feat.get("ein"),
        "organization_name": feat.get("organization_name"),
        "baseline_score": baseline["resilience_score"],
        "baseline_risk_band": baseline["risk_band"],
        "projected_score": projected["resilience_score"],
        "projected_risk_band": projected["risk_band"],
        "score_delta": round(score_delta, 3),
        "risk_shift": risk_shift,
        "projected_months_of_reserve": projected.get("months_of_reserve"),
        "projected_operating_margin": projected.get("operating_margin"),
        "recommendation": _generate_recommendation(scenario_id, score_delta, baseline, projected),
        "evidence": [
            f"Baseline score: {baseline['resilience_score']:.2f} ({baseline['risk_band']})",
            f"Projected score: {projected['resilience_score']:.2f} ({projected['risk_band']})",
            f"Score change: {score_delta:+.3f}",
        ],
    }


def _generate_recommendation(
    scenario_id: str, delta: float,
    baseline: dict[str, Any], projected: dict[str, Any],
) -> str:
    org = baseline.get("organization_name", "This organization")
    if "grant_cut" in scenario_id:
        if delta < -0.15:
            return f"{org} is highly vulnerable to this funding cut. Consider building reserves and diversifying revenue before this risk materializes."
        if delta < -0.05:
            return f"{org} would face moderate stress. A contingency plan and reserve building are advisable."
        return f"{org} can likely absorb this cut, though monitoring revenue trends is recommended."
    if "reserve" in scenario_id:
        if delta > 0.10:
            return f"A reserve grant would materially improve {org}'s resilience. This is a high-impact intervention."
        return f"A reserve grant would provide incremental improvement to {org}'s financial stability."
    if "diversif" in scenario_id:
        if delta > 0.05:
            return f"Revenue diversification would meaningfully reduce {org}'s concentration risk."
        return f"Diversification offers modest benefit; other interventions may have more impact."
    if "margin" in scenario_id:
        if delta > 0.05:
            return f"Margin improvement would significantly strengthen {org}'s operating position."
        return f"Margin improvement would provide a moderate boost to financial health."
    return "Scenario projected. Review the score change and risk band shift for decision guidance."


# ── Public API ─────────────────────────────────────────────────────────────

def run_all_scenarios(features_dir: Path, output_dir: Path) -> dict[str, Any]:
    """Run all scenarios for all organizations and produce scenario artifacts.

    Reads: features_dir/features.parquet
    Writes:
      - output_dir/scenarios.json
      - manifests_dir/scenario_manifest.json
    """
    features_dir = Path(features_dir).expanduser().resolve()
    output_dir = Path(output_dir).expanduser().resolve()
    manifests_dir = output_dir.parent / "manifests"

    features_path = features_dir / "features.parquet"
    if not features_path.exists():
        return {
            "status": "error",
            "step": "scenarios",
            "message": f"Feature table not found at {features_path}.",
        }

    table = pq.read_table(features_path)
    rows = table.to_pylist()

    # Get latest year per EIN
    latest_by_ein: dict[str, dict[str, Any]] = {}
    for row in rows:
        ein = row.get("ein")
        if ein is None:
            continue
        year = row.get("tax_year", "")
        if ein not in latest_by_ein or year > latest_by_ein[ein].get("tax_year", ""):
            latest_by_ein[ein] = row

    # Run all scenarios for all orgs
    all_results: list[dict[str, Any]] = []
    for ein, feat in sorted(latest_by_ein.items()):
        for scenario_id in SCENARIO_CATALOG:
            result = run_scenario(feat, scenario_id)
            if result is not None:
                all_results.append(result)

    # Write outputs
    output_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    scenarios_path = output_dir / "scenarios.json"
    scenarios_path.write_text(json.dumps(all_results, indent=2, default=str) + "\n", encoding="utf-8")

    # Manifest
    manifest = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "organizations_evaluated": len(latest_by_ein),
        "scenarios_run": len(SCENARIO_CATALOG),
        "total_results": len(all_results),
        "scenario_catalog": {
            sid: {"title": s["title"], "assumption": s["assumption"]}
            for sid, s in SCENARIO_CATALOG.items()
        },
        "outputs": {"scenarios_json": str(scenarios_path)},
    }
    manifest_path = manifests_dir / "scenario_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    return {
        "status": "ok",
        "step": "scenarios",
        "organizations_evaluated": len(latest_by_ein),
        "total_results": len(all_results),
        "outputs": {
            "scenarios_json": str(scenarios_path),
            "scenario_manifest": str(manifest_path),
        },
    }
