"""Generate hero case studies and frontend-consumable JSON artifacts.

Selects three hero nonprofits from scored data:
  1. Resilient leader (highest score)
  2. Tipping-risk case (Watch/At Risk with interesting signals)
  3. Intervention turnaround (largest positive scenario delta)

Produces typed JSON matching the contracts in contracts/hackathon-contracts.ts:
  - screener_rows.json  (ScreenerRowContract[])
  - org_details.json    (OrgDetailContract[])
  - scenario_results.json (ScenarioResultContract[])
  - hero_cases.json     (HeroCaseStudyContract[])
  - memo_context.json   (MemoContextContract)
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq


def _fmt_currency(amount: int | float | None) -> str:
    if amount is None:
        return "$0"
    if abs(amount) >= 1_000_000:
        return f"${amount / 1_000_000:.1f}M"
    if abs(amount) >= 1_000:
        return f"${amount / 1_000:.0f}K"
    return f"${amount:,.0f}"


def _fmt_pct(value: float | None) -> str:
    if value is None:
        return "N/A"
    return f"{value:.1%}"


def _build_screener_rows(scores: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build ScreenerRowContract-shaped rows for the portfolio screener."""
    rows = []
    for s in scores:
        flags = []
        for w in s.get("watchouts", []):
            if len(flags) < 3:
                flags.append(w[:60])

        rows.append({
            "id": s["ein"],
            "organizationName": s.get("organization_name", ""),
            "ein": s["ein"],
            "city": s.get("city", ""),
            "state": s.get("state", ""),
            "missionArea": s.get("size_band", "general"),
            "revenue": s.get("total_revenue") or 0,
            "growthRate": round((s.get("revenue_growth_yoy") or 0) * 100, 1),
            "reserveMonths": round(s.get("months_of_reserve") or 0, 1),
            "staffCount": s.get("total_employee_count") or 0,
            "riskBand": s.get("risk_band", "Watch"),
            "screenScore": round((s.get("resilience_score") or 0.5) * 100),
            "flags": flags,
        })

    rows.sort(key=lambda r: r["screenScore"], reverse=True)
    return rows


