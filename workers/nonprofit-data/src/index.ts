/**
 * nonprofit-data Cloudflare Worker
 *
 * Caches ProPublica 990 data in a D1 database so the dashboard never
 * calls ProPublica at request time. The POST /api/sync route rehydrates
 * the database from ProPublica on demand (protected by ADMIN_KEY).
 *
 * Routes:
 *   GET  /api/portfolio            → scored rows for all PORTFOLIO_EINS
 *   GET  /api/org/:ein             → org profile + all filings
 *   POST /api/sync                 → pull fresh data from ProPublica (admin)
 *   POST /api/sync/registry-batch  → sync next N EINs from irs_ein_years not yet in organizations (admin)
 *   GET  /api/stats                → row counts (organizations + IRS index if migrated)
 *   GET  /api/registry             → paginated rows from irs_filings_raw (full IRS index mirror)
 *   GET  /api/irs990-browse        → latest full-Form-990 row per EIN from irs990_xml_returns (TEOS ingest)
 *   GET  /health                   → liveness check
 */

import { scoring } from "./scoring";
import { normalizeFiling } from "./normalize";

export interface Env {
  DB: D1Database;
  ADMIN_KEY: string;
  PORTFOLIO_EINS: string; // comma-separated 9-digit EINs
}

// ─── CORS headers ─────────────────────────────────────────────────────────────
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/health") {
      return json({ ok: true, ts: Date.now() });
    }

    if (pathname === "/api/portfolio" && request.method === "GET") {
      return handlePortfolio(env);
    }

    const orgMatch = pathname.match(/^\/api\/org\/([0-9]{9})$/);
    if (orgMatch && request.method === "GET") {
      return handleOrg(env, orgMatch[1]);
    }

    if (pathname === "/api/sync" && request.method === "POST") {
      return handleSync(request, env);
    }

    if (pathname === "/api/sync/registry-batch" && request.method === "POST") {
      return handleRegistryBatch(request, env);
    }

    if (pathname === "/api/stats" && request.method === "GET") {
      return handleStats(env);
    }

    if (pathname === "/api/registry" && request.method === "GET") {
      return handleRegistryPage(request, env);
    }

    if (pathname === "/api/irs990-browse" && request.method === "GET") {
      return handleIrs990Browse(request, env);
    }

    return json({ error: "Not found" }, 404);
  },
};

// ─── GET /api/portfolio ───────────────────────────────────────────────────────
async function handlePortfolio(env: Env): Promise<Response> {
  const eins = parseEins(env.PORTFOLIO_EINS);

  const rows = await env.DB.prepare(
    `SELECT o.ein, o.name, o.city, o.state, o.ntee_label,
            s.composite_score, s.tier, s.risk_band,
            s.reserve_months, s.growth_rate, s.staff_estimate,
            s.current_revenue, s.prior_revenue, s.computed_at
     FROM organizations o
     LEFT JOIN scores s ON s.ein = o.ein
     WHERE o.ein IN (${eins.map(() => "?").join(",")})`,
  )
    .bind(...eins)
    .all();

  if (!rows.results.length) {
    return json(
      {
        error: "No data cached yet. POST /api/sync to seed the database.",
        eins,
      },
      503,
    );
  }

  // Build screener-compatible response shape
  const screener = rows.results.map((r) => ({
    ein: formatEin(r.ein as string),
    organizationName: r.name,
    city: r.city,
    state: r.state,
    missionArea: r.ntee_label,
    screenScore: Math.round(Number(r.composite_score ?? 0)),
    riskBand: r.risk_band ?? "At Risk",
    reserveMonths: Number(r.reserve_months ?? 0),
    growthRate: Number(r.growth_rate ?? 0),
    staffCount: Number(r.staff_estimate ?? 1),
    revenue: Number(r.current_revenue ?? 0),
  }));

  const revenueByOrg: Record<string, { currentYearRevenue: number; priorYearRevenue: number }> = {};
  for (const r of rows.results) {
    revenueByOrg[r.ein as string] = {
      currentYearRevenue: Number(r.current_revenue ?? 0),
      priorYearRevenue: Number(r.prior_revenue ?? 0),
    };
  }

  return json({ screener, revenueByOrg, source: "d1-cache", scoring: "moobu-resilience-v1" });
}

// ─── GET /api/org/:ein ────────────────────────────────────────────────────────
async function handleOrg(env: Env, ein: string): Promise<Response> {
  const org = await env.DB.prepare("SELECT * FROM organizations WHERE ein = ?").bind(ein).first();
  if (!org) return json({ error: `EIN ${ein} not found` }, 404);

  const filings = await env.DB.prepare(
    "SELECT * FROM filings WHERE ein = ? ORDER BY tax_year ASC",
  )
    .bind(ein)
    .all();

  const score = await env.DB.prepare("SELECT * FROM scores WHERE ein = ?").bind(ein).first();

  return json({ organization: org, filings: filings.results, score });
}

