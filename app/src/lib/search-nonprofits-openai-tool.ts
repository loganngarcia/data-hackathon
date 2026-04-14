import type { ChatCompletionTool } from "openai/resources/chat/completions";

/** OpenAI Chat Completions `tools[]` entry — JSON Schema for `search_nonprofits` (mirrors Worker `/api/irs990-search`). */
export const SEARCH_NONPROFITS_OPENAI_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_nonprofits",
    description:
      "Query the D1 TEOS 990 table (latest filing per EIN). All filters optional; combined with AND. " +
      "Use `mission_text` to filter by mission/program description only; use `q` for broader text (name, city, state, mission, EIN). " +
      "Use `states` for multiple states (OR). Numeric filters match Form 990 Part I / Part VIII / Part IX fields.",
    parameters: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description:
            "Broad text: organization name, city, state, mission keywords, activity text, or partial EIN digits (OR match).",
        },
        mission_text: {
          type: "string",
          description:
            "Mission / program description substring only (matches mission_desc OR activity_mission_desc). Prefer this when the user cares about what the org does, not its name or location.",
        },
        state: { type: "string", description: "Single US state (2 letters), e.g. CA." },
        states: {
          type: "string",
          description: 'Multiple states OR logic, comma-separated 2-letter codes, e.g. "CA,NY,TX".',
        },
        city: { type: "string", description: "City substring." },
        ein: { type: "string", description: "Nine-digit EIN (digits only)." },
        legal_domicile_state: {
          type: "string",
          description: "Legal domicile state from the filing (2 letters), often same as HQ.",
        },
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
        fundraising_expenses_min_usd: { type: "number", description: "Minimum fundraising expenses USD." },
        fundraising_expenses_max_usd: { type: "number", description: "Maximum fundraising expenses USD." },
        management_expenses_min_usd: {
          type: "number",
          description: "Minimum management & general (admin) expenses USD.",
        },
        management_expenses_max_usd: { type: "number", description: "Maximum management & general expenses USD." },
        contributions_grants_min_usd: { type: "number", description: "Minimum contributions & grants revenue USD." },
        contributions_grants_max_usd: { type: "number", description: "Maximum contributions & grants USD." },
        investment_income_min_usd: { type: "number", description: "Minimum investment income USD." },
        investment_income_max_usd: { type: "number", description: "Maximum investment income USD." },
        program_service_revenue_min_usd: { type: "number", description: "Minimum program service revenue USD." },
        program_service_revenue_max_usd: { type: "number", description: "Maximum program service revenue USD." },
        other_revenue_min_usd: { type: "number", description: "Minimum other revenue USD." },
        other_revenue_max_usd: { type: "number", description: "Maximum other revenue USD." },
        rev_less_expenses_min_usd: {
          type: "number",
          description: "Minimum CY revenue minus expenses (surplus/deficit) USD.",
        },
        rev_less_expenses_max_usd: { type: "number", description: "Maximum CY rev less expenses USD." },
        total_assets_eoy_min_usd: { type: "number", description: "Minimum total assets EOY USD." },
        total_assets_eoy_max_usd: { type: "number", description: "Maximum total assets EOY USD." },
        reserve_months_min: {
          type: "number",
          description: "Minimum reserve runway in months (net assets EOY / annual expenses × 12).",
        },
        reserve_months_max: { type: "number", description: "Maximum reserve months." },
        board_members_min: { type: "integer", description: "Minimum governing-body / board headcount (Part VI)." },
        board_members_max: { type: "integer", description: "Maximum board headcount." },
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
        has_mission: {
          type: "boolean",
          description: "True = require non-empty mission or activity description on the filing.",
        },
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
          description: "Sort order for results.",
        },
        limit: { type: "integer", description: "Max rows 1–100 (default 25)." },
        offset: { type: "integer", description: "Pagination offset." },
      },
      additionalProperties: false,
    },
  },
};
