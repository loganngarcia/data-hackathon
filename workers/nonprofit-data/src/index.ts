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
 *   GET  /api/irs990-browse        → latest full-Form-990 row per EIN from irs990_xml_returns (TEOS ingest). Query: `revenueBands`, `assetsBands`, `reserveBands`, `employeeBands`, `volunteerBands`, `boardBands`, `states` (comma-separated lists; OR within each) plus legacy singular `revenueBand`, `assetsBand`, `reserveBand`, `employeeBand`, `volunteerBand`, `boardBand`, `state`. When `LOGO_DEV_PUBLISHABLE_KEY` is set, each row includes `logo_image_url` (D1 domains + Logo.dev CDN).
 *   GET  /api/irs990-row           → single TEOS row by `orgId` (`irs990-<return_pk>` or `irs990-ein-<9 digits>`), same row shape as browse (deep links / chat).
 *                                   Query: `random=1` or `order=random` → ORDER BY RANDOM() (offset ignored; use `exclude` for paging).
 *   GET  /api/irs990-bucket-counts → aggregate bucket totals (score formula matches Next mapIrs990Rows)
 *   GET  /api/irs990-website       → latest TEOS `website_txt` for an EIN
 *   GET  /api/irs990-mission       → latest TEOS `mission_desc` / `activity_mission_desc` for an EIN
 *   GET  /api/irs990-people        → Part VII Section A names/titles (+ principal/business officer fallback) for latest filing
 *   GET|POST /api/irs990-search    → filterable TEOS latest-filing-per-EIN search (many query params / JSON body fields)
 *   POST /mcp                       → JSON-RPC MCP-style tools (search_nonprofits) over D1
 *   POST /api/logo-cache-warm      → fill `org_logo_cache` from TEOS websites + Logo.dev Brand Search (admin)
 *   POST /api/d1-normalize         → batch-rewrite existing D1 text (org name, city, state) + refresh logo cache (admin; no crons — call until done)
 *   GET  /health                   → liveness check
 */

import {
  formatCityDisplay,
  formatStateAbbrevDisplay,
  toOrganizationTitleCase,
} from "./org-name-format";
import { scoring } from "./scoring";
import { normalizeFiling } from "./normalize";
import { parseSearchFilters, runIrs990Search } from "./irs990-search";
import { handleMcpPost, mcpOptions } from "./mcp-server";
import { resolveLogoDevImageUrl } from "./logo-dev-url";

export interface Env {
  DB: D1Database;
  ADMIN_KEY: string;
  PORTFOLIO_EINS: string; // comma-separated 9-digit EINs
  /** Optional — `sk_…` for https://api.logo.dev/search (warm route only; never expose to clients). */
  LOGO_DEV_SECRET_KEY?: string;
  /**
   * Optional — `pk_…` for https://img.logo.dev/… — Worker adds `logo_image_url` on `/api/irs990-browse` rows.
   * Set with `wrangler secret put LOGO_DEV_PUBLISHABLE_KEY` so the Next app does not bundle a public key.
   */
  LOGO_DEV_PUBLISHABLE_KEY?: string;
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

    if (pathname === "/api/irs990-row" && request.method === "GET") {
      return handleIrs990RowByOrgId(request, env);
    }

    if (pathname === "/api/irs990-bucket-counts" && request.method === "GET") {
      return handleIrs990BucketCounts(request, env);
    }

    if (pathname === "/api/irs990-website" && request.method === "GET") {
      return handleIrs990Website(request, env);
    }

    if (pathname === "/api/irs990-mission" && request.method === "GET") {
      return handleIrs990Mission(request, env);
    }

    if (pathname === "/api/irs990-people" && request.method === "GET") {
      return handleIrs990People(request, env);
    }

    if (pathname === "/api/irs990-search" && (request.method === "GET" || request.method === "POST")) {
      return handleIrs990SearchApi(request, env);
    }

