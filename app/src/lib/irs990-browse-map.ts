import { formatCityDisplay, formatStateAbbrevDisplay, toOrganizationTitleCase } from "@/lib/org-name-format";
import { formatOrgMissionDescription, pickMissionRaw } from "@/lib/mission-text";
import { normalizeWebsiteUrl } from "@/lib/website-url";
import {
  computeResilienceScore,
  estimateStaffFte,
  tierToRiskBand,
} from "@/lib/resilience-score";
import type { ScreenerRow } from "@/lib/types";
import { irs990BrowseRowToYearFinancials } from "@/lib/teos-year-financial";

export type Irs990BrowseRow = {
  return_pk?: string;
  ein?: string;
  name?: string;
  city?: string;
  state?: string;
  website_txt?: string | null;
  /** TEOS filer phone (Form 990 header). */
  org_phone?: string | null;
  /** When D1 adds an org email column, browse rows may include it. */
  org_email?: string | null;
  mission_desc?: string | null;
  activity_mission_desc?: string | null;
  cy_total_revenue_amt?: number | null;
  py_total_revenue_amt?: number | null;
  cy_total_expenses_amt?: number | null;
  py_total_expenses_amt?: number | null;
  cy_rev_less_expenses_amt?: number | null;
  net_assets_eoy_amt?: number | null;
  net_assets_boy_amt?: number | null;
  cy_contributions_grants_amt?: number | null;
  cy_program_service_revenue_amt?: number | null;
  cy_investment_income_amt?: number | null;
  cy_other_revenue_amt?: number | null;
  total_program_service_expenses_amt?: number | null;
  cy_total_management_and_general_expenses_amt?: number | null;
  cy_total_fundraising_expense_amt?: number | null;
  formation_yr?: number | null;
  total_employee_cnt?: number | null;
  total_volunteers_cnt?: number | null;
  board_members_cnt?: number | null;
  governing_body_voting_cnt?: number | null;
  voting_members_governing_cnt?: number | null;
  voting_members_independent_cnt?: number | null;
  independent_voting_member_cnt?: number | null;
  tax_yr?: number | null;
  organization_501c3_ind?: number | null;
  logo_cached_domain?: string | null;
  logo_image_url?: string | null;
};

export function formatEin9(digits: string): string {
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function parseFormationYearFrom990(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return undefined;
  const y = Math.floor(n);
  const maxY = new Date().getFullYear() + 1;
  if (y < 1600 || y > maxY) return undefined;
  return y;
}

function parseNonnegativeInt990(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "bigint") {
    const i = Number(v);
    if (!Number.isFinite(i)) return undefined;
    const f = Math.floor(i);
    return f >= 0 ? f : undefined;
  }
  const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 0) return undefined;
  return i;
}

