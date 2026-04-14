import { NextResponse } from "next/server";
import { portfolioBucketCounts, type PortfolioBucketCounts } from "@/lib/portfolio-buckets";
import { PORTFOLIO_ORGS } from "@/lib/portfolio-config";
import { formatOrgMissionDescription, pickMissionRaw } from "@/lib/mission-text";
import { normalizeWebsiteUrl } from "@/lib/website-url";
import { filingsToYearRows } from "@/lib/propublica-filing";
import {
  computeResilienceScore,
  estimateStaffFte,
  tierToRiskBand,
} from "@/lib/resilience-score";
import {
  formatCityDisplay,
  formatStateAbbrevDisplay,
  toOrganizationTitleCase,
} from "@/lib/org-name-format";
import { getNonprofitWorkerBaseUrl } from "@/lib/nonprofit-worker-url";
import { parseAssetsBandQuery, type AssetsBandId } from "@/lib/assets-band";
import { parseRevenueBandQuery, type RevenueBandId } from "@/lib/revenue-band";
import { parseReserveBandQuery, type ReserveBandId } from "@/lib/reserve-band";
import { parseBoardBandQuery, type BoardBandId } from "@/lib/board-band";
import { irs990BrowseRowToYearFinancials } from "@/lib/teos-year-financial";
import type { ScreenerRow } from "@/lib/types";

const PROPUBLICA_ORG = "https://projects.propublica.org/nonprofits/api/v2/organizations";
const SHOWCASE_EINS = PORTFOLIO_ORGS.map((o) => o.ein);

/** 9-digit EINs from `excludeEins` query (comma-separated); used with TEOS random paging. */
function parseExcludeEinsQuery(param: string | null): string[] {
  if (!param?.trim()) return [];
  const out: string[] = [];
  for (const part of param.split(",")) {
    const d = part.replace(/\D/g, "").slice(0, 9);
    if (d.length === 9) out.push(d);
  }
  return [...new Set(out)];
}

function mapScreenerDisplayFormat(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.map((r) => ({
    ...r,
    organizationName: toOrganizationTitleCase(r.organizationName),
    city: formatCityDisplay(r.city),
    state: formatStateAbbrevDisplay(r.state),
  }));
}

async function tryWorkerCache(): Promise<{
  screener: ScreenerRow[];
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
} | null> {
  const base = getNonprofitWorkerBaseUrl();
  try {
    const res = await fetch(`${base}/api/portfolio`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      screener?: ScreenerRow[];
      revenueByOrg?: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
    };
    if (!data.screener?.length) return null;
    return { screener: mapScreenerDisplayFormat(data.screener), revenueByOrg: data.revenueByOrg ?? {} };
  } catch {
    return null;
  }
}

type Irs990BrowseRow = {
  return_pk?: string;
  ein?: string;
  name?: string;
  city?: string;
  state?: string;
  website_txt?: string | null;
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
  formation_yr?: number | null;
  total_employee_cnt?: number | null;
  total_volunteers_cnt?: number | null;
  tax_yr?: number | null;
  organization_501c3_ind?: number | null;
  /** Worker D1 `org_logo_cache` joined in `/api/irs990-browse`. */
  logo_cached_domain?: string | null;
  /** Worker-built `img.logo.dev` URL when `LOGO_DEV_PUBLISHABLE_KEY` is set on the Worker. */
  logo_image_url?: string | null;
};

function formatEin9(digits: string): string {
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
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 0) return undefined;
  return i;
}

function mapIrs990Rows(rows: Irs990BrowseRow[]): {
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
    const riskBand = resilience ? tierToRiskBand(resilience.tier) : reserveM >= 6 ? "Foundation" : reserveM >= 3 ? "Steady" : "Watch";
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
    const netAssetsEoy = Number(r.net_assets_eoy_amt ?? 0);
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
    });
    revenueByOrg[id] = {
      currentYearRevenue: rev,
      priorYearRevenue: prev,
    };
  }

  return { screener, revenueByOrg };
}

