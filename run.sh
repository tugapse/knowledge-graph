#!/usr/bin/env bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${SCRIPT_DIR}${PYTHONPATH:+:${PYTHONPATH}}"

usage() {
    echo "Knowledge Graph Runner"
    echo ""
    echo "Usage:"
    echo "  ./run.sh [--build-minified] [python args...]"
    echo ""
    echo "Examples:"
    echo "  ./run.sh -k ./knowledge -d ./docs"
    echo "  ./run.sh --build-minified -k ./knowledge -d ./docs -b ./dist -r ai"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Check if the first argument is --build-minified
if [[ "${1:-}" == "--build-minified" ]]; then
    shift # Remove the --build-minified flag from the arguments list
    
    # Call the build-minified.sh script with the remaining arguments
    "$SCRIPT_DIR/build-minified.sh" "$@"
    exit $?
fi

# Otherwise, run the standard Python entry
PYTHON_ENTRY="${PYTHON_ENTRY:-python3}"
"$PYTHON_ENTRY" "$SCRIPT_DIR/src/main.py" "$@"