#!/bin/bash
set -euo pipefail
echo "=== Go Security Lint ==="
cd "$(dirname "$0")/.."
gosec -quiet -confidence medium ./...