// ─── POST /api/sync ───────────────────────────────────────────────────────────
async function handleSync(request: Request, env: Env): Promise<Response> {
  const key = request.headers.get("X-Admin-Key") ?? "";
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: "Unauthorized — provide X-Admin-Key header" }, 401);
  }

  const eins = parseEins(env.PORTFOLIO_EINS);
  const results: Array<{ ein: string; status: string; error?: string }> = [];
  for (const ein of eins) {
    results.push(await syncOneEin(env.DB, ein));
  }

  return json({ synced: results, ts: Date.now() });
}

/** Pull next N EINs from `irs_ein_years` that are not yet in `organizations`, enrich from ProPublica. */
async function handleRegistryBatch(request: Request, env: Env): Promise<Response> {
  const key = request.headers.get("X-Admin-Key") ?? "";
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: "Unauthorized — provide X-Admin-Key header" }, 401);
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));

  let pending: { results?: Array<{ ein: string }> };
  try {
    pending = await env.DB.prepare(
      `SELECT y.ein AS ein FROM irs_ein_years y
       LEFT JOIN organizations o ON o.ein = y.ein
       WHERE o.ein IS NULL
       GROUP BY y.ein
       ORDER BY y.ein
       LIMIT ?`,
    )
      .bind(limit)
      .all();
  } catch (e) {
    return json(
      {
        error: "irs_ein_years missing — run schema-irs-registry.sql and import index CSVs (see IRS-INDEX.md).",
        details: (e as Error).message,
      },
      503,
    );
  }

  const eins = pending.results?.map((r) => r.ein) ?? [];
  const results: Array<{ ein: string; status: string; error?: string }> = [];
  for (const ein of eins) {
    results.push(await syncOneEin(env.DB, ein));
    await new Promise((r) => setTimeout(r, 120));
  }

  return json({
    synced: results,
    ts: Date.now(),
    note:
      "ProPublica does not include every IRS filer; some EINs return 404. Raw 990 XML remains in the IRS ZIPs if you need filings ProPublica lacks.",
  });
}

async function handleStats(env: Env): Promise<Response> {
  const orgs = await env.DB.prepare("SELECT COUNT(*) AS c FROM organizations").first<{ c: number }>();
  let irsFilingsRawRows: number | null = null;
  let irsEinYearRows: number | null = null;
  let distinctIrsEins: number | null = null;
  let irs990XmlReturns: number | null = null;
  let irs990XmlDistinctEins: number | null = null;
  try {
    irsFilingsRawRows =
      (await env.DB.prepare("SELECT COUNT(*) AS c FROM irs_filings_raw").first<{ c: number }>())?.c ?? null;
  } catch {
    /* table not created */
  }
  try {
    irsEinYearRows = (await env.DB.prepare("SELECT COUNT(*) AS c FROM irs_ein_years").first<{ c: number }>())?.c ?? null;
    distinctIrsEins =
      (await env.DB.prepare("SELECT COUNT(DISTINCT ein) AS c FROM irs_ein_years").first<{ c: number }>())?.c ?? null;
  } catch {
    /* irs_ein_years not created */
  }
  try {
    irs990XmlReturns = (await env.DB.prepare("SELECT COUNT(*) AS c FROM irs990_xml_returns").first<{ c: number }>())?.c ?? null;
    irs990XmlDistinctEins =
      (await env.DB.prepare("SELECT COUNT(DISTINCT ein) AS c FROM irs990_xml_returns").first<{ c: number }>())?.c ?? null;
  } catch {
    /* irs990_xml_* not migrated */
  }
  return json({
    organizations: orgs?.c ?? 0,
    irsFilingsRawRows,
    irsEinYearRows,
    distinctIrsEins,
    irs990XmlReturns,
    irs990XmlDistinctEins,
    note:
      "organizations+filings+scores = ProPublica cache; irs990_xml_* = TEOS Form 990 XML ingest; irs_filings_raw = IRS index CSV",
  });
}

