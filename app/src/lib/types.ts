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
  growthRate: number;
  reserveMonths: number;
  staffCount: number;
  riskBand: RiskBand;
  screenScore: number;
  flags: string[];
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
  peerBenchmarks: Array<{ label: string; orgValue: number; peerMedian: number }>;
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
