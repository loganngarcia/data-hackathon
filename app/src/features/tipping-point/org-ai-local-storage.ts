/**
 * Persists AI-generated org detail payloads (and mirrored API caches) in localStorage
 * so reopening a profile is instant without waiting on the network again.
 */

import type { OrgRecommendationsAiResponse } from "@/lib/org-recommendations-types";
import type { OrgOutreachPersonDraft } from "@/lib/org-outreach-types";

const NS = "tipping_point_ai_v1";

function safeParse<T>(raw: string | null): T | undefined {
  if (raw == null || raw === "") return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function djb2Short(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function lsSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

// --- Org recommendations (OpenAI) ---

export function loadOrgRecommendationsFromStorage(orgId: string): OrgRecommendationsAiResponse | undefined {
  if (typeof window === "undefined") return undefined;
  const v = safeParse<OrgRecommendationsAiResponse>(localStorage.getItem(`${NS}:rec:${orgId}`));
  if (v?.scenario?.headline && v?.memo?.bullets?.length && v?.evidence?.paragraph) return v;
  return undefined;
}

export function saveOrgRecommendationsToStorage(orgId: string, data: OrgRecommendationsAiResponse): void {
  lsSet(`${NS}:rec:${orgId}`, JSON.stringify(data));
}

// --- Synthetic outreach (phone / email drafts) — keyed by input fingerprint ---

export function buildOutreachInputFingerprint(
  ein: string,
  organizationName: string,
  city: string,
  state: string,
  missionSummary: string,
  people: { name: string; title: string | null }[],
): string {
  const row = people.map((p) => `${p.name}\x1e${p.title ?? ""}`).join("\x1f");
  return [ein, organizationName, city, state, missionSummary, row].join("\x1e");
}

export function loadOutreachDraftsFromStorage(fingerprint: string): OrgOutreachPersonDraft[] | undefined {
  if (typeof window === "undefined") return undefined;
  const key = `${NS}:outreach:${djb2Short(fingerprint)}`;
  const parsed = safeParse<{ fingerprint: string; people: OrgOutreachPersonDraft[] }>(localStorage.getItem(key));
  if (
    parsed?.fingerprint === fingerprint &&
    Array.isArray(parsed.people) &&
    parsed.people.length > 0 &&
    parsed.people.every((p) => typeof p.contactEmail === "string" && typeof p.phoneTel === "string")
  ) {
    return parsed.people;
  }
  return undefined;
}

export function saveOutreachDraftsToStorage(fingerprint: string, people: OrgOutreachPersonDraft[]): void {
  lsSet(`${NS}:outreach:${djb2Short(fingerprint)}`, JSON.stringify({ fingerprint, people }));
}

// --- Mission + filings (instant revisit; not all AI, same persistence goal) ---

export function loadMissionTextFromStorage(ein: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = localStorage.getItem(`${NS}:mission:${ein}`);
  if (typeof raw === "string" && raw.length > 0) return raw;
  return undefined;
}

export function saveMissionTextToStorage(ein: string, mission: string): void {
  lsSet(`${NS}:mission:${ein}`, mission);
}

export function loadNonprofitFilingsJsonFromStorage(ein: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = localStorage.getItem(`${NS}:filings:${ein}`);
  if (typeof raw === "string" && raw.length > 0) return raw;
  return undefined;
}

export function saveNonprofitFilingsJsonToStorage(ein: string, json: string): void {
  lsSet(`${NS}:filings:${ein}`, json);
}
