# Architecture Summary

## System Overview

Tipping Point is a three-layer system: a Python analytics pipeline that processes IRS 990 XML filings into scored, structured artifacts; a set of precomputed JSON files that serve as the data contract between analytics and presentation; and a Next.js frontend that renders a three-screen decision workflow for funders and advisors.

The architecture is designed for demo reliability. The frontend consumes static JSON artifacts, not a live API, so the demo path never depends on runtime computation. The Python pipeline runs offline to produce those artifacts, and the frontend reads them at build time or from local fixtures.

```
IRS 990 XML corpus
    |
    v
Python pipeline (lxml, pandas)
    |  normalize -> feature engineer -> score -> explain -> scenario simulate
    v
Precomputed JSON artifacts (5 typed interfaces)
    |
    v
Next.js frontend (TypeScript, React 19, Tailwind)
    |  Portfolio Screener -> Organization Detail -> Scenario + Memo
    v
Judge-facing demo (Vercel or localhost)
```

## Data Flow

**Stage 1: Ingestion.** Raw IRS 990 XML files (Form 990 and 990-EZ, excluding 990-PF) are parsed with `lxml`. Schema drift across tax years is resolved using an XPath alias map derived from the Nonprofit Open Data Collective Master Concordance File. Each filing becomes one row keyed by EIN and tax year. Output: a normalized Parquet table, one row per org-year.

**Stage 2: Panel construction.** Filings are deduplicated (latest amended return per EIN per year), joined across years, and filtered to organizations with at least four years of data. Missing financial fields are not imputed. Revenue outliers beyond the 99.5th percentile are capped. The result is a canonical org-year panel covering seven fiscal years.

**Stage 3: Feature engineering.** The pipeline computes lagged, rolling, ratio, and peer-relative features from the canonical panel. Each feature carries explicit metadata marking it as observed or derived. Features feed directly into the scoring model.

**Stage 4: Scoring.** The eight-signal resilience model (see below) produces a composite score from 0 to 100 for every qualifying organization, plus a tipping-risk flag and top-driver explanations.

**Stage 5: Scenario simulation.** Controlled intervention levers (reserve grant, revenue diversification, margin improvement, staffing stabilization) recompute projected score deltas. Every scenario output is labeled as a forecast, not a causal claim.

**Stage 6: Artifact generation.** The pipeline writes typed JSON files conforming to the five data-contract interfaces. The frontend consumes these directly.

## The Eight-Signal Scoring Model

Each signal is normalized to a 0-10 scale. Revenue concentration and operating reserves are weighted at 2x. The weighted sum produces a composite score from 0 to 100, bucketed into four tiers.

| # | Signal | Source | Weight | What it measures |
|---|--------|--------|--------|-----------------|
| 1 | Revenue growth | CAGR of total revenue across available years | 1x | Trajectory direction |
| 2 | Revenue volatility | Standard deviation of annual total revenue | 1x | Predictability of the funding base |
| 3 | Operating stability | Expense-to-revenue growth differential (YoY) | 1x | Whether costs are outpacing income |
| 4 | Liquidity / reserves | Net assets EOY divided by total functional expenses | 2x | Months of runway at zero income |
| 5 | Concentration risk | HHI across revenue streams (contributions, program, investment, other) | 2x | Single-source dependency |
| 6 | Net asset trend | Year-over-year direction of net assets | 1x | Balance sheet erosion or growth |
| 7 | Employee stability | Headcount consistency across filings | 1x | Organizational continuity |
| 8 | Shock recovery | Surplus/deficit consistency (positive vs. negative years) | 1x | Structural deficit patterns |

**Tiers:** Foundation (75-100), Steady (50-74), Watch (25-49), At Risk (0-24). The demo uses a simplified four-band scheme: Foundation, Steady, Watch, At Risk.

## Data Contract

The pipeline and frontend share five typed interfaces defined in `contracts/hackathon-contracts.ts`. The Python pipeline writes JSON conforming to these shapes; the frontend consumes them with no transformation.

| Interface | Purpose | Key fields |
|-----------|---------|------------|
| `ScreenerRow` | One row in the portfolio screener table | EIN, org name, revenue, growth rate, reserve months, risk band, composite score, flags |
| `OrgDetail` | Full organization profile for the detail screen | Revenue mix breakdown, top signals, watchouts, peer benchmarks, narrative summary |
| `ScenarioResult` | Output of one intervention simulation | Scenario title, assumption, projected reserve/growth, risk shift, recommendation, evidence |
| `MemoContext` | Framing for the advisor memo | Audience, ask, time horizon, constraints, talk track |
| `HeroCaseStudy` | Anchor case for the demo narrative | Headline, one-liner, outcome, why it matters |

## Copilot Layer

The copilot supports four deterministic intents:

1. **Why flagged** -- explain why an organization received its risk band.
2. **What changed** -- summarize the multi-year trajectory in plain language.
3. **Best intervention** -- recommend the highest-leverage scenario lever.
4. **Draft memo** -- produce an advisor-ready recommendation paragraph.

Each intent has a deterministic template fallback that consumes the structured evidence objects from the data contract. The optional upgrade path uses Fireworks-hosted Qwen for more natural narrative generation, but the system remains fully functional without any external LLM calls. Every copilot output includes explicit checks against hallucination and mismatch with the structured evidence.

## Design Decisions

**Precomputed JSON over live API.** The demo runs from static artifacts so reliability during the five-minute video is guaranteed. No network calls, no cold starts, no runtime failures. The pipeline produces the artifacts once; the frontend reads them deterministically.

**Deterministic fallbacks for every copilot output.** If the Fireworks API is unavailable, the app still renders complete recommendations and memos from template-based generation. Judges never see an error state.

**Three-screen scope lock.** The frontend is restricted to three screens: Portfolio Screener, Organization Detail, and Scenario + Memo. This constraint keeps the demo narrative tight and prevents scope creep into features that do not serve the five-minute story.

**990-PF exclusion.** Private foundations have a fundamentally different financial structure (investment income dominant, different filing fields). Mixing them with public charities in the same scoring model would produce misleading comparisons. They are excluded from v1 entirely.

**No imputation of financial fields.** Missing 990 values are left missing rather than imputed, because invented financial data would undermine the credibility of the scoring model with judges. Organizations need at least four years of data to receive a score.

## Stack

| Layer | Technology |
|-------|-----------|
| Data ingestion | Python 3.10+, lxml, pandas |
| Storage | Parquet files, DuckDB for analytical queries |
| Scoring | Python, scikit-learn (Random Forest / XGBoost for early-warning classifier) |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Contracts | TypeScript interfaces shared between pipeline output and frontend input |
| Deployment | Vercel (frontend), local execution (pipeline) |
