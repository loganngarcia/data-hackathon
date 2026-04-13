import type {
  HeroCaseStudy,
  MemoContext,
  OrgDetail,
  ScenarioResult,
  ScreenerRow,
} from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchScreenerRows(): Promise<ScreenerRow[]> {
  return fetchJson<ScreenerRow[]>("/api/screener");
}

export function fetchOrgDetail(id: string): Promise<OrgDetail> {
  return fetchJson<OrgDetail>(`/api/orgs/${encodeURIComponent(id)}`);
}

export function fetchScenarioResult(id: string): Promise<ScenarioResult> {
  return fetchJson<ScenarioResult>(`/api/scenarios/${encodeURIComponent(id)}`);
}

export function fetchMemoContext(): Promise<MemoContext> {
  return fetchJson<MemoContext>("/api/memo-context");
}

export function fetchHeroCaseStudy(): Promise<HeroCaseStudy> {
  return fetchJson<HeroCaseStudy>("/api/hero");
}
