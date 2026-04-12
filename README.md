# Tipping Point

**Helping every nonprofit build the financial resilience to thrive.**

Tipping Point turns seven years of IRS 990 filings into a resilience score, a tipping-risk flag, and a scenario-backed advisor memo -- so funders know which nonprofit to support now and why.

Built for the Aggies Data Hackathon 2026 by Logan Garcia, Sheryn Liao, and Udita Saha.

---

## What It Does

Nonprofit leaders and funders make high-stakes decisions with incomplete information. IRS Form 990 is public, but raw filings are hard to use. Tipping Point closes that gap with three capabilities:

1. **Portfolio screening.** Rank nonprofits by financial resilience using a composite score derived from eight signals across seven years of filings. Sort by risk band, filter by sector or geography, and identify which organizations need attention.

2. **Organization-level explanation.** For any nonprofit, see the revenue mix, peer benchmarks, top signals, and watchouts that explain the score. Every ranking is interpretable, not a black box.

3. **Scenario simulation and advisor memo.** Test interventions (reserve grants, revenue diversification, staffing changes) and see how the projected score shifts. Generate a recommendation memo grounded in structured evidence.

## The Three Screens

The product is scoped to three screens that map to the advisor decision workflow:

- **Portfolio Screener** -- Sort the portfolio, isolate the file worth deeper review.
- **Organization Detail** -- Read the operating story beside the peer frame and the risk flags.
- **Scenario + Memo** -- Translate the evidence into a recommendation the judges can repeat back.

## How It Works

### Data Pipeline

IRS 990 XML filings (Form 990 and 990-EZ) are parsed, normalized across schema versions, deduplicated, and assembled into a canonical org-year panel. Missing financial fields are not imputed. Organizations need at least four years of data to receive a score.

### Eight-Signal Resilience Model

Each nonprofit is scored on eight financial signals:

| Signal | What it measures |
|--------|-----------------|
| Revenue growth | Trajectory direction (CAGR across available years) |
| Revenue volatility | Predictability of the funding base |
| Operating stability | Whether costs are outpacing income |
| Liquidity / reserves | Months of runway at zero income (2x weight) |
| Concentration risk | Single-source dependency via HHI (2x weight) |
| Net asset trend | Balance sheet erosion or growth |
| Employee stability | Organizational continuity |
| Shock recovery | Structural deficit patterns |

Signals are normalized to 0-10, weighted, and summed to a composite 0-100 score. Tiers: Foundation (75-100), Steady (50-74), Watch (25-49), At Risk (0-24).

### Copilot

Four constrained intents (why flagged, what changed, best intervention, draft memo) consume structured evidence from the scoring pipeline. Deterministic template fallbacks ensure the app works without any external LLM calls.

For a deeper look at the system design, see [docs/architecture-summary.md](docs/architecture-summary.md).

## Data Sources

- **Primary:** IRS Form 990 series bulk XML downloads covering seven fiscal years of U.S. public charity filings.
- **Schema resolution:** Nonprofit Open Data Collective Master Concordance File for XPath mapping across tax-year schema versions.
- **Excluded:** Form 990-PF (private foundations) -- different financial structure, incompatible with public charity benchmarking.

## Run Locally

### Prerequisites

- Node.js 20+
- Python 3.10+ (for the analytics pipeline)

### Frontend

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click through the three-screen demo flow.

### Pipeline

```bash
cd pipeline
pip install -e .
hackathon-pipeline --help
```

The pipeline reads raw XML from `data/raw/` and writes scored artifacts to `data/processed/`.

### Project Structure

```
app/                  Next.js frontend (TypeScript, React 19, Tailwind)
pipeline/             Python analytics pipeline (lxml, pandas, scikit-learn)
contracts/            Shared typed interfaces between pipeline and frontend
data/raw/             Local mirror of IRS 990 XML corpus
data/processed/       Generated artifacts (scores, scenarios, case studies)
docs/                 Architecture, pitch brief, demo narrative, judging guidance
```

## Team

| Name | Role |
|------|------|
| **Logan Garcia** | Data pipeline, infrastructure, repository architecture |
| **Sheryn Liao** | Product design, frontend, visual system, storytelling |
| **Udita Saha** | Data analysis, model development, feature engineering |

## License

This project was built for the Aggies Data Hackathon 2026. The underlying IRS 990 data is public.
