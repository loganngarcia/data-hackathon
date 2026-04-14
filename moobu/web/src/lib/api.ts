import type {
  AtRiskOrg,
  HiddenGem,
  NonprofitProfile,
  OverviewStats,
  PaginatedNonprofits,
  PeerComparison,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchNonprofits(params: {
  page?: number;
  page_size?: number;
  state?: string;
  tier?: string;
  min_score?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
}): Promise<PaginatedNonprofits> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return fetchJSON(`/api/nonprofits?${searchParams}`);
}

export function fetchNonprofit(ein: string): Promise<NonprofitProfile> {
  return fetchJSON(`/api/nonprofit/${ein}`);
}

export function fetchAtRisk(limit = 100): Promise<AtRiskOrg[]> {
  return fetchJSON(`/api/at-risk?limit=${limit}`);
}

export function fetchOverview(): Promise<OverviewStats> {
  return fetchJSON("/api/stats/overview");
}

export function fetchPeers(ein: string): Promise<PeerComparison> {
  return fetchJSON(`/api/nonprofit/${ein}/peers`);
}

export function fetchHiddenGems(limit = 100): Promise<HiddenGem[]> {
  return fetchJSON(`/api/hidden-gems?limit=${limit}`);
}
