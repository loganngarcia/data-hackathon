# Mission: Moobu — Nonprofit Financial Resilience Platform

> A fully functional local platform under `moobu/` that parses IRS 990 XML filings, computes resilience scores for 1,000+ nonprofits, runs an early-warning engine, serves data via FastAPI, and presents it through an interactive Next.js dashboard — all powered by real data.

## Context

- **Codebase**: Fresh build in `moobu/` subdirectory. Existing `app/` and `pipeline/` stay untouched.
- **Backend**: Python 3.10+ (lxml, DuckDB, scikit-learn/XGBoost, FastAPI)
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + Recharts
- **Storage**: DuckDB (single-file columnar DB)
- **Data source**: ZIP file at `~/Downloads/Hackathon Student Files-20260412T201011Z-3-001.zip` (13,317 XML files, ~1GB). Supplement with AWS S3 `s3://irs-form-990/` for additional years.
- **Build command (backend)**: `cd moobu/api && pip install -e . && uvicorn moobu_api.main:app --reload`
- **Build command (frontend)**: `cd moobu/web && npm run build`
- **Test command (backend)**: `cd moobu/api && python -m pytest`
- **Test command (frontend)**: `cd moobu/web && npm run lint && npm run build`
- **Type-check command**: `cd moobu/web && npx tsc --noEmit`

## Scope

