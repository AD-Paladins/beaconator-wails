#!/bin/bash
set -euo pipefail
echo "=== Full Security Check ==="
cd "$(dirname "$0")/.."
echo ""
echo "--- Go Vulnerability Check ---"
govulncheck ./...
echo ""
echo "--- Go Security Lint ---"
gosec -quiet -confidence medium ./...
echo ""
echo "--- JS Dependency Audit ---"
cd frontend && npm audit