/** Parse comma-separated 9-digit EINs for optional NOT IN clause. */
function parseExcludeEins(url: URL): string[] {
  const raw = (url.searchParams.get("exclude") ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter((s) => s.length === 9);
}

/** Latest filing per EIN from TEOS `irs990_xml_returns` (full Form 990 XML pipeline). */
async function handleIrs990Browse(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const take = Math.min(101, limit + 1);
  const exclude = parseExcludeEins(url);
  const excludeSql =
    exclude.length > 0 ? ` AND r.ein NOT IN (${exclude.map(() => "?").join(",")}) ` : "";

  try {
    const stmt = `SELECT r.return_pk, r.ein, r.org_legal_name AS name, r.filer_city AS city, r.filer_state AS state,
              r.cy_total_revenue_amt, r.py_total_revenue_amt, r.cy_total_expenses_amt, r.net_assets_eoy_amt,
              r.total_employee_cnt, r.tax_yr, r.organization_501c3_ind, r.website_txt
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
       WHERE 1=1 ${excludeSql}
       ORDER BY r.org_legal_name COLLATE NOCASE
       LIMIT ? OFFSET ?`;

    const rows = await env.DB.prepare(stmt)
      .bind(...exclude, take, offset)
      .all();

    const list = (rows.results ?? []) as Record<string, unknown>[];
    const hasMore = list.length > limit;
    const pageRows = hasMore ? list.slice(0, limit) : list;

    return json({
      count: pageRows.length,
      rows: pageRows,
      hasMore,
      nextOffset: offset + pageRows.length,
      source: "irs990_xml_returns",
    });
  } catch (e) {
    return json(
      {
        error: "irs990_xml_returns not available — run schema-irs990-xml.sql and TEOS ingest (see IRS-990-XML-INGEST.md).",
        details: (e as Error).message,
      },
      503,
    );
  }
}

/** Paginated browse of the full IRS TEOS index mirror (`irs_filings_raw`). */
async function handleRegistryPage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const after = (url.searchParams.get("after") ?? "").trim();

  let rows: { results?: Record<string, unknown>[] };
  try {
    if (!after) {
      rows = await env.DB.prepare(
        `SELECT object_id, return_id, filing_type, ein, tax_period, taxpayer_name, return_type, xml_batch_id, index_year
         FROM irs_filings_raw
         ORDER BY CAST(object_id AS INTEGER)
         LIMIT ?`,
      )
        .bind(limit)
        .all();
    } else {
      rows = await env.DB.prepare(
        `SELECT object_id, return_id, filing_type, ein, tax_period, taxpayer_name, return_type, xml_batch_id, index_year
         FROM irs_filings_raw
         WHERE CAST(object_id AS INTEGER) > CAST(? AS INTEGER)
         ORDER BY CAST(object_id AS INTEGER)
         LIMIT ?`,
      )
        .bind(after, limit)
        .all();
    }
  } catch (e) {
    return json(
      {
        error: "irs_filings_raw empty or not migrated — run schema-irs-filings-raw.sql + npm run irs:index (see IRS-INDEX.md).",
        details: (e as Error).message,
      },
      503,
    );
  }

  const list = rows.results ?? [];
  const last = list[list.length - 1] as { object_id?: string } | undefined;
  const nextAfter =
    list.length === limit && last?.object_id != null ? String(last.object_id) : null;

  return json({
    count: list.length,
    nextAfter,
    rows: list,
  });
}

async function syncOneEin(
  db: D1Database,
  ein: string,
): Promise<{ ein: string; status: string; error?: string }> {
  try {
    const payload = await fetchProPublica(ein);
    await upsertOrg(db, ein, payload);
    await upsertFilings(db, ein, payload.filings_with_data ?? []);
    await upsertScore(db, ein, payload.filings_with_data ?? []);
    return { ein, status: "ok" };
  } catch (e) {
    return { ein, status: "error", error: (e as Error).message };
  }
}

// ─── ProPublica fetch ─────────────────────────────────────────────────────────
const PROPUBLICA = "https://projects.propublica.org/nonprofits/api/v2/organizations";

type PPOrg = {
  organization?: {
    name?: string;
    city?: string;
    state?: string;
    ntee_code?: string;
  };
  filings_with_data?: Record<string, unknown>[];
};

async function fetchProPublica(ein: string): Promise<PPOrg> {
  const res = await fetch(`${PROPUBLICA}/${ein}.json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ProPublica ${ein}: HTTP ${res.status}`);
  return res.json() as Promise<PPOrg>;
}

// ─── Database helpers ─────────────────────────────────────────────────────────
async function upsertOrg(db: D1Database, ein: string, payload: PPOrg): Promise<void> {
  const org = payload.organization ?? {};
  const ntee = org.ntee_code?.trim() ?? "";
  await db
    .prepare(
      `INSERT INTO organizations (ein, name, city, state, ntee_code, ntee_label, last_synced)
       VALUES (?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(ein) DO UPDATE SET
         name=excluded.name, city=excluded.city, state=excluded.state,
         ntee_code=excluded.ntee_code, ntee_label=excluded.ntee_label,
         last_synced=excluded.last_synced`,
    )
    .bind(
      ein,
      org.name ?? "Unknown",
      org.city?.trim() ?? "",
      org.state?.trim() ?? "",
      ntee,
      nteeLabel(ntee),
    )
    .run();
}

