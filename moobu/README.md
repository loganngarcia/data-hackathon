# Moobu — Nonprofit Financial Resilience Platform

Moobu analyzes IRS 990 filings to score the financial resilience of nonprofits and identify organizations that would benefit most from targeted support.

**7,798 nonprofits scored** | **703 at-risk identified** | **368 crisis events detected**

## Quick Start (Local Development)

### Prerequisites
- Python 3.10+
- Node.js 20+
- npm

### 1. Backend (FastAPI)

```bash
cd moobu/api
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn moobu_api.main:app --port 8000
```

Verify: [http://localhost:8000/api/health](http://localhost:8000/api/health) should return `{"status":"ok"}`

### 2. Frontend (Next.js)

Open a **second terminal**:

```bash
cd moobu/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database

The DuckDB file at `moobu/data/moobu.duckdb` is pre-built with all scored data. No ingestion step needed — just start the API and it connects automatically.

If you need to rebuild from raw XML data:

```bash
cd moobu/api
source .venv/bin/activate
python -m moobu_api.ingest        # Parse XML -> DuckDB
python -m moobu_api.scoring       # Compute resilience scores
python -m moobu_api.early_warning  # Run early-warning engine
```

## Architecture

| Layer | Technology |
|-------|-----------|
| Data Parsing | Python + lxml (IRS 990 XML -> Parquet -> DuckDB) |
| Storage | DuckDB (single-file, 8.3MB) |
| Scoring | 8-metric weighted Resilience Score (0-100) |
| Early Warning | Rule-based crisis pattern detection |
| API | FastAPI (5 REST endpoints) |
| Frontend | Next.js 16 + TypeScript + Tailwind + Recharts |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nonprofits` | Paginated list with filters (state, tier, score, search) |
| GET | `/api/nonprofit/{ein}` | Full profile with financials and score breakdown |
| GET | `/api/at-risk` | Top 100 at-risk orgs with factors and recommendations |
| GET | `/api/stats/overview` | Aggregate statistics and distributions |
| GET | `/api/nonprofit/{ein}/peers` | Peer comparison by state and revenue |

## Deployment

- **Frontend**: Deployed on Vercel (set `NEXT_PUBLIC_API_URL` env var to backend URL)
- **Backend**: Deployed on Render with Docker (DuckDB baked into image)

## Team

Logan Garcia, Sheryn Liao, Udita Saha — Aggies Data Hackathon 2026