    if (pathname === "/mcp") {
      if (request.method === "OPTIONS") return mcpOptions();
      if (request.method === "POST") return handleMcpPost(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (pathname === "/api/logo-cache-warm" && request.method === "POST") {
      return handleLogoCacheWarm(request, env);
    }

    if (pathname === "/api/d1-normalize" && request.method === "POST") {
      return handleD1Normalize(request, env);
    }

    return json({ error: "Not found" }, 404);
  },
};

// ─── GET|POST /api/irs990-search ──────────────────────────────────────────────
async function handleIrs990SearchApi(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const filters = parseSearchFilters(url.searchParams);
      const result = await runIrs990Search(env, filters);
      return json({ ok: true, ...result });
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const filters = parseSearchFilters(body);
    const result = await runIrs990Search(env, filters);
    return json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
}

// ─── GET /api/portfolio ───────────────────────────────────────────────────────
async function handlePortfolio(env: Env): Promise<Response> {
  const eins = parseEins(env.PORTFOLIO_EINS);

  const rows = await env.DB.prepare(
    `SELECT o.ein, o.name, o.city, o.state, o.ntee_label,
            s.composite_score, s.tier, s.risk_band,
            s.reserve_months, s.growth_rate, s.staff_estimate,
            s.current_revenue, s.prior_revenue, s.computed_at,
            teos.net_assets_eoy_amt AS teos_net_assets_eoy_amt
     FROM organizations o
     LEFT JOIN scores s ON s.ein = o.ein
     LEFT JOIN (
       SELECT r.ein, r.net_assets_eoy_amt
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
     ) teos ON teos.ein = o.ein
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
  const screener = rows.results.map((r) => {
    const na = Number(r.teos_net_assets_eoy_amt ?? 0);
    return {
      ein: formatEin(r.ein as string),
      organizationName: toOrganizationTitleCase(String(r.name ?? "Unknown organization").trim()) || "Unknown organization",
      city: formatCityDisplay(String(r.city ?? "\u2014")),
      state: formatStateAbbrevDisplay(String(r.state ?? "\u2014")),
      missionArea: r.ntee_label,
      screenScore: Math.round(Number(r.composite_score ?? 0)),
      riskBand: r.risk_band ?? "At Risk",
      reserveMonths: Number(r.reserve_months ?? 0),
      growthRate: Number(r.growth_rate ?? 0),
      staffCount: Number(r.staff_estimate ?? 1),
      revenue: Number(r.current_revenue ?? 0),
      netAssetsEoy: Number.isFinite(na) ? na : 0,
    };
  });

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

/**
 * Same latest-per-EIN slice as `/api/irs990-browse`.
 * Aggregate score proxy for filter labels (per-row scores use Moobu `computeResilienceScore` in Next):
 * legacy blend of growth + reserve months. Buckets: at-risk = score < 50, thriving = score > 90.
 */
async function handleIrs990BucketCounts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const exclude = parseExcludeEins(url);
  const excludeSql =
    exclude.length > 0 ? ` AND r.ein NOT IN (${exclude.map(() => "?").join(",")}) ` : "";

  const stmt = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN sc < 50 THEN 1 ELSE 0 END) AS at_risk,
      SUM(CASE WHEN sc > 90 THEN 1 ELSE 0 END) AS thriving
    FROM (
      SELECT ROUND(
        MIN(100.0, MAX(0.0,
          38.0
          + MIN(22.0, (
              CASE WHEN ABS(COALESCE(r.py_total_revenue_amt, 0)) > 0.000001
                THEN ((r.cy_total_revenue_amt - r.py_total_revenue_amt) * 1.0 / ABS(r.py_total_revenue_amt)) * 100.0
                ELSE 0.0 END
            ) / 3.0)
          + MIN(28.0,
              (CASE WHEN COALESCE(r.cy_total_expenses_amt, 0) > 0
                THEN (r.net_assets_eoy_amt * 1.0 / r.cy_total_expenses_amt) * 12.0
                ELSE 0.0 END) * 1.5)
        ))
      ) AS sc
      FROM irs990_xml_returns r
      INNER JOIN (
        SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
        FROM irs990_xml_returns
        GROUP BY ein
      ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
      WHERE 1=1 ${excludeSql}
    ) t
  `;

  try {
    const row = await env.DB.prepare(stmt)
      .bind(...exclude)
      .first<{ total: number | null; at_risk: number | null; thriving: number | null }>();

    const total = Number(row?.total ?? 0);
    const atRisk = Number(row?.at_risk ?? 0);
    const thriving = Number(row?.thriving ?? 0);

    return json({
      total,
      atRisk,
      thriving,
      source: "irs990_xml_returns",
    });
  } catch (e) {
    return json(
      {
        error:
          "irs990_xml_returns not available — run schema-irs990-xml.sql and TEOS ingest (see IRS-990-XML-INGEST.md).",
        details: (e as Error).message,
      },
      503,
    );
  }
}

/** Latest `website_txt` for one EIN (TEOS ingest). */
async function handleIrs990Website(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ein = (url.searchParams.get("ein") ?? "").replace(/\D/g, "");
  if (ein.length !== 9) {
    return json({ error: "ein must be 9 digits" }, 400);
  }

  try {
    const row = await env.DB.prepare(
      `SELECT r.website_txt
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
       WHERE r.ein = ?
       LIMIT 1`,
    )
      .bind(ein)
      .first<{ website_txt: string | null }>();

    const raw = row?.website_txt?.trim();
    if (!raw) {
      return json({ website: null as string | null });
    }
    let out = raw;
    if (!/^https?:\/\//i.test(out)) {
      out = `https://${out.replace(/^\/+/, "")}`;
    }
    try {
      const u = new URL(out);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return json({ website: null as string | null });
      }
      return json({ website: u.toString() });
    } catch {
      return json({ website: null as string | null });
    }
  } catch (e) {
    return json(
      {
        website: null as string | null,
        error: (e as Error).message,
      },
      503,
    );
  }
}

/** Latest TEOS mission / activity text (raw; Next.js formats for display). */
async function handleIrs990Mission(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ein = (url.searchParams.get("ein") ?? "").replace(/\D/g, "");
  if (ein.length !== 9) {
    return json({ error: "ein must be 9 digits" }, 400);
  }

  try {
    const row = await env.DB.prepare(
      `SELECT r.mission_desc, r.activity_mission_desc
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
       WHERE r.ein = ?
       LIMIT 1`,
    )
      .bind(ein)
      .first<{ mission_desc: string | null; activity_mission_desc: string | null }>();

    const a = row?.activity_mission_desc?.trim() ?? "";
    const m = row?.mission_desc?.trim() ?? "";
    let mission_raw: string | null = null;
    if (a && m) {
      mission_raw = a.length >= m.length ? a : m;
    } else {
      mission_raw = a || m || null;
    }

    return json({ mission_raw });
  } catch (e) {
    return json({ mission_raw: null as string | null, error: (e as Error).message });
  }
}

type Irs990PersonRow = { name: string; title: string | null };

/** Part VII Section A (latest TEOS filing per EIN); fallback principal / business officer from return header. */
async function handleIrs990People(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ein = (url.searchParams.get("ein") ?? "").replace(/\D/g, "");
  if (ein.length !== 9) {
    return json({ error: "ein must be 9 digits" }, 400);
  }
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "28", 10) || 28));

  try {
    const latest = await env.DB.prepare(
      `SELECT r.return_pk, r.principal_officer_nm, r.business_officer_person_nm, r.business_officer_title_txt
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
       WHERE r.ein = ?
       LIMIT 1`,
    )
      .bind(ein)
      .first<{
        return_pk: string;
        principal_officer_nm: string | null;
        business_officer_person_nm: string | null;
        business_officer_title_txt: string | null;
      }>();

    if (!latest?.return_pk) {
      return json({ people: [] as Irs990PersonRow[] });
    }

    const partVii = await env.DB.prepare(
      `SELECT person_nm, title_txt FROM irs990_xml_people
       WHERE return_pk = ? AND former_ind = 0
       ORDER BY row_ix ASC
       LIMIT ?`,
    )
      .bind(latest.return_pk, limit)
      .all<{ person_nm: string | null; title_txt: string | null }>();

    const people: Irs990PersonRow[] = [];
    const seen = new Set<string>();

    for (const r of partVii.results ?? []) {
      const name = (r.person_nm ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const titleRaw = (r.title_txt ?? "").trim();
      people.push({ name, title: titleRaw.length > 0 ? titleRaw : null });
    }

    if (people.length === 0) {
      const po = (latest.principal_officer_nm ?? "").trim();
      const bo = (latest.business_officer_person_nm ?? "").trim();
      const boTitle = (latest.business_officer_title_txt ?? "").trim();

      if (po) {
        people.push({ name: po, title: null });
        seen.add(po.toLowerCase());
      }
      if (bo && !seen.has(bo.toLowerCase())) {
        people.push({
          name: bo,
          title: boTitle.length > 0 ? boTitle : null,
        });
      }
    }

    return json({ people });
  } catch (e) {
    return json({ people: [] as Irs990PersonRow[], error: (e as Error).message });
  }
}

