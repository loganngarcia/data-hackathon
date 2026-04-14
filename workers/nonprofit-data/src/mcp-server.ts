/**
 * Minimal MCP-style JSON-RPC 2.0 over HTTP POST for Cursor / custom clients.
 * Single tool: `search_nonprofits` → D1 `runIrs990Search` (same logic as GET/POST /api/irs990-search).
 *
 * POST /mcp  Content-Type: application/json
 * Methods: initialize, tools/list, tools/call (MCP-compatible shapes).
 */

import {
  parseSearchFilters,
  runIrs990Search,
  type Irs990SearchEnv,
  type Irs990SearchFilters,
} from "./irs990-search";

/** JSON Schema for MCP `tools[].inputSchema` — keep in sync with `app/src/lib/search-nonprofits-openai-tool.ts`. */
export const SEARCH_NONPROFITS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    q: {
      type: "string",
      description:
        "Broad OR: legal name, city, state, mission/activity, partial EIN.",
    },
    mission_text: {
      type: "string",
      description: "Mission/program text only (mission_desc OR activity_mission_desc).",
    },
    state: { type: "string", description: "Single US state, 2 letters." },
    states: { type: "string", description: 'Multiple states OR, comma-separated, e.g. "CA,NY".' },
    city: { type: "string", description: "City substring." },
    ein: { type: "string", description: "9-digit EIN (digits only)." },
    legal_domicile_state: { type: "string", description: "Legal domicile state, 2 letters." },
    tax_yr_min: { type: "integer", description: "Minimum tax year." },
    tax_yr_max: { type: "integer", description: "Maximum tax year." },
    revenue_min_usd: { type: "number", description: "Minimum CY revenue USD." },
    revenue_max_usd: { type: "number", description: "Maximum CY revenue USD." },
    expenses_min_usd: { type: "number", description: "Minimum CY expenses USD." },
    expenses_max_usd: { type: "number", description: "Maximum CY expenses USD." },
    net_assets_min_usd: { type: "number", description: "Minimum net assets EOY USD." },
    net_assets_max_usd: { type: "number", description: "Maximum net assets EOY USD." },
    gross_receipts_min_usd: { type: "number", description: "Minimum gross receipts USD." },
    gross_receipts_max_usd: { type: "number", description: "Maximum gross receipts USD." },
    program_service_expenses_min_usd: { type: "number", description: "Minimum program service expenses USD." },
    program_service_expenses_max_usd: { type: "number", description: "Maximum program service expenses USD." },
    fundraising_expenses_min_usd: { type: "number", description: "Minimum fundraising expenses USD." },
    fundraising_expenses_max_usd: { type: "number", description: "Maximum fundraising expenses USD." },
    management_expenses_min_usd: { type: "number", description: "Minimum management & general USD." },
    management_expenses_max_usd: { type: "number", description: "Maximum management & general USD." },
    contributions_grants_min_usd: { type: "number", description: "Minimum contributions & grants USD." },
    contributions_grants_max_usd: { type: "number", description: "Maximum contributions & grants USD." },
    investment_income_min_usd: { type: "number", description: "Minimum investment income USD." },
    investment_income_max_usd: { type: "number", description: "Maximum investment income USD." },
    program_service_revenue_min_usd: { type: "number", description: "Minimum program service revenue USD." },
    program_service_revenue_max_usd: { type: "number", description: "Maximum program service revenue USD." },
    other_revenue_min_usd: { type: "number", description: "Minimum other revenue USD." },
    other_revenue_max_usd: { type: "number", description: "Maximum other revenue USD." },
    rev_less_expenses_min_usd: { type: "number", description: "Minimum CY revenue less expenses USD." },
    rev_less_expenses_max_usd: { type: "number", description: "Maximum CY rev less expenses USD." },
    total_assets_eoy_min_usd: { type: "number", description: "Minimum total assets EOY USD." },
    total_assets_eoy_max_usd: { type: "number", description: "Maximum total assets EOY USD." },
    reserve_months_min: { type: "number", description: "Minimum reserve months (runway)." },
    reserve_months_max: { type: "number", description: "Maximum reserve months." },
    board_members_min: { type: "integer", description: "Minimum board / governing count." },
    board_members_max: { type: "integer", description: "Maximum board count." },
    employees_min: { type: "integer", description: "Minimum employees." },
    employees_max: { type: "integer", description: "Maximum employees." },
    volunteers_min: { type: "integer", description: "Minimum volunteers." },
    volunteers_max: { type: "integer", description: "Maximum volunteers." },
    formation_yr_min: { type: "integer", description: "Minimum formation year." },
    formation_yr_max: { type: "integer", description: "Maximum formation year." },
    is_501c3: { type: "boolean", description: "If true, only 501(c)(3); if false, exclude 501(c)(3)." },
    has_website: { type: "boolean", description: "If true, require non-empty website." },
    has_mission: { type: "boolean", description: "If true, require mission or activity text." },
    sort: {
      type: "string",
      enum: [
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
      ],
      description: "Result ordering.",
    },
    limit: { type: "integer", description: "Max rows (1–100, default 25)." },
    offset: { type: "integer", description: "Pagination offset." },
  },
} as const;

