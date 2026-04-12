# Aggies Data Hackathon frontend

**Stack:** Next.js, **TypeScript**, and **Vercel** as the deployment target for this demo.

This folder contains a mocked three-screen flow:

1. Portfolio Screener
2. Organization Detail
3. Scenario + Memo

## Run locally

From the repository root:

```bash
cd app
npm install
npm run dev
```

Open http://localhost:3000 and stop with `Ctrl+C`.

## Deploy (Vercel)

Use the [Vercel CLI](https://vercel.com/docs/cli) or connect the repo in the Vercel dashboard. Agents working in Cursor should use the **Vercel MCP** configured at the repo root (`.cursor/mcp.json`, server URL `https://mcp.vercel.com`) for projects, deployments, logs, and docs instead of guessing.

## Useful commands

```bash
npm run dev
npm run build
npm run lint
npm run start
```

## Notes

- The UI is driven by typed fixtures in `src/lib/mock-data.ts`.
- The contract shapes in `../contracts/hackathon-contracts.ts` are the intended backend handoff boundary when present.
- The current flow is presentation-first so the demo works before ingestion or API work is live.
