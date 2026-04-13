import { buildPeerBenchmarks } from "@/lib/peer-benchmarks";
import type { OrgDetail, ScreenerRow } from "@/lib/types";

/** Shown when a field is not backed by ProPublica / computed metrics in this app. */
export const EM_DASH = "\u2014";

/**
 * Org detail card fields derived only from live screener + revenue facts.
 * No marketing copy or CRM fixtures — unknown narrative fields use an em dash.
 */
export function buildLiveOrgDetail(
  row: ScreenerRow,
  portfolioRows: ScreenerRow[],
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }> | null,
): OrgDetail {
  const live = revenueByOrg?.[row.id];
  const geo = [row.city, row.state].filter((s) => s && s !== EM_DASH).join(", ");

  return {
    id: row.id,
    organizationName: row.organizationName,
    summary: EM_DASH,
    website: "",
    missionArea: row.missionArea,
    geography: geo || EM_DASH,
    currentYearRevenue: live?.currentYearRevenue ?? 0,
    priorYearRevenue: live?.priorYearRevenue ?? 0,
    revenueMix: [],
    topSignals: [],
    watchouts: [],
    peerBenchmarks: buildPeerBenchmarks(row, portfolioRows),
    narrative: EM_DASH,
  };
}
