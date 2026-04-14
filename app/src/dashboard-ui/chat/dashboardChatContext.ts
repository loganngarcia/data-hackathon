/**
 * Client-only context for the chat composer: current route, mosaic toolbar filters,
 * and (when applicable) the org profile the user has open (`?org=` + snapshot).
 */

import { ASSETS_BAND_LABELS } from "@/lib/assets-band";
import type { PersistedPortfolioFilters } from "@/lib/portfolio-filters-storage";
import { readPersistedPortfolioFilters } from "@/lib/portfolio-filters-storage";
import { BOARD_BAND_MENU_LABELS } from "@/lib/board-band";
import { COUNT_BAND_MENU_LABELS } from "@/lib/portfolio-toolbar-bands";
import { RESERVE_BAND_LABELS } from "@/lib/reserve-band";
import { REVENUE_BAND_LABELS } from "@/lib/revenue-band";
import { teosSnapshotMatchesUrl } from "@/lib/org-context-for-message";
import { parseTeosOrgIdParam } from "@/lib/teos-org-id";
import {
  readTeosOrgSnapshotFromSession,
  type TeosOrgChatSnapshot,
} from "@/lib/teos-org-chat-snapshot";

function formatPortfolioFiltersHuman(f: PersistedPortfolioFilters): string {
  const parts: string[] = [];
  if (f.assetsBands.length > 0) {
    parts.push(`Net assets: ${f.assetsBands.map((id) => ASSETS_BAND_LABELS[id]).join(", ")}`);
  }
  if (f.revenueBands.length > 0) {
    parts.push(`Revenue: ${f.revenueBands.map((id) => REVENUE_BAND_LABELS[id]).join(", ")}`);
  }
  if (f.reserveBands.length > 0) {
    parts.push(`Reserve coverage: ${f.reserveBands.map((id) => RESERVE_BAND_LABELS[id]).join(", ")}`);
  }
  if (f.employeeBands.length > 0) {
    parts.push(`Employees: ${f.employeeBands.map((id) => COUNT_BAND_MENU_LABELS[id]).join(", ")}`);
  }
  if (f.volunteerBands.length > 0) {
    parts.push(`Volunteers: ${f.volunteerBands.map((id) => COUNT_BAND_MENU_LABELS[id]).join(", ")}`);
  }
  if (f.boardBands.length > 0) {
    parts.push(`Board size: ${f.boardBands.map((id) => BOARD_BAND_MENU_LABELS[id]).join(", ")}`);
  }
  if (f.stateAbbrevs.length > 0) {
    parts.push(`States: ${f.stateAbbrevs.join(", ")}`);
  }
  return parts.length > 0 ? parts.join("\n") : "No toolbar band filters (full TEOS pool on the list).";
}

function describeOrgFromUrl(orgRaw: string | null, snapshot: TeosOrgChatSnapshot | null): string | null {
  if (!orgRaw?.trim()) return null;
  let decoded = orgRaw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* keep raw */
  }
  const snap = snapshot && teosSnapshotMatchesUrl(decoded, snapshot) ? snapshot : null;

  if (snap) {
    return formatSnapshotLine("Organization in focus", snap);
  }

  const parsed = parseTeosOrgIdParam(decoded);
  if (parsed.ein) return `Organization in focus (from URL): EIN ${parsed.ein} · id ${decoded}`;
  if (parsed.returnPk) return `Organization in focus (from URL): filing id ${parsed.returnPk} · id ${decoded}`;
  return `Organization in focus (from URL): id ${decoded}`;
}

function formatSnapshotLine(title: string, snap: TeosOrgChatSnapshot): string {
  const loc = [snap.city, snap.state].filter(Boolean).join(", ");
  const d = snap.ein.replace(/\D/g, "");
  const einPretty = d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2)}` : snap.ein;
  return `${title}: "${snap.name}"${loc ? ` (${loc})` : ""}${einPretty ? ` · EIN ${einPretty}` : ""} · id ${snap.orgId}`;
}

/**
 * Extra system-facing block for the user message (not a second HTTP field).
 * Empty on SSR / non-browser.
 */
export function buildDashboardChatContextPromptSection(): string {
  if (typeof window === "undefined") return "";

  const path = window.location.pathname || "";
  const onHomeMosaic = path === "/" || path === "";
  const chatSession = /^\/c\/[^/]+\/?$/.test(path);

  const params = new URLSearchParams(window.location.search);
  const orgRaw = params.get("org");

  let routeLine: string;
  if (onHomeMosaic) {
    routeLine = "Page: Home — Tipping Point portfolio mosaic (org list + optional org detail) is shown.";
  } else if (chatSession) {
    routeLine =
      "Page: Chat session — conversation view; mosaic may be hidden. The URL may still include ?org= if the user opened an org from the list.";
  } else {
    routeLine = `Page: ${path || "(unknown)"}`;
  }

  const filters = readPersistedPortfolioFilters();
  const filtersHuman = formatPortfolioFiltersHuman(filters);
  const snapshot = readTeosOrgSnapshotFromSession();
  /** URL wins; if user was on \`/?org=\` and started chat, \`/c/…\` may drop the param — keep session snapshot. */
  const orgLine =
    orgRaw?.trim()
      ? describeOrgFromUrl(orgRaw, snapshot)
      : snapshot
        ? formatSnapshotLine("Recently focused organization (session — chat URL may omit ?org=)", snapshot)
        : null;

  const lines: string[] = [
    "[App UI context — personalization only]",
    "The user is browsing the Tipping Point nonprofit dashboard. Use this to tailor tone and relevance.",
    "Do not assume these settings must be applied to `search_nonprofits` unless the user asks for a search aligned with them.",
    "When you do use the mosaic filters or the in-focus org in a tool call or answer, say so briefly (one short phrase).",
    "",
    routeLine,
  ];

  if (onHomeMosaic) {
    lines.push("");
    lines.push("Mosaic toolbar filters currently selected (narrow the on-screen list — optional for search tools):");
    lines.push(filtersHuman);
  } else {
    lines.push("");
    lines.push(
      "Saved mosaic toolbar filters (persist in this browser; optional for search — user may not have the list visible):",
    );
    lines.push(filtersHuman);
  }

  if (orgLine) {
    lines.push("");
    lines.push(orgLine);
  } else {
    lines.push("");
    lines.push("No organization profile is in focus (no ?org= and no recent org snapshot in this tab).");
  }

  return lines.join("\n");
}
