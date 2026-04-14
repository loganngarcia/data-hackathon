# Tipping Point: Nonprofit Resilience Copilot

This repository is the execution workspace for the Aggies Data Hackathon 2026 project focused on identifying financially resilient nonprofits, spotting tipping-risk organizations, and simulating interventions using IRS 990 filing data.

## Project Shape

- `pipeline/`: Python data pipeline for inventory, normalization, features, scoring, and scenario artifacts.
- `app/`: Next.js + TypeScript demo app for the three-screen judge flow.
- `contracts/`: Shared artifact definitions between analytics outputs and the frontend.
- `data/raw/`: Local mirror location for raw XML files from the Google Drive corpus.
- `data/processed/`: Generated canonical tables, scores, scenarios, and case-study artifacts.
- `docs/`: Submission, judging, demo, and execution support materials.

## Source Data

The raw dataset lives in the Codex-accessible Google Drive folder `Hackathon Student Files`.

Known dataset structure:

- `Hackathon Student Files/IRS990Data/XML Files`
- `Hackathon Student Files/2025_990PF`
- `Hackathon Student Files/2025_990T`
- `Hackathon Student Files/2024_990T`

The repository is being structured so the pipeline can consume a reproducible local mirror under `data/raw/` while preserving the Google Drive source-of-truth path.

## Deliverable Targets

- Financial insight quality aligned to the 40% judging component
- Product/storytelling quality aligned to the 60% judging component
- Round-one package: code, slide deck, and five-minute demo video
- Presentation-friendly app flow with only three screens:
  - `Portfolio Screener`
  - `Organization Detail`
  - `Scenario + Memo`

## Current Status

- Execution plan established in `agent-first-hackathon-plan.md`
- Google Drive corpus location confirmed
- Parallel scaffolding underway for data, app, and submission workstreams

## Run The App

### Prerequisites

- `Node.js` 20 or newer
- `npm`

### Step By Step

1. Open a terminal.
2. Go to the frontend app directory:

   ```bash
   cd /Users/sherynliao/projects/data-hackathon/app
   ```

3. Install dependencies the first time you run the app:

   ```bash
   npm install
   ```

4. Start the local development server:

   ```bash
   npm run dev
   ```

5. Open the app in your browser:

   ```text
   http://localhost:3000
   ```

6. Click through the mocked three-screen demo:
   - `Portfolio Screener`
   - `Organization Detail`
   - `Scenario + Memo`

7. Stop the server when you are done by pressing `Ctrl+C` in the terminal.

### Useful Commands

- Run the dev server:

  ```bash
  npm run dev
  ```

- Run a production build check:

  ```bash
  npm run build
  ```

- Run linting:

  ```bash
  npm run lint
  ```

- Start the production server after building:

  ```bash
  npm run start
  ```

### Notes

- Portfolio data comes from **`/api/portfolio-data`** (Worker TEOS / D1), not local fixtures.
- The typed backend handoff contract lives in `contracts/hackathon-contracts.ts`.
- If port `3000` is already in use, Next.js will usually offer the next available port in the terminal output.
