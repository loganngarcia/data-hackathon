"""API route handlers for the Moobu API."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query

from .db import query
from .models import (
    AtRiskOrg,
    MetricBreakdown,
    NonprofitProfile,
    NonprofitSummary,
    OverviewStats,
    PaginatedNonprofits,
    PeerComparison,
    PeerOrg,
    YearlyFinancials,
)

router = APIRouter(prefix="/api")


@router.get("/nonprofits", response_model=PaginatedNonprofits)
def list_nonprofits(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    state: str | None = None,
    min_score: float | None = None,
    max_score: float | None = None,
    tier: str | None = None,
    search: str | None = None,
    sort_by: str = "composite_score",
    sort_dir: str = "desc",
):
    conditions = []
    params: dict = {}

    if state:
        conditions.append("s.state = $state")
        params["state"] = state
    if min_score is not None:
        conditions.append("s.composite_score >= $min_score")
        params["min_score"] = min_score
    if max_score is not None:
        conditions.append("s.composite_score <= $max_score")
        params["max_score"] = max_score
    if tier:
        conditions.append("s.tier = $tier")
        params["tier"] = tier
    if search:
        conditions.append("(s.org_name ILIKE $search OR s.ein LIKE $search_ein)")
        params["search"] = f"%{search}%"
        params["search_ein"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"

    allowed_sorts = {
        "composite_score", "org_name", "latest_total_revenue",
        "latest_total_expenses", "latest_net_assets", "ein", "state",
    }
    if sort_by not in allowed_sorts:
        sort_by = "composite_score"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"

    total = query(f"SELECT COUNT(*) FROM org_scores s WHERE {where}", params).fetchone()[0]

    offset = (page - 1) * page_size
    data_q = f"""
        SELECT
            s.ein, s.org_name, s.state, s.composite_score, s.tier,
            s.latest_total_revenue, s.latest_total_expenses, s.latest_net_assets,
            s.years_of_data,
            w.vulnerability_score
        FROM org_scores s
        LEFT JOIN early_warnings w ON s.ein = w.ein
        WHERE {where}
        ORDER BY {sort_by} {direction} NULLS LAST
        LIMIT {page_size} OFFSET {offset}
    """
    rows = query(data_q, params).fetchall()

    items = [
        NonprofitSummary(
            ein=r[0], org_name=r[1], state=r[2], composite_score=r[3],
            tier=r[4], latest_total_revenue=r[5], latest_total_expenses=r[6],
            latest_net_assets=r[7], years_of_data=r[8], vulnerability_score=r[9],
        )
        for r in rows
    ]

    return PaginatedNonprofits(items=items, total=total, page=page, page_size=page_size)


@router.get("/nonprofit/{ein}", response_model=NonprofitProfile)
def get_nonprofit(ein: str):
    score_row = query("SELECT * FROM org_scores WHERE ein = $1", [ein]).fetchone()
    if not score_row:
        raise HTTPException(status_code=404, detail=f"Nonprofit {ein} not found")

    cols = [c[0] for c in query("DESCRIBE org_scores").fetchall()]
    score_dict = dict(zip(cols, score_row))

    fin_rows = query(
        """SELECT tax_year, total_revenue, total_expenses, contributions_grants,
                  program_service_rev, investment_income, other_revenue,
                  net_assets_eoy, rev_less_expenses
           FROM filings WHERE ein = $1 ORDER BY tax_year""",
        [ein],
    ).fetchall()

    financials = [
        YearlyFinancials(
            tax_year=r[0], total_revenue=r[1], total_expenses=r[2],
            contributions_grants=r[3], program_service_rev=r[4],
            investment_income=r[5], other_revenue=r[6],
            net_assets_eoy=r[7], rev_less_expenses=r[8],
        )
        for r in fin_rows
    ]

    warning = query(
        "SELECT vulnerability_score, factors, recommendation FROM early_warnings WHERE ein = $1",
        [ein],
    ).fetchone()

    vuln_score = None
    factors = None
    rec = None
    if warning:
        vuln_score = warning[0]
        factors = json.loads(warning[1]) if warning[1] else []
        rec = warning[2]

    return NonprofitProfile(
        ein=score_dict["ein"],
        org_name=score_dict["org_name"],
        state=score_dict["state"],
        composite_score=score_dict["composite_score"],
        tier=score_dict["tier"],
        confidence=score_dict["confidence"],
        years_of_data=score_dict["years_of_data"],
        metrics=MetricBreakdown(
            revenue_concentration_hhi=score_dict["revenue_concentration_hhi"],
            operating_reserve_ratio=score_dict["operating_reserve_ratio"],
            revenue_growth_trend=score_dict["revenue_growth_trend"],
            expense_vs_revenue_growth=score_dict["expense_vs_revenue_growth"],
            program_expense_ratio=score_dict["program_expense_ratio"],
            revenue_volatility=score_dict["revenue_volatility"],
            net_asset_trend=score_dict["net_asset_trend"],
            surplus_deficit_consistency=score_dict["surplus_deficit_consistency"],
        ),
        financials=financials,
        vulnerability_score=vuln_score,
        warning_factors=factors,
        recommendation=rec,
    )


@router.get("/at-risk", response_model=list[AtRiskOrg])
def get_at_risk(limit: int = Query(100, ge=1, le=500)):
    rows = query(f"""
        SELECT
            w.ein, w.org_name, s.state, s.composite_score, s.tier,
            w.vulnerability_score, w.factors, w.recommendation,
            s.latest_total_revenue, s.latest_net_assets
        FROM early_warnings w
        JOIN org_scores s ON w.ein = s.ein
        ORDER BY w.vulnerability_score DESC
        LIMIT {limit}
    """).fetchall()

    return [
        AtRiskOrg(
            ein=r[0], org_name=r[1], state=r[2], composite_score=r[3],
            tier=r[4], vulnerability_score=r[5],
            factors=json.loads(r[6]) if r[6] else [],
            recommendation=r[7] or "",
            latest_total_revenue=r[8], latest_net_assets=r[9],
        )
        for r in rows
    ]


@router.get("/stats/overview", response_model=OverviewStats)
def get_overview():
    total = query("SELECT COUNT(DISTINCT ein) FROM filings").fetchone()[0]
    scored = query("SELECT COUNT(*) FROM org_scores").fetchone()[0]
    at_risk = query(
        "SELECT COUNT(*) FROM early_warnings WHERE vulnerability_score > 0.5"
    ).fetchone()[0]

    tier_rows = query("SELECT tier, COUNT(*) FROM org_scores GROUP BY tier").fetchall()
    score_dist = {r[0]: r[1] for r in tier_rows}

    state_rows = query(
        "SELECT state, COUNT(*) FROM org_scores WHERE state IS NOT NULL GROUP BY state ORDER BY COUNT(*) DESC LIMIT 20"
    ).fetchall()
    state_dist = {r[0]: r[1] for r in state_rows}

    avg = query("SELECT AVG(composite_score) FROM org_scores").fetchone()[0] or 0
    median = query("SELECT MEDIAN(composite_score) FROM org_scores").fetchone()[0] or 0

    return OverviewStats(
        total_orgs=total,
        scored_orgs=scored,
        at_risk_orgs=at_risk,
        score_distribution=score_dist,
        state_distribution=state_dist,
        avg_score=round(avg, 2),
        median_score=round(median, 2),
    )


@router.get("/nonprofit/{ein}/peers", response_model=PeerComparison)
def get_peers(ein: str, limit: int = Query(10, ge=1, le=50)):
    target = query(
        "SELECT composite_score, state, latest_total_revenue FROM org_scores WHERE ein = $1",
        [ein],
    ).fetchone()
    if not target:
        raise HTTPException(status_code=404, detail=f"Nonprofit {ein} not found")

    target_score, target_state, target_rev = target

    if target_rev and target_rev > 0:
        min_rev = target_rev // 5
        max_rev = target_rev * 5
        rows = query("""
            SELECT ein, org_name, state, composite_score, tier, latest_total_revenue
            FROM org_scores
            WHERE ein != $1 AND state = $2
              AND latest_total_revenue BETWEEN $3 AND $4
            ORDER BY ABS(composite_score - $5)
            LIMIT $6
        """, [ein, target_state, min_rev, max_rev, target_score or 0, limit]).fetchall()
    else:
        rows = query("""
            SELECT ein, org_name, state, composite_score, tier, latest_total_revenue
            FROM org_scores
            WHERE ein != $1 AND state = $2
            ORDER BY ABS(composite_score - $3)
            LIMIT $4
        """, [ein, target_state, target_score or 0, limit]).fetchall()

    peers = [
        PeerOrg(
            ein=r[0], org_name=r[1], state=r[2], composite_score=r[3],
            tier=r[4], latest_total_revenue=r[5],
        )
        for r in rows
    ]

    peer_scores = [p.composite_score for p in peers if p.composite_score is not None]
    peer_avg = sum(peer_scores) / len(peer_scores) if peer_scores else None

    return PeerComparison(
        target_ein=ein,
        target_score=target_score,
        peers=peers,
        peer_avg_score=round(peer_avg, 2) if peer_avg is not None else None,
    )
