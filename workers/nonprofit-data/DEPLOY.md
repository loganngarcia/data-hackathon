# nonprofit-data Worker — deploy guide

## Prerequisites
- `npm install -g wrangler` (or `pnpm add -g wrangler`)
- `wrangler login`

## 1 — Create D1 database

```bash
cd workers/nonprofit-data
npm install
npm run db:create
```

Copy the `database_id` from the output into `wrangler.toml`:
```toml
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 2 — Run migrations

```bash
# local dev
npm run db:migrate

# against the remote (production) database
npm run db:migrate:remote
```

## 3 — Set secrets

```bash
wrangler secret put ADMIN_KEY
# enter a strong random string — you'll use this to trigger syncs
```

## 4 — Deploy

```bash
npm run deploy
```

The worker deploys to `https://nonprofit-data.<account>.workers.dev`.

## 5 — (Optional) Add custom domain

In `wrangler.toml`, uncomment and fill in:
```toml
[[routes]]
pattern  = "nonprofit-data.loganngarcia.com/*"
zone_name = "loganngarcia.com"
```
Then re-deploy.

## 6 — Seed the database (first sync from ProPublica)

```bash
ADMIN_KEY=your-secret curl -X POST \
  https://nonprofit-data.<account>.workers.dev/api/sync \
  -H "X-Admin-Key: $ADMIN_KEY"
```

Expected response:
```json
{"synced":[{"ein":"330103012","status":"ok"},{"ein":"680073413","status":"ok"},{"ein":"371437781","status":"ok"}],"ts":...}
```

## 7 — Wire to the Next.js app

In Vercel → Project → Settings → Environment Variables add:
```
NONPROFIT_WORKER_URL = https://nonprofit-data.<account>.workers.dev
```

The `/api/portfolio-data` route will now read from the D1 cache instead of
calling ProPublica at request time.

## Re-syncing

Run step 6 whenever you want to refresh data from ProPublica.
You can also set up a Cloudflare Cron Trigger for automated nightly syncs:

```toml
# wrangler.toml
[triggers]
crons = ["0 6 * * *"]   # 6 AM UTC daily
```

Then handle it in `src/index.ts`:
```ts
export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // same logic as handleSync but without auth check
  },
};
```
