/**
 * Maps Worker `irs990-search` rows to chat org cards (same fields as portfolio list / `ScreenerRow` slice).
 */

import { formatCityDisplay, formatStateAbbrevDisplay, toOrganizationTitleCase } from "@/lib/org-name-format";
import { normalizeWebsiteUrl } from "@/lib/website-url";

export type NonprofitSearchCard = {
  orgId: string;
  title: string;
  /** @deprecated Legacy persisted messages — prefer city + state + meta fields */
  subtitle?: string;
  /** Present on new tool rows; optional for older saved chat bubbles */
  city?: string;
  state?: string;
  /** Short mission / activity excerpt from TEOS (when returned by search). */
  missionSnippet?: string;
  websiteUrl?: string;
  /** Hostname for Logo.dev / cache */
  logoDomain?: string;
  logoImageUrl?: string;
  reserveMonths?: number;
  netAssetsEoy?: number;
  boardMemberCount?: number;
};

/** Parse one card object from streamed SSE JSON (new tool payloads + legacy `{ orgId, title, subtitle }`). */
export function parseNonprofitSearchCardFromUnknown(item: unknown): NonprofitSearchCard | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const orgId = typeof o.orgId === "string" ? o.orgId.trim() : "";
  const title = typeof o.title === "string" ? o.title : "";
  if (!orgId || !title) return null;

  const card: NonprofitSearchCard = { orgId, title };

  if (typeof o.subtitle === "string" && o.subtitle) card.subtitle = o.subtitle;
  if (typeof o.city === "string") card.city = o.city;
  if (typeof o.state === "string") card.state = o.state;
  if (typeof o.websiteUrl === "string" && o.websiteUrl) card.websiteUrl = o.websiteUrl;
  if (typeof o.logoDomain === "string" && o.logoDomain.trim()) {
    card.logoDomain = o.logoDomain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  }
  if (typeof o.logoImageUrl === "string" && o.logoImageUrl) card.logoImageUrl = o.logoImageUrl;

  if (typeof o.reserveMonths === "number" && Number.isFinite(o.reserveMonths)) {
    card.reserveMonths = o.reserveMonths;
  }
  if (typeof o.netAssetsEoy === "number" && Number.isFinite(o.netAssetsEoy)) {
    card.netAssetsEoy = o.netAssetsEoy;
  }
  if (typeof o.boardMemberCount === "number" && Number.isFinite(o.boardMemberCount)) {
    const b = Math.floor(o.boardMemberCount);
    if (b >= 0) card.boardMemberCount = b;
  }
  if (typeof o.missionSnippet === "string" && o.missionSnippet.trim()) {
    card.missionSnippet = o.missionSnippet.trim();
  }
  return card;
}

export function parseNonprofitSearchCardsFromStreamArray(raw: unknown): NonprofitSearchCard[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: NonprofitSearchCard[] = [];
  for (const item of raw) {
    const c = parseNonprofitSearchCardFromUnknown(item);
    if (c) out.push(c);
  }
  return out.length ? out : null;
}

const MAX_CARDS = 25;

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalNonnegInt(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 0) return undefined;
  return i;
}

export function irs990SearchRowsToChatCards(rows: unknown[] | undefined | null): NonprofitSearchCard[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: NonprofitSearchCard[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const pk = r.return_pk != null ? String(r.return_pk).trim() : "";
    const einRaw = String(r.ein ?? "").replace(/\D/g, "").slice(0, 9);
    const orgId = pk ? `irs990-${pk}` : einRaw.length === 9 ? `irs990-ein-${einRaw}` : "";
    if (!orgId) continue;
    const title = toOrganizationTitleCase(
      String(r.name ?? "Unknown organization").trim() || "Unknown organization",
    );
    const city = formatCityDisplay(String(r.city ?? "").trim() || "—");
    const state = formatStateAbbrevDisplay(String(r.state ?? "").trim() || "—");
    const subtitle = [city, state].filter((s) => s && s !== "—").join(", ") || "—";
    const exp = num(r.cy_total_expenses_amt);
    const na = num(r.net_assets_eoy_amt);
    const reserveMonths = Math.round((exp > 0 ? (na / exp) * 12 : 0) * 10) / 10;
    const netAssetsEoy = Number.isFinite(na) ? na : 0;
    const boardMemberCount = parseOptionalNonnegInt(r.board_members_cnt);
    const missionRaw = r.mission_snippet;
    const missionSnippet =
      typeof missionRaw === "string" && missionRaw.trim().length > 0 ? missionRaw.trim() : undefined;
    const websiteUrl = normalizeWebsiteUrl(
      typeof r.website_txt === "string" ? r.website_txt : undefined,
    );
    let logoDomain: string | undefined;
    const rawLogo = r.logo_cached_domain;
    if (typeof rawLogo === "string" && rawLogo.trim().length > 0) {
      logoDomain = rawLogo
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
    }
    out.push({
      orgId,
      title,
      subtitle,
      city,
      state,
      reserveMonths,
      netAssetsEoy,
      ...(websiteUrl ? { websiteUrl } : {}),
      ...(logoDomain ? { logoDomain } : {}),
      ...(boardMemberCount !== undefined ? { boardMemberCount } : {}),
      ...(missionSnippet ? { missionSnippet } : {}),
    });
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

export function mergeNonprofitSearchCards(
  prev: NonprofitSearchCard[],
  next: NonprofitSearchCard[],
): NonprofitSearchCard[] {
  const seen = new Set(prev.map((c) => c.orgId));
  const out = [...prev];
  for (const c of next) {
    if (seen.has(c.orgId)) continue;
    seen.add(c.orgId);
    out.push(c);
  }
  return out;
}
