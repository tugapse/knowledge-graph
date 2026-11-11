#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${SCRIPT_DIR}/server${PYTHONPATH:+:${PYTHONPATH}}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    echo "Knowledge Graph Runner"
    echo ""
    echo "Usage:"
    echo "  ./run.sh [python args...]"
    echo ""
    echo "Examples:"
    echo "  ./run.sh -k ./knowledge -d ./docs                    # serve (builds the client if needed)"
    echo "  ./run.sh -k ./knowledge -d ./docs --rebuild-client   # serve after a fresh npm run build"
    echo "  ./run.sh -k ./knowledge -d ./docs -b ./dist/site     # npm run build + static bundle"
    echo ""
    "${PYTHON_ENTRY:-python3}" "$SCRIPT_DIR/server/main.py" --help
    exit 0
fi

exec "${PYTHON_ENTRY:-python3}" "$SCRIPT_DIR/server/main.py" "$@"
