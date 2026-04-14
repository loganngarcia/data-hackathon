export interface OrgPerson {
  person_name: string;
  title: string | null;
  avg_hours_per_week: number | null;
  compensation: number | null;
  is_officer: boolean | null;
  is_director: boolean | null;
}

export interface NonprofitSummary {
  ein: string;
  org_name: string | null;
  state: string | null;
  composite_score: number | null;
  tier: string | null;
  latest_total_revenue: number | null;
  latest_total_expenses: number | null;
  latest_net_assets: number | null;
  years_of_data: number | null;
  vulnerability_score: number | null;
  mission_description: string | null;
}

export interface PaginatedNonprofits {
  items: NonprofitSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface MetricBreakdown {
  revenue_concentration_hhi: number | null;
  operating_reserve_ratio: number | null;
  revenue_growth_trend: number | null;
  expense_vs_revenue_growth: number | null;
  program_expense_ratio: number | null;
  revenue_volatility: number | null;
  net_asset_trend: number | null;
  surplus_deficit_consistency: number | null;
}

export interface YearlyFinancials {
  tax_year: number;
  total_revenue: number | null;
  total_expenses: number | null;
  contributions_grants: number | null;
  program_service_rev: number | null;
  investment_income: number | null;
  other_revenue: number | null;
  net_assets_eoy: number | null;
  rev_less_expenses: number | null;
}

export interface NonprofitProfile {
  ein: string;
  org_name: string | null;
  state: string | null;
  composite_score: number | null;
  tier: string | null;
  confidence: string | null;
  years_of_data: number | null;
  metrics: MetricBreakdown | null;
  financials: YearlyFinancials[];
  vulnerability_score: number | null;
  warning_factors: string[] | null;
  recommendation: string | null;
  mission_description: string | null;
  website: string | null;
  formation_year: number | null;
  employee_count: number | null;
  volunteer_count: number | null;
  people: OrgPerson[];
}

export interface AtRiskOrg {
  ein: string;
  org_name: string | null;
  state: string | null;
  composite_score: number | null;
  tier: string | null;
  vulnerability_score: number;
  factors: string[];
  recommendation: string;
  latest_total_revenue: number | null;
  latest_net_assets: number | null;
}

export interface OverviewStats {
  total_orgs: number;
  scored_orgs: number;
  at_risk_orgs: number;
  score_distribution: Record<string, number>;
  state_distribution: Record<string, number>;
  avg_score: number;
  median_score: number;
}

export interface PeerOrg {
  ein: string;
  org_name: string | null;
  state: string | null;
  composite_score: number | null;
  tier: string | null;
  latest_total_revenue: number | null;
}

export interface PeerComparison {
  target_ein: string;
  target_score: number | null;
  peers: PeerOrg[];
  peer_avg_score: number | null;
}

export interface HiddenGem {
  ein: string;
  org_name: string | null;
  state: string | null;
  mission_description: string | null;
  composite_score: number | null;
  tier: string | null;
  latest_total_revenue: number | null;
  latest_net_assets: number | null;
  gem_score: number;
  gem_reason: string;
  program_efficiency: number | null;
  employee_count: number | null;
}

export type Tier = "Thriving" | "Stable" | "Needs Support" | "Urgent";