function normalizeWebsiteToDomain(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  let candidate = t;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, "")}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    return h.length >= 3 ? h : null;
  } catch {
    return null;
  }
}

async function logoDevSearchDomain(secret: string, q: string): Promise<string | null> {
  const url = `https://api.logo.dev/search?q=${encodeURIComponent(q)}&strategy=match`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] as { domain?: string };
  const d = typeof first?.domain === "string" ? first.domain.trim() : "";
  if (!d || !/^[\w.-]+$/.test(d)) return null;
  return d.toLowerCase();
}

/**
 * Populate `org_logo_cache`: TEOS `website_txt` → domain first; else Brand Search on legal name.
 * Requires `wrangler secret put LOGO_DEV_SECRET_KEY` for search rows without a website.
 */
async function handleLogoCacheWarm(request: Request, env: Env): Promise<Response> {
  const key = request.headers.get("X-Admin-Key") ?? "";
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: "Unauthorized — provide X-Admin-Key header" }, 401);
  }

  const secret = env.LOGO_DEV_SECRET_KEY?.trim();

  const url = new URL(request.url);
  const limit = Math.min(2000, Math.max(1, parseInt(url.searchParams.get("limit") ?? "150", 10) || 150));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  let rows: { results?: Array<Record<string, unknown>> };
  try {
    rows = await env.DB.prepare(
      `SELECT r.ein, r.org_legal_name AS name, r.website_txt
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
       ORDER BY r.ein
       LIMIT ? OFFSET ?`,
    )
      .bind(limit, offset)
      .all();
  } catch (e) {
    return json(
      {
        error: "org_logo_cache or irs990_xml_returns unavailable — run schema SQL + ingest.",
        details: (e as Error).message,
      },
      503,
    );
  }

  const results: Array<{ ein: string; status: string; domain?: string }> = [];

  for (const raw of rows.results ?? []) {
    const ein = String(raw.ein ?? "").replace(/\D/g, "").padStart(9, "0").slice(0, 9);
    if (ein.length !== 9) {
      results.push({ ein, status: "bad_ein" });
      continue;
    }

    const cached = await env.DB.prepare("SELECT ein FROM org_logo_cache WHERE ein = ?").bind(ein).first();
    if (cached) {
      results.push({ ein, status: "skip_cached" });
      continue;
    }

    const name = String(raw.name ?? "").trim();
    const fromWeb = normalizeWebsiteToDomain(raw.website_txt as string | null | undefined);
    if (fromWeb) {
      await env.DB.prepare(
        `INSERT INTO org_logo_cache (ein, logo_domain, source, updated_at) VALUES (?, ?, 'website', unixepoch())`,
      )
        .bind(ein, fromWeb)
        .run();
      results.push({ ein, status: "website", domain: fromWeb });
      continue;
    }

    if (!name) {
      results.push({ ein, status: "no_name" });
      continue;
    }

    if (!secret) {
      results.push({ ein, status: "needs_logo_dev_secret" });
      continue;
    }

    const domain = await logoDevSearchDomain(secret, name);
    if (!domain) {
      results.push({ ein, status: "search_miss" });
      continue;
    }

    await env.DB.prepare(
      `INSERT INTO org_logo_cache (ein, logo_domain, source, updated_at) VALUES (?, ?, 'brand_search', unixepoch())`,
    )
      .bind(ein, domain)
      .run();
    results.push({ ein, status: "brand_search", domain });
  }

  return json({
    offset,
    limit,
    processed: results.length,
    results,
    ts: Date.now(),
  });
}

