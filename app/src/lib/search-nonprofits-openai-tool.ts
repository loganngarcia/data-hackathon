import type { ChatCompletionTool } from "openai/resources/chat/completions";

/** OpenAI Chat Completions `tools[]` entry — JSON Schema for `search_nonprofits`. */
export const SEARCH_NONPROFITS_OPENAI_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_nonprofits",
    description:
      "Query the D1 TEOS 990 table (latest filing per EIN). All filters optional; combined with AND. Returns rows with financials, mission snippet, officers, website, 501(c) flags, etc.",
    parameters: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description:
            "Broad text: organization name, city, state, mission keywords, or EIN digits (partial ok).",
        },
        state: { type: "string", description: "Two-letter US state, e.g. CA." },
        city: { type: "string", description: "City substring." },
        ein: { type: "string", description: "Nine-digit EIN (digits only)." },
        tax_yr_min: { type: "integer", description: "Minimum tax year (filing year)." },
        tax_yr_max: { type: "integer", description: "Maximum tax year." },
        revenue_min_usd: { type: "number", description: "Minimum CY total revenue USD." },
        revenue_max_usd: { type: "number", description: "Maximum CY total revenue USD." },
        expenses_min_usd: { type: "number", description: "Minimum CY total expenses USD." },
        expenses_max_usd: { type: "number", description: "Maximum CY total expenses USD." },
        net_assets_min_usd: { type: "number", description: "Minimum net assets EOY USD." },
        net_assets_max_usd: { type: "number", description: "Maximum net assets EOY USD." },
        gross_receipts_min_usd: { type: "number", description: "Minimum gross receipts USD." },
        gross_receipts_max_usd: { type: "number", description: "Maximum gross receipts USD." },
        program_service_expenses_min_usd: {
          type: "number",
          description: "Minimum Part IX program service expenses USD.",
        },
        program_service_expenses_max_usd: {
          type: "number",
          description: "Maximum program service expenses USD.",
        },
        employees_min: { type: "integer", description: "Minimum employees." },
        employees_max: { type: "integer", description: "Maximum employees." },
        volunteers_min: { type: "integer", description: "Minimum volunteers." },
        volunteers_max: { type: "integer", description: "Maximum volunteers." },
        formation_yr_min: { type: "integer", description: "Minimum formation year." },
        formation_yr_max: { type: "integer", description: "Maximum formation year." },
        is_501c3: {
          type: "boolean",
          description: "True = only 501(c)(3); false = exclude 501(c)(3).",
        },
        has_website: { type: "boolean", description: "True = filing lists a website." },
        sort: {
          type: "string",
          enum: ["name", "revenue", "expenses", "tax_yr", "ein"],
          description: "Sort: name | revenue | expenses | tax_yr | ein.",
        },
        limit: { type: "integer", description: "Max rows 1–100 (default 25)." },
        offset: { type: "integer", description: "Pagination offset." },
      },
      additionalProperties: false,
    },
  },
};
