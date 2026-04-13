# Aggies Data Hackathon — frontend (`app/`)

This directory is the **Next.js 15 + TypeScript** demo for **Tipping Point**. The **main experience** (`/`) ports the **`data-hackathon-dashboard` shell**: left sidebar (chats, search, new chat, You), bottom **chat composer**, `?settings` profile sheet, and chat sessions at **`/c/[chatId]`**. The center column is the **mosaic dashboard**: on load it fetches **`/api/portfolio-data`** (ProPublica 990 extracts + **Moobu-style** 0–100 resilience scores). If that fails, it falls back to `mock-data` screener rows.

## Quick start

From **`app/`** (not the repo root):

```bash
npm install
npm run dev
```

Open the URL Next prints (often [http://localhost:3000](http://localhost:3000)). **Dev uses Webpack** by default (more stable hot reload than Turbopack here). **`npm run dev:turbo`** if you want Turbopack; **`npm run dev:clean`** if the dev server starts throwing `ENOENT` / missing manifest errors after many edits (stops, deletes `.next`, restarts). Production build:

```bash
npm run build
npm start
```

## Routes

| Route | What you get |
|--------|----------------|
| **`/`** | Full **dashboard shell** + **Tipping Point mosaic** (Overview → Highlights) + **ChatBar**. Starting a chat navigates to `/c/…`. |
| **`/c/[chatId]`** | Chat transcript + composer (same shell). Replies call **`POST /api/gemini`** when `GEMINI_API_KEY` is set. |
| **`/legacy`** | **No** chat shell — only the original **three-screen deck** (rail + workspace) for backup / judge walkthrough. |

## What lives where

| Path | Purpose |
|------|---------|
| **`src/app/(main)/layout.tsx`** | Wraps **`/`** and **`/c/*`** in **`DashboardAppShell`** (sidebar, You overlay, padding). |
| **`src/app/(main)/page.tsx`** | Home: **`HomeWithChat`** (mosaic + ChatBar). |
| **`src/app/(main)/c/[chatId]/page.tsx`** | **`ChatSessionPage`** (messages + ChatBar). |
| **`src/app/legacy/page.tsx`** | **`HackathonAppDeck`** — screener → detail → scenario + memo. |
| **`src/app/api/gemini/route.ts`** | Server proxy for Gemini (same role as `data-hackathon-dashboard/api/gemini.ts`). |
| **`src/app/api/portfolio-data/route.ts`** | ProPublica org JSON per configured EIN → **Moobu-equivalent** composite score (`src/lib/resilience-score.ts`) → screener rows + revenue facts. |
| **`src/app/api/nonprofit-filings/route.ts`** | IRS filing history points for the revenue chart (ProPublica). |
| **`src/dashboard-ui/`** | Ported UI from **`data-hackathon-dashboard`**: `LeftSidebar`, `ChatBar`, `YouSettingsOverlay`, chat persistence, etc. |
| **`src/features/tipping-point/`** | Tipping Point mosaic UI (owned slice — import **`@/features/tipping-point`**). Use **`embedded`** on the dashboard when inside the shell (hides duplicate top chrome). |
| **`src/components/legacy/hackathon-app-deck.tsx`** | Legacy deck only. |
| **`src/lib/mock-data.ts`**, **`types.ts`**, **`format-display.ts`** | Data and formatting shared by mosaic + deck. |
| **`src/features/tipping-point/tipping-point-dashboard.css`** | Mosaic layout (sections, cards) — co-located with the feature. |

## Environment

- **`GEMINI_API_KEY`** — optional; without it, new chats still open but assistant replies explain the missing key. Set in Vercel or `.env.local` for local dev.
- **`NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY`** — optional; when set, portfolio org avatars load brand logos from [Logo.dev](https://www.logo.dev/) using each org’s website domain from `mock-data` (`pk_…` publishable key). If unset, avatars fall back to initials.

## `data-hackathon-dashboard/` (original Vite package)

**`app/data-hackathon-dashboard/`** remains the **standalone Vite** copy. The Next app **reuses its components** from `src/dashboard-ui/`; you do not need to run Vite for the main hackathon UI.

## Repo root vs `app/`

The repository may contain other folders (skills, docs). **`app/`** is the frontend package: its own `package.json`, `node_modules`, and `next` commands.