/**
 * One-shot / batched backfill: normalize `organizations` + every `irs990_xml_returns` row (name, city, state),
 * and UPSERT `org_logo_cache` from TEOS websites + Logo.dev (latest filing per EIN).
 * No cron — call repeatedly with next `irsOffset` / `logoOffset` until both `done` are true.
 */
async function handleD1Normalize(request: Request, env: Env): Promise<Response> {
  const key = request.headers.get("X-Admin-Key") ?? "";
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: "Unauthorized — provide X-Admin-Key header" }, 401);
  }

  const url = new URL(request.url);
  const batch = Math.min(500, Math.max(1, parseInt(url.searchParams.get("batch") ?? "150", 10) || 150));
  const irsOffset = Math.max(0, parseInt(url.searchParams.get("irsOffset") ?? "0", 10) || 0);
  const logoOffset = Math.max(0, parseInt(url.searchParams.get("logoOffset") ?? "0", 10) || 0);
  const doOrgs = url.searchParams.get("organizations") !== "false";
  const doIrs = url.searchParams.get("irs990") !== "false";
  const doLogos = url.searchParams.get("logos") !== "false";

  const secret = env.LOGO_DEV_SECRET_KEY?.trim();
  const out: Record<string, unknown> = {
    note: "This project has no scheduled crons; re-POST with nextOffset values until irs990.done and logos.done are true.",
  };

  try {
    if (doOrgs) {
      const orgRows = await env.DB.prepare("SELECT ein, name, city, state FROM organizations").all();
      let n = 0;
      for (const row of orgRows.results ?? []) {
        const ein = row.ein as string;
        const name = toOrganizationTitleCase(String(row.name ?? "").trim()) || "Unknown organization";
        const city = formatCityDisplay(String(row.city ?? "").trim() || "\u2014");
        const state = formatStateAbbrevDisplay(String(row.state ?? "").trim() || "\u2014");
        await env.DB.prepare("UPDATE organizations SET name = ?, city = ?, state = ? WHERE ein = ?")
          .bind(name, city, state, ein)
          .run();
        n++;
      }
      out.organizations = { updated: n };
    } else {
      out.organizations = { skipped: true };
    }

    if (doIrs) {
      const sel = await env.DB.prepare(
        `SELECT return_pk, org_legal_name, filer_city, filer_state FROM irs990_xml_returns ORDER BY return_pk LIMIT ? OFFSET ?`,
      )
        .bind(batch, irsOffset)
        .all();
      const rows = sel.results ?? [];
      let n = 0;
      for (const row of rows) {
        const pk = String(row.return_pk ?? "");
        const nm = toOrganizationTitleCase(String(row.org_legal_name ?? "").trim() || "Unknown organization");
        const ci = formatCityDisplay(String(row.filer_city ?? "").trim() || "\u2014");
        const st = formatStateAbbrevDisplay(String(row.filer_state ?? "").trim() || "\u2014");
        await env.DB.prepare(
          `UPDATE irs990_xml_returns SET org_legal_name = ?, filer_city = ?, filer_state = ? WHERE return_pk = ?`,
        )
          .bind(nm, ci, st, pk)
          .run();
        n++;
      }
      const got = rows.length;
      out.irs990 = {
        updated: n,
        batch,
        offsetStart: irsOffset,
        nextOffset: got < batch ? null : irsOffset + got,
        done: got < batch,
      };
    } else {
      out.irs990 = { skipped: true };
    }

    if (doLogos) {
      const sel = await env.DB.prepare(
        `SELECT r.ein, r.org_legal_name, r.website_txt
         FROM irs990_xml_returns r
         INNER JOIN (
           SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
           FROM irs990_xml_returns
           GROUP BY ein
         ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
         ORDER BY r.ein
         LIMIT ? OFFSET ?`,
      )
        .bind(batch, logoOffset)
        .all();
      const rows = sel.results ?? [];
      const results: Array<{ ein: string; status: string; domain?: string }> = [];
      for (const raw of rows) {
        const ein = String(raw.ein ?? "").replace(/\D/g, "").padStart(9, "0").slice(0, 9);
        if (ein.length !== 9) {
          results.push({ ein, status: "bad_ein" });
          continue;
        }
        const legal = String(raw.org_legal_name ?? "").trim();
        const displayName = toOrganizationTitleCase(legal) || legal;
        const fromWeb = normalizeWebsiteToDomain(raw.website_txt as string | null | undefined);
        if (fromWeb) {
          await env.DB.prepare(
            `INSERT INTO org_logo_cache (ein, logo_domain, source, updated_at) VALUES (?, ?, 'website', unixepoch())
             ON CONFLICT(ein) DO UPDATE SET logo_domain = excluded.logo_domain, source = excluded.source, updated_at = unixepoch()`,
          )
            .bind(ein, fromWeb)
            .run();
          results.push({ ein, status: "website", domain: fromWeb });
          continue;
        }
        const searchQ = displayName || legal;
        if (!searchQ) {
          results.push({ ein, status: "no_name" });
          continue;
        }
        if (!secret) {
          results.push({ ein, status: "needs_logo_dev_secret" });
          continue;
        }
        const domain = await logoDevSearchDomain(secret, searchQ);
        if (!domain) {
          results.push({ ein, status: "search_miss" });
          continue;
        }
        await env.DB.prepare(
          `INSERT INTO org_logo_cache (ein, logo_domain, source, updated_at) VALUES (?, ?, 'brand_search', unixepoch())
           ON CONFLICT(ein) DO UPDATE SET logo_domain = excluded.logo_domain, source = excluded.source, updated_at = unixepoch()`,
        )
          .bind(ein, domain)
          .run();
        results.push({ ein, status: "brand_search", domain });
      }
      const got = rows.length;
      out.logos = {
        processed: results.length,
        results,
        batch,
        offsetStart: logoOffset,
        nextOffset: got < batch ? null : logoOffset + got,
        done: got < batch,
      };
    } else {
      out.logos = { skipped: true };
    }

    return json({ ...out, ts: Date.now() });
  } catch (e) {
    return json({ error: (e as Error).message, details: String(e) }, 500);
  }
}

