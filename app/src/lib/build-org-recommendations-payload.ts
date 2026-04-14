import type { OrgDetail, ScreenerRow } from "@/lib/types";
import type { OrgPerson990 } from "@/lib/types";
import type { OrgRecommendationsRequestPayload } from "@/lib/org-recommendations-types";

function numOrNull(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n;
}

function impliedYoY(current: number, prior: number): number | null {
  if (!(prior > 0) || !Number.isFinite(current)) return null;
  return ((current - prior) / prior) * 100;
}

/**
 * Serialize screener + live detail into a single JSON-safe object for the recommendations API.
 */
export function buildOrgRecommendationsPayload(
  row: ScreenerRow,
  detail: OrgDetail,
  portfolioRows: ScreenerRow[],
  similarRows: ScreenerRow[],
  people: OrgPerson990[] | undefined,
): OrgRecommendationsRequestPayload {
  const cy = detail.currentYearRevenue;
  const py = detail.priorYearRevenue;
  const yoy = impliedYoY(cy, py);

  const organization: Record<string, unknown> = {
    name: row.organizationName,
    ein: row.ein,
    city: row.city,
    state: row.state,
    missionArea: row.missionArea,
    revenueUsd: row.revenue,
    netAssetsEoyUsd: row.netAssetsEoy,
    filingGrowthRatePct: row.growthRate,
    reserveMonths: row.reserveMonths,
    staffCount: row.staffCount,
    riskBand: row.riskBand,
    screenScore: row.screenScore,
    missionSummary: row.missionSummary ?? null,
    foundedYear: row.foundedYear ?? null,
    employeeCount: row.employeeCount ?? null,
    volunteerCount: row.volunteerCount ?? null,
    boardMemberCount: row.boardMemberCount ?? null,
    programServiceExpensesUsd: row.programServiceExpensesUsd ?? null,
    managementGeneralExpensesUsd: row.managementGeneralExpensesUsd ?? null,
    fundraisingExpensesUsd: row.fundraisingExpensesUsd ?? null,
    websiteUrl: row.websiteUrl ?? null,
    logoDomain: row.logoDomain ?? null,
  };

  const peerBenchmarkRows = detail.peerBenchmarks.map((b) => ({
    label: b.label,
    orgValue: numOrNull(b.orgValue),
    peerMedian: numOrNull(b.peerMedian),
  }));

  const n = portfolioRows.length;
  const similarOrganizations = similarRows.slice(0, 6).map((r) => ({
    name: r.organizationName,
    reserveMonths: numOrNull(r.reserveMonths),
    growthRate: numOrNull(r.growthRate),
    revenue: numOrNull(r.revenue),
  }));

  const leadership = (people ?? []).slice(0, 8).map((p) => ({
    name: p.name,
    title: p.title,
  }));

  return {
    organizationId: row.id,
    portfolioListSize: n,
    organization,
    revenueFacts: {
      currentYearRevenue: cy,
      priorYearRevenue: py,
      impliedYoYGrowthPct: yoy,
    },
    peerBenchmarkRows,
    similarOrganizations,
    leadership,
  };
}
