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

/** JSON Schema for MCP `tools[].inputSchema` — mirrors `Irs990SearchFilters`. */
export const SEARCH_NONPROFITS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    q: {
      type: "string",
      description:
        "Free text: legal name, city, state, EIN digits, or mission keywords (broad LIKE match).",
    },
    state: { type: "string", description: "US state, 2 letters (e.g. CA)." },
    city: { type: "string", description: "City substring." },
    ein: { type: "string", description: "9-digit EIN (digits only)." },
    tax_yr_min: { type: "integer", description: "Minimum tax year (latest filing year per EIN)." },
    tax_yr_max: { type: "integer", description: "Maximum tax year." },
    revenue_min_usd: { type: "number", description: "Minimum CY total revenue (USD)." },
    revenue_max_usd: { type: "number", description: "Maximum CY total revenue (USD)." },
    expenses_min_usd: { type: "number", description: "Minimum CY total expenses (USD)." },
    expenses_max_usd: { type: "number", description: "Maximum CY total expenses (USD)." },
    net_assets_min_usd: { type: "number", description: "Minimum net assets EOY (USD)." },
    net_assets_max_usd: { type: "number", description: "Maximum net assets EOY (USD)." },
    gross_receipts_min_usd: { type: "number", description: "Minimum gross receipts (USD)." },
    gross_receipts_max_usd: { type: "number", description: "Maximum gross receipts (USD)." },
    program_service_expenses_min_usd: { type: "number", description: "Minimum Part IX program service expenses (USD)." },
    program_service_expenses_max_usd: { type: "number", description: "Maximum program service expenses (USD)." },
    employees_min: { type: "integer", description: "Minimum reported employees." },
    employees_max: { type: "integer", description: "Maximum reported employees." },
    volunteers_min: { type: "integer", description: "Minimum reported volunteers." },
    volunteers_max: { type: "integer", description: "Maximum reported volunteers." },
    formation_yr_min: { type: "integer", description: "Minimum organization formation year." },
    formation_yr_max: { type: "integer", description: "Maximum formation year." },
    is_501c3: { type: "boolean", description: "If true, only 501(c)(3); if false, exclude 501(c)(3)." },
    has_website: { type: "boolean", description: "If true, require non-empty website on the filing." },
    sort: {
      type: "string",
      enum: ["name", "revenue", "expenses", "tax_yr", "ein"],
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
