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
exec vercel deploy --prod --yes --token "$VERCEL_TOKEN" "$@"
