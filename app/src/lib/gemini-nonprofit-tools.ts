/**
 * Shared system instruction + Gemini-style tool schema for nonprofit D1 search (TEOS 990).
 * Chat uses OpenAI (`search-nonprofits-openai-tool.ts`); `SEARCH_NONPROFITS_GEMINI_FUNCTION` kept for reference.
 */

export const NONPROFIT_SEARCH_SYSTEM_INSTRUCTION = `You are a nonprofit research assistant with access to a real IRS Form 990 database (TEOS XML ingest).
The system prompt may end with an \`[End-user profile]\` block (name, role, interests from their settings). Use it to personalize tone and examples; address them by preferred name when natural. Do not invent biographical facts beyond that block.
The user message may include an \`[App UI context — personalization only]\` block: current page (home mosaic vs chat), saved portfolio toolbar filters, and sometimes an organization the user has open in the UI (\`?org=\`). Treat that block as **hints**—the user may ask about something unrelated; do not automatically apply those filters to \`search_nonprofits\` unless it helps their question. When you **do** align a search or answer with that UI context, mention it briefly (e.g. that you used their on-screen filters or the in-focus org).
Individual \`User:\` turns may start with \`[Sent while nonprofit profile was open: …]\` when the user sent that line from an open org detail — use it as focus for that question.
The user message may be a short question or a multi-turn transcript labeled "User:" / "Assistant:" lines — respond to the latest user need.
When the user asks which organizations match criteria, you MUST call the tool \`search_nonprofits\` with structured filters — do not invent EINs, revenue, or locations.
Combine filters with AND logic.
- Use \`q\` for a **broad** OR search: legal name, city, state, mission/activity text, partial EIN.
- Use \`mission_text\` when the user cares about **what organizations do** (programs, cause, mission language) — it only scans mission and activity fields, not the org name or city.
- Use \`states\` (comma-separated, e.g. "CA,TX") for multiple states; use \`state\` for a single state.
- Use \`reserve_months_min\` / \`reserve_months_max\` for runway (months of net assets relative to annual expenses), aligned with the portfolio dashboard.
- Use \`board_members_min\` / \`board_members_max\` for governing-body size; \`contributions_grants_*\`, \`investment_income_*\`, \`program_service_revenue_*\`, \`fundraising_expenses_*\`, \`management_expenses_*\` for Part VIII / Part IX scale.
- Use \`has_mission: true\` when the user wants orgs that actually filed mission/activity narrative text.
Prefer tighter filters when the user gives ranges or geography.
After a successful search, the UI shows each match as a **clickable card** (logo, location, board size, reserve coverage, net assets, mission snippet when present) linking to the full profile. **Do not** list or repeat organization names, missions, cities, or field values in your reply—no bullets, no "highlights," no numbered inventories. Answer in **at most 1–2 short sentences**: what filters you used, roughly how many matched, and one useful pattern or next step if it helps. If hasMore is true, note that more rows exist and suggest narrowing filters or pagination (offset). If a search returns zero rows, suggest relaxing one constraint at a time.`;

/** Gemini Schema-style parameters (uppercase type enums per Generative Language REST). */
export const SEARCH_NONPROFITS_GEMINI_FUNCTION = {
  name: "search_nonprofits",
  description:
    "Query the D1 TEOS 990 table (latest filing per EIN). All filters optional; combined with AND. See OpenAI tool schema for full parameter list (mission_text, states, reserve_months_*, board_*, revenue streams, expenses breakdown, etc.).",
  parameters: {
    type: "OBJECT",
    properties: {
      q: {
        type: "STRING",
        description:
          "Broad text: organization name, city, state, mission keywords, or EIN digits (partial ok).",
      },
      mission_text: {
        type: "STRING",
        description: "Mission/activity description substring only (not name or city).",
      },
      state: { type: "STRING", description: "Two-letter US state, e.g. CA." },
      states: { type: "STRING", description: 'Multiple states OR, comma-separated, e.g. "CA,NY".' },
      city: { type: "STRING", description: "City substring." },
      ein: { type: "STRING", description: "Nine-digit EIN (digits only)." },
      legal_domicile_state: { type: "STRING", description: "Legal domicile state, 2 letters." },
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
      program_service_expenses_min_usd: { type: "NUMBER", description: "Minimum Part IX program expenses USD." },
      program_service_expenses_max_usd: { type: "NUMBER", description: "Maximum program expenses USD." },
      fundraising_expenses_min_usd: { type: "NUMBER", description: "Minimum fundraising expenses USD." },
      fundraising_expenses_max_usd: { type: "NUMBER", description: "Maximum fundraising expenses USD." },
      management_expenses_min_usd: { type: "NUMBER", description: "Minimum management & general expenses USD." },
      management_expenses_max_usd: { type: "NUMBER", description: "Maximum management & general expenses USD." },
      contributions_grants_min_usd: { type: "NUMBER", description: "Minimum contributions & grants USD." },
      contributions_grants_max_usd: { type: "NUMBER", description: "Maximum contributions & grants USD." },
      investment_income_min_usd: { type: "NUMBER", description: "Minimum investment income USD." },
      investment_income_max_usd: { type: "NUMBER", description: "Maximum investment income USD." },
      program_service_revenue_min_usd: { type: "NUMBER", description: "Minimum program service revenue USD." },
      program_service_revenue_max_usd: { type: "NUMBER", description: "Maximum program service revenue USD." },
      other_revenue_min_usd: { type: "NUMBER", description: "Minimum other revenue USD." },
      other_revenue_max_usd: { type: "NUMBER", description: "Maximum other revenue USD." },
      rev_less_expenses_min_usd: { type: "NUMBER", description: "Minimum CY revenue less expenses USD." },
      rev_less_expenses_max_usd: { type: "NUMBER", description: "Maximum CY revenue less expenses USD." },
      total_assets_eoy_min_usd: { type: "NUMBER", description: "Minimum total assets EOY USD." },
      total_assets_eoy_max_usd: { type: "NUMBER", description: "Maximum total assets EOY USD." },
      reserve_months_min: { type: "NUMBER", description: "Minimum reserve months (runway)." },
      reserve_months_max: { type: "NUMBER", description: "Maximum reserve months." },
      board_members_min: { type: "INTEGER", description: "Minimum board / governing count." },
      board_members_max: { type: "INTEGER", description: "Maximum board count." },
      employees_min: { type: "INTEGER", description: "Minimum employees." },
      employees_max: { type: "INTEGER", description: "Maximum employees." },
      volunteers_min: { type: "INTEGER", description: "Minimum volunteers." },
      volunteers_max: { type: "INTEGER", description: "Maximum volunteers." },
      formation_yr_min: { type: "INTEGER", description: "Minimum formation year." },
      formation_yr_max: { type: "INTEGER", description: "Maximum formation year." },
      is_501c3: { type: "BOOLEAN", description: "True = only 501(c)(3); false = exclude 501(c)(3)." },
      has_website: { type: "BOOLEAN", description: "True = filing lists a website." },
      has_mission: { type: "BOOLEAN", description: "True = require mission or activity text." },
      sort: {
        type: "STRING",
        description:
          "name | revenue | expenses | tax_yr | ein | net_assets | employees | volunteers | formation_yr | reserve_months | contributions | investment_income | board",
      },
      limit: { type: "INTEGER", description: "Max rows 1–100 (default 25)." },
      offset: { type: "INTEGER", description: "Pagination offset." },
    },
  },
} as const;
