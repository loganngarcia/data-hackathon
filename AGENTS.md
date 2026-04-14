AGENT INSTRUCTIONS

Use these agent instructions to help you win the hackathon.

- Use agent skills frequently
- Data hackathon with a curated business case. Final presentation due at April 14 2026 at 10am.
- Judges want real answers. Explain what you did why you chose it.
- Five minute presentation plus five minute Q&A. Three or four slides only. Make slides with Chronicle at https://chroniclehq.com

## App stack (repository)

- The demo app lives in `app/`: **Next.js + TypeScript** (no JavaScript-only source files for app logic; keep `tsconfig` strictness as the project already does).
- **Deployment targets:** Production is split between **Vercel** (Next app) and **Cloudflare** (nonprofit-data Worker + D1). **Always redeploy the side you changed** before considering the task done—do not leave production on stale code.
- **Cloudflare first (Worker):** The Next app calls the Worker at runtime. **Always deploy the Worker to Cloudflare** when `workers/nonprofit-data/` changes (`src/`, `wrangler.toml`, or anything that affects the deployed Worker). From `workers/nonprofit-data/`: **`npm run deploy`** or **`npx wrangler deploy`**. On **GitHub**, pushes to `main`/`master` that touch `workers/nonprofit-data/**` run **`.github/workflows/deploy-cloudflare-worker.yml`** automatically (requires repo secret **`CLOUDFLARE_API_TOKEN`**).
- **Vercel (`app/`):** After **any** change under `app/` (routes, UI, API routes, `lib/`, config). From `app/`: **`npm run deploy:vercel`** (uses `app/.env.local` → `VERCEL_TOKEN`, production deploy, then aliases **`https://nonprofit-ai-data.vercel.app`** to the new deployment). Prefer `vercel.json` / `vercel.ts` and env vars on Vercel for configuration.
- **GitHub → Vercel (automatic):** Pushes to **`main`/`master`** that touch **`app/**`** run **`.github/workflows/deploy-vercel-app.yml`** (production deploy + vanity alias). Requires repo secrets **`VERCEL_TOKEN`**, **`VERCEL_ORG_ID`**, and **`VERCEL_PROJECT_ID`** (from the Vercel project **Settings → General**). If secrets are missing, deploy from your machine with `npm run deploy:vercel` as above.
- **Both in one command:** From `app/`, **`npm run deploy:production`** deploys **Cloudflare Worker then Vercel** (requires `CLOUDFLARE_API_TOKEN` and `VERCEL_TOKEN` in `app/.env.local`). Use this when shipping features that touch **both** the Worker and the Next app so production never skips Cloudflare.

### Tipping Point dashboard UI (merge-friendly)

- **Location:** `app/src/features/tipping-point/` (components + `tipping-point-dashboard.css` co-located). **Import:** `import { TippingPointDashboard } from "@/features/tipping-point"`.
- **Why:** Keeps the hackathon mosaic out of generic `components/` so pulls that add pipelines, APIs, or other apps rarely touch the same paths. Prefer editing this folder (and shared `lib/` types/data) for dashboard work.
- **Pulling / rebasing:** Fetch and merge or rebase `main` often; if Git reports conflicts, they are usually in `app/src/app/api/portfolio-data/`, `dashboard-ui/`, or routes — resolve shared data first, then re-run `npm run build` in `app/`.

### Local dev (agents — do not ask the user to run the server)

When changing or verifying the **Next app** (`app/`), **start the dev server yourself** from `app/`: `npm run dev -- -p 3000` (background if needed), wait until it is **Ready**, then **`curl` the homepage** (expect `200`).

**Cursor browser — always navigate (mandatory):** The embedded browser **does not auto-reload** on file saves. **Every time** you start/restart dev **or** finish a batch of UI/route/style/API work under `app/`, you **must** call MCP **`cursor-ide-browser`** → **`browser_navigate`** to **`http://localhost:3000/`** so the user sees the current app in Cursor. If the first navigation stays on `about:blank`, call **`browser_navigate` again** with the **`viewId`** from the tool metadata. Optionally also `open http://localhost:3000` on macOS for the system browser — that does not replace the Cursor step.

After edits, **re-check the terminal** for “Compiled” / errors. The revenue chart shows **loading** while fetching; if filings are missing or the request fails, the **chart block is omitted** (no error strip). Do not instruct the user to run `npm run dev` unless they explicitly prefer to. If port 3000 is busy, stop the old process first; use `npm run dev:clean` if the cache is corrupted.

## Vercel MCP (required for agent work on deploys and platform tasks)

This workspace registers the official **Vercel MCP** in `.cursor/mcp.json` (`https://mcp.vercel.com`).

When you work on anything involving **Vercel projects, deployments, domains, build or runtime logs, or Vercel documentation**, use the **Vercel MCP tools** first (e.g. list projects, get deployment, build logs, runtime logs, search docs). Do not guess platform behavior if the MCP can return current facts.

If the user has not completed OAuth, tell them once: open Cursor MCP settings, select the `vercel` server, and finish **Needs login** so tools are available.

## Debugging (read the terminal)

When diagnosing **Next.js dev**, **API routes**, or **“Internal Server Error” / invalid JSON** in the browser:

1. **Read terminal output** — Cursor mirrors running terminals under `~/.cursor/projects/<workspace-folder>/terminals/*.txt` (path matches your machine; newest files usually have the latest errors). Use `ls -lt` on that folder or open the Terminal panel in Cursor.
2. **Look for** stack traces at the **end** of the file: `ENOENT` under `app/.next/server`, missing `*.js` chunks, or failed `fetch` to external APIs.
3. **Default dev is Webpack** (`npm run dev`) for steadier HMR than Turbopack in this repo. Use `npm run dev:turbo` only if you want Turbopack. After mysterious `ENOENT` / manifest errors during edits: **stop dev**, then `npm run dev:clean` from `app/`.
4. **Run a single dev server** on port 3000. Do not delete `app/.next` while `next dev` is running (agents and users should stop the server first, then clean).
5. **Monorepo tracing**: `next.config.mjs` only sets `outputFileTracingRoot` when `NEXT_OUTPUT_FILE_TRACING_ROOT=1` (e.g. CI). Local dev leaves it off to reduce dev-cache races.
6. **Page looks like raw HTML (no layout/CSS)** — same root cause as missing chunks (`Cannot find module './331.js'`, `__webpack_modules__… is not a function`): the dev **webpack manifest** under `app/.next` no longer matches the chunk files on disk (HMR interrupted, crash, two `next dev` processes, or deleting `.next` while dev is running). Styles are loaded as chunks too, so the UI can look “unstyled.” **Fix:** stop **every** `next dev`, `rm -rf app/.next`, start **one** server on port 3000 (`npm run dev -- -p 3000`), hard-refresh the browser. Do not delete `.next` while the server is running.

Agents should **actually read** those files (or run a short shell command to tail them) instead of guessing when the user reports server-side failures.
