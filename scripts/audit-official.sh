#!/bin/bash
# pnpm audit using official npm registry (bypasses Huawei Cloud mirror)
# Usage: bash scripts/audit-official.sh
#
# P-013 fix: Huawei Cloud npm mirror doesn't support audit API (405).
# This script temporarily switches to the official registry for audit.

set -euo pipefail

OFFICIAL_REGISTRY="https://registry.npmjs.org/"
ORIGINAL_REGISTRY=$(pnpm config get registry 2>/dev/null || echo "")

echo "=== pnpm audit (official registry) ==="
echo "Original registry: $ORIGINAL_REGISTRY"
echo "Switching to: $OFFICIAL_REGISTRY"
echo ""

# Run audit with official registry via --registry flag
pnpm audit --registry="$OFFICIAL_REGISTRY" --audit-level=moderate || {
  echo ""
  echo "Note: pnpm audit exited with non-zero status (vulnerabilities found or audit incomplete)."
  echo "If the error is ERR_PNPM_AUDIT_BAD_RESPONSE, the mirror is still being used."
  echo "Try: npm audit --registry=$OFFICIAL_REGISTRY --audit-level=moderate"
  exit 1
}
