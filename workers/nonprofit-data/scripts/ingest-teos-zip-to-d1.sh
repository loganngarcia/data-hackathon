#!/usr/bin/env bash
# Download an IRS TEOS 990 XML zip, extract, ingest into remote D1 in chunks (low peak memory).
#
# Usage (from workers/nonprofit-data/):
#   ./scripts/ingest-teos-zip-to-d1.sh 'https://apps.irs.gov/.../2026_TEOS_XML_01A.zip' 150
#
# Resume after a network blip (skip already-ingested *XML file* offset; third arg):
#   ./scripts/ingest-teos-zip-to-d1.sh '…same url…' 150 9900
#
# Args:
#   $1  ZIP URL (required)
#   $2  XML files per parser batch (default 150) — scans this many files per chunk, only full Form 990 rows go to D1
#   $3  resume: skip first N sorted XML paths (default 0). Reuses cached zip + extract if present.
#
# Requires: curl, unzip, wrangler logged in; D1 schema for irs990_xml_* already applied.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

URL="${1:?Usage: $0 <zip-url> [chunk_size] [resume_skip_xml_offset]}"
CHUNK="${2:-150}"
RESUME_SKIP="${3:-0}"
CACHE="${ROOT}/.cache/teos"
mkdir -p "$CACHE"

NAME="$(basename "$URL" .zip)"
ZIP_PATH="${CACHE}/${NAME}.zip"
EXTRACT_DIR="${CACHE}/${NAME}_extracted"

echo "==> Download: $URL"
if [[ ! -f "$ZIP_PATH" ]]; then
  curl -fsSL --retry 3 --retry-delay 2 -o "$ZIP_PATH" "$URL"
else
  echo "    (using cached $ZIP_PATH)"
fi

if [[ "${RESUME_SKIP}" -gt 0 ]]; then
  echo "==> Resume: skip ${RESUME_SKIP} XML file(s) (reusing extract if present)"
  if [[ ! -d "$EXTRACT_DIR" ]] || [[ $(find "$EXTRACT_DIR" -name '*.xml' -type f 2>/dev/null | wc -l | tr -d ' ') -eq 0 ]]; then
    echo "    No extracted XML at $EXTRACT_DIR — unzip once without resume arg." >&2
    exit 1
  fi
else
  echo "==> Unzip → $EXTRACT_DIR"
  rm -rf "$EXTRACT_DIR"
  mkdir -p "$EXTRACT_DIR"
  unzip -q -o "$ZIP_PATH" -d "$EXTRACT_DIR"
fi

TOTAL=$(find "$EXTRACT_DIR" -name '*.xml' -type f | wc -l | tr -d ' ')
if [[ "${TOTAL:-0}" -eq 0 ]]; then
  echo "No XML found under $EXTRACT_DIR" >&2
  exit 1
fi

echo "==> Total XML files: $TOTAL (chunk=$CHUNK; full Form 990 only; TEOS mixes 990PF/990EZ)"

SKIP="${RESUME_SKIP}"
BATCH=$(( RESUME_SKIP / CHUNK ))
while [[ "$SKIP" -lt "$TOTAL" ]]; do
  BATCH=$((BATCH + 1))
  OUT="${CACHE}/${NAME}_skip${SKIP}_chunk${CHUNK}.sql"
  echo "==> Batch $BATCH: skip=$SKIP limit=$CHUNK → $OUT"
  node scripts/parse-irs990-xml.mjs --dir "$EXTRACT_DIR" --skip "$SKIP" --limit "$CHUNK" --continue-on-error > "$OUT"
  if [[ ! -s "$OUT" ]]; then
    echo "    (no full Form 990 SQL this chunk; continuing)"
    SKIP=$((SKIP + CHUNK))
    continue
  fi
  echo "==> D1 execute (remote)…"
  attempt=1
  until wrangler d1 execute nonprofit-990 --remote --file="$OUT"; do
    attempt=$((attempt + 1))
    if [[ "$attempt" -gt 5 ]]; then
      echo "D1 upload failed after 5 tries. Resume with: $0 '$URL' $CHUNK $SKIP" >&2
      exit 1
    fi
    echo "    (retry $attempt in 8s…)" >&2
    sleep 8
  done
  SKIP=$((SKIP + CHUNK))
done

echo "==> Done. Scanned $TOTAL XML file(s) from $NAME (started at resume offset ${RESUME_SKIP})."
