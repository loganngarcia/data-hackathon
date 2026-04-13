#!/usr/bin/env bash
# Loads VERCEL_TOKEN from .env.local (gitignored) and runs Vercel CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env.local ]]; then
  echo "Missing app/.env.local — copy from .env.local.example and set VERCEL_TOKEN." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source ./.env.local
set +a
if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is empty after sourcing .env.local." >&2
  exit 1
fi

SCOPE="loganngarcias-projects"
VANITY="nonprofit-ai-data.vercel.app"
PROD_SLOT="app-sigma-lilac-76.vercel.app"

vercel deploy --prod --yes --token "$VERCEL_TOKEN" "$@"
# Keep the hackathon vanity URL on the same deployment as the project’s production slot.
vercel alias set "$PROD_SLOT" "$VANITY" --token "$VERCEL_TOKEN" -S "$SCOPE"