/** One page of TEOS rows from Worker (`random=1` → `ORDER BY RANDOM()` in D1; else A–Z + offset). */
async function fetchIrs990Page(
  base: string,
  offset: number,
  limit: number,
  excludeEins: string[],
  options?: {
    random?: boolean;
    revenueBand?: RevenueBandId;
    assetsBand?: AssetsBandId;
    reserveBand?: ReserveBandId;
    employeeBand?: string;
    volunteerBand?: string;
    boardBand?: BoardBandId;
    state?: string;
  },
): Promise<{
  screener: ScreenerRow[];
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
  hasMore: boolean;
} | null> {
  if (limit <= 0) {
    return { screener: [], revenueByOrg: {}, hasMore: false };
  }
  const excludeParam = excludeEins.length ? `&exclude=${encodeURIComponent(excludeEins.join(","))}` : "";
  const randomParam = options?.random ? "&random=1" : "";
  const band = options?.revenueBand;
  const revenueParam =
    band && band !== "all" ? `&revenueBand=${encodeURIComponent(band)}` : "";
  const eb = options?.employeeBand;
  const employeeParam =
    eb && eb !== "all" ? `&employeeBand=${encodeURIComponent(eb)}` : "";
  const vb = options?.volunteerBand;
  const volunteerParam =
    vb && vb !== "all" ? `&volunteerBand=${encodeURIComponent(vb)}` : "";
  const bb = options?.boardBand;
  const boardParam =
    bb && bb !== "all" ? `&boardBand=${encodeURIComponent(bb)}` : "";
  const st = options?.state;
  const stateParam = st && st !== "all" ? `&state=${encodeURIComponent(st)}` : "";
  const ab = options?.assetsBand;
  const assetsParam =
    ab && ab !== "all" ? `&assetsBand=${encodeURIComponent(ab)}` : "";
  const rb = options?.reserveBand;
  const reserveParam =
    rb && rb !== "all" ? `&reserveBand=${encodeURIComponent(rb)}` : "";
  const off = options?.random ? 0 : offset;
  try {
    const res = await fetch(
      `${base}/api/irs990-browse?limit=${limit}&offset=${off}${excludeParam}${randomParam}${revenueParam}${assetsParam}${reserveParam}${employeeParam}${volunteerParam}${boardParam}${stateParam}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rows?: Irs990BrowseRow[];
      hasMore?: boolean;
    };
    const rows = data.rows ?? [];
    return {
      ...mapIrs990Rows(rows),
      hasMore: Boolean(data.hasMore),
    };
  } catch {
    return null;
  }
}

async function fetchTeosBucketCounts(base: string): Promise<PortfolioBucketCounts | null> {
  const excludeParam = SHOWCASE_EINS.length
    ? `exclude=${encodeURIComponent(SHOWCASE_EINS.join(","))}`
    : "";
  const q = excludeParam ? `?${excludeParam}` : "";
  try {
    const res = await fetch(`${base}/api/irs990-bucket-counts${q}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      total?: number;
      atRisk?: number;
      thriving?: number;
    };
    return {
      total: Number(data.total ?? 0),
      atRisk: Number(data.atRisk ?? 0),
      thriving: Number(data.thriving ?? 0),
    };
  } catch {
    return null;
  }
}

function mergeBucketCounts(a: PortfolioBucketCounts, b: PortfolioBucketCounts): PortfolioBucketCounts {
  return {
    total: a.total + b.total,
    atRisk: a.atRisk + b.atRisk,
    thriving: a.thriving + b.thriving,
  };
}

/** Showcase rows only (for bucket totals when page ≥ 2 doesn’t repeat curated fetch). */
async function getShowcaseRowsForBucketTotals(): Promise<ScreenerRow[] | null> {
  const cached = await tryWorkerCache();
  if (cached?.screener.length) return cached.screener;
  const built = await buildProPublicaPortfolio();
  return built?.screener.length ? built.screener : null;
}

