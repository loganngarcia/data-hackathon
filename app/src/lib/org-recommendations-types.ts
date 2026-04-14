/** OpenAI JSON output for org detail “Recommendations” banners. */

export type OrgRecommendationsAiScenario = {
  headline: string;
  narrative: string;
  projectedReserveLabel: string;
  projectedGrowthLabel: string;
  riskShiftLabel: string;
};

export type OrgRecommendationsAiMemo = {
  headline: string;
  bullets: string[];
};

export type OrgRecommendationsAiEvidence = {
  paragraph: string;
};

export type OrgRecommendationsAiResponse = {
  scenario: OrgRecommendationsAiScenario;
  memo: OrgRecommendationsAiMemo;
  evidence: OrgRecommendationsAiEvidence;
};

/** POST `/api/org-recommendations` body (client-built aggregate). */
export type OrgRecommendationsRequestPayload = {
  organizationId: string;
  /** Count of orgs in the loaded portfolio list (context for peer comparisons). */
  portfolioListSize: number;
  organization: Record<string, unknown>;
  revenueFacts: {
    currentYearRevenue: number;
    priorYearRevenue: number;
    impliedYoYGrowthPct: number | null;
  };
  peerBenchmarkRows: Array<{
    label: string;
    orgValue: number | null;
    peerMedian: number | null;
  }>;
  similarOrganizations: Array<{
    name: string;
    reserveMonths: number | null;
    growthRate: number | null;
    revenue: number | null;
  }>;
  leadership: Array<{ name: string; title: string | null }>;
};
