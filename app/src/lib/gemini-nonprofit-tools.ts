/**
 * Shared system instruction + Gemini-style tool schema for nonprofit D1 search (TEOS 990).
 * Chat uses OpenAI (`search-nonprofits-openai-tool.ts`); `SEARCH_NONPROFITS_GEMINI_FUNCTION` kept for reference.
 */

export const NONPROFIT_SEARCH_SYSTEM_INSTRUCTION = `You are a nonprofit research assistant with access to a real IRS Form 990 database (TEOS XML ingest).
The user message may be a short question or a multi-turn transcript labeled "User:" / "Assistant:" lines — respond to the latest user need.
When the user asks which organizations match criteria, you MUST call the tool \`search_nonprofits\` with structured filters — do not invent EINs, revenue, or locations.
Combine filters with AND logic. Use \`q\` for fuzzy name, city, state, mission, or partial EIN digits; use numeric min/max fields for scale (revenue, expenses, net assets, gross receipts, program expenses, employees, volunteers, formation year, tax year).
Prefer tighter filters when the user gives ranges or geography. Summarize results clearly: name, EIN, city/state, key dollar fields, and mission_snippet. If hasMore is true, say more rows exist and suggest narrowing filters or pagination (offset).
If a search returns zero rows, suggest relaxing one constraint at a time.`;

/** Gemini Schema-style parameters (uppercase type enums per Generative Language REST). */
export const SEARCH_NONPROFITS_GEMINI_FUNCTION = {
  name: "search_nonprofits",
  description:
    "Query the D1 TEOS 990 table (latest filing per EIN). All filters optional; combined with AND. Returns rows with financials, mission snippet, officers, website, 501(c) flags, etc.",
  parameters: {
    type: "OBJECT",
    properties: {
      q: {
        type: "STRING",
        description:
          "Broad text: organization name, city, state, mission keywords, or EIN digits (partial ok).",
      },
      state: { type: "STRING", description: "Two-letter US state, e.g. CA." },
      city: { type: "STRING", description: "City substring." },
      ein: { type: "STRING", description: "Nine-digit EIN (digits only)." },
      tax_yr_min: { type: "INTEGER", description: "Minimum tax year (filing year)." },
      tax_yr_max: { type: "INTEGER", description: "Maximum tax year." },
      revenue_min_usd: { type: "NUMBER", description: "Minimum CY total revenue USD." },
      revenue_max_usd: { type: "NUMBER", description: "Maximum CY total revenue USD." },
      expenses_min_usd: { type: "NUMBER", description: "Minimum CY total expenses USD." },
      expenses_max_usd: { type: "NUMBER", description: "Maximum CY total expenses USD." },
      net_assets_min_usd: { type: "NUMBER", description: "Minimum net assets EOY USD." },
      net_assets_max_usd: { type: "NUMBER", description: "Maximum net assets EOY USD." },
      gross_receipts_min_usd: { type: "NUMBER", description: "Minimum gross receipts USD." },
      gross_receipts_max_usd: { type: "NUMBER", description: "Maximum gross receipts USD." },
      program_service_expenses_min_usd: { type: "NUMBER", description: "Minimum Part IX program service expenses USD." },
      program_service_expenses_max_usd: { type: "NUMBER", description: "Maximum program service expenses USD." },
      employees_min: { type: "INTEGER", description: "Minimum employees." },
      employees_max: { type: "INTEGER", description: "Maximum employees." },
      volunteers_min: { type: "INTEGER", description: "Minimum volunteers." },
      volunteers_max: { type: "INTEGER", description: "Maximum volunteers." },
      formation_yr_min: { type: "INTEGER", description: "Minimum formation year." },
      formation_yr_max: { type: "INTEGER", description: "Maximum formation year." },
      is_501c3: { type: "BOOLEAN", description: "True = only 501(c)(3); false = exclude 501(c)(3)." },
      has_website: { type: "BOOLEAN", description: "True = filing lists a website." },
      sort: {
        type: "STRING",
        description: "Sort: name | revenue | expenses | tax_yr | ein.",
        enum: ["name", "revenue", "expenses", "tax_yr", "ein"],
      },
      limit: { type: "INTEGER", description: "Max rows 1–100 (default 25)." },
      offset: { type: "INTEGER", description: "Pagination offset." },
    },
  },
} as const;