async function resolveBucketCountsForResponse(
  page: number,
  curatedScreener?: ScreenerRow[],
): Promise<PortfolioBucketCounts | undefined> {
  const base = getNonprofitWorkerBaseUrl();
  let showcaseCounts: PortfolioBucketCounts;

  if (page === 1 && curatedScreener?.length) {
    showcaseCounts = portfolioBucketCounts(curatedScreener);
  } else {
    const rows = await getShowcaseRowsForBucketTotals();
    if (!rows?.length) return undefined;
    showcaseCounts = portfolioBucketCounts(rows);
  }

  const teos = await fetchTeosBucketCounts(base);
  if (!teos) return showcaseCounts;
  return mergeBucketCounts(showcaseCounts, teos);
}

type ProPublicaOrgPayload = {
  organization?: {
    name?: string;
    city?: string;
    state?: string;
    ntee_code?: string;
  };
  filings_with_data?: Record<string, unknown>[];
};

function missionFromNtee(code?: string): string {
  if (!code) return "Nonprofit";
  const c = code.trim().toUpperCase()[0];
  const map: Record<string, string> = {
    A: "Arts & culture",
    B: "Education",
    C: "Environment",
    D: "Health care",
    E: "Health",
    F: "Mental health",
    G: "Disease / health",
    H: "Medical research",
    I: "Crime & legal",
    J: "Employment",
    K: "Food & nutrition",
    L: "Housing",
    M: "Public safety",
    N: "Recreation",
    O: "Youth",
    P: "Human services",
    Q: "International",
    R: "Civil rights",
    S: "Community improvement",
    T: "Philanthropy",
    U: "Science & research",
    V: "Social science",
    W: "Public benefit",
    X: "Religion",
    Y: "Mutual benefit",
    Z: "Unknown",
  };
  return map[c] ?? "Community benefit";
}

function yoyLatestTwo(years: ReturnType<typeof filingsToYearRows>): number {
  if (years.length < 2) return 0;
  const a = years[years.length - 1].total_revenue;
  const b = years[years.length - 2].total_revenue;
  if (Math.abs(b) < 1e-9) return 0;
  return ((a - b) / Math.abs(b)) * 100;
}

