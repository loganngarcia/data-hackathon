# Moobu

**Helping every nonprofit build the financial resilience to thrive.**

Aggies Data Hackathon 2026 · April 12–14
Logan Garcia · Sheryn Liao · Udita Saha
Stack: Python (FastAPI) + Next.js (TypeScript) + DuckDB

---

### Brand

| Element | Value |
|---------|-------|
| Blue | `#3B69B7` (Fairlight blue — buttons, headers, primary accents) |
| Orange | `#F5A623` (Fairlight orange — alerts, risk indicators, CTAs) |
| Font | Inter or system sans-serif |

Use blue for structure and trust. Use orange for danger, risk, and things that need attention. The color pairing should feel like a financial tool, not a startup landing page.

---

## 1. The WOW Moment

Everything we build exists to serve one moment in our 5-minute video. This is what makes judges lean forward.

> **"We analyzed 7 years of IRS 990 filings and identified 47 nonprofits that could be strengthened right now — organizations with strong missions and early warning signs that match the patterns of past financial crises. Moobu spots these signals up to 2 years ahead, giving advisors the time to intervene. This is where targeted support has the highest return on impact."**
>
> *Live demo: Click any nonprofit → 7-year trajectory → resilience score → risk signals → peer comparison → intervention recommendation.*

This is not a retrospective dashboard. This is a **forward-looking resilience platform** that gives advisors like Fairlight the information they need to protect nonprofits before a crisis hits. That's our edge over every team building charts of historical data.

---

## 2. Working Backwards: The Press Release

We start with the press release for the finished product. Then we figure out what we need to build to make it true.

> ### Moobu: Giving Nonprofits the Financial Visibility to Thrive
>
> **Davis, CA — April 14, 2026** — A team of UC Davis data scientists unveiled Moobu, a platform that scores the financial resilience of every nonprofit in the IRS 990 database and identifies which organizations would benefit most from targeted support — up to two years before a financial crisis could occur.
>
> **The problem:** 96% of nonprofits cannot accumulate investment reserves. When a major grant disappears or a revenue stream shifts, organizations doing vital work can find themselves in crisis within a single fiscal year. Advisors and donors currently have no systematic way to identify where proactive support would make the biggest difference.
>
> **What Moobu does:** Analyzes 7 years of IRS 990 filings across three form types (990, 990-EZ, 990-PF) to compute a composite Resilience Score for each organization. The platform's early-warning engine identifies organizations whose financial trajectory suggests they're entering a vulnerable period — and surfaces them while there's still time for meaningful intervention.
>
> An advisor opens the dashboard, filters by sector or geography, immediately sees which organizations are thriving, which are stable, and which would benefit most from support. Then she drills into any one to see its full trajectory, peer comparison, and specific areas where intervention would strengthen resilience.
>
> *"Every nonprofit deserves to see what's coming. Moobu gives advisors the visibility to help them get ahead of it."*

---

## 3. Target Persona

**Primary:** Maya, a financial advisor at Fairlight Advisors. She manages 200+ nonprofit clients and needs to identify which ones would benefit from proactive support. She currently reviews 990s manually in spreadsheets. She wants patterns, not numbers.

**Secondary:** A program officer at a foundation deciding where to allocate $5M in grants for maximum impact. She needs to understand which applicants are financially resilient and which could be strengthened with targeted funding.

**The job to be done:** Go from "10,000 nonprofits" to "these 47 would benefit most from support right now" in under 60 seconds.

---

## 4. Product Features

### Feature 1: Resilience Score Engine

A composite score (0–100) for every nonprofit, built from 8 financial metrics extracted from 990 XML data.

#### The 8 Metrics

| # | Metric | 990 XML Source | Why It Matters |
|---|--------|---------------|----------------|
| 1 | **Revenue Concentration (HHI)** | CYContributionsGrantsAmt, CYProgramServiceRevenueAmt, CYInvestmentIncomeAmt, CYOtherRevenueAmt | One funding source = fragile |
| 2 | **Operating Reserve Ratio** | NetAssetsOrFundBalancesEOYAmt / TotalFunctionalExpensesAmt | How many months can you survive with zero income? |
| 3 | **Revenue Growth Trend** | CYTotalRevenueAmt across 7 years (CAGR) | Are you growing or shrinking? |
| 4 | **Expense vs Revenue Growth** | CYTotalExpensesAmt vs CYTotalRevenueAmt (YoY delta) | Costs outpacing income = unsustainable |
| 5 | **Program Expense Ratio** | TotalProgramServiceExpensesAmt / TotalFunctionalExpensesAmt | Is the money going to the mission or to overhead? |
| 6 | **Revenue Volatility** | Std deviation of CYTotalRevenueAmt over 7 years | Wild swings = unpredictable = risky |
| 7 | **Net Asset Trend** | NetAssetsOrFundBalancesEOYAmt year-over-year | Is the financial foundation growing or eroding? |
| 8 | **Surplus/Deficit Consistency** | CYRevenuesLessExpensesAmt (positive vs negative years) | Chronic deficits signal structural challenges |