async function upsertFilings(
  db: D1Database,
  ein: string,
  raw: Record<string, unknown>[],
): Promise<void> {
  const rows = raw.map((f) => normalizeFiling(f)).filter(Boolean);
  for (const row of rows) {
    if (!row) continue;
    await db
      .prepare(
        `INSERT INTO filings
           (ein, tax_year, total_revenue, total_expenses, rev_less_expenses,
            contributions_grants, program_service_rev, investment_income, other_revenue,
            net_assets_eoy, program_expenses, total_func_expenses)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(ein, tax_year) DO UPDATE SET
           total_revenue=excluded.total_revenue, total_expenses=excluded.total_expenses,
           rev_less_expenses=excluded.rev_less_expenses,
           contributions_grants=excluded.contributions_grants,
           program_service_rev=excluded.program_service_rev,
           investment_income=excluded.investment_income,
           other_revenue=excluded.other_revenue,
           net_assets_eoy=excluded.net_assets_eoy,
           program_expenses=excluded.program_expenses,
           total_func_expenses=excluded.total_func_expenses`,
      )
      .bind(
        ein, row.tax_year,
        row.total_revenue, row.total_expenses, row.rev_less_expenses,
        row.contributions_grants, row.program_service_rev,
        row.investment_income, row.other_revenue,
        row.net_assets_eoy, row.program_expenses, row.total_func_expenses,
      )
      .run();
  }
}

async function upsertScore(
  db: D1Database,
  ein: string,
  raw: Record<string, unknown>[],
): Promise<void> {
  const years = raw.map((f) => normalizeFiling(f)).filter(Boolean);
  years.sort((a, b) => a!.tax_year - b!.tax_year);

  const score = scoring.compute(years as NonNullable<typeof years[0]>[]);
  const latest = years[years.length - 1];
  const prior = years.length >= 2 ? years[years.length - 2] : null;

  const reserveM =
    latest && latest.total_expenses > 0
      ? (latest.net_assets_eoy / latest.total_expenses) * 12
      : 0;
  const growth =
    prior && Math.abs(prior.total_revenue) > 1e-9
      ? ((latest!.total_revenue - prior.total_revenue) / Math.abs(prior.total_revenue)) * 100
      : 0;
  const staff = latest ? estimateStaffFte(latest.total_expenses) : 1;

  await db
    .prepare(
      `INSERT INTO scores
         (ein, composite_score, tier, risk_band, reserve_months, growth_rate,
          staff_estimate, current_revenue, prior_revenue, computed_at)
       VALUES (?,?,?,?,?,?,?,?,?,unixepoch())
       ON CONFLICT(ein) DO UPDATE SET
         composite_score=excluded.composite_score, tier=excluded.tier,
         risk_band=excluded.risk_band, reserve_months=excluded.reserve_months,
         growth_rate=excluded.growth_rate, staff_estimate=excluded.staff_estimate,
         current_revenue=excluded.current_revenue, prior_revenue=excluded.prior_revenue,
         computed_at=excluded.computed_at`,
    )
    .bind(
      ein,
      Math.round(Math.max(0, Math.min(100, score?.composite_score ?? 0))),
      score?.tier ?? "Urgent",
      tierToRiskBand(score?.tier ?? "Urgent"),
      Math.round(reserveM * 10) / 10,
      Math.round(growth * 10) / 10,
      staff,
      latest?.total_revenue ?? 0,
      prior?.total_revenue ?? 0,
    )
    .run();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function parseEins(raw: string): string[] {
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

function formatEin(digits: string): string {
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function estimateStaffFte(totalExpenses: number): number {
  if (totalExpenses <= 0) return 1;
  const perFte = 65_000;
  return Math.max(1, Math.round((totalExpenses * 0.6) / perFte));
}

function tierToRiskBand(tier: string): string {
  const map: Record<string, string> = {
    Strong: "Foundation",
    Stable: "Steady",
    Vulnerable: "Watch",
    Urgent: "At Risk",
  };
  return map[tier] ?? "At Risk";
}

const NTEE_MAP: Record<string, string> = {
  A: "Arts & culture", B: "Education", C: "Environment", D: "Health care",
  E: "Health", F: "Mental health", G: "Disease / health", H: "Medical research",
  I: "Crime & legal", J: "Employment", K: "Food & nutrition", L: "Housing",
  M: "Public safety", N: "Recreation", O: "Youth", P: "Human services",
  Q: "International", R: "Civil rights", S: "Community improvement",
  T: "Philanthropy", U: "Science & research", V: "Social science",
  W: "Public benefit", X: "Religion", Y: "Mutual benefit", Z: "Unknown",
};

function nteeLabel(code: string): string {
  const c = code?.trim().toUpperCase()[0] ?? "";
  return NTEE_MAP[c] ?? "Community benefit";
}
