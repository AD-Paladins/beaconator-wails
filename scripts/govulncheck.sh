#!/bin/bash
set -euo pipefail
echo "=== Go Vulnerability Check ==="
cd "$(dirname "$0")/.."
govulncheck ./...
