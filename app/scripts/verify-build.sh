#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

pass=0
fail=0

echo "========================================"
echo " Build Verification"
echo "========================================"
echo ""

# 1. Next.js build
echo "--- npm run build ---"
if npm run build > /dev/null 2>&1; then
  echo "PASS: build"
  ((pass++))
else
  echo "FAIL: build"
  ((fail++))
fi

# 2. TypeScript type-check
echo "--- npx tsc --noEmit ---"
if npx tsc --noEmit > /dev/null 2>&1; then
  echo "PASS: tsc --noEmit"
  ((pass++))
else
  echo "FAIL: tsc --noEmit"
  ((fail++))
fi

# 3. Linter
echo "--- npm run lint ---"
if npm run lint > /dev/null 2>&1; then
  echo "PASS: lint"
  ((pass++))
else
  echo "FAIL: lint"
  ((fail++))
fi

# Summary
echo ""
echo "========================================"
echo " Summary: $pass passed, $fail failed"
echo "========================================"

if [ "$fail" -gt 0 ]; then
  exit 1
fi