**In scope:**
- XML parsing pipeline for Form 990 (full) filings across multiple years
- Schema harmonization using XPath alias mapping
- DuckDB storage with one-row-per-filing normalized data
- 8-metric Resilience Score engine (0–100 composite)
- Early-Warning Engine (ML classifier or rule-based fallback)
- FastAPI REST API with 5 endpoints matching the spec
- Next.js interactive dashboard with 3 views (Portfolio Overview, Org Deep Dive, Intervention Prioritization)
- Moobu brand styling (#3B69B7 blue, #F5A623 orange, Inter font)
- E2E local verification

**Out of scope:**
- Form 990-PF parsing (different financial universe)
- Form 990-EZ parsing (v1 focuses on full 990 only; add later if time)
- Deployment to Vercel/Railway (local only for now)
- Slide deck, video, or presentation materials (Workstream C is human-led)
- Changes to existing `app/`, `pipeline/`, or `contracts/` directories

## Milestones

### Milestone 1: Project Scaffold & Data Extraction
**Size:** M
**Goal:** `moobu/` directory exists with Python backend and Next.js frontend scaffolds. Raw XML data extracted from ZIP and organized. Branch `sl-init-moobu` created.

**Files to touch:**
- `moobu/api/pyproject.toml` — Python package config with dependencies (lxml, duckdb, fastapi, uvicorn, scikit-learn, pandas, pyarrow)
- `moobu/api/src/moobu_api/__init__.py` — Package init
- `moobu/api/src/moobu_api/main.py` — FastAPI app placeholder
- `moobu/web/package.json` — Next.js project with Tailwind, Recharts, TypeScript
- `moobu/web/src/app/page.tsx` — Root page placeholder
- `moobu/data/raw/` — Extracted XML files organized by year/form

**Steps:**
1. Create and checkout branch `sl-init-moobu` from main
2. Create `moobu/` directory structure (api, web, data, pipeline)
3. Scaffold Python backend with pyproject.toml and FastAPI entry point
4. Scaffold Next.js app with `npx create-next-app@latest`
5. Extract ZIP to `moobu/data/raw/` preserving directory structure
6. Verify XML files are accessible and parseable (spot-check 3 files)

**Acceptance criteria:**
- [ ] `ls moobu/data/raw/` shows XML directories with >5,000 files
- [ ] `cd moobu/api && pip install -e .` succeeds
- [ ] `cd moobu/web && npm install && npm run build` succeeds
- [ ] `python -c "from lxml import etree; etree.parse('moobu/data/raw/...')"` parses a sample XML
- [ ] `git log --oneline -1` shows commit on `sl-init-moobu` branch

---

### Milestone 2: XML Parsing & DuckDB Ingestion
**Size:** L
**Goal:** All Form 990 (full) XMLs parsed into a normalized Parquet/DuckDB table with one row per filing. Schema-harmonized across tax years. Deduped by EIN + tax year.

**Files to touch:**
- `moobu/api/src/moobu_api/parser.py` — XML parsing with lxml, namespace stripping, XPath extraction
- `moobu/api/src/moobu_api/schema.py` — Field mapping (990 XPath → Moobu schema), XPath alias map
- `moobu/api/src/moobu_api/ingest.py` — Batch processing, dedup, Parquet output, DuckDB loading
- `moobu/api/src/moobu_api/db.py` — DuckDB connection and table setup
- `moobu/data/processed/filings.parquet` — Output normalized data
- `moobu/data/moobu.duckdb` — Database file

**Steps:**
1. Build XPath alias map for the 13 target fields (EIN, org name, tax year, total revenue, total expenses, rev less expenses, contributions, program service rev, investment income, other revenue, net assets EOY, program expenses, total functional expenses, state)
2. Parse all Form 990 XMLs, extracting target fields with namespace-aware XPath
3. Handle schema variations across tax years (2019 vs 2025 field names)
4. Deduplicate: keep latest filing per EIN per tax year
5. Write to Parquet, load into DuckDB
6. Validate: row counts, null rates, value distributions

**Acceptance criteria:**
- [ ] `python -c "import duckdb; db=duckdb.connect('moobu/data/moobu.duckdb'); print(db.sql('SELECT COUNT(*) FROM filings'))"` returns >4,000 rows
- [ ] All 13 target fields present in schema
- [ ] Null rate for core financial fields (total_revenue, total_expenses, net_assets_eoy) < 30%
- [ ] `SELECT COUNT(DISTINCT ein) FROM filings` returns >3,000 unique organizations
- [ ] No duplicate EIN + tax_year combinations

---

### Milestone 3: Resilience Score Engine
**Size:** M
**Goal:** Every qualifying nonprofit (4+ years of data) has a composite Resilience Score (0–100) computed from 8 financial metrics. Scores stored in DuckDB.

**Files to touch:**
- `moobu/api/src/moobu_api/scoring.py` — 8 metric computations + composite score
- `moobu/api/src/moobu_api/ingest.py` — Extended to run scoring after ingestion
- DuckDB tables: `org_scores`, `org_metrics`

**Steps:**
1. For each org with multi-year data, compute: Revenue Concentration (HHI), Operating Reserve Ratio, Revenue Growth Trend (CAGR), Expense vs Revenue Growth, Program Expense Ratio, Revenue Volatility, Net Asset Trend, Surplus/Deficit Consistency
2. Normalize each metric 0–10 across the population
3. Weight and combine: revenue concentration + operating reserves at 2x, rest at 1x → composite 0–100
4. Assign tiers: 75–100 Thriving, 50–74 Stable, 25–49 Needs Support, 0–24 Urgent
5. Store per-org scores and per-metric breakdowns in DuckDB
6. If <4 years of data available per org, compute with available data but flag confidence level

**Acceptance criteria:**
- [ ] `SELECT COUNT(*) FROM org_scores` returns >1,000 scored organizations
- [ ] Score distribution spans all 4 tiers (Thriving, Stable, Needs Support, Urgent)
- [ ] `SELECT AVG(composite_score), STDDEV(composite_score) FROM org_scores` shows reasonable distribution (mean ~50, stddev >15)
- [ ] Each org_score row has all 8 metric sub-scores
- [ ] Scores reproducible: running scoring twice gives identical results

---

### Milestone 4: Early-Warning Engine
**Size:** M
**Goal:** An early-warning system identifies nonprofits showing pre-crisis financial patterns. Either ML-based (if enough crisis events) or rule-based fallback. Results stored in DuckDB and surfaced with explanations.

**Files to touch:**
- `moobu/api/src/moobu_api/early_warning.py` — Crisis detection, feature engineering, model training, prediction
- DuckDB tables: `early_warnings`, `crisis_events`

**Steps:**
1. Scan historical data for crisis events: >30% single-year revenue drop
2. If >=30 crisis events found: extract pre-crisis financial profiles (1-2 years before), train Random Forest/XGBoost classifier on pre-crisis vs. stable profiles, score all current-year orgs
3. If <30 crisis events: implement rule-based fallback (reserve ratio <1 month AND revenue declining 2+ years AND high contribution volatility)
4. Generate vulnerability score (0–100%) per nonprofit
5. Surface top factors driving each org's warning score (feature importance or rule explanation)
6. Store results in DuckDB

**Acceptance criteria:**
- [ ] `SELECT COUNT(*) FROM early_warnings WHERE vulnerability_score > 0.5` returns >0 (at-risk organizations identified)
- [ ] Each warning has a list of contributing factors (explainability)
- [ ] `SELECT COUNT(*) FROM crisis_events` shows how many historical crises were found (logged for transparency)
- [ ] Scoring pipeline completes without errors on full dataset

---

### Milestone 5: FastAPI Backend
**Size:** M
**Goal:** 5 REST API endpoints serving nonprofit data, resilience scores, early warnings, and peer comparisons from DuckDB. CORS enabled for frontend.

**Files to touch:**
- `moobu/api/src/moobu_api/main.py` — FastAPI app with CORS, routers
- `moobu/api/src/moobu_api/routes.py` — Endpoint handlers
- `moobu/api/src/moobu_api/models.py` — Pydantic response models
- `moobu/api/src/moobu_api/db.py` — Query layer

**Steps:**
1. Define Pydantic models matching the API contract from the spec
2. Implement `GET /api/nonprofits` — paginated list with filters (state, sector, min_score, search)
3. Implement `GET /api/nonprofit/{ein}` — full profile with 7yr financials, score breakdown, peer group
4. Implement `GET /api/at-risk` — top 100 early-warning orgs with intervention recommendations
5. Implement `GET /api/stats/overview` — totals, score distribution, sector breakdown
6. Implement `GET /api/nonprofit/{ein}/peers` — cluster members with comparative scores
7. Add CORS middleware for localhost:3000
8. Write integration tests against real DuckDB data

**Acceptance criteria:**
- [ ] `curl http://localhost:8000/api/nonprofits | python -m json.tool` returns valid JSON with paginated results
- [ ] `curl http://localhost:8000/api/nonprofit/{ein}` returns a complete org profile with score breakdown
- [ ] `curl http://localhost:8000/api/at-risk` returns ranked list with vulnerability scores and recommendations
- [ ] `curl http://localhost:8000/api/stats/overview` returns summary statistics
- [ ] `curl http://localhost:8000/api/nonprofit/{ein}/peers` returns peer comparison data
- [ ] All 5 endpoints return proper HTTP status codes (200 for success, 404 for not found)
- [ ] CORS headers present in responses

---

### Milestone 6: Next.js Frontend Dashboard
**Size:** L
**Goal:** Interactive dashboard with 3 views powered by the FastAPI backend. Moobu brand styling. Responsive.

**Files to touch:**
- `moobu/web/src/app/page.tsx` — Landing/Portfolio Overview
- `moobu/web/src/app/org/[ein]/page.tsx` — Organization Deep Dive
- `moobu/web/src/app/at-risk/page.tsx` — Intervention Prioritization
- `moobu/web/src/components/` — Reusable components (ScoreCard, FilterBar, TrajectoryChart, MetricBreakdown, PeerComparison, RiskBadge)
- `moobu/web/src/lib/api.ts` — API client functions
- `moobu/web/src/lib/types.ts` — TypeScript interfaces matching API models
- `moobu/web/tailwind.config.ts` — Moobu brand colors
- `moobu/web/src/app/globals.css` — Global styles, Inter font

**Steps:**
1. Configure Tailwind with Moobu brand colors (#3B69B7, #F5A623)
2. Build Portfolio Overview: filterable/sortable table of all nonprofits with color-coded score badges, filters for state/sector/revenue range, search by name/EIN, summary stats bar
3. Build Organization Deep Dive: 7-year financial trajectory chart (Recharts), resilience score breakdown by metric, early-warning indicators with plain-English explanations, peer comparison
4. Build Intervention Prioritization: ranked list of at-risk orgs, sorted by early warning + positive trajectory, intervention recommendations per org
5. Wire API client to FastAPI backend (configurable base URL via env var)
6. Add responsive breakpoints (1440, 1024, 768)
7. Add loading states and error handling

**Acceptance criteria:**
- [ ] `cd moobu/web && npm run build` succeeds with zero TypeScript errors
- [ ] `cd moobu/web && npm run lint` passes
- [ ] Portfolio Overview renders with real nonprofit data from API
- [ ] Clicking a nonprofit row navigates to its Deep Dive page with 7-year trajectory chart
- [ ] Intervention Prioritization page shows ranked list with risk scores
- [ ] All views use Moobu brand colors (blue #3B69B7 for structure, orange #F5A623 for risk)
- [ ] Responsive at 1440px, 1024px, and 768px widths

---

### Milestone 7: Integration & E2E Verification
**Size:** M
**Depends on:** All previous milestones
**Goal:** Everything works together end-to-end. Backend serves real data, frontend consumes it, all views functional. PR opened for review.

**Acceptance criteria:**
- [ ] FastAPI server starts: `cd moobu/api && uvicorn moobu_api.main:app` runs without errors
- [ ] Next.js dev server starts: `cd moobu/web && npm run dev` runs without errors
- [ ] Portfolio Overview loads with >1,000 nonprofits from API
- [ ] Organization Deep Dive shows real 7-year financial data and resilience score
- [ ] At-risk view shows early-warning organizations with explanations
- [ ] API returns data in <2 seconds for all endpoints
- [ ] `cd moobu/web && npm run build` succeeds (production-ready)
- [ ] `cd moobu/api && python -m pytest` passes all tests
- [ ] All changes committed on `sl-init-moobu` branch
- [ ] PR opened against `main` with summary of what was built

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Only 2 years of full 990 data in ZIP (2019 + 2025) — not enough for 7-year longitudinal analysis | **HIGH** | Supplement with AWS S3 public IRS 990 data (`s3://irs-form-990/`) for years 2017-2024. If S3 is slow, compute scores with available years and flag confidence level. |
| XML schema variations across tax years break parsing | **HIGH** | Build an XPath alias map for the 13 target fields. Test against samples from each year. Fall back to IRSx library if manual mapping fails. |
| Not enough historical crisis events (<30) for ML classifier | **MEDIUM** | Use rule-based fallback: reserve ratio <1 month AND revenue declining 2+ years AND high contribution volatility. Still compelling and defensible. |
| DuckDB performance on 5,000+ filings | **LOW** | DuckDB handles millions of rows. The dataset is well within limits. |
| S3 data download takes too long | **MEDIUM** | Download a targeted subset (e.g., 10,000 filings across 5 years) rather than the full corpus. Prioritize organizations that overlap with the ZIP data for longitudinal continuity. |
| Frontend-backend schema drift during parallel development | **LOW** | API contract defined upfront in Pydantic models. TypeScript interfaces generated from or aligned to the same contract. |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Fresh build in `moobu/` rather than refactoring existing code | User preference. Existing `app/` and `pipeline/` have a different product shape (screener/detail/scenario vs. resilience/early-warning/intervention). Clean start avoids conflating two design visions. |
| Follow the spec's API contract, not existing contracts | User preference. The spec defines a resilience-focused product with 5 clear endpoints. The existing contracts are for a different UX flow. |
| Focus on Form 990 full only (skip 990-EZ and 990-PF) | Per spec: 990-PF is a different financial universe. 990-EZ adds complexity with different XML field names for limited additional coverage. |
| DuckDB over PostgreSQL | Per spec. Single-file, no server process, fast analytical queries, native Parquet support. Perfect for hackathon. |
| FastAPI over Next.js API routes for backend | Per spec. Python backend keeps data processing, ML, and API in one language. FastAPI's async + Pydantic validation is production-quality. |
| Supplement ZIP data with AWS S3 | The ZIP only has 2 years of full 990 data. Resilience scoring requires 4+ years. S3 has 2011-present data. |
| Recharts for frontend charts | Per spec. React-native charting library, good TypeScript support, easy trajectory + bar charts. |
| Local-only deployment | User preference. Deploy is a separate concern after core functionality works. |
