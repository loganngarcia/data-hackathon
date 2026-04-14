#!/usr/bin/env bash
# Backfill D1: title-case org names & cities, uppercase state codes, refresh org_logo_cache.
# This repo has NO crons — run this script (or POST /api/d1-normalize in a loop) until done.
set -euo pipefail
BASE="${NONPROFIT_WORKER_URL:-https://nonprofit-data.logangarcia102.workers.dev}"
BATCH="${BATCH:-150}"
LOGO_BATCH="${LOGO_BATCH:-80}"
: "${ADMIN_KEY:?Set ADMIN_KEY}"

post() {
  curl -sS -X POST "${BASE%/}$1" -H "X-Admin-Key: ${ADMIN_KEY}" -H "Accept: application/json"
}

echo "=== organizations + irs990_xml_returns (batched) ==="
irs=0
first=1
while true; do
  if [ "$first" -eq 1 ]; then orgs_q="organizations=true"; else orgs_q="organizations=false"; fi
  first=0
  body=$(post "/api/d1-normalize?batch=${BATCH}&irsOffset=${irs}&logoOffset=0&logos=0&${orgs_q}&irs990=1")
  echo "$body" | head -c 2000
  echo
  done=$(echo "$body" | jq -r '.irs990.done // false')
  next=$(echo "$body" | jq -r '.irs990.nextOffset // empty')
  if [ "$done" = "true" ]; then
    echo "irs990 pass complete."
    break
  fi
  if [ -z "$next" ] || [ "$next" = "null" ]; then
    echo "Unexpected: no nextOffset but not done" >&2
    exit 1
  fi
  irs=$next
done

echo "=== org_logo_cache (latest filing per EIN, UPSERT) ==="
lo=0
while true; do
  body=$(post "/api/d1-normalize?batch=${LOGO_BATCH}&irsOffset=0&logoOffset=${lo}&organizations=0&irs990=0&logos=1")
  echo "$body" | head -c 2500
  echo
  done=$(echo "$body" | jq -r '.logos.done // false')
  next=$(echo "$body" | jq -r '.logos.nextOffset // empty')
  if [ "$done" = "true" ]; then
    echo "logo cache pass complete."
    break
  fi
  if [ -z "$next" ] || [ "$next" = "null" ]; then
    echo "Unexpected: logos no nextOffset" >&2
    exit 1
  fi
  lo=$next
done

echo "All D1 normalize passes finished."
