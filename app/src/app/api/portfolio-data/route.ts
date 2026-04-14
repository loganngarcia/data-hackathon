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
import {
  parseAssetsBandQuery,
  parseAssetsBandsQuery,
  type AssetsBandSelection,
} from "@/lib/assets-band";
import {
  parseRevenueBandQuery,
  parseRevenueBandsQuery,
  type RevenueBandSelection,
} from "@/lib/revenue-band";
import {
  parseReserveBandQuery,
  parseReserveBandsQuery,
  type ReserveBandSelection,
} from "@/lib/reserve-band";
import {
  parseBoardBandQuery,
  parseBoardBandsQuery,
  type BoardBandSelection,
} from "@/lib/board-band";
import {
  isCountBandId,
  parseCountBandsQuery,
  parseStatesQuery,
  type CountBandId,
  type CountBandSelection,
  type StateAbbrevSelection,
} from "@/lib/portfolio-toolbar-bands";
import { filterTeosBrowseRows } from "@/lib/portfolio-browse-filters";
import { formatEin9, mapIrs990Rows, type Irs990BrowseRow } from "@/lib/irs990-browse-map";
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

/** One page of TEOS rows from Worker (`random=1` → `ORDER BY RANDOM()` in D1; else A–Z + offset). */
async function fetchIrs990Page(
  base: string,
  offset: number,
  limit: number,
  excludeEins: string[],
  options?: {
    random?: boolean;
    revenueBands?: RevenueBandSelection;
    assetsBands?: AssetsBandSelection;
    reserveBands?: ReserveBandSelection;
    employeeBands?: CountBandSelection;
    volunteerBands?: CountBandSelection;
    boardBands?: BoardBandSelection;
    states?: StateAbbrevSelection;
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
  const rev = options?.revenueBands;
  const revenueParam =
    rev && rev.length > 0 ? `&revenueBands=${encodeURIComponent(rev.join(","))}` : "";
  const eb = options?.employeeBands;
  const employeeParam =
    eb && eb.length > 0 ? `&employeeBands=${encodeURIComponent(eb.join(","))}` : "";
  const vb = options?.volunteerBands;
  const volunteerParam =
    vb && vb.length > 0 ? `&volunteerBands=${encodeURIComponent(vb.join(","))}` : "";
  const bb = options?.boardBands;
  const boardParam =
    bb && bb.length > 0 ? `&boardBands=${encodeURIComponent(bb.join(","))}` : "";
  const st = options?.states;
  const stateParam =
    st && st.length > 0 ? `&states=${encodeURIComponent(st.join(","))}` : "";
  const ab = options?.assetsBands;
  const assetsParam =
    ab && ab.length > 0 ? `&assetsBands=${encodeURIComponent(ab.join(","))}` : "";
  const rb = options?.reserveBands;
  const reserveParam =
    rb && rb.length > 0 ? `&reserveBands=${encodeURIComponent(rb.join(","))}` : "";
  const off = options?.random ? 0 : offset;
  try {
    const res = await fetch(
      `${base}/api/irs990-browse?limit=${limit}&offset=${off}${excludeParam}${randomParam}${revenueParam}${assetsParam}${reserveParam}${employeeParam}${volunteerParam}${boardParam}${stateParam}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rows?: Irs990BrowseRow[];
      hasMore?: boolean;
    };
    const rows = filterTeosBrowseRows(data.rows ?? [], options);
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
  const revenueBandsParsed = parseRevenueBandsQuery(url.searchParams.get("revenueBands"));
  const revenueBandLegacy = parseRevenueBandQuery(url.searchParams.get("revenueBand"));
  const revenueBands: RevenueBandSelection =
    revenueBandsParsed.length > 0
      ? revenueBandsParsed
      : revenueBandLegacy !== "all"
        ? [revenueBandLegacy as RevenueBandSelection[number]]
        : [];

  const assetsBandsParsed = parseAssetsBandsQuery(url.searchParams.get("assetsBands"));
  const assetsBandLegacy = parseAssetsBandQuery(url.searchParams.get("assetsBand"));
  const assetsBands: AssetsBandSelection =
    assetsBandsParsed.length > 0
      ? assetsBandsParsed
      : assetsBandLegacy !== "all"
        ? [assetsBandLegacy as AssetsBandSelection[number]]
        : [];

  const reserveBandsParsed = parseReserveBandsQuery(url.searchParams.get("reserveBands"));
  const reserveBandLegacy = parseReserveBandQuery(url.searchParams.get("reserveBand"));
  const reserveBands: ReserveBandSelection =
    reserveBandsParsed.length > 0
      ? reserveBandsParsed
      : reserveBandLegacy !== "all"
        ? [reserveBandLegacy as ReserveBandSelection[number]]
        : [];

  const employeeBandsParsed = parseCountBandsQuery(url.searchParams.get("employeeBands"));
  const employeeBandLegacy = (url.searchParams.get("employeeBand") ?? "").trim();
  const employeeBands: CountBandSelection =
    employeeBandsParsed.length > 0
      ? employeeBandsParsed
      : employeeBandLegacy && employeeBandLegacy !== "all" && isCountBandId(employeeBandLegacy)
        ? [employeeBandLegacy as Exclude<CountBandId, "all">]
        : [];

  const volunteerBandsParsed = parseCountBandsQuery(url.searchParams.get("volunteerBands"));
  const volunteerBandLegacy = (url.searchParams.get("volunteerBand") ?? "").trim();
  const volunteerBands: CountBandSelection =
    volunteerBandsParsed.length > 0
      ? volunteerBandsParsed
      : volunteerBandLegacy && volunteerBandLegacy !== "all" && isCountBandId(volunteerBandLegacy)
        ? [volunteerBandLegacy as Exclude<CountBandId, "all">]
        : [];

  const boardBandsParsed = parseBoardBandsQuery(url.searchParams.get("boardBands"));
  const boardBandLegacy = parseBoardBandQuery(url.searchParams.get("boardBand"));
  const boardBands: BoardBandSelection =
    boardBandsParsed.length > 0
      ? boardBandsParsed
      : boardBandLegacy !== "all"
        ? [boardBandLegacy]
        : [];

  const statesParsed = parseStatesQuery(url.searchParams.get("states"));
  const stateLegacy = (url.searchParams.get("state") ?? "").trim();
  const states: StateAbbrevSelection =
    statesParsed.length > 0
      ? statesParsed
      : stateLegacy !== "all" && stateLegacy.length === 2
        ? [stateLegacy.toUpperCase()]
        : [];

  const browseOpts = {
    random: true as const,
    revenueBands,
    assetsBands,
    reserveBands,
    employeeBands,
    volunteerBands,
    boardBands,
    states,
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
