/**
 * Filterable search over latest TEOS Form 990 row per EIN (`irs990_xml_returns`).
 * All filters are optional; combined with AND. Text `q` matches name, city, state, EIN digits, mission.
 * Use `mission_text` to target mission/activity descriptions without mixing in name/city noise.
 */

export type Irs990SearchEnv = { DB: D1Database };

/** Reserve months (runway): net_assets_eoy / cy_total_expenses * 12; 0 if expenses <= 0. */
export const RESERVE_MONTHS_SQL = `(CASE WHEN COALESCE(r.cy_total_expenses_amt, 0) <= 0 THEN 0.0 ELSE (CAST(COALESCE(r.net_assets_eoy_amt, 0) AS REAL) / r.cy_total_expenses_amt) * 12 END)`;

export const BOARD_COUNT_SQL = `COALESCE(r.governing_body_voting_cnt, r.voting_members_governing_cnt, r.voting_members_independent_cnt, r.independent_voting_member_cnt, 0)`;

export type Irs990SearchFilters = {
  /** Broad: org name, city, state, EIN digits, mission/activity (OR). */
  q?: string;
  /** Mission or program description only (matches mission_desc OR activity_mission_desc). */
  mission_text?: string;
  /** US state 2-letter */
  state?: string;
  /** Comma-separated 2-letter states (OR) — e.g. "CA,NY,TX" */
  states?: string;
  /** City substring */
  city?: string;
  /** 9-digit EIN (digits only or formatted) */
  ein?: string;
  /** Legal domicile state (Form 990), 2 letters */
  legal_domicile_state?: string;
  tax_yr_min?: number;
  tax_yr_max?: number;
  revenue_min_usd?: number;
  revenue_max_usd?: number;
  expenses_min_usd?: number;
  expenses_max_usd?: number;
  net_assets_min_usd?: number;
  net_assets_max_usd?: number;
  gross_receipts_min_usd?: number;
  gross_receipts_max_usd?: number;
  program_service_expenses_min_usd?: number;
  program_service_expenses_max_usd?: number;
  fundraising_expenses_min_usd?: number;
  fundraising_expenses_max_usd?: number;
  management_expenses_min_usd?: number;
  management_expenses_max_usd?: number;
  contributions_grants_min_usd?: number;
  contributions_grants_max_usd?: number;
  investment_income_min_usd?: number;
  investment_income_max_usd?: number;
  program_service_revenue_min_usd?: number;
  program_service_revenue_max_usd?: number;
  other_revenue_min_usd?: number;
  other_revenue_max_usd?: number;
  rev_less_expenses_min_usd?: number;
  rev_less_expenses_max_usd?: number;
  total_assets_eoy_min_usd?: number;
  total_assets_eoy_max_usd?: number;
  /** Months of runway (aligned with portfolio reserve filter) */
  reserve_months_min?: number;
  reserve_months_max?: number;
  board_members_min?: number;
  board_members_max?: number;
  employees_min?: number;
  employees_max?: number;
  volunteers_min?: number;
  volunteers_max?: number;
  formation_yr_min?: number;
  formation_yr_max?: number;
  /** If true, only 501(c)(3); if false, exclude 501(c)(3) */
  is_501c3?: boolean;
  /** If true, require non-empty website_txt */
  has_website?: boolean;
  /** If true, require non-empty mission or activity text */
  has_mission?: boolean;
  sort?:
    | "name"
    | "revenue"
    | "expenses"
    | "tax_yr"
    | "ein"
    | "net_assets"
    | "employees"
    | "volunteers"
    | "formation_yr"
    | "reserve_months"
    | "contributions"
    | "investment_income"
    | "board";
  limit?: number;
  offset?: number;
};