async function fetchOrg(ein: string): Promise<ProPublicaOrgPayload> {
  const res = await fetch(`${PROPUBLICA_ORG}/${ein}.json`, {
    next: { revalidate: 86_400 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ProPublica ${ein}: ${res.status}`);
  }
  return res.json() as Promise<ProPublicaOrgPayload>;
}

async function fetchTeosMissionSummaryForEin(base: string, ein9: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${base}/api/irs990-mission?ein=${ein9}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { mission_raw?: string | null };
    return formatOrgMissionDescription(data.mission_raw ?? undefined);
  } catch {
    return undefined;
  }
}

async function buildProPublicaPortfolio(): Promise<{
  screener: ScreenerRow[];
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
} | null> {
  const base = getNonprofitWorkerBaseUrl();
  try {
    const results = await Promise.all(
      PORTFOLIO_ORGS.map(async (cfg) => {
        const payload = await fetchOrg(cfg.ein);
        const org = payload.organization;
        const rawFilings = payload.filings_with_data ?? [];
        const years = filingsToYearRows(rawFilings);
        const score = computeResilienceScore(years);
        const latest = years[years.length - 1];
        const prior = years.length >= 2 ? years[years.length - 2] : undefined;

        const composite = score?.composite_score ?? 0;
        const tier = score?.tier ?? "Urgent";
        const riskBand = tierToRiskBand(tier);

        const reserveM =
          latest && latest.total_expenses > 0
            ? (latest.net_assets_eoy / latest.total_expenses) * 12
            : 0;
        const growth = yoyLatestTwo(years);
        const revenue = latest ? latest.total_revenue : 0;
        const staff = latest ? estimateStaffFte(latest.total_expenses) : 1;

        const missionSummary = await fetchTeosMissionSummaryForEin(base, cfg.ein);

        const netAssetsEoy = latest ? Number(latest.net_assets_eoy) : 0;
        const row: ScreenerRow = {
          id: cfg.id,
          organizationName: toOrganizationTitleCase(org?.name ?? "Unknown organization"),
          ein: formatEin9(cfg.ein),
          city: formatCityDisplay(org?.city?.trim() || "—"),
          state: formatStateAbbrevDisplay(org?.state?.trim() || "—"),
          missionArea: missionFromNtee(org?.ntee_code),
          revenue,
          netAssetsEoy: Number.isFinite(netAssetsEoy) ? netAssetsEoy : 0,
          growthRate: Math.round(growth * 10) / 10,
          reserveMonths: Math.round(reserveM * 10) / 10,
          staffCount: staff,
          riskBand,
          screenScore: Math.round(Math.max(0, Math.min(100, composite))),
          ...(missionSummary ? { missionSummary } : {}),
        };

        return {
          row,
          revenueFacts: {
            currentYearRevenue: latest?.total_revenue ?? 0,
            priorYearRevenue: prior?.total_revenue ?? 0,
          },
        };
      }),
    );

    const screener = results.map((r) => r.row);
    const revenueByOrg = Object.fromEntries(
      PORTFOLIO_ORGS.map((cfg, i) => [cfg.id, results[i].revenueFacts]),
    );
    return { screener, revenueByOrg };
  } catch {
    return null;
  }
}

/**
 * Paginated portfolio for the dashboard.
 * - All pages: random TEOS rows (`ORDER BY RANDOM()` in D1). No fixed “showcase” prefix.
 * - Pass `excludeEins` (comma-separated 9-digit EINs) for orgs already shown so load-more avoids duplicates.
 *
 * Query: `page` (1-based), `pageSize` (default 20, max 100), optional `excludeEins`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(4, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
  const base = getNonprofitWorkerBaseUrl();
  const clientExclude = parseExcludeEinsQuery(url.searchParams.get("excludeEins"));
  const revenueBand = parseRevenueBandQuery(url.searchParams.get("revenueBand"));
  const assetsBand = parseAssetsBandQuery(url.searchParams.get("assetsBand"));
  const reserveBand = parseReserveBandQuery(url.searchParams.get("reserveBand"));
  const employeeBand = (url.searchParams.get("employeeBand") ?? "").trim();
  const volunteerBand = (url.searchParams.get("volunteerBand") ?? "").trim();
  const boardBand = parseBoardBandQuery(url.searchParams.get("boardBand"));
  const stateFilter = (url.searchParams.get("state") ?? "").trim();
  const browseOpts = {
    random: true as const,
    revenueBand,
    ...(assetsBand !== "all" ? { assetsBand } : {}),
    ...(reserveBand !== "all" ? { reserveBand } : {}),
    ...(employeeBand && employeeBand !== "all" ? { employeeBand } : {}),
    ...(volunteerBand && volunteerBand !== "all" ? { volunteerBand } : {}),
    ...(boardBand !== "all" ? { boardBand } : {}),
    ...(stateFilter && stateFilter !== "all" ? { state: stateFilter } : {}),
  };

  if (page >= 2) {
    const bucketCounts = await resolveBucketCountsForResponse(page);
    const teos = await fetchIrs990Page(base, 0, pageSize, clientExclude, browseOpts);
    if (!teos?.screener.length) {
      return NextResponse.json({
        screener: [],
        revenueByOrg: {},
        page,
        pageSize,
        hasMore: false,
        append: true,
        source: "worker-irs990-xml",
        scoring: "moobu-resilience-v1",
        ...(bucketCounts ? { bucketCounts } : {}),
      });
    }
    return NextResponse.json({
      screener: teos.screener,
      revenueByOrg: teos.revenueByOrg,
      page,
      pageSize,
      hasMore: teos.hasMore,
      append: true,
      source: "worker-irs990-xml",
      scoring: "moobu-resilience-v1",
      ...(bucketCounts ? { bucketCounts } : {}),
    });
  }

  const bucketCounts = await resolveBucketCountsForResponse(1);
  const teos = await fetchIrs990Page(base, 0, pageSize, clientExclude, browseOpts);
  if (!teos?.screener.length) {
    return NextResponse.json({ error: "No portfolio data" }, { status: 503 });
  }

  return NextResponse.json({
    screener: teos.screener,
    revenueByOrg: teos.revenueByOrg,
    page: 1,
    pageSize,
    hasMore: teos.hasMore,
    append: false,
    source: "worker-irs990-xml",
    scoring: "moobu-resilience-v1",
    ...(bucketCounts ? { bucketCounts } : {}),
  });
}
