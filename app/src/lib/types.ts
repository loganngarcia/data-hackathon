export type ScreenKey = "screener" | "detail" | "scenario";

export type RiskBand = "Foundation" | "Steady" | "Watch" | "At Risk";

export interface ScreenerRow {
  id: string;
  organizationName: string;
  ein: string;
  city: string;
  state: string;
  missionArea: string;
  revenue: number;
  /** Latest filing net assets (EOY), USD — from TEOS `net_assets_eoy_amt` or ProPublica filing extract. */
  netAssetsEoy: number;
  growthRate: number;
  reserveMonths: number;
  staffCount: number;
  riskBand: RiskBand;
  screenScore: number;
  /** HTTPS URL from D1 `website_txt` (TEOS) when present. */
  websiteUrl?: string;
  /** Organization phone from latest TEOS 990 filing (`irs990_xml_returns.org_phone`) when present. */
  orgPhone?: string;
  /** Organization contact email when present in TEOS / upstream row (optional; many filings omit it). */
  orgEmail?: string;
  /** Hostname for Logo.dev, from D1 `org_logo_cache` (website or Brand Search). */
  logoDomain?: string;
  /** Full `img.logo.dev` URL from Worker when `LOGO_DEV_PUBLISHABLE_KEY` is set on Cloudflare (preferred over client-side Logo.dev). */
  logoImageUrl?: string;
  /** Formatted mission / activity text from TEOS when present. */
  missionSummary?: string;
  /** IRS FormationYr from latest TEOS 990 XML when present. */
  foundedYear?: number;
  /** Total employees (990 Part I) from latest TEOS row when present. */
  employeeCount?: number;
  /** Total volunteers (990 Part I) from latest TEOS row when present. */
  volunteerCount?: number;
  /** Governing-body size (990 Part VI): COALESCE(governing_body_voting_cnt, voting_members_governing_cnt). */
  boardMemberCount?: number;
  /** Form 990 Part IX program service expenses (USD), TEOS `total_program_service_expenses_amt`. */
  programServiceExpensesUsd?: number;
  /** Management & general / admin functional expenses (USD), TEOS `cy_total_management_and_general_expenses_amt`. */
  managementGeneralExpensesUsd?: number;
  /** Fundraising functional expenses (USD), TEOS `cy_total_fundraising_expense_amt`. */
  fundraisingExpensesUsd?: number;
}

/** How to format a peer-benchmark metric in the org detail Metrics section. */
export type PeerBenchmarkMetricFormat = "reserve_months" | "percent" | "ratio" | "usd";

export interface PeerBenchmarkMetric {
  label: string;
  format: PeerBenchmarkMetricFormat;
  orgValue: number | null;
  peerMedian: number | null;
}

export interface OrgDetail {
  id: string;
  organizationName: string;
  summary: string;
  website: string;
  missionArea: string;
  geography: string;
  currentYearRevenue: number;
  priorYearRevenue: number;
  revenueMix: Array<{ label: string; value: number; tone: "accent" | "muted" | "warm" }>;
  topSignals: string[];
  watchouts: string[];
  peerBenchmarks: PeerBenchmarkMetric[];
  narrative: string;
}

export interface ScenarioResult {
  scenarioId: string;
  title: string;
  assumption: string;
  projectedReserveMonths: number;
  projectedGrowth: number;
  riskShift: string;
  recommendation: string;
  evidence: string[];
}

export interface PeopleCard {
  id: string;
  name: string;
  title: string;
}

/** One person from IRS Form 990 Part VII Section A (or principal/business officer fallback). */
export interface OrgPerson990 {
  name: string;
  title: string | null;
}

export interface MemoContext {
  audience: string;
  ask: string;
  timeHorizon: string;
  constraints: string[];
  talkTrack: string[];
}

export interface HeroCaseStudy {
  organizationId: string;
  headline: string;
  oneLiner: string;
  outcome: string;
  whyItMatters: string;
}