**Scoring:** Normalize each metric 0–10, weight by importance (revenue concentration and operating reserves at 2x), sum to 0–100. Tiers: 75–100 Thriving (green), 50–74 Stable (yellow), 25–49 Needs Support (orange), 0–24 Urgent (red).

### Feature 2: Early-Warning Engine

The thing no other team will build. We look at nonprofits that went through sudden financial crises in the past and learn the early warning signs — so we can identify organizations showing those same signs today, while there's still time to help.

1. **Find historical crises.** Scan 7 years of data for >30% single-year revenue drops.
2. **Capture the early signals.** For each crisis, grab the org's financial profile 1–2 years *before* the drop.
3. **Train a classifier.** Random Forest or XGBoost on pre-crisis vs. stable financial profiles.
4. **Score everyone.** Run the model on the latest year's data. Output: vulnerability score (0–100%) per nonprofit.
5. **Surface and explain.** Orgs showing early warning signs get surfaced with the specific factors driving their score.

**Fallback if we don't find enough historical crises (<30):** Rule-based detection — reserve ratio <1 month AND revenue declining 2+ consecutive years AND high contribution volatility. Still compelling, still defensible.

### Feature 3: Interactive Dashboard (Next.js)

Three views:

**Portfolio Overview** — Filterable, sortable table of all nonprofits. Color-coded score badges. Filters for NTEE code, state, revenue range. Search by name or EIN. Summary stats at the top.

**Organization Deep Dive** — Click any row. 7-year financial trajectory chart. Resilience Score breakdown by metric. Early-warning indicators with plain-English explanations. Peer comparison against similar orgs.

**Intervention Prioritization** — Ranked list of orgs where targeted support would have the greatest impact. Sorted by: early warning signals + positive trajectory signs (orgs already working to improve). Each entry gets a recommendation: diversify revenue, build reserves, optimize operations.

---

## 5. Data Architecture and Cleaning

### Source Data

The dataset lives in the "Hackathon Student Files" Google Drive folder (owned by jrenneisen@ucdavis.edu):

```
Hackathon Student Files/
├── IRS990Data/
│   └── XML Files/
│       ├── 2019_990/          # Form 990 full returns, 2019
│       ├── 2019_990PF/        # Form 990-PF private foundations, 2019
│       ├── 2020_990/          # Form 990 full returns, 2020
│       └── 2025_990PF/        # Form 990-PF private foundations, 2025
├── 2024_990T/                 # Form 990 full returns, 2024
├── 2025_990T/                 # Form 990 full returns, 2025
├── 2025_990EZ/                # Form 990-EZ short form, 2025
└── 2025_990PF/                # Form 990-PF private foundations, 2025
```

**Status at kickoff:** 2019 and 2020 data available now. The year-specific folders (2024, 2025) appear empty — organizers said data drops within 48 hours. Start parsing what's available, incorporate new data as it lands.

**Fallback:** Public IRS 990 data on AWS S3 (`s3://irs-form-990/`), covering 2011–present.

### The Three Form Types

| Form | Who Files | Variables | Notes |
|------|-----------|-----------|-------|
| **990 (Full)** | >$200K gross receipts OR >$500K assets | ~5,000 | Richest data. Part VIII (revenue), Part IX (expenses), Part X (balance sheet). |
| **990-EZ** | <$200K gross receipts AND <$500K assets | ~1,800 | Simplified. ~1,700 fields overlap with full 990 but use different XML names. |
| **990-PF** | Private foundations | ~3,000 | Different financial structure entirely. Investment income dominant. Exclude from v1. |

### XML Structure

Each file = one nonprofit's annual filing:

```xml
<Return>
  <ReturnHeader>
    <Filer>
      <EIN>123456789</EIN>
      <BusinessName>
        <BusinessNameLine1Txt>Example Nonprofit</BusinessNameLine1Txt>
      </BusinessName>
      <USAddress>
        <StateAbbreviationCd>CA</StateAbbreviationCd>
      </USAddress>
    </Filer>
    <TaxYr>2025</TaxYr>
  </ReturnHeader>
  <ReturnData>
    <IRS990>
      <CYTotalRevenueAmt>1500000</CYTotalRevenueAmt>
      <CYTotalExpensesAmt>1400000</CYTotalExpensesAmt>
      ...
    </IRS990>
  </ReturnData>
</Return>
```