function optionalUsdFrom990(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function optionalTrimmedString(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

/** Basic email shape check for optional TEOS / CRM email fields. */
function optionalOrgEmail(v: unknown): string | undefined {
  const s = optionalTrimmedString(v);
  if (!s) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return undefined;
  return s;
}

/**
 * Same coalesce + default as Worker `boardCntExpr` / `portfolio-browse-filters` `boardMembersFromRow`
 * so list cards show the same count the board filter uses (0 when all Part VI fields are null).
 */
function boardMembersFromBrowseRow(r: Irs990BrowseRow): number {
  return (
    parseNonnegativeInt990(r.board_members_cnt) ??
    parseNonnegativeInt990(r.governing_body_voting_cnt) ??
    parseNonnegativeInt990(r.voting_members_governing_cnt) ??
    parseNonnegativeInt990(r.voting_members_independent_cnt) ??
    parseNonnegativeInt990(r.independent_voting_member_cnt) ??
    0
  );
}

export function mapIrs990Rows(rows: Irs990BrowseRow[]): {
  screener: ScreenerRow[];
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
} {
  const screener: ScreenerRow[] = [];
  const revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }> = {};

  for (const r of rows) {
    const pk = String(r.return_pk ?? r.ein ?? "");
    const id = `irs990-${pk}`;
    const rev = Number(r.cy_total_revenue_amt ?? 0);
    const prev = Number(r.py_total_revenue_amt ?? 0);
    const exp = Number(r.cy_total_expenses_amt ?? 0);
    const na = Number(r.net_assets_eoy_amt ?? 0);
    let growth = 0;
    if (Math.abs(prev) > 1e-6) growth = ((rev - prev) / Math.abs(prev)) * 100;
    const reserveM = exp > 0 ? (na / exp) * 12 : 0;
    const staff = Math.max(1, Math.floor(Number(r.total_employee_cnt ?? 1)));
    const einDigits = String(r.ein ?? "").replace(/\D/g, "").slice(0, 9).padStart(9, "0");
    const einFmt = einDigits.length === 9 ? formatEin9(einDigits) : "—";

    const years = irs990BrowseRowToYearFinancials(r);
    const resilience = years ? computeResilienceScore(years) : null;
    const legacyComposite = Math.min(
      100,
      Math.max(0, 38 + Math.min(22, growth / 3) + Math.min(28, reserveM * 1.5)),
    );
    const composite = resilience?.composite_score ?? legacyComposite;
    const riskBand = resilience
      ? tierToRiskBand(resilience.tier)
      : reserveM >= 6
        ? "Foundation"
        : reserveM >= 3
          ? "Steady"
          : "Watch";
    const score = Math.round(Math.max(0, Math.min(100, composite)));

    const websiteUrl = normalizeWebsiteUrl(r.website_txt ?? undefined);
    const rawLogo = r.logo_cached_domain;
    const logoDomain =
      typeof rawLogo === "string" && rawLogo.trim().length > 0
        ? rawLogo
            .trim()
            .replace(/^https?:\/\//i, "")
            .replace(/\/.*$/, "")
            .toLowerCase()
        : undefined;
    const missionRaw = pickMissionRaw(r.activity_mission_desc, r.mission_desc);
    const missionSummary = formatOrgMissionDescription(missionRaw);
    const foundedYear = parseFormationYearFrom990(r.formation_yr);
    const employeeCount = parseNonnegativeInt990(r.total_employee_cnt);
    const volunteerCount = parseNonnegativeInt990(r.total_volunteers_cnt);
    const boardMemberCount = boardMembersFromBrowseRow(r);
    const netAssetsEoy = Number(r.net_assets_eoy_amt ?? 0);
    const programServiceExpensesUsd = optionalUsdFrom990(r.total_program_service_expenses_amt);
    const managementGeneralExpensesUsd = optionalUsdFrom990(r.cy_total_management_and_general_expenses_amt);
    const fundraisingExpensesUsd = optionalUsdFrom990(r.cy_total_fundraising_expense_amt);
    const orgPhone = optionalTrimmedString(r.org_phone);
    const orgEmail = optionalOrgEmail(r.org_email);
    screener.push({
      id,
      organizationName: toOrganizationTitleCase(
        (r.name ?? "Unknown organization").trim() || "Unknown organization",
      ),
      ein: einFmt,
      city: formatCityDisplay((r.city ?? "—").trim() || "—"),
      state: formatStateAbbrevDisplay((r.state ?? "—").trim() || "—"),
      missionArea: r.organization_501c3_ind === 1 ? "501(c)(3)" : "Nonprofit (IRS 990)",
      revenue: rev,
      netAssetsEoy: Number.isFinite(netAssetsEoy) ? netAssetsEoy : 0,
      growthRate: Math.round(growth * 10) / 10,
      reserveMonths: Math.round(reserveM * 10) / 10,
      staffCount: staff,
      riskBand,
      screenScore: score,
      ...(websiteUrl ? { websiteUrl } : {}),
      ...(logoDomain ? { logoDomain } : {}),
      ...(typeof r.logo_image_url === "string" && r.logo_image_url.trim().length > 0
        ? { logoImageUrl: r.logo_image_url.trim() }
        : {}),
      ...(missionSummary ? { missionSummary } : {}),
      ...(foundedYear !== undefined ? { foundedYear } : {}),
      ...(employeeCount !== undefined ? { employeeCount } : {}),
      ...(volunteerCount !== undefined ? { volunteerCount } : {}),
      boardMemberCount,
      ...(programServiceExpensesUsd !== undefined ? { programServiceExpensesUsd } : {}),
      ...(managementGeneralExpensesUsd !== undefined ? { managementGeneralExpensesUsd } : {}),
      ...(fundraisingExpensesUsd !== undefined ? { fundraisingExpensesUsd } : {}),
      ...(orgPhone ? { orgPhone } : {}),
      ...(orgEmail ? { orgEmail } : {}),
    });
    revenueByOrg[id] = {
      currentYearRevenue: rev,
      priorYearRevenue: prev,
    };
  }

  return { screener, revenueByOrg };
}