type JsonRpcReq = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

function jsonRpcResult(id: string | number | null, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_MCP },
  });
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): Response {
  const err: { code: number; message: string; data?: unknown } = { code, message };
  if (data !== undefined) err.data = data;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: err }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_MCP },
  });
}

const CORS_MCP: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Authorization",
};

async function dispatch(env: Irs990SearchEnv, req: JsonRpcReq): Promise<Response> {
  const id = req.id ?? null;
  const method = req.method;

  if (method === "initialize") {
    return jsonRpcResult(id as string | number, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "nonprofit-d1-search", version: "1.0.0" },
    });
  }

  if (method === "notifications/initialized" || (typeof method === "string" && method.startsWith("notifications/"))) {
    return new Response(null, { status: 204, headers: CORS_MCP });
  }

  if (method === "tools/list") {
    return jsonRpcResult(id as string | number, {
      tools: [
        {
          name: "search_nonprofits",
          description:
            "Search IRS Form 990 TEOS filings in D1: latest filing per EIN with rich financial and profile fields. " +
            "Combine multiple filters (all AND). Use `q` for fuzzy name/mission/EIN text; use numeric filters for scale and geography.",
          inputSchema: SEARCH_NONPROFITS_INPUT_SCHEMA,
        },
      ],
    });
  }

  if (method === "tools/call") {
    const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    const name = params.name;
    if (name !== "search_nonprofits") {
      return jsonRpcError(id, -32602, `Unknown tool: ${String(name)}`);
    }
    const rawArgs = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
    const filters = parseSearchFilters(rawArgs as Record<string, unknown>);
    try {
      const out = await runIrs990Search(env, filters as Irs990SearchFilters);
      return jsonRpcResult(id as string | number, {
        content: [{ type: "text", text: JSON.stringify(out, null, 0) }],
        isError: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonRpcResult(id as string | number, {
        content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
        isError: true,
      });
    }
  }

  if (method === "ping" || method === "resources/list") {
    return jsonRpcResult(id as string | number, method === "ping" ? {} : { resources: [] });
  }

  return jsonRpcError(id, -32601, `Method not found: ${String(method)}`);
}

export async function handleMcpPost(request: Request, env: Irs990SearchEnv): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  if (Array.isArray(body)) {
    const results = await Promise.all(body.map((b) => dispatch(env, b as JsonRpcReq)));
    const payloads = await Promise.all(results.map((r) => r.json()));
    return new Response(JSON.stringify(payloads), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_MCP },
    });
  }

  return dispatch(env, body as JsonRpcReq);
}

export function mcpOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_MCP });
}