/** Latest filing per EIN from TEOS `irs990_xml_returns` (full Form 990 XML pipeline). */
async function handleIrs990Browse(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const take = Math.min(101, limit + 1);
  const random =
    url.searchParams.get("random") === "1" ||
    url.searchParams.get("order") === "random";
  const exclude = parseExcludeEins(url);
  const excludeSql =
    exclude.length > 0 ? ` AND r.ein NOT IN (${exclude.map(() => "?").join(",")}) ` : "";

  /** USD bounds on latest-year `cy_total_revenue_amt` — `revenueBands` (comma) OR legacy `revenueBand` (aligned with app `lib/revenue-band.ts`). */
  const revenueBandsRaw = (url.searchParams.get("revenueBands") ?? "").trim();
  const revenueBandLegacy = (url.searchParams.get("revenueBand") ?? "").trim();
  const revenueParts = [
    ...new Set(
      [
        ...(revenueBandsRaw ? revenueBandsRaw.split(",") : []),
        ...(revenueBandLegacy && revenueBandLegacy !== "all" ? [revenueBandLegacy] : []),
      ]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  let revenueSql = "";
  const revenueBinds: number[] = [];
  if (revenueParts.length > 0) {
    const revCol = `COALESCE(r.cy_total_revenue_amt, 0)`;
    const clauses: string[] = [];
    for (const p of revenueParts) {
      if (p === "lt10k") {
        clauses.push(`(${revCol} >= ? AND ${revCol} < ?)`);
        revenueBinds.push(0, 10_000);
      } else if (p === "10k_100k") {
        clauses.push(`(${revCol} >= ? AND ${revCol} < ?)`);
        revenueBinds.push(10_000, 100_000);
      } else if (p === "100k_500k") {
        clauses.push(`(${revCol} >= ? AND ${revCol} < ?)`);
        revenueBinds.push(100_000, 500_000);
      } else if (p === "500k_1m") {
        clauses.push(`(${revCol} >= ? AND ${revCol} < ?)`);
        revenueBinds.push(500_000, 1_000_000);
      } else if (p === "1m_5m") {
        clauses.push(`(${revCol} >= ? AND ${revCol} < ?)`);
        revenueBinds.push(1_000_000, 5_000_000);
      } else if (p === "gt5m") {
        clauses.push(`(${revCol} >= ?)`);
        revenueBinds.push(5_000_000);
      }
    }
    if (clauses.length > 0) {
      revenueSql = ` AND (${clauses.join(" OR ")}) `;
    }
  }

  /** Net assets EOY — `assetsBands` (comma) OR legacy `assetsBand` (aligned with app `lib/assets-band.ts`). */
  const assetsBandsRaw = (url.searchParams.get("assetsBands") ?? "").trim();
  const assetsBandLegacy = (url.searchParams.get("assetsBand") ?? "").trim();
  const assetsParts = [
    ...new Set(
      [
        ...(assetsBandsRaw ? assetsBandsRaw.split(",") : []),
        ...(assetsBandLegacy && assetsBandLegacy !== "all" ? [assetsBandLegacy] : []),
      ]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  let assetsSql = "";
  const assetsBinds: number[] = [];
  if (assetsParts.length > 0) {
    const naCol = `COALESCE(r.net_assets_eoy_amt, 0)`;
    const clauses: string[] = [];
    for (const p of assetsParts) {
      if (p === "0_10k") {
        clauses.push(`(${naCol} >= ? AND ${naCol} < ?)`);
        assetsBinds.push(0, 10_000);
      } else if (p === "10k_50k") {
        clauses.push(`(${naCol} >= ? AND ${naCol} < ?)`);
        assetsBinds.push(10_000, 50_000);
      } else if (p === "50k_100k") {
        clauses.push(`(${naCol} >= ? AND ${naCol} < ?)`);
        assetsBinds.push(50_000, 100_000);
      } else if (p === "100k_500k") {
        clauses.push(`(${naCol} >= ? AND ${naCol} < ?)`);
        assetsBinds.push(100_000, 500_000);
      } else if (p === "500k_1m") {
        clauses.push(`(${naCol} >= ? AND ${naCol} < ?)`);
        assetsBinds.push(500_000, 1_000_000);
      } else if (p === "1m_plus") {
        clauses.push(`(${naCol} >= ?)`);
        assetsBinds.push(1_000_000);
      }
    }
    if (clauses.length > 0) {
      assetsSql = ` AND (${clauses.join(" OR ")}) `;
    }
  }

  /** Reserve coverage (months) — `reserveBands` (comma) OR legacy `reserveBand`. */
  const reserveMonthsExpr = `(CASE WHEN COALESCE(r.cy_total_expenses_amt, 0) > 0 THEN (CAST(COALESCE(r.net_assets_eoy_amt, 0) AS REAL) / r.cy_total_expenses_amt) * 12 ELSE 0 END)`;
  const reserveBandsRaw = (url.searchParams.get("reserveBands") ?? "").trim();
  const reserveBandLegacy = (url.searchParams.get("reserveBand") ?? "").trim().toLowerCase();
  const reserveParts = [
    ...new Set(
      [
        ...(reserveBandsRaw ? reserveBandsRaw.split(",").map((s) => s.trim().toLowerCase()) : []),
        ...(reserveBandLegacy && reserveBandLegacy !== "all" ? [reserveBandLegacy] : []),
      ].filter(Boolean),
    ),
  ];
  let reserveSql = "";
  const reserveBinds: number[] = [];
  if (reserveParts.length > 0) {
    const clauses: string[] = [];
    for (const p of reserveParts) {
      if (p === "m0_3") {
        clauses.push(`(${reserveMonthsExpr} >= ? AND ${reserveMonthsExpr} < ?)`);
        reserveBinds.push(0, 3);
      } else if (p === "m3_6") {
        clauses.push(`(${reserveMonthsExpr} >= ? AND ${reserveMonthsExpr} < ?)`);
        reserveBinds.push(3, 6);
      } else if (p === "m6_12") {
        clauses.push(`(${reserveMonthsExpr} >= ? AND ${reserveMonthsExpr} < ?)`);
        reserveBinds.push(6, 12);
      } else if (p === "m12_24") {
        clauses.push(`(${reserveMonthsExpr} >= ? AND ${reserveMonthsExpr} < ?)`);
        reserveBinds.push(12, 24);
      } else if (p === "m24p") {
        clauses.push(`(${reserveMonthsExpr} >= ?)`);
        reserveBinds.push(24);
      }
    }
    if (clauses.length > 0) {
      reserveSql = ` AND (${clauses.join(" OR ")}) `;
    }
  }

  /** `employeeBands` / `volunteerBands` (comma) OR legacy single param — OR combined. */
  const countBandSqlMulti = (
    pluralName: string,
    legacyName: string,
    column: "total_employee_cnt" | "total_volunteers_cnt",
  ): { sql: string; binds: number[] } => {
    const rawPlural = (url.searchParams.get(pluralName) ?? "").trim();
    const rawLegacy = (url.searchParams.get(legacyName) ?? "").trim();
    const parts = [
      ...new Set(
        [
          ...(rawPlural ? rawPlural.split(",") : []),
          ...(rawLegacy && rawLegacy !== "all" ? [rawLegacy] : []),
        ]
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (parts.length === 0) return { sql: "", binds: [] };
    const n = `COALESCE(r.${column}, 0)`;
    const clauses: string[] = [];
    const binds: number[] = [];
    for (const raw of parts) {
      switch (raw) {
        case "0_1":
          clauses.push(`(${n} >= ? AND ${n} <= ?)`);
          binds.push(0, 1);
          break;
        case "1_10":
          clauses.push(`(${n} >= ? AND ${n} <= ?)`);
          binds.push(1, 10);
          break;
        case "10_50":
          clauses.push(`(${n} >= ? AND ${n} <= ?)`);
          binds.push(10, 50);
          break;
        case "50_100":
          clauses.push(`(${n} >= ? AND ${n} <= ?)`);
          binds.push(50, 100);
          break;
        case "100p":
          clauses.push(`(${n} >= ?)`);
          binds.push(100);
          break;
        default:
          break;
      }
    }
    if (clauses.length === 0) return { sql: "", binds: [] };
    return { sql: ` AND (${clauses.join(" OR ")}) `, binds };
  };

  const empF = countBandSqlMulti("employeeBands", "employeeBand", "total_employee_cnt");
  const volF = countBandSqlMulti("volunteerBands", "volunteerBand", "total_volunteers_cnt");

  /** Optional `boardBands` (comma-separated) or legacy `boardBand`: `0_3`, `4`, … `8p` — OR combined (aligned with app `lib/board-band.ts`). */
  const boardBandsRaw = (url.searchParams.get("boardBands") ?? "").trim();
  const boardParamLegacy = (url.searchParams.get("boardBand") ?? "").trim();
  const boardBandParts = [
    ...new Set(
      (boardBandsRaw
        ? boardBandsRaw.split(",")
        : boardParamLegacy
          ? [boardParamLegacy]
          : []
      )
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  /** Part VI: prefer governing-body voting count; fall back to independent-member counts when totals are omitted in XML. */
  const boardCntExpr = `COALESCE(r.governing_body_voting_cnt, r.voting_members_governing_cnt, r.voting_members_independent_cnt, r.independent_voting_member_cnt, 0)`;
  let boardSql = "";
  const boardBinds: number[] = [];
  if (boardBandParts.length > 0) {
    const clauses: string[] = [];
    for (const p of boardBandParts) {
      if (p === "0_3") {
        clauses.push(`(${boardCntExpr} >= ? AND ${boardCntExpr} <= ?)`);
        boardBinds.push(0, 3);
      } else if (p === "4") {
        clauses.push(`(${boardCntExpr} = ?)`);
        boardBinds.push(4);
      } else if (p === "5") {
        clauses.push(`(${boardCntExpr} = ?)`);
        boardBinds.push(5);
      } else if (p === "6") {
        clauses.push(`(${boardCntExpr} = ?)`);
        boardBinds.push(6);
      } else if (p === "7") {
        clauses.push(`(${boardCntExpr} = ?)`);
        boardBinds.push(7);
      } else if (p === "8p") {
        clauses.push(`(${boardCntExpr} >= ?)`);
        boardBinds.push(8);
      }
    }
    if (clauses.length > 0) {
      boardSql = ` AND (${clauses.join(" OR ")}) `;
    }
  }

  /** `states` (comma USPS) OR legacy `state` — OR combined. */
  const statesRaw = (url.searchParams.get("states") ?? "").trim();
  const stateLegacy = (url.searchParams.get("state") ?? "").trim().toUpperCase();
  const stateParts = [
    ...new Set(
      [
        ...(statesRaw
          ? statesRaw
              .split(",")
              .map((s) => s.trim().toUpperCase())
              .filter((s) => s.length === 2 && /^[A-Z]{2}$/.test(s))
          : []),
        ...(stateLegacy.length === 2 && /^[A-Z]{2}$/.test(stateLegacy) ? [stateLegacy] : []),
      ],
    ),
  ];
  let stateSql = "";
  const stateBinds: string[] = [];
  if (stateParts.length > 0) {
    stateSql = ` AND UPPER(TRIM(r.filer_state)) IN (${stateParts.map(() => "?").join(",")}) `;
    stateBinds.push(...stateParts);
  }

  try {
    const orderSql = random
      ? "ORDER BY RANDOM()"
      : "ORDER BY r.org_legal_name COLLATE NOCASE";
    const offsetBind = random ? 0 : offset;

    const stmt = `SELECT r.return_pk, r.ein, r.org_legal_name AS name, r.filer_city AS city, r.filer_state AS state,
              r.cy_total_revenue_amt, r.py_total_revenue_amt, r.cy_total_expenses_amt, r.py_total_expenses_amt,
              r.cy_rev_less_expenses_amt, r.net_assets_eoy_amt, r.net_assets_boy_amt,
              r.cy_contributions_grants_amt, r.cy_program_service_revenue_amt, r.cy_investment_income_amt, r.cy_other_revenue_amt,
              r.total_program_service_expenses_amt, r.cy_total_management_and_general_expenses_amt, r.cy_total_fundraising_expense_amt,
              r.formation_yr, r.total_employee_cnt, r.total_volunteers_cnt,
              COALESCE(r.governing_body_voting_cnt, r.voting_members_governing_cnt, r.voting_members_independent_cnt, r.independent_voting_member_cnt) AS board_members_cnt,
              r.governing_body_voting_cnt, r.voting_members_governing_cnt, r.voting_members_independent_cnt, r.independent_voting_member_cnt,
              r.tax_yr, r.organization_501c3_ind, r.website_txt,
              NULLIF(TRIM(r.org_phone), '') AS org_phone,
              r.mission_desc, r.activity_mission_desc,
              lc.logo_domain AS logo_cached_domain
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
       LEFT JOIN org_logo_cache lc ON lc.ein = r.ein
       WHERE 1=1 ${excludeSql} ${revenueSql} ${assetsSql} ${reserveSql} ${empF.sql} ${volF.sql} ${boardSql} ${stateSql}
       ${orderSql}
       LIMIT ? OFFSET ?`;

    const rows = await env.DB.prepare(stmt)
      .bind(
        ...exclude,
        ...revenueBinds,
        ...assetsBinds,
        ...reserveBinds,
        ...empF.binds,
        ...volF.binds,
        ...boardBinds,
        ...stateBinds,
        take,
        offsetBind,
      )
      .all();

    const list = (rows.results ?? []) as Record<string, unknown>[];
    const hasMore = list.length > limit;
    const pageRows = hasMore ? list.slice(0, limit) : list;

    const logoPk = env.LOGO_DEV_PUBLISHABLE_KEY?.trim();
    if (logoPk) {
      for (const row of pageRows) {
        const r = row as Record<string, unknown>;
        const url = resolveLogoDevImageUrl(
          String(r.name ?? ""),
          String(r.website_txt ?? ""),
          r.logo_cached_domain != null ? String(r.logo_cached_domain) : undefined,
          logoPk,
          { size: 72, retina: true },
        );
        if (url) r.logo_image_url = url;
      }
    }

    return json({
      count: pageRows.length,
      rows: pageRows,
      hasMore,
      nextOffset: offset + pageRows.length,
      random,
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

/** Same column list as `/api/irs990-browse` (single row). */
const IRS990_BROWSE_ROW_SELECT = `SELECT r.return_pk, r.ein, r.org_legal_name AS name, r.filer_city AS city, r.filer_state AS state,
              r.cy_total_revenue_amt, r.py_total_revenue_amt, r.cy_total_expenses_amt, r.py_total_expenses_amt,
              r.cy_rev_less_expenses_amt, r.net_assets_eoy_amt, r.net_assets_boy_amt,
              r.cy_contributions_grants_amt, r.cy_program_service_revenue_amt, r.cy_investment_income_amt, r.cy_other_revenue_amt,
              r.total_program_service_expenses_amt, r.cy_total_management_and_general_expenses_amt, r.cy_total_fundraising_expense_amt,
              r.formation_yr, r.total_employee_cnt, r.total_volunteers_cnt,
              COALESCE(r.governing_body_voting_cnt, r.voting_members_governing_cnt, r.voting_members_independent_cnt, r.independent_voting_member_cnt) AS board_members_cnt,
              r.governing_body_voting_cnt, r.voting_members_governing_cnt, r.voting_members_independent_cnt, r.independent_voting_member_cnt,
              r.tax_yr, r.organization_501c3_ind, r.website_txt,
              NULLIF(TRIM(r.org_phone), '') AS org_phone,
              r.mission_desc, r.activity_mission_desc,
              lc.logo_domain AS logo_cached_domain`;

/**
 * GET /api/irs990-row?orgId=irs990-<return_pk> | irs990-ein-<9 digits>
 * One TEOS row (latest filing per EIN when resolving by EIN), same shape as browse.
 */
async function handleIrs990RowByOrgId(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const orgId = (url.searchParams.get("orgId") ?? "").trim();
  if (!orgId) return json({ error: "Missing orgId" }, 400);

  let returnPk: string | undefined;
  let ein: string | undefined;
  if (orgId.startsWith("irs990-ein-")) {
    const d = orgId.slice("irs990-ein-".length).replace(/\D/g, "").slice(0, 9);
    if (d.length === 9) ein = d;
  } else if (orgId.startsWith("irs990-")) {
    const rest = orgId.slice("irs990-".length);
    if (/^\d+$/.test(rest)) returnPk = rest;
  }
  if (!returnPk && !ein) return json({ error: "Invalid orgId" }, 400);

  const logoPk = env.LOGO_DEV_PUBLISHABLE_KEY?.trim();

  try {
    let stmt: string;
    const binds: unknown[] = [];
    if (returnPk) {
      stmt = `${IRS990_BROWSE_ROW_SELECT}
       FROM irs990_xml_returns r
       LEFT JOIN org_logo_cache lc ON lc.ein = r.ein
       WHERE r.return_pk = ?
       LIMIT 1`;
      binds.push(returnPk);
    } else {
      stmt = `${IRS990_BROWSE_ROW_SELECT}
       FROM irs990_xml_returns r
       INNER JOIN (
         SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
         FROM irs990_xml_returns
         GROUP BY ein
       ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
       LEFT JOIN org_logo_cache lc ON lc.ein = r.ein
       WHERE r.ein = ?
       LIMIT 1`;
      binds.push(ein!);
    }

    const rows = await env.DB.prepare(stmt).bind(...binds).all();
    const list = (rows.results ?? []) as Record<string, unknown>[];
    if (list.length === 0) {
      return json({ rows: [], source: "irs990_xml_returns" }, 404);
    }

    const pageRows = list;
    if (logoPk) {
      for (const row of pageRows) {
        const r = row as Record<string, unknown>;
        const resolved = resolveLogoDevImageUrl(
          String(r.name ?? ""),
          String(r.website_txt ?? ""),
          r.logo_cached_domain != null ? String(r.logo_cached_domain) : undefined,
          logoPk,
          { size: 72, retina: true },
        );
        if (resolved) r.logo_image_url = resolved;
      }
    }

    return json({
      count: pageRows.length,
      rows: pageRows,
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
