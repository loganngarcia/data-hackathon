#!/usr/bin/env bash
# Full production deploy: Cloudflare Worker first, then Vercel (Next.js).
# Requires app/.env.local with CLOUDFLARE_API_TOKEN and VERCEL_TOKEN.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/.." && pwd)"
WORKER_DIR="$REPO_ROOT/workers/nonprofit-data"

if [[ ! -f "$APP_DIR/.env.local" ]]; then
  echo "Missing app/.env.local — copy from .env.local.example and set tokens." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env.local"
set +a

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is empty. Add it to app/.env.local (API token with Workers Scripts:Edit)." >&2
  exit 1
fi
if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is empty. Add it to app/.env.local." >&2
  exit 1
fi

echo "==> Cloudflare Worker (workers/nonprofit-data)"
(cd "$WORKER_DIR" && npm ci && npx wrangler deploy)

echo "==> Vercel (app/)"
cd "$APP_DIR"
bash scripts/vercel-deploy.sh "$@"
