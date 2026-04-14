export type RiskBand = "Foundation" | "Steady" | "Watch" | "At Risk";

export interface ScreenerRowContract {
  id: string;
  organizationName: string;
  ein: string;
  city: string;
  state: string;
  missionArea: string;
  revenue: number;
  netAssetsEoy: number;
  growthRate: number;
  reserveMonths: number;
  staffCount: number;
  riskBand: RiskBand;
  screenScore: number;
  /** Optional: TEOS governing-body voting members (990 Part VI). */
  boardMemberCount?: number;
}

export interface OrgDetailContract {
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
  peerBenchmarks: Array<{
    label: string;
    format: "reserve_months" | "percent" | "ratio" | "usd";
    orgValue: number | null;
    peerMedian: number | null;
  }>;
  narrative: string;
}

export interface ScenarioResultContract {
  scenarioId: string;
  title: string;
  assumption: string;
  projectedReserveMonths: number;
  projectedGrowth: number;
  riskShift: string;
  recommendation: string;
  evidence: string[];
}

export interface MemoContextContract {
  audience: string;
  ask: string;
  timeHorizon: string;
  constraints: string[];
  talkTrack: string[];
}

export interface HeroCaseStudyContract {
  organizationId: string;
  headline: string;
  oneLiner: string;
  outcome: string;
  whyItMatters: string;
}

export const hackathonContracts = {
  screenerRow: {
    required: [
      "id",
      "organizationName",
      "ein",
      "city",
      "state",
      "missionArea",
      "revenue",
      "netAssetsEoy",
      "growthRate",
      "reserveMonths",
      "staffCount",
      "riskBand",
      "screenScore",
    ],
  },
  orgDetail: {
    required: [
      "id",
      "organizationName",
      "summary",
      "website",
      "missionArea",
      "geography",
      "currentYearRevenue",
      "priorYearRevenue",
      "revenueMix",
      "topSignals",
      "watchouts",
      "peerBenchmarks",
      "narrative",
    ],
  },
  scenarioResult: {
    required: [
      "scenarioId",
      "title",
      "assumption",
      "projectedReserveMonths",
      "projectedGrowth",
      "riskShift",
      "recommendation",
      "evidence",
    ],
  },
  memoContext: {
    required: ["audience", "ask", "timeHorizon", "constraints", "talkTrack"],
  },
  heroCaseStudy: {
    required: ["organizationId", "headline", "oneLiner", "outcome", "whyItMatters"],
  },
} as const;
