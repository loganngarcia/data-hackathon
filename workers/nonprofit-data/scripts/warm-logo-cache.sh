#!/usr/bin/env bash
# Populate D1 org_logo_cache via POST /api/logo-cache-warm (requires ADMIN_KEY).
# Optional: LOGO_DEV_SECRET_KEY on the Worker (wrangler secret put) for orgs with no website_txt.
set -euo pipefail
BASE="${NONPROFIT_WORKER_URL:-https://nonprofit-data.logangarcia102.workers.dev}"
LIMIT="${1:-2000}"
: "${ADMIN_KEY:?Set ADMIN_KEY (same as wrangler secret ADMIN_KEY for this Worker)}"
curl -sS -X POST "${BASE%/}/api/logo-cache-warm?limit=${LIMIT}" \
  -H "X-Admin-Key: ${ADMIN_KEY}"