**The catch:** The IRS changes XML schemas across tax years. `CYTotalRevenueAmt` in 2020 might be `TotalRevenueCurrentYearAmt` in 2019. The Master Concordance File (Nonprofit Open Data Collective) maps ~10,000 XPaths across all schema versions. Use it.

### Field Mapping

| Field | XPath (Form 990) | 990-EZ Equivalent |
|-------|-------------------|-------------------|
| **EIN** | `/ReturnHeader/Filer/EIN` | Same |
| **Org Name** | `/ReturnHeader/Filer/BusinessName/BusinessNameLine1Txt` | Same |
| **Tax Year** | `/ReturnHeader/TaxYr` or `TaxPeriodEndDt` | Same |
| **Total Revenue** | `/IRS990/CYTotalRevenueAmt` | `TotalRevenueAmt` |
| **Total Expenses** | `/IRS990/CYTotalExpensesAmt` | `TotalExpensesAmt` |
| **Rev Less Expenses** | `/IRS990/CYRevenuesLessExpensesAmt` | `ExcessOrDeficitForYearAmt` |
| **Contributions/Grants** | `/IRS990/CYContributionsGrantsAmt` | `ContributionsGiftsGrantsEtcAmt` |
| **Program Service Rev** | `/IRS990/CYProgramServiceRevenueAmt` | `ProgramServiceRevenueAmt` |
| **Investment Income** | `/IRS990/CYInvestmentIncomeAmt` | `InvestmentIncomeAmt` |
| **Other Revenue** | `/IRS990/CYOtherRevenueAmt` | `OtherRevenueTotalAmt` |
| **Net Assets EOY** | `/IRS990/NetAssetsOrFundBalancesEOYAmt` | `NetAssetsOrFundBalancesEOYAmt` |
| **Program Expenses** | `/IRS990/TotalProgramServiceExpensesAmt` | `TotalProgramServiceExpensesAmt` |
| **Total Func. Expenses** | `/IRS990/TotalFunctionalExpensesAmt` | `TotalExpensesAmt` (combined) |
| **State** | `/ReturnHeader/Filer/USAddress/StateAbbreviationCd` | Same |

### Cleaning Plan

990 data is a mess. The organizers warned us. Here's how we handle it:

**1. XML Parsing** — Use `lxml` (fast). Strip IRS namespaces. Build an XPath alias map using the Master Concordance File, or use the `IRSx` library which handles versioned resolution out of the box. Output: one Parquet file, one row per filing.

**2. Dedup** — Keep only the latest filing per EIN per tax year (amended returns exist). Join across years on EIN.

**3. Missing Data** — Expect 15–25% missing values (worse for 990-EZ). Do NOT impute financial fields. Require 4+ years of data for a Resilience Score. Flag confidence: High (6–7yr), Medium (4–5yr), Low (<4yr, excluded).

**4. Outliers** — Cap at 99.5th percentile for scoring. Flag >1000% YoY revenue changes (data entry errors or mergers). Separate 990-PF entirely — different financial universe.

**5. Schema Harmonization** — Map 990 and 990-EZ field names to a common Moobu schema. Keep raw form type for traceability. Exclude 990-PF from v1.

---

## 6. Technical Architecture

| Layer | Technology | Details |
|-------|-----------|---------|
| **Data Ingestion** | Python + lxml | Parse 990 XML → Parquet. Namespace handling, XPath aliasing. Optionally IRSx. |
| **Storage** | DuckDB | Columnar, analytical, single-file DB. Loads Parquet natively. |
| **Scoring** | Python + scikit-learn | Resilience Score (weighted metrics) + Early-Warning (Random Forest / XGBoost). |
| **API** | FastAPI | JSON REST endpoints. CORS for Vercel. |
| **Frontend** | Next.js + TypeScript | Recharts, Tailwind. Three views. |
| **Deploy** | Vercel + Railway | Free tiers. Live URL for judges. |

