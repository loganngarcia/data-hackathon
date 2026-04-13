import { NextResponse } from "next/server";
import { PORTFOLIO_ORGS } from "@/lib/portfolio-config";
import { filingsToYearRows } from "@/lib/propublica-filing";
import {
  computeResilienceScore,
  estimateStaffFte,
  tierToRiskBand,
} from "@/lib/resilience-score";
import type { ScreenerRow } from "@/lib/types";

const PROPUBLICA_ORG = "https://projects.propublica.org/nonprofits/api/v2/organizations";
const SHOWCASE_EINS = PORTFOLIO_ORGS.map((o) => o.ein);

async function tryWorkerCache(): Promise<{
  screener: ScreenerRow[];
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
} | null> {
  const base = process.env.NONPROFIT_WORKER_URL?.trim();
  if (!base) return null;
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
    return { screener: data.screener, revenueByOrg: data.revenueByOrg ?? {} };
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
  cy_total_revenue_amt?: number | null;
  py_total_revenue_amt?: number | null;
  cy_total_expenses_amt?: number | null;
  net_assets_eoy_amt?: number | null;
  total_employee_cnt?: number | null;
  tax_yr?: number | null;
  organization_501c3_ind?: number | null;
};

function formatEin9(digits: string): string {
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
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
    const score = Math.min(
      100,
      Math.max(0, 38 + Math.min(22, growth / 3) + Math.min(28, reserveM * 1.5)),
    );

    screener.push({
      id,
      organizationName: (r.name ?? "Unknown organization").trim() || "Unknown organization",
      ein: einFmt,
      city: (r.city ?? "—").trim() || "—",
      state: (r.state ?? "—").trim() || "—",
      missionArea: r.organization_501c3_ind === 1 ? "501(c)(3)" : "Nonprofit (IRS 990)",
      revenue: rev,
      growthRate: Math.round(growth * 10) / 10,
      reserveMonths: Math.round(reserveM * 10) / 10,
      staffCount: staff,
      riskBand: reserveM >= 6 ? "Foundation" : reserveM >= 3 ? "Steady" : "Watch",
      screenScore: Math.round(score),
    });
    revenueByOrg[id] = {
      currentYearRevenue: rev,
      priorYearRevenue: prev,
    };
  }

  return { screener, revenueByOrg };
}

/** One page of TEOS rows from Worker (small payload; offset paginated). */
async function fetchIrs990Page(
  base: string,
  offset: number,
  limit: number,
  excludeEins: string[],
): Promise<{
  screener: ScreenerRow[];
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
  hasMore: boolean;
} | null> {
  if (limit <= 0) {
    return { screener: [], revenueByOrg: {}, hasMore: false };
  }
  const excludeParam = excludeEins.length ? `&exclude=${encodeURIComponent(excludeEins.join(","))}` : "";
  try {
    const res = await fetch(`${base}/api/irs990-browse?limit=${limit}&offset=${offset}${excludeParam}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
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

async function buildProPublicaPortfolio(): Promise<{
  screener: ScreenerRow[];
  revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
} | null> {
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

        const row: ScreenerRow = {
          id: cfg.id,
          organizationName: org?.name ?? "Unknown organization",
          ein: formatEin9(cfg.ein),
          city: org?.city?.trim() || "—",
          state: org?.state?.trim() || "—",
          missionArea: missionFromNtee(org?.ntee_code),
          revenue,
          growthRate: Math.round(growth * 10) / 10,
          reserveMonths: Math.round(reserveM * 10) / 10,
          staffCount: staff,
          riskBand,
          screenScore: Math.round(Math.max(0, Math.min(100, composite))),
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
 * - Page 1: showcase orgs (ProPublica/worker cache) + first slice of TEOS D1 rows.
 * - Page 2+: only TEOS rows (offset math aligns with page 1 length).
 *
 * Query: `page` (1-based), `pageSize` (default 20, max 100).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(4, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
  const base = process.env.NONPROFIT_WORKER_URL?.trim();
  const showcaseCount = PORTFOLIO_ORGS.length;

  if (page >= 2) {
    if (!base) {
      return NextResponse.json({
        screener: [],
        revenueByOrg: {},
        page,
        pageSize,
        hasMore: false,
        append: true,
        source: "none",
        scoring: "moobu-resilience-v1",
      });
    }
    const teosOffset = (page - 1) * pageSize - showcaseCount;
    if (teosOffset < 0) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }
    const teos = await fetchIrs990Page(base, teosOffset, pageSize, SHOWCASE_EINS);
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
    });
  }

  const cached = await tryWorkerCache();
  let curated: NonNullable<Awaited<ReturnType<typeof tryWorkerCache>>> | null = cached;
  let curatedSource: "worker-cache" | "propublica" = "propublica";
  if (cached?.screener.length) {
    curated = cached;
    curatedSource = "worker-cache";
  } else {
    curated = await buildProPublicaPortfolio();
  }
  if (!curated?.screener.length) {
    return NextResponse.json({ error: "No portfolio data" }, { status: 503 });
  }

  const teosSlots = Math.max(0, pageSize - curated.screener.length);
  let screener = [...curated.screener];
  let revenueByOrg = { ...curated.revenueByOrg };
  let hasMore = false;
  let source: string = curatedSource;

  if (base && teosSlots > 0) {
    const teos = await fetchIrs990Page(base, 0, teosSlots, SHOWCASE_EINS);
    if (teos?.screener.length) {
      screener = [...curated.screener, ...teos.screener];
      revenueByOrg = { ...curated.revenueByOrg, ...teos.revenueByOrg };
      hasMore = teos.hasMore;
      source = `${curatedSource}+irs990-xml`;
    }
  }

  return NextResponse.json({
    screener,
    revenueByOrg,
    page: 1,
    pageSize,
    hasMore,
    append: false,
    source,
    scoring: "moobu-resilience-v1",
  });
}