def _build_org_detail(
    score: dict[str, Any],
    scenarios: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build OrgDetailContract-shaped detail for a single org."""
    signals = score.get("signals", {})
    top_drivers = score.get("top_drivers", [])

    top_signals = [
        d["explanation"] for d in top_drivers
        if d.get("direction") == "positive"
    ][:3]
    watchouts = score.get("watchouts", [])[:3]

    revenue = score.get("total_revenue") or 0
    margin = score.get("operating_margin")
    reserve = score.get("months_of_reserve")
    hhi = score.get("revenue_hhi")

    peer_benchmarks = []
    if score.get("margin_pctile_peer") is not None:
        peer_benchmarks.append({
            "metric": "Operating Margin",
            "value": _fmt_pct(margin),
            "peerPctile": round((score["margin_pctile_peer"] or 0) * 100),
            "peerGroup": score.get("peer_group", ""),
        })
    if score.get("reserve_pctile_peer") is not None:
        peer_benchmarks.append({
            "metric": "Months of Reserve",
            "value": f"{reserve:.1f}" if reserve else "N/A",
            "peerPctile": round((score["reserve_pctile_peer"] or 0) * 100),
            "peerGroup": score.get("peer_group", ""),
        })
    if score.get("concentration_pctile_peer") is not None:
        peer_benchmarks.append({
            "metric": "Revenue Concentration (HHI)",
            "value": f"{hhi:.2f}" if hhi else "N/A",
            "peerPctile": round((score["concentration_pctile_peer"] or 0) * 100),
            "peerGroup": score.get("peer_group", ""),
        })

    narrative = _generate_narrative(score)

    # Find scenarios for this org
    org_scenarios = [s for s in scenarios if s.get("ein") == score["ein"]]

    return {
        "id": score["ein"],
        "organizationName": score.get("organization_name", ""),
        "summary": f"Resilience score: {score.get('resilience_score', 0):.0%} ({score.get('risk_band', 'Watch')})",
        "website": "",
        "missionArea": score.get("size_band", "general"),
        "geography": f"{score.get('city', '')}, {score.get('state', '')}",
        "currentYearRevenue": revenue,
        "priorYearRevenue": None,
        "revenueMix": {
            "contributions": round((score.get("contribution_share") or 0) * 100),
            "programServices": round((score.get("program_revenue_share") or 0) * 100),
            "investments": round((score.get("investment_share") or 0 if score.get("investment_share") is not None else 0) * 100),
            "other": max(0, 100 - round((score.get("contribution_share") or 0) * 100)
                         - round((score.get("program_revenue_share") or 0) * 100)
                         - round((score.get("investment_share") or 0) * 100 if score.get("investment_share") is not None else 0)),
        },
        "topSignals": top_signals,
        "watchouts": watchouts,
        "peerBenchmarks": peer_benchmarks,
        "narrative": narrative,
        "scenarios": [
            {
                "scenarioId": s["scenario_id"],
                "title": s["title"],
                "assumption": s["assumption"],
                "projectedReserveMonths": round(s.get("projected_months_of_reserve") or 0, 1),
                "projectedGrowth": round(s.get("score_delta", 0) * 100, 1),
                "riskShift": s["risk_shift"],
                "recommendation": s["recommendation"],
                "evidence": s.get("evidence", []),
            }
            for s in org_scenarios
        ],
    }


def _generate_narrative(score: dict[str, Any]) -> str:
    """Generate a human-readable narrative from score signals."""
    org = score.get("organization_name", "This organization")
    band = score.get("risk_band", "Watch")
    resilience = score.get("resilience_score", 0.5)

    parts = [f"{org} scores {resilience:.0%} on our resilience index, placing it in the '{band}' band."]

    top_drivers = score.get("top_drivers", [])
    positives = [d for d in top_drivers if d.get("direction") == "positive"]
    negatives = [d for d in top_drivers if d.get("direction") == "negative"]

    if positives:
        parts.append(f"Key strengths: {positives[0]['explanation']}")
    if negatives:
        parts.append(f"Primary concern: {negatives[0]['explanation']}")

    reserve = score.get("months_of_reserve")
    if reserve is not None:
        if reserve >= 6:
            parts.append(f"With {reserve:.1f} months of reserves, the organization has a meaningful financial cushion.")
        elif reserve >= 3:
            parts.append(f"At {reserve:.1f} months of reserves, the cushion is thin but present.")
        else:
            parts.append(f"Only {reserve:.1f} months of reserves is a significant vulnerability.")

    return " ".join(parts)


def _select_hero_cases(
    scores: list[dict[str, Any]],
    scenarios: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Select three hero case studies for the demo narrative."""
    if not scores:
        return []

    heroes: list[dict[str, Any]] = []

    # 1. Resilient leader: highest resilience score
    sorted_by_score = sorted(scores, key=lambda s: s.get("resilience_score", 0), reverse=True)
    leader = sorted_by_score[0]
    heroes.append({
        "organizationId": leader["ein"],
        "headline": f"{leader.get('organization_name', 'Unknown')} — Resilient Leader",
        "oneLiner": f"Scores {leader.get('resilience_score', 0):.0%} resilience with strong reserves and diversified revenue.",
        "outcome": f"Risk band: {leader.get('risk_band', 'Steady')}. This organization demonstrates the financial stability that advisors look for.",
        "whyItMatters": "Shows what 'healthy' looks like — a benchmark for other organizations in the same peer group.",
    })

    # 2. Tipping-risk case: Watch or At Risk with interesting signals
    at_risk = [s for s in sorted_by_score if s.get("risk_band") in ("Watch", "At Risk")]
    if at_risk:
        risky = at_risk[0]
        watchouts = risky.get("watchouts", ["financial stress indicators present"])
        heroes.append({
            "organizationId": risky["ein"],
            "headline": f"{risky.get('organization_name', 'Unknown')} — Tipping Risk",
            "oneLiner": f"Scores {risky.get('resilience_score', 0):.0%} with warning signals that warrant advisor attention.",
            "outcome": f"Risk band: {risky.get('risk_band', 'Watch')}. {watchouts[0] if watchouts else 'Multiple risk factors present.'}",
            "whyItMatters": "Illustrates how the tool catches financial fragility before it becomes a crisis.",
        })

    # 3. Intervention turnaround: largest positive scenario delta
    if scenarios:
        positive_scenarios = [s for s in scenarios if s.get("score_delta", 0) > 0]
        if positive_scenarios:
            best = max(positive_scenarios, key=lambda s: s.get("score_delta", 0))
            heroes.append({
                "organizationId": best.get("ein", ""),
                "headline": f"{best.get('organization_name', 'Unknown')} — Turnaround Candidate",
                "oneLiner": f"A {best.get('title', 'targeted intervention')} could improve resilience by {best.get('score_delta', 0):+.0%}.",
                "outcome": f"{best.get('risk_shift', 'Risk unchanged')}. {best.get('recommendation', '')}",
                "whyItMatters": "Demonstrates that targeted interventions can materially improve financial outlook — actionable for advisors.",
            })

    return heroes


def generate_artifacts(
    scores_dir: Path,
    features_dir: Path,
    scenarios_dir: Path,
    output_dir: Path,
) -> dict[str, Any]:
    """Generate all frontend-consumable JSON artifacts.

    Reads: scores, features, and scenario outputs.
    Writes JSON files matching the TypeScript contracts.
    """
    scores_dir = Path(scores_dir).expanduser().resolve()
    features_dir = Path(features_dir).expanduser().resolve()
    scenarios_dir = Path(scenarios_dir).expanduser().resolve()
    output_dir = Path(output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load scores
    scores_detail_path = scores_dir / "scores_detail.json"
    if not scores_detail_path.exists():
        return {"status": "error", "message": f"Scores not found at {scores_detail_path}"}
    scores = json.loads(scores_detail_path.read_text(encoding="utf-8"))

    # Load scenarios
    scenarios_path = scenarios_dir / "scenarios.json"
    scenarios = []
    if scenarios_path.exists():
        scenarios = json.loads(scenarios_path.read_text(encoding="utf-8"))

    # Build artifacts
    screener_rows = _build_screener_rows(scores)
    org_details = {s["ein"]: _build_org_detail(s, scenarios) for s in scores}
    hero_cases = _select_hero_cases(scores, scenarios)

    # Memo context
    memo_context = {
        "audience": "Fairlight Advisors — nonprofit financial advisory",
        "ask": "Identify resilient nonprofits, flag tipping-risk organizations, and recommend high-impact interventions.",
        "timeHorizon": "Based on most recent available filing year with multi-year trend analysis.",
        "constraints": [
            "Analysis limited to IRS Form 990 public filings.",
            "All scenario projections are forecasts, not causal guarantees.",
            "990-EZ and 990-PF filers excluded from this analysis.",
        ],
        "talkTrack": _generate_talk_track(scores, hero_cases),
    }

    # Write all artifacts
    paths = {}
    for name, data in [
        ("screener_rows.json", screener_rows),
        ("org_details.json", org_details),
        ("scenario_results.json", scenarios),
        ("hero_cases.json", hero_cases),
        ("memo_context.json", memo_context),
    ]:
        p = output_dir / name
        p.write_text(json.dumps(data, indent=2, default=str) + "\n", encoding="utf-8")
        paths[name] = str(p)

    return {
        "status": "ok",
        "step": "generate-artifacts",
        "screener_rows": len(screener_rows),
        "org_details": len(org_details),
        "hero_cases": len(hero_cases),
        "scenarios": len(scenarios),
        "outputs": paths,
    }


def _generate_talk_track(
    scores: list[dict[str, Any]],
    heroes: list[dict[str, Any]],
) -> str:
    """Generate a brief talk track for the memo / demo."""
    total = len(scores)
    steady = sum(1 for s in scores if s.get("risk_band") == "Steady")
    watch = sum(1 for s in scores if s.get("risk_band") == "Watch")
    at_risk = sum(1 for s in scores if s.get("risk_band") == "At Risk")

    parts = [
        f"We analyzed {total} nonprofit organizations using IRS Form 990 filings.",
        f"Our 8-signal resilience model classified {steady} as Steady, {watch} as Watch, and {at_risk} as At Risk.",
    ]

    for hero in heroes:
        parts.append(f"{hero['headline']}: {hero['oneLiner']}")

    parts.append(
        "Each score is explainable — top drivers and watchouts are surfaced per organization. "
        "Scenario simulations show how interventions like reserve grants or revenue diversification "
        "could shift an organization's resilience outlook."
    )

    return " ".join(parts)
