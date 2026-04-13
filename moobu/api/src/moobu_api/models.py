"""Pydantic response models for the Moobu API."""

from __future__ import annotations

from pydantic import BaseModel


class NonprofitSummary(BaseModel):
    ein: str
    org_name: str | None
    state: str | None
    composite_score: float | None
    tier: str | None
    latest_total_revenue: int | None
    latest_total_expenses: int | None
    latest_net_assets: int | None
    years_of_data: int | None
    vulnerability_score: float | None = None


class PaginatedNonprofits(BaseModel):
    items: list[NonprofitSummary]
    total: int
    page: int
    page_size: int


class MetricBreakdown(BaseModel):
    revenue_concentration_hhi: float | None
    operating_reserve_ratio: float | None
    revenue_growth_trend: float | None
    expense_vs_revenue_growth: float | None
    program_expense_ratio: float | None
    revenue_volatility: float | None
    net_asset_trend: float | None
    surplus_deficit_consistency: float | None


class YearlyFinancials(BaseModel):
    tax_year: int
    total_revenue: int | None
    total_expenses: int | None
    contributions_grants: int | None
    program_service_rev: int | None
    investment_income: int | None
    other_revenue: int | None
    net_assets_eoy: int | None
    rev_less_expenses: int | None


class NonprofitProfile(BaseModel):
    ein: str
    org_name: str | None
    state: str | None
    composite_score: float | None
    tier: str | None
    confidence: str | None
    years_of_data: int | None
    metrics: MetricBreakdown | None
    financials: list[YearlyFinancials]
    vulnerability_score: float | None = None
    warning_factors: list[str] | None = None
    recommendation: str | None = None


class AtRiskOrg(BaseModel):
    ein: str
    org_name: str | None
    state: str | None
    composite_score: float | None
    tier: str | None
    vulnerability_score: float
    factors: list[str]
    recommendation: str
    latest_total_revenue: int | None
    latest_net_assets: int | None


class OverviewStats(BaseModel):
    total_orgs: int
    scored_orgs: int
    at_risk_orgs: int
    score_distribution: dict[str, int]
    state_distribution: dict[str, int]
    avg_score: float
    median_score: float


class PeerOrg(BaseModel):
    ein: str
    org_name: str | None
    state: str | None
    composite_score: float | None
    tier: str | None
    latest_total_revenue: int | None


class PeerComparison(BaseModel):
    target_ein: str
    target_score: float | None
    peers: list[PeerOrg]
    peer_avg_score: float | None