const MAX_LIMIT = 100;

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function int(v: unknown): number | undefined {
  const n = num(v);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

function bool(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/** Parse comma-separated USPS state abbrevs → uppercase 2-letter tokens. */
function parseStatesList(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const u = part.trim().replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
    if (u.length === 2) out.push(u);
  }
  return [...new Set(out)];
}

/** Parse filters from URLSearchParams (GET) or flat JSON (POST). */
export function parseSearchFilters(input: URLSearchParams | Record<string, unknown>): Irs990SearchFilters {
  const get = (k: string) =>
    input instanceof URLSearchParams ? input.get(k) : (input as Record<string, unknown>)[k];

  const o: Irs990SearchFilters = {};
  const q = str(get("q"));
  if (q) o.q = q;
  const missionText = str(get("mission_text"));
  if (missionText) o.mission_text = missionText;

  const state = str(get("state"));
  if (state) o.state = state.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  const statesRaw = str(get("states"));
  if (statesRaw) o.states = statesRaw;
  const city = str(get("city"));
  if (city) o.city = city;
  const einRaw = str(get("ein"));
  if (einRaw) {
    const d = einRaw.replace(/\D/g, "").slice(0, 9);
    if (d.length === 9) o.ein = d;
  }
  const legalDom = str(get("legal_domicile_state"));
  if (legalDom) o.legal_domicile_state = legalDom.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();

  const tmin = int(get("tax_yr_min"));
  const tmax = int(get("tax_yr_max"));
  if (tmin !== undefined) o.tax_yr_min = tmin;
  if (tmax !== undefined) o.tax_yr_max = tmax;

  const pair = (minKey: string, maxKey: keyof Irs990SearchFilters) => {
    const a = num(get(minKey));
    const b = num(get(maxKey as string));
    if (a !== undefined) (o as Record<string, number>)[minKey] = a;
    if (b !== undefined) (o as Record<string, number>)[maxKey as string] = b;
  };
  pair("revenue_min_usd", "revenue_max_usd");
  pair("expenses_min_usd", "expenses_max_usd");
  pair("net_assets_min_usd", "net_assets_max_usd");
  pair("gross_receipts_min_usd", "gross_receipts_max_usd");
  pair("program_service_expenses_min_usd", "program_service_expenses_max_usd");
  pair("fundraising_expenses_min_usd", "fundraising_expenses_max_usd");
  pair("management_expenses_min_usd", "management_expenses_max_usd");
  pair("contributions_grants_min_usd", "contributions_grants_max_usd");
  pair("investment_income_min_usd", "investment_income_max_usd");
  pair("program_service_revenue_min_usd", "program_service_revenue_max_usd");
  pair("other_revenue_min_usd", "other_revenue_max_usd");
  pair("rev_less_expenses_min_usd", "rev_less_expenses_max_usd");
  pair("total_assets_eoy_min_usd", "total_assets_eoy_max_usd");
  pair("reserve_months_min", "reserve_months_max");
  pair("board_members_min", "board_members_max");

  const emin = int(get("employees_min"));
  const emax = int(get("employees_max"));
  if (emin !== undefined) o.employees_min = emin;
  if (emax !== undefined) o.employees_max = emax;
  const vmin = int(get("volunteers_min"));
  const vmax = int(get("volunteers_max"));
  if (vmin !== undefined) o.volunteers_min = vmin;
  if (vmax !== undefined) o.volunteers_max = vmax;
  const fmin = int(get("formation_yr_min"));
  const fmax = int(get("formation_yr_max"));
  if (fmin !== undefined) o.formation_yr_min = fmin;
  if (fmax !== undefined) o.formation_yr_max = fmax;

  const c3 = bool(get("is_501c3"));
  if (c3 !== undefined) o.is_501c3 = c3;
  const hw = bool(get("has_website"));
  if (hw !== undefined) o.has_website = hw;
  const hm = bool(get("has_mission"));
  if (hm !== undefined) o.has_mission = hm;

  const sort = str(get("sort"));
  const sortOk: Irs990SearchFilters["sort"][] = [
    "name",
    "revenue",
    "expenses",
    "tax_yr",
    "ein",
    "net_assets",
    "employees",
    "volunteers",
    "formation_yr",
    "reserve_months",
    "contributions",
    "investment_income",
    "board",
  ];
  if (sort && sortOk.includes(sort as Irs990SearchFilters["sort"])) {
    o.sort = sort as Irs990SearchFilters["sort"];
  }
  const limit = int(get("limit"));
  const offset = int(get("offset"));
  if (limit !== undefined) o.limit = limit;
  if (offset !== undefined) o.offset = offset;

  return o;
}

export async function runIrs990Search(
  env: Irs990SearchEnv,
  filters: Irs990SearchFilters,
): Promise<{ rows: Record<string, unknown>[]; hasMore: boolean; limit: number; offset: number }> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? 25));
  const offset = Math.max(0, filters.offset ?? 0);
  const take = limit + 1;

  const binds: unknown[] = [];
  const where: string[] = [];

  const stateList = parseStatesList(filters.states);
  if (stateList.length > 0) {
    where.push(`UPPER(TRIM(r.filer_state)) IN (${stateList.map(() => "?").join(",")})`);
    binds.push(...stateList);
  } else if (filters.state) {
    where.push(`UPPER(TRIM(r.filer_state)) = ?`);
    binds.push(filters.state.toUpperCase());
  }

  if (filters.legal_domicile_state) {
    where.push(`UPPER(TRIM(COALESCE(r.legal_domicile_state_cd, ''))) = ?`);
    binds.push(filters.legal_domicile_state.toUpperCase());
  }

  if (filters.city) {
    where.push(`r.filer_city LIKE ?`);
    binds.push(`%${filters.city.replace(/[%_]/g, "")}%`);
  }
  if (filters.ein) {
    where.push(`r.ein = ?`);
    binds.push(filters.ein);
  }
  if (filters.tax_yr_min !== undefined) {
    where.push(`COALESCE(r.tax_yr, 0) >= ?`);
    binds.push(filters.tax_yr_min);
  }
  if (filters.tax_yr_max !== undefined) {
    where.push(`COALESCE(r.tax_yr, 0) <= ?`);
    binds.push(filters.tax_yr_max);
  }
  if (filters.revenue_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_revenue_amt, 0) >= ?`);
    binds.push(filters.revenue_min_usd);
  }
  if (filters.revenue_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_revenue_amt, 0) <= ?`);
    binds.push(filters.revenue_max_usd);
  }
  if (filters.expenses_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_expenses_amt, 0) >= ?`);
    binds.push(filters.expenses_min_usd);
  }
  if (filters.expenses_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_expenses_amt, 0) <= ?`);
    binds.push(filters.expenses_max_usd);
  }
  if (filters.net_assets_min_usd !== undefined) {
    where.push(`COALESCE(r.net_assets_eoy_amt, 0) >= ?`);
    binds.push(filters.net_assets_min_usd);
  }
  if (filters.net_assets_max_usd !== undefined) {
    where.push(`COALESCE(r.net_assets_eoy_amt, 0) <= ?`);
    binds.push(filters.net_assets_max_usd);
  }
  if (filters.gross_receipts_min_usd !== undefined) {
    where.push(`COALESCE(r.gross_receipts_amt, 0) >= ?`);
    binds.push(filters.gross_receipts_min_usd);
  }
  if (filters.gross_receipts_max_usd !== undefined) {
    where.push(`COALESCE(r.gross_receipts_amt, 0) <= ?`);
    binds.push(filters.gross_receipts_max_usd);
  }
  if (filters.program_service_expenses_min_usd !== undefined) {
    where.push(`COALESCE(r.total_program_service_expenses_amt, 0) >= ?`);
    binds.push(filters.program_service_expenses_min_usd);
  }
  if (filters.program_service_expenses_max_usd !== undefined) {
    where.push(`COALESCE(r.total_program_service_expenses_amt, 0) <= ?`);
    binds.push(filters.program_service_expenses_max_usd);
  }
  if (filters.fundraising_expenses_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_fundraising_expense_amt, 0) >= ?`);
    binds.push(filters.fundraising_expenses_min_usd);
  }
  if (filters.fundraising_expenses_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_fundraising_expense_amt, 0) <= ?`);
    binds.push(filters.fundraising_expenses_max_usd);
  }
  if (filters.management_expenses_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_management_and_general_expenses_amt, 0) >= ?`);
    binds.push(filters.management_expenses_min_usd);
  }
  if (filters.management_expenses_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_total_management_and_general_expenses_amt, 0) <= ?`);
    binds.push(filters.management_expenses_max_usd);
  }
  if (filters.contributions_grants_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_contributions_grants_amt, 0) >= ?`);
    binds.push(filters.contributions_grants_min_usd);
  }
  if (filters.contributions_grants_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_contributions_grants_amt, 0) <= ?`);
    binds.push(filters.contributions_grants_max_usd);
  }
  if (filters.investment_income_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_investment_income_amt, 0) >= ?`);
    binds.push(filters.investment_income_min_usd);
  }
  if (filters.investment_income_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_investment_income_amt, 0) <= ?`);
    binds.push(filters.investment_income_max_usd);
  }
  if (filters.program_service_revenue_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_program_service_revenue_amt, 0) >= ?`);
    binds.push(filters.program_service_revenue_min_usd);
  }
  if (filters.program_service_revenue_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_program_service_revenue_amt, 0) <= ?`);
    binds.push(filters.program_service_revenue_max_usd);
  }
  if (filters.other_revenue_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_other_revenue_amt, 0) >= ?`);
    binds.push(filters.other_revenue_min_usd);
  }
  if (filters.other_revenue_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_other_revenue_amt, 0) <= ?`);
    binds.push(filters.other_revenue_max_usd);
  }
  if (filters.rev_less_expenses_min_usd !== undefined) {
    where.push(`COALESCE(r.cy_rev_less_expenses_amt, 0) >= ?`);
    binds.push(filters.rev_less_expenses_min_usd);
  }
  if (filters.rev_less_expenses_max_usd !== undefined) {
    where.push(`COALESCE(r.cy_rev_less_expenses_amt, 0) <= ?`);
    binds.push(filters.rev_less_expenses_max_usd);
  }
  if (filters.total_assets_eoy_min_usd !== undefined) {
    where.push(`COALESCE(r.total_assets_eoy_amt, 0) >= ?`);
    binds.push(filters.total_assets_eoy_min_usd);
  }
  if (filters.total_assets_eoy_max_usd !== undefined) {
    where.push(`COALESCE(r.total_assets_eoy_amt, 0) <= ?`);
    binds.push(filters.total_assets_eoy_max_usd);
  }
  if (filters.reserve_months_min !== undefined) {
    where.push(`${RESERVE_MONTHS_SQL} >= ?`);
    binds.push(filters.reserve_months_min);
  }
  if (filters.reserve_months_max !== undefined) {
    where.push(`${RESERVE_MONTHS_SQL} <= ?`);
    binds.push(filters.reserve_months_max);
  }
  if (filters.board_members_min !== undefined) {
    where.push(`${BOARD_COUNT_SQL} >= ?`);
    binds.push(filters.board_members_min);
  }
  if (filters.board_members_max !== undefined) {
    where.push(`${BOARD_COUNT_SQL} <= ?`);
    binds.push(filters.board_members_max);
  }
  if (filters.employees_min !== undefined) {
    where.push(`COALESCE(r.total_employee_cnt, 0) >= ?`);
    binds.push(filters.employees_min);
  }
  if (filters.employees_max !== undefined) {
    where.push(`COALESCE(r.total_employee_cnt, 0) <= ?`);
    binds.push(filters.employees_max);
  }
  if (filters.volunteers_min !== undefined) {
    where.push(`COALESCE(r.total_volunteers_cnt, 0) >= ?`);
    binds.push(filters.volunteers_min);
  }
  if (filters.volunteers_max !== undefined) {
    where.push(`COALESCE(r.total_volunteers_cnt, 0) <= ?`);
    binds.push(filters.volunteers_max);
  }
  if (filters.formation_yr_min !== undefined) {
    where.push(`COALESCE(r.formation_yr, 0) >= ?`);
    binds.push(filters.formation_yr_min);
  }
  if (filters.formation_yr_max !== undefined) {
    where.push(`COALESCE(r.formation_yr, 0) <= ?`);
    binds.push(filters.formation_yr_max);
  }
  if (filters.is_501c3 === true) {
    where.push(`r.organization_501c3_ind = 1`);
  } else if (filters.is_501c3 === false) {
    where.push(`r.organization_501c3_ind = 0`);
  }
  if (filters.has_website === true) {
    where.push(`TRIM(COALESCE(r.website_txt, '')) != ''`);
  }
  if (filters.has_mission === true) {
    where.push(
      `(TRIM(COALESCE(r.mission_desc, '')) != '' OR TRIM(COALESCE(r.activity_mission_desc, '')) != '')`,
    );
  }

  if (filters.mission_text) {
    const mt = `%${filters.mission_text.trim().replace(/[%_]/g, " ")}%`;
    where.push(`(r.mission_desc LIKE ? OR r.activity_mission_desc LIKE ?)`);
    binds.push(mt, mt);
  }

  if (filters.q) {
    const qq = `%${filters.q.trim().replace(/[%_]/g, " ")}%`;
    const qein = filters.q.replace(/\D/g, "").slice(0, 9);
    where.push(
      `(` +
        `r.org_legal_name LIKE ? OR r.filer_city LIKE ? OR r.filer_state LIKE ? ` +
        `OR r.mission_desc LIKE ? OR r.activity_mission_desc LIKE ?` +
        (qein.length >= 3 ? ` OR REPLACE(r.ein, '-', '') LIKE ?` : "") +
        `)`,
    );
    binds.push(qq, qq, qq, qq, qq);
    if (qein.length >= 3) binds.push(`%${qein}%`);
  }

  const whereSql = where.length ? `AND ${where.join(" AND ")}` : "";

  let orderBy = "r.org_legal_name COLLATE NOCASE ASC";
  switch (filters.sort) {
    case "revenue":
      orderBy = "COALESCE(r.cy_total_revenue_amt, 0) DESC";
      break;
    case "expenses":
      orderBy = "COALESCE(r.cy_total_expenses_amt, 0) DESC";
      break;
    case "tax_yr":
      orderBy = "COALESCE(r.tax_yr, 0) DESC";
      break;
    case "ein":
      orderBy = "r.ein ASC";
      break;
    case "net_assets":
      orderBy = "COALESCE(r.net_assets_eoy_amt, 0) DESC";
      break;
    case "employees":
      orderBy = "COALESCE(r.total_employee_cnt, 0) DESC";
      break;
    case "volunteers":
      orderBy = "COALESCE(r.total_volunteers_cnt, 0) DESC";
      break;
    case "formation_yr":
      orderBy = "COALESCE(r.formation_yr, 0) DESC";
      break;
    case "reserve_months":
      orderBy = `${RESERVE_MONTHS_SQL} DESC`;
      break;
    case "contributions":
      orderBy = "COALESCE(r.cy_contributions_grants_amt, 0) DESC";
      break;
    case "investment_income":
      orderBy = "COALESCE(r.cy_investment_income_amt, 0) DESC";
      break;
    case "board":
      orderBy = `${BOARD_COUNT_SQL} DESC`;
      break;
    default:
      break;
  }

  const stmt = `
    SELECT r.return_pk, r.ein, r.org_legal_name AS name, r.filer_city AS city, r.filer_state AS state,
           r.filer_zip, r.legal_domicile_state_cd,
           r.tax_yr, r.return_type_cd, r.return_version,
           r.gross_receipts_amt,
           r.cy_total_revenue_amt, r.cy_total_expenses_amt, r.cy_rev_less_expenses_amt,
           r.cy_contributions_grants_amt, r.cy_program_service_revenue_amt, r.cy_investment_income_amt, r.cy_other_revenue_amt,
           r.total_program_service_expenses_amt, r.cy_total_fundraising_expense_amt, r.cy_total_management_and_general_expenses_amt,
           r.net_assets_eoy_amt, r.net_assets_boy_amt,
           r.total_assets_eoy_amt, r.total_liabilities_eoy_amt,
           r.total_employee_cnt, r.total_volunteers_cnt,
           r.voting_members_governing_cnt, r.voting_members_independent_cnt,
           ${BOARD_COUNT_SQL} AS board_members_cnt,
           r.formation_yr, r.organization_501c3_ind, r.organization_501c_type_txt,
           r.website_txt, r.org_phone, r.principal_officer_nm, r.business_officer_person_nm, r.business_officer_title_txt,
           SUBSTR(COALESCE(r.activity_mission_desc, r.mission_desc, ''), 1, 320) AS mission_snippet,
           lc.logo_domain AS logo_cached_domain
    FROM irs990_xml_returns r
    INNER JOIN (
      SELECT ein, MAX(COALESCE(tax_yr, 0)) AS max_ty
      FROM irs990_xml_returns
      GROUP BY ein
    ) latest ON r.ein = latest.ein AND COALESCE(r.tax_yr, 0) = latest.max_ty
    LEFT JOIN org_logo_cache lc ON lc.ein = r.ein
    WHERE 1=1 ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  binds.push(take, offset);

  const res = await env.DB.prepare(stmt).bind(...binds).all();
  const list = (res.results ?? []) as Record<string, unknown>[];
  const hasMore = list.length > limit;
  const rows = hasMore ? list.slice(0, limit) : list;

  return { rows, hasMore, limit, offset };
}