### API Contract

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/nonprofits` | Paginated list. Filters: `?state=CA&sector=education&min_score=50` |
| GET | `/api/nonprofit/{ein}` | Full profile: 7yr financials, score breakdown, cliff risk, peer group |
| GET | `/api/at-risk` | Top 100 orgs showing early warning signs, with intervention recommendations |
| GET | `/api/stats/overview` | Totals, score distribution, sector breakdown |
| GET | `/api/nonprofit/{ein}/peers` | Cluster members with comparative scores |

---

## 7. Agent Workstreams

All engineering is done by AI coding agents (Claude Code, Codex). The team focuses on data exploration, model design decisions, storytelling, and presentation. The agents execute.

### Workstream A: Data + Model

**Agents:** Data parsing agent, ML agent, API agent

**Tasks:**
1. Download and inventory all XML files from Google Drive
2. Build parsing pipeline (lxml + namespace handling + XPath alias map)
3. Parse all available years → Parquet → DuckDB
4. Dedup, clean, handle missing data, harmonize schemas
5. Compute 8 resilience metrics for all qualifying orgs
6. Build composite Resilience Score (tune weights, validate distribution)
7. Identify historical crisis events, train early-warning classifier, generate predictions
8. Build FastAPI endpoints, connect to DuckDB, deploy to Railway

**Gate:** All 5 API endpoints return valid JSON, Resilience Scores cover 1,000+ orgs, early-warning model produces scores.

### Workstream B: Frontend + UX

**Agents:** Frontend agent, integration agent

**Tasks:**
1. Scaffold Next.js + Tailwind with TypeScript interfaces matching API contract
2. Build Portfolio Overview (table, filters, score badges, stats bar) with mock data
3. Build Organization Deep Dive (trajectory chart, score breakdown, risk factors)
4. Build Intervention Prioritization (ranked list, recommendations)
5. Wire in Moobu brand colors (`#3B69B7` blue, `#F5A623` orange)
6. Add responsive breakpoints (1440, 1024, 768)
7. Swap mock data for live API when Workstream A deploys
8. Deploy to Vercel

**Gate:** All three views functional with real data at a public URL.

### Workstream C: Storytelling (Human-led)

**Owners:** Logan, Sheryn, Udita

**Tasks:**
1. Explore the data as it's parsed — look for surprising patterns and good stories
2. Pick 2–3 real nonprofits from the data to feature in the presentation
3. Build slide deck (10–15 slides): Problem → Insight → Solution → Live Demo → Impact
4. Record 5-minute video (30s problem, 60s solution, 120s live demo, 60s insights, 30s impact)
5. Write GitHub README with screenshots and methodology
6. Polish dashboard for demo-readiness (loading states, fallback data)

### Integration Contract

Both agent workstreams share the API contract (Section 6) as their handshake. Workstream B builds against mock JSON that matches the contract exactly. When Workstream A's API goes live, integration = changing one base URL.

### Dependency Graph

```
A1 (download data) ──→ A2 (parse XML) ──→ A3 (clean + DuckDB) ──→ A4 (metrics)
                                                                      ↓
                                                          ┌── A5 (Resilience Score)
                                                          ├── A6 (Early-Warning Engine)
                                                          └── A7 (FastAPI + deploy)
                                                                      ↓
B1 (scaffold) ──→ B2 (Overview) ──→ B3 (Deep Dive) ──→ B4 (Intervention) ──→ B5 (Integration + deploy)
                                                                                        ↓
                                                                              C1 (Storytelling + Video)
```

A and B run in parallel from the start. B uses mock data until A7 ships. C runs alongside everything — the team explores data and builds narrative as the agents build code.

---

## 8. Judging Alignment

| Category | Weight | How Moobu scores |
|----------|--------|-----------------|
| **Financial Insights** | 40% | 8-metric Resilience Score from deep 990 analysis. Early-Warning Engine as a predictive insight. Peer benchmarking for context. HHI for revenue concentration. 7-year longitudinal trends. |
| **Solution Development** | 60% | Deployed full-stack web app. ML model with eval metrics. Interactive dashboard. Clean API. Intervention recommendations an advisor could act on. |

---

## 9. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| XML parsing bogs down in schema variations | **HIGH** | Start with full 990 only. Add 990-EZ if time. Skip 990-PF. Use IRSx or Master Concordance File. |
| Not enough crisis events to train a classifier | MEDIUM | Lower threshold to 20%. Fall back to rule-based detection if <30 events. |
| Drive data still uploading | MEDIUM | Start with 2019/2020. Backfill from AWS S3 public dataset. |
| Frontend-backend integration breaks | LOW | Contract defined upfront. Worst case: demo with mock data, explain model in slides. |
| Video/slides time crunch | MEDIUM | Hard code freeze well before deadline. Final stretch = storytelling only. |

---

## 10. Definition of Done

Moobu ships when:

1. Resilience Scores computed for 1,000+ nonprofits across 4+ years
2. Early-Warning Engine running (ML or rule-based fallback)
3. Dashboard live at a public URL judges can click through
4. All three views working with real data
5. Slide deck done (10–15 slides, PDF)
6. Video done (5 minutes: problem → solution → live demo → insights → impact)
7. Code on public GitHub with README and methodology docs
8. At least one compelling headline number in the presentation ("47 orgs where targeted support would make the biggest difference")
