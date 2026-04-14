/**
 * Session snapshot so the chat composer can label the org behind `?org=` without an extra fetch.
 * Written from `TippingPointDashboard` when an org profile is open.
 */

export const TEOS_ORG_CHAT_SNAPSHOT_KEY = "tp-chat-org-snapshot-v1";

export type TeosOrgChatSnapshot = {
  orgId: string;
  name: string;
  city: string;
  state: string;
  ein: string;
  /** Hostname for logo (TEOS / Logo.dev). */
  websiteDomain?: string;
  logoDomain?: string;
  logoImageUrl?: string;
};

export function readTeosOrgSnapshotFromSession(): TeosOrgChatSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TEOS_ORG_CHAT_SNAPSHOT_KEY);
    if (!raw?.trim()) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const orgId = typeof rec.orgId === "string" ? rec.orgId : "";
    const name = typeof rec.name === "string" ? rec.name : "";
    if (!orgId.trim() || !name.trim()) return null;
    return {
      orgId: orgId.trim(),
      name: name.trim(),
      city: typeof rec.city === "string" ? rec.city : "",
      state: typeof rec.state === "string" ? rec.state : "",
      ein: typeof rec.ein === "string" ? rec.ein : "",
      websiteDomain: typeof rec.websiteDomain === "string" ? rec.websiteDomain : undefined,
      logoDomain: typeof rec.logoDomain === "string" ? rec.logoDomain : undefined,
      logoImageUrl: typeof rec.logoImageUrl === "string" ? rec.logoImageUrl : undefined,
    };
  } catch {
    return null;
  }
}

export function syncTeosOrgSnapshotForChat(row: TeosOrgChatSnapshot | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (row) {
      window.sessionStorage.setItem(TEOS_ORG_CHAT_SNAPSHOT_KEY, JSON.stringify(row));
    } else {
      window.sessionStorage.removeItem(TEOS_ORG_CHAT_SNAPSHOT_KEY);
    }
  } catch {
    /* quota / private mode */
  }
}
