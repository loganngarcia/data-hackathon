/**
 * Session-scoped caches + localStorage hydration for org detail payloads
 * (swiping between orgs avoids duplicate network; reopening the tab restores from disk).
 */

import type { OrgRecommendationsAiResponse } from "@/lib/org-recommendations-types";
import {
  loadMissionTextFromStorage,
  loadNonprofitFilingsJsonFromStorage,
  loadOrgRecommendationsFromStorage,
  saveMissionTextToStorage,
  saveNonprofitFilingsJsonToStorage,
  saveOrgRecommendationsToStorage,
} from "./org-ai-local-storage";

const recommendationsByOrgId = new Map<string, OrgRecommendationsAiResponse>();
const missionTextByEin = new Map<string, string>();
const nonprofitFilingsJsonByEin = new Map<string, string>();

export function getCachedOrgRecommendations(orgId: string): OrgRecommendationsAiResponse | undefined {
  const m = recommendationsByOrgId.get(orgId);
  if (m) return m;
  const fromLs = loadOrgRecommendationsFromStorage(orgId);
  if (fromLs) {
    recommendationsByOrgId.set(orgId, fromLs);
    return fromLs;
  }
  return undefined;
}

export function setCachedOrgRecommendations(orgId: string, data: OrgRecommendationsAiResponse): void {
  recommendationsByOrgId.set(orgId, data);
  saveOrgRecommendationsToStorage(orgId, data);
}

export function getCachedMissionText(ein: string): string | undefined {
  const m = missionTextByEin.get(ein);
  if (m) return m;
  const fromLs = loadMissionTextFromStorage(ein);
  if (fromLs) {
    missionTextByEin.set(ein, fromLs);
    return fromLs;
  }
  return undefined;
}

export function setCachedMissionText(ein: string, mission: string): void {
  missionTextByEin.set(ein, mission);
  saveMissionTextToStorage(ein, mission);
}

export function getCachedNonprofitFilingsJson(ein: string): string | undefined {
  const m = nonprofitFilingsJsonByEin.get(ein);
  if (m) return m;
  const fromLs = loadNonprofitFilingsJsonFromStorage(ein);
  if (fromLs) {
    nonprofitFilingsJsonByEin.set(ein, fromLs);
    return fromLs;
  }
  return undefined;
}

export function setCachedNonprofitFilingsJson(ein: string, json: string): void {
  nonprofitFilingsJsonByEin.set(ein, json);
  saveNonprofitFilingsJsonToStorage(ein, json);
}
